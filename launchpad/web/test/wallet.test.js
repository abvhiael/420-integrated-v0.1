import test from 'node:test';
import assert from 'node:assert/strict';
import {executionGate,submitReviewedTransaction} from '../core/wallet.js';
const ADDR=x=>'0x'+x.padStart(40,'0'),HASH=x=>'0x'+x.repeat(64);
const config={network:{chainId:'0x1a4'},registry:{
  launchpadRouterAddress:ADDR('1001'),allocationRegistryAddress:ADDR('1002'),
  crowdfundingIntegrationAddress:ADDR('1003'),arbitrationCasesAddress:ADDR('1004'),
  payRouterAddress:ADDR('1005'),approvedInputAsset:ADDR('1006')}};
const wallet={account:ADDR('a11c'),chainId:'0x1a4'},saleId=HASH('1'),payment=HASH('2');
const word=s=>String(s).replace(/^0x/,'').padStart(64,'0');
function review(kind,selector,target,args,request={}){
  const req={saleId,account:wallet.account,...request};
  return {schema:'420-launchpad-transaction-review-v1',canonical:true,kind,
    transaction:{to:config.registry[target],data:'0x'+selector+args.map(word).join(''),value:'0x0'},
    binding:{kind,account:wallet.account,chainId:wallet.chainId,saleId,request:req,preparedAt:Date.now()}};
}
const contribute=()=>review('contribute','91d216e2','allocationRegistryAddress',[saleId,42,payment],{amount:'42',paymentId:payment});
test('exact audited selector, target, value and arguments are enforced independent of the API',()=>{
  assert.equal(executionGate({config,wallet,review:contribute()}).ok,true);
  for(const mutate of [
    x=>x.transaction.data='0xdeadbeef'+x.transaction.data.slice(10),
    x=>x.transaction.data=x.transaction.data.slice(0,-2),
    x=>x.transaction.data=x.transaction.data.slice(0,74)+word(43)+x.transaction.data.slice(138),
    x=>x.transaction.to=ADDR('9999'),
    x=>x.transaction.value='0x1',
    x=>x.binding.request.paymentId=HASH('3'),
    x=>x.binding.account=ADDR('9999'),
    x=>x.binding.preparedAt=Date.now()-121000,
    x=>x.binding.kind='claim'
  ]){
    const r=contribute();mutate(r);
    assert.equal(executionGate({config,wallet,review:r}).ok,false);
  }
  assert.equal(executionGate({config,wallet:{...wallet,chainId:'0x1'},review:contribute()}).reason,'WRONG_NETWORK');
  assert.equal(executionGate({config,wallet,review:{...contribute(),canonical:false}}).reason,'CANONICAL_REVIEW_REQUIRED');
});
test('full supported participant selector map enforces canonical contexts',()=>{
  const cases=[
    ['claim','84cc9dfb','allocationRegistryAddress',[saleId,payment],{deliveryCommitment:payment}],
    ['refund','e6080b26','crowdfundingIntegrationAddress',[saleId],{}],
    ['refund','b24201a5','allocationRegistryAddress',[saleId,payment],{refundCommitment:payment}],
    ['bind-identity','b3b9e906','crowdfundingIntegrationAddress',[payment],{profileId:payment}],
    ['register-intent','558218c7','crowdfundingIntegrationAddress',[saleId,42,9],{amount:'42',nonce:'9'}],
    ['link-dispute','b528b306','crowdfundingIntegrationAddress',[saleId,payment],{caseId:payment}],
    ['publish-outcome','a7fdd8cd','crowdfundingIntegrationAddress',[saleId,wallet.account],{}],
    ['recover-unallocated','158e5e19','crowdfundingIntegrationAddress',[saleId,payment],{paymentId:payment}],
    ['reconcile-refund','5367eab9','crowdfundingIntegrationAddress',[payment],{paymentId:payment}]
  ];
  for(const [kind,selector,target,args,req] of cases){
    const r=review(kind,selector,target,args,req);
    assert.equal(executionGate({config,wallet,review:r}).ok,true,kind+': '+executionGate({config,wallet,review:r}).reason);
  }
});
test('approval calldata and conversion checkout are quote-bound',()=>{
  const quote={saleId,amount:'42',nonce:'9',marketId:payment,inputAsset:config.registry.approvedInputAsset,
    maxInput:'50',minOutput:'42',source:{at:200},expiresAt:220,approveRequired:true,canPay:true,
    approval:{spender:ADDR('4444'),amount:'50'},transaction:{to:config.registry.payRouterAddress,
      data:'0xa6db208d'+Array.from({length:10},(_,i)=>word(i)).join('')}};
  const req={amount:'42',nonce:'9',marketId:payment,inputAsset:quote.inputAsset,maxInput:'50',minOutput:'42'};
  const approval=review('approve-conversion','095ea7b3','approvedInputAsset',[quote.approval.spender,50],req);
  approval.binding.quote=quote;
  assert.equal(executionGate({config,wallet,review:approval}).ok,true);
  const paymentReview=review('pay-conversion','a6db208d','payRouterAddress',Array.from({length:10},(_,i)=>i),req);
  paymentReview.binding.quote=quote;
  assert.equal(executionGate({config,wallet,review:paymentReview}).ok,true);
  quote.maxInput='99';
  assert.equal(executionGate({config,wallet,review:paymentReview}).ok,false);
});
test('wallet rechecks session after fresh review and refuses changed account, chain and review',async()=>{
  const r=contribute();let sent=false;
  const ethereum={request:async ({method,params})=>{
    if(method==='eth_chainId')return wallet.chainId;
    if(method==='eth_accounts')return [wallet.account];
    if(method==='eth_sendTransaction'){sent=true;assert.deepEqual(params[0],{from:wallet.account,to:r.transaction.to,data:r.transaction.data,value:'0x0'});return '0xtx';}
  }};
  assert.equal(await submitReviewedTransaction({ethereum,config,wallet,review:r,revalidate:async()=>{}}),'0xtx');
  assert.equal(sent,true);
  sent=false;
  await assert.rejects(()=>submitReviewedTransaction({ethereum,config,wallet,review:r,revalidate:async()=>{r.binding.preparedAt=0;}}),/STALE_TRANSACTION_REVIEW/);
  assert.equal(sent,false);
  for(const wrong of [{eth_chainId:'0x1',eth_accounts:[wallet.account]},{eth_chainId:wallet.chainId,eth_accounts:[ADDR('9999')]}]){
    const altered={request:async({method})=>method==='eth_sendTransaction'?(sent=true):wrong[method]};
    await assert.rejects(()=>submitReviewedTransaction({ethereum:altered,config,wallet,review:contribute()}),/WALLET_SESSION_CHANGED/);
    assert.equal(sent,false);
  }
});
