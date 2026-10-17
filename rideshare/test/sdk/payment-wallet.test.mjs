import test from 'node:test';
import assert from 'node:assert/strict';
import {createSdk420,createWalletSdk420} from '../../../packages/420-sdk/dist/index.js';
import {derivePaymentId,directSettlementCall,digest,prepareWalletPayment} from '../../src/payment-protocol.mjs';
const a=n=>'0x'+n.toString(16).padStart(40,'0'),h=n=>'0x'+n.toString(16).padStart(64,'0');
function setup(patch={}){
 const entries=['SmartAccountFactory420','CapabilityRegistry420','PaymentRouter420'].map((name,i)=>({name,address:a(421+i),verified:true}));
 const contracts={chainId:420n,chainIdDecimal:'420',get:name=>entries.find(e=>e.name===name),list:()=>entries};
 const network={chainId:420n,chainIdDecimal:'420',rpc:{http:['http://127.0.0.1:8545']},service:()=>null};
 const sdk=createSdk420({network,contracts,transport:{request:async()=>null}});let prepared=0,sent=0;
 const provider={request:async method=>method==='eth_chainId'?(patch.chain??'0x1a4'):[patch.controller??a(1)]};
 const adapter={discoverSmartAccount:async()=>({controller:a(1),smartAccount:patch.account??a(500),deployed:true,factoryAddress:a(421),capabilityRegistry:a(422)}),prepareSessionUserOperation:async(_,account,key,request)=>{prepared++;return{account,key,request};},sendPreparedSessionUserOperation:async()=>{sent++;},confirmSessionUserOperation:async()=>{sent++;}};
 const wallet=createWalletSdk420({sdk,provider,adapter});const intent={invoiceId:h(1),payQuoteId:h(2),payerNonce:'0',payer:a(500),controller:a(1),merchant:a(5),asset:a(6),amountUnits:'1000',tipUnits:'0',target:a(423),value:'0',chainId:420,expiresAt:130};intent.paymentId=derivePaymentId(intent);intent.calldata=directSettlementCall(intent);
 return{wallet,intent,counts:()=>({prepared,sent})};
}
test('real canonical Wallet SDK prepares only exact hash-bound smart-account Pay request and never sends',async()=>{
 const x=setup();const result=await prepareWalletPayment({...x,sessionKey:a(2),consent:true,expectedIntentHash:digest(x.intent),clock:()=>100});
 assert.equal(result.account.smartAccount,x.intent.payer);assert.equal(result.request.target,x.intent.target);assert.equal(result.request.data,x.intent.calldata);assert.equal(result.request.value,'0');assert.deepEqual(x.counts(),{prepared:1,sent:0});
});
test('canonical SDK consumer rejects wrong chain/controller/account, implicit consent, expired or changed call',async()=>{
 for(const patch of [{chain:'0x1a5'},{controller:a(3)},{account:a(4)}]){const x=setup(patch);await assert.rejects(()=>prepareWalletPayment({...x,sessionKey:a(2),consent:true,expectedIntentHash:digest(x.intent),clock:()=>100}));assert.equal(x.counts().sent,0);}
 const x=setup();for(const options of [{consent:false},{expectedIntentHash:'bad'},{clock:()=>130},{intent:{...x.intent,calldata:'0xdeadbeef'}}])await assert.rejects(()=>prepareWalletPayment({...x,sessionKey:a(2),consent:true,expectedIntentHash:digest(x.intent),clock:()=>100,...options}));
});

test('PT-02 refuses chain/account switching during wallet preparation and elapsed consent',async()=>{
 const x=setup();let connects=0;
 const moved=new Proxy(x.wallet,{get(target,prop,receiver){
  if(prop==='connect')return async()=>{const result=await target.connect();return ++connects===2?{...result,chainId:421n}:result};
  return Reflect.get(target,prop,receiver);
 }});
 await assert.rejects(()=>prepareWalletPayment({wallet:moved,intent:x.intent,sessionKey:a(2),consent:true,expectedIntentHash:digest(x.intent),clock:()=>100}),{code:'INVALID_PAY_BINDING'});
 assert.equal(x.counts().sent,0);
 const y=setup();let now=100;
 const slow=new Proxy(y.wallet,{get(target,prop,receiver){
  if(prop==='prepareSession')return async(...args)=>{const result=await target.prepareSession(...args);now=131;return result};
  return Reflect.get(target,prop,receiver);
 }});
 await assert.rejects(()=>prepareWalletPayment({wallet:slow,intent:y.intent,sessionKey:a(2),consent:true,expectedIntentHash:digest(y.intent),clock:()=>now}),{code:'INVALID_PAY_BINDING'});
 assert.equal(y.counts().sent,0);
});
