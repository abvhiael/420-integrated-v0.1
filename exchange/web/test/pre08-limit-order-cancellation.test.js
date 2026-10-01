import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserExecutionController} from '../core/browser-execution-controller.js';
import {LimitOrderCancellationController,buildLimitOrderNonceCancelTransaction} from '../core/limit-order-cancellation-controller.js';
import {hashLimitOrder} from '../core/limit-order-identity.js';
import {functionSelector,uintWord} from '../core/abi.js';
import {WalletExecutionError} from '../core/wallet-execution.js';

const addr=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const account=addr(1),settlement=addr(9),auth=addr(10);
const order={maker:account,sellToken:addr(2),buyToken:addr(3),sellAmountRaw:'1000',minBuyAmountRaw:'500',recipient:account,marketId:'0x'+'04'.repeat(32),nonce:'7',expiry:'2000',allowPartial:true};
const orderHash=hashLimitOrder(order);
const baseRecord={schema:'420-exchange-order-status-v1',orderHash,order,state:'accepted',revision:3,remainingSellAmountRaw:'1000'};
const runtime={
  deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'},
  contracts:{ExchangeLimitOrderSettlement420:settlement,ExchangeAuthorization420:auth},
  execution:{orderSigning:'DISABLED_PRETESTNET',orderPublication:'DISABLED_PRETESTNET',orderWithdrawal:'DISABLED_PRETESTNET',orderCancellation:'DISABLED_PRETESTNET'},
};
function chainState(filled='0',overrides={}){
  return {orderHash,filledSellAmountRaw:String(filled),cancelled:false,nonceCancelled:false,nonceFloor:'0',boundHash:'0x'+'00'.repeat(32),...overrides};
}
function provider({accountValue=account,sendResult='0x'+'ab'.repeat(32),sendError=null}={}){
  const listeners=new Map(),calls=[];
  return {
    listeners,calls,on(n,cb){listeners.set(n,cb);},removeListener(n,cb){if(listeners.get(n)===cb)listeners.delete(n);},
    async request({method}){
      calls.push(method);
      if(method==='eth_requestAccounts'||method==='eth_accounts')return [accountValue];
      if(method==='eth_chainId')return '0x420';
      if(method==='eth_call')return '0x';
      if(method==='eth_estimateGas')return '0x5208';
      if(method==='eth_sendTransaction'){if(sendError)throw sendError;return sendResult;}
      throw new Error('unexpected '+method);
    },
  };
}
async function setup({wallet=provider(),record=baseRecord,states=[chainState()],statusRecord=record,lifecycleInspector,withdraw}={}){
  const browser=new BrowserExecutionController({runtime});await browser.connect({ethereum:wallet});
  let readIndex=0;
  const controller=new LimitOrderCancellationController({
    controller:browser,
    readState:async()=>states[Math.min(readIndex++,states.length-1)],
    status:async()=>statusRecord,
    withdraw:withdraw??(async()=>({idempotent:false,order:{...statusRecord,state:'cancelled',cancellation:{mode:'OFFCHAIN_WITHDRAWAL'}}})),
    lifecycleInspector:lifecycleInspector??(async()=>({rpc:{state:'FINALIZED'},indexed:{records:[{kind:'CANCELLATION'}],conflicts:[],replacementRecordIds:[],status:'CANONICAL'}})),
    submissionGate:{enabled:true,mode:'PRE08_MOCK'},withdrawalGate:{enabled:true,mode:'PRE08_MOCK'},nowSeconds:()=>1000,
  });
  return {wallet,browser,controller};
}
function confirmation(review){return {orderHash:review.orderHash,nonce:review.nonce,account:review.account,chainId:review.chainId,remainingSellAmountRaw:review.remainingSellAmountRaw};}

test('PRE-08 distinguishes maker-authorized off-chain withdrawal from on-chain cancellation',async()=>{
  let withdrawn=null;
  const env=await setup({withdraw:async args=>{withdrawn=args;return {idempotent:false,order:{...baseRecord,state:'cancelled',cancellation:{mode:'OFFCHAIN_WITHDRAWAL'}}};}});
  await env.controller.prepare({record:baseRecord,mode:'HASH'});
  env.controller.beginConfirmation();env.controller.confirm(confirmation(env.controller.review));
  const result=await env.controller.withdrawOffchain({requestId:'withdraw-browser-1'});
  assert.equal(result.state,'WITHDRAWN_OFFCHAIN');
  assert.equal(withdrawn.orderHash,orderHash);assert.equal(withdrawn.maker,account);assert.equal(withdrawn.nonce,'7');
  assert.equal(env.wallet.calls.includes('eth_sendTransaction'),false);
  env.controller.dispose();env.browser.dispose();
});

test('cancellation review binds exact order hash nonce maker chain and remaining amount',async()=>{
  const env=await setup();
  await env.controller.prepare({record:baseRecord,mode:'HASH'});
  const review=env.controller.review;
  assert.equal(review.orderHash,orderHash);assert.equal(review.nonce,'7');assert.equal(review.account,account);assert.equal(review.chainId,'0x420');assert.equal(review.remainingSellAmountRaw,'1000');
  env.controller.beginConfirmation();
  assert.throws(()=>env.controller.confirm({...confirmation(review),remainingSellAmountRaw:'999'}),e=>e.code==='CONFIRMATION_MISMATCH');
  env.controller.confirm(confirmation(review));
  env.controller.dispose();env.browser.dispose();
});

