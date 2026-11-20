import test from 'node:test';import assert from 'node:assert/strict';import {executionGate,submitReviewedTransaction} from '../core/wallet.js';
const config={network:{chainId:'0x1a4'},registry:{launchpadRouterAddress:'0x0000000000000000000000000000000000001001',allocationRegistryAddress:'0x0000000000000000000000000000000000001002',crowdfundingIntegrationAddress:'0x0000000000000000000000000000000000001003'}};
const wallet={account:'0x000000000000000000000000000000000000a11c',chainId:'0x1a4'};const review={canonical:true,transaction:{to:'0x0000000000000000000000000000000000001002',data:'0x1234',value:'0x0'}};
test('execution gate rejects wrong network, unresolved review, and wrong target',()=>{assert.equal(executionGate({config,wallet:{...wallet,chainId:'0x1'},review}).reason,'WRONG_NETWORK');assert.equal(executionGate({config,wallet,review:{...review,canonical:false}}).reason,'CANONICAL_REVIEW_REQUIRED');assert.equal(executionGate({config,wallet,review:{canonical:true,transaction:{...review.transaction,to:'0x0000000000000000000000000000000000009999'}}}).reason,'UNEXPECTED_TRANSACTION_TARGET');});
test('submit sends exactly the reviewed transaction',async()=>{let req;const ethereum={request:async r=>{if(r.method==='eth_chainId')return wallet.chainId;if(r.method==='eth_accounts')return [wallet.account];req=r;return '0xtx';}};assert.equal(await submitReviewedTransaction({ethereum,config,wallet,review}),'0xtx');assert.equal(req.method,'eth_sendTransaction');assert.deepEqual(req.params[0],{from:wallet.account,to:review.transaction.to,data:'0x1234',value:'0x0'});});

test('checkout and arbitration targets are authorized only when canonically resolved',()=>{
  const pay='0x000000000000000000000000000000000000f00d',
    token='0x000000000000000000000000000000000000beef',arb='0x000000000000000000000000000000000000aabb';
  for(const target of [pay,token,arb]){
    assert.equal(executionGate({config,wallet,review:{...review,transaction:{...review.transaction,to:target}}}).reason,'UNEXPECTED_TRANSACTION_TARGET');
  }
  const resolved={...config,registry:{...config.registry,payRouterAddress:pay,approvedInputAsset:token,arbitrationCasesAddress:arb}};
  for(const target of [pay,token,arb])assert.equal(executionGate({config:resolved,wallet,review:{...review,transaction:{...review.transaction,to:target}}}).ok,true);
});
test('wallet submission refuses stale account and chain even with previously accepted review',async()=>{
  for(const bad of [
    {eth_chainId:'0x999',eth_accounts:[wallet.account]},
    {eth_chainId:wallet.chainId,eth_accounts:['0x000000000000000000000000000000000000beef']}
  ]){
    let submitted=false;
    const ethereum={request:async({method})=>{if(method==='eth_sendTransaction'){submitted=true;return '0x1';}return bad[method];}};
    await assert.rejects(()=>submitReviewedTransaction({ethereum,config,wallet,review}),/WALLET_SESSION_CHANGED/);
    assert.equal(submitted,false);
  }
});