test('nonce cancellation builder is maker-only and encodes the exact reviewed nonce',()=>{
  const tx=buildLimitOrderNonceCancelTransaction({runtime,account,order});
  assert.equal(tx.request.from,account);assert.equal(tx.request.to,settlement);
  assert.equal(tx.request.data,functionSelector('cancelNonce(uint256)')+uintWord('7'));
  assert.throws(()=>buildLimitOrderNonceCancelTransaction({runtime,account:addr(8),order}),e=>e.code==='MAKER_MISMATCH');
});

test('cross-account prepare and provider switch prohibit cancellation authority',async()=>{
  const env=await setup();
  await assert.rejects(env.controller.prepare({record:{...baseRecord,order:{...order,maker:addr(8)},orderHash:hashLimitOrder({...order,maker:addr(8)})},mode:'HASH'}),e=>e.code==='MAKER_MISMATCH');
  await env.controller.prepare({record:baseRecord,mode:'HASH'});
  env.wallet.listeners.get('accountsChanged')?.([addr(8)]);
  assert.equal(env.controller.state,'INVALIDATED');
  assert.throws(()=>env.controller.beginConfirmation(),e=>e.code==='CANCELLATION_INVALIDATED');
  env.controller.dispose();env.browser.dispose();
});

test('racing fill and duplicate cancellation are detected by fresh settlement state immediately before send',async()=>{
  const race=await setup({states:[chainState('0'),chainState('400')]});
  await race.controller.prepare({record:baseRecord,mode:'HASH'});race.controller.beginConfirmation();race.controller.confirm(confirmation(race.controller.review));
  await assert.rejects(race.controller.submitOnchain(),e=>e.code==='RACING_FILL');
  assert.equal(race.wallet.calls.includes('eth_sendTransaction'),false);
  race.controller.dispose();race.browser.dispose();

  const dup=await setup({states:[chainState('0'),chainState('0',{cancelled:true})]});
  await dup.controller.prepare({record:baseRecord,mode:'HASH'});dup.controller.beginConfirmation();dup.controller.confirm(confirmation(dup.controller.review));
  await assert.rejects(dup.controller.submitOnchain(),e=>e.code==='DUPLICATE_CANCEL');
  assert.equal(dup.wallet.calls.includes('eth_sendTransaction'),false);
  dup.controller.dispose();dup.browser.dispose();
});

test('fresh state plus fresh preflight is required at the guarded on-chain send boundary',async()=>{
  const env=await setup({states:[chainState('0'),chainState('0')]});
  await env.controller.prepare({record:baseRecord,mode:'HASH'});env.controller.beginConfirmation();env.controller.confirm(confirmation(env.controller.review));
  const sent=await env.controller.submitOnchain();
  assert.equal(sent.txHash,'0x'+'ab'.repeat(32));assert.equal(env.controller.state,'SUBMITTED');
  const methods=env.wallet.calls;
  assert.ok(methods.includes('eth_call'));assert.ok(methods.includes('eth_estimateGas'));assert.ok(methods.includes('eth_sendTransaction'));
  env.controller.dispose();env.browser.dispose();
});

test('wallet rejection becomes explicit REJECTED cancellation outcome',async()=>{
  const error=Object.assign(new Error('rejected'),{code:4001});
  const env=await setup({wallet:provider({sendError:error}),states:[chainState('0'),chainState('0')]});
  await env.controller.prepare({record:baseRecord,mode:'HASH'});env.controller.beginConfirmation();env.controller.confirm(confirmation(env.controller.review));
  await assert.rejects(env.controller.submitOnchain(),e=>e instanceof WalletExecutionError&&e.code==='USER_REJECTED');
  assert.equal(env.controller.state,'REJECTED');
  env.controller.dispose();env.browser.dispose();
});

test('cancellation lifecycle models reverted replacement reorg and indexer conflict deterministically',async()=>{
  let scenario='REVERTED';
  const inspector=async()=>{
    if(scenario==='REVERTED')return {rpc:{state:'REVERTED'},indexed:{records:[],conflicts:[],replacementRecordIds:[],status:'UNINDEXED'}};
    if(scenario==='REPLACED')return {rpc:{state:'DROPPED'},indexed:{records:[],conflicts:[],replacementRecordIds:['replacement-1'],status:'REORGED'}};
    if(scenario==='REORGED')return {rpc:{state:'REORGED'},indexed:{records:[],conflicts:[],replacementRecordIds:[],status:'REORGED'}};
    if(scenario==='CONFLICT')return {rpc:{state:'FINALIZED'},indexed:{records:[{kind:'CANCELLATION'}],conflicts:['rpc-canonical-v13-reorg'],replacementRecordIds:[],status:'REORGED'}};
    return {rpc:{state:'FINALIZED'},indexed:{records:[{kind:'CANCELLATION'}],conflicts:[],replacementRecordIds:[],status:'CANONICAL'}};
  };
  const env=await setup({states:[chainState('0'),chainState('0')],lifecycleInspector:inspector});
  await env.controller.prepare({record:baseRecord,mode:'NONCE'});env.controller.beginConfirmation();env.controller.confirm(confirmation(env.controller.review));await env.controller.submitOnchain();
  assert.equal((await env.controller.observeLifecycle()).state,'REVERTED');
  scenario='REPLACED';assert.equal((await env.controller.observeLifecycle()).state,'REPLACED');
  scenario='REORGED';assert.equal((await env.controller.observeLifecycle()).state,'REORGED');
  scenario='CONFLICT';assert.equal((await env.controller.observeLifecycle()).state,'INDEXER_CONFLICTING');
  scenario='CONFIRMED';assert.equal((await env.controller.observeLifecycle()).state,'CONFIRMED');
  env.controller.dispose();env.browser.dispose();
});
