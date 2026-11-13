import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from '../../extension/vendor/ethers-6.17.0.min.js';
import {normalizeFinanceProvider420,verifyFinanceDeployment420,quoteFinanceRoutes420,
 financeQuoteIdentity420,buildFinanceSwapCall420,readFinanceAllowance420,
 financeApprovalCall420,financeBridgeCall420,bridgeReceiptEvidence420,bridgeDestinationEvidence420,FINANCE_TRANSFER_ABI_420,
 bridgeStage420,readFinanceValidator420,FINANCE_ROUTER_ABI_420,FINANCE_BRIDGE_ABI_420,
 FINANCE_STAKE_ABI_420} from '../../extension/core/finance420.js';
import {financeRaw420,financeProviderCatalog420,financeOptions420,financePrepare420,
 assertFinanceReview420,financeStakeStatus420} from '../../extension/core/finance-runtime420.js';
const ADDRESS=n=>'0x'+n.toString(16).padStart(40,'0');
const ID=n=>'0x'+n.toString(16).padStart(64,'0');
const CHAIN='0x1a4',CODE='0x6001600055',HASH=keccak256(CODE);
const router=ADDRESS(100),spender=ADDRESS(101),tokenIn=ADDRESS(102),tokenOut=ADDRESS(103);
const account=ADDRESS(104),smartAccount=ADDRESS(105),destination=ADDRESS(106);
const ex=new Interface(FINANCE_ROUTER_ABI_420),bridge=new Interface(FINANCE_BRIDGE_ABI_420),stake=new Interface(FINANCE_STAKE_ABI_420);
const providerRaw={id:'420exchange:main',label:'420Exchange',kind:'420exchange',releaseApproved:true,
 chainId:CHAIN,router,codeHash:HASH,spender,spenderCodeHash:HASH,tokenIn,tokenOut,marketId:ID(42),
 routes:[{id:ID(1),data:'0x',name:'Canonical A'},{id:ID(2),data:'0x',name:'Canonical B'}]};
function mockRpc({allowance=2000000n,revert=false,impact=175n}={}){
 const calls=[];
 const provider={async request(method,params){
  calls.push({method,params});
  if(method==='eth_getCode')return CODE;
  if(method==='eth_call'){
   const data=params[0].data||'0x';
   if(data.startsWith(ex.getFunction('quoteExactInput').selector)){
     if(revert)throw new Error('No canonical swap liquidity');
     const args=ex.decodeFunctionData('quoteExactInput',data);
     const out=args.routeId.toLowerCase()===ID(1)?950000n:1000000n;
     return ex.encodeFunctionResult('quoteExactInput',[tokenOut,out,impact]);
   }
   if(data.startsWith('0xdd62ed3e'))return '0x'+allowance.toString(16).padStart(64,'0');
   return '0x';
  }
  throw Error('Unexpected '+method);
 }};
 return {provider,calls};
}
const makeState=(payer=account)=>({
 network:{status:'matched',expectedChainId:CHAIN},
 selectedAccount:account,account:{controller:account,kind:payer===account?'eoa':'smart',smartAccount:payer},
 portfolio:{tokens:[{address:tokenIn,verified:true,hidden:false,spam:false,decimals:6,
  balance:{status:'spendable',spendable:'8000000'}}]}
});
test('raw units reject scientific and fractional dust, preserving token precision',()=>{
 assert.equal(financeRaw420('1.234567',6),'1234567');
 for(const x of ['1e9','0','-1','1.2345678','.5','1,000','NaN'])
   assert.throws(()=>financeRaw420(x,6));
});
test('approved provider must bind exact chain, deployed router and spender bytecode',async()=>{
 const p=normalizeFinanceProvider420(providerRaw,CHAIN);
 assert.equal(p.router,router);
 const {provider}=mockRpc();
 await verifyFinanceDeployment420(provider,p);
 for(const changes of [
   {releaseApproved:false},{chainId:'0x1'},{tokenIn:tokenOut},{routes:[]},
 ])assert.throws(()=>normalizeFinanceProvider420({...providerRaw,...changes},CHAIN));
 await assert.rejects(()=>verifyFinanceDeployment420({request:async()=> '0x6001600056'},p),/code hash/);
 const mismatched=normalizeFinanceProvider420({...providerRaw,codeHash:ID(3)},CHAIN);
 await assert.rejects(()=>verifyFinanceDeployment420(provider,mismatched),/code hash/);
});
test('swap route comparison uses canonical on-chain output and enforces slippage',async()=>{
 const p=normalizeFinanceProvider420(providerRaw,CHAIN);
 const {provider}=mockRpc();
 const routes=await quoteFinanceRoutes420(provider,p,{account,amountRaw:'1200000',slippageBps:50});
 assert.equal(routes.length,2);
 assert.equal(routes[0].routeId,ID(2));
 assert.equal(routes[0].outputRaw,'1000000');
 assert.equal(routes[0].minimumRaw,'995000');
 assert.equal(routes[0].impactBps,175);
 const built=buildFinanceSwapCall420(p,routes[0]);
 const args=ex.decodeFunctionData('swapExactInput',built.data);
 assert.equal(args.minAmountOut,995000n);
 assert.equal(args.recipient.toLowerCase(),account);
 assert.throws(()=>buildFinanceSwapCall420(p,{...routes[0],routeId:ID(9)}),/Unapproved/);
 for(const bps of [0,501,1.1])await assert.rejects(()=>quoteFinanceRoutes420(provider,p,{account,amountRaw:'1',slippageBps:bps}));
 const missing=await quoteFinanceRoutes420(mockRpc({revert:true}).provider,p,{account,amountRaw:'100',slippageBps:50});
 assert.equal(missing.length,0);
});
test('finance options cannot invent liquidity or spend unverified assets',async()=>{
 const state=makeState(),config={financeProviders:[providerRaw]};
 const {provider}=mockRpc();
 const results=await financeOptions420({provider,config,state,kind:'swap',amountInput:'1.2',slippageBps:50});
 assert.equal(results.length,2);assert.equal(results[0].inputRaw,'1200000');
 const blank=await financeOptions420({provider,config:{financeProviders:[]},state,kind:'swap',amountInput:'1.2'});
 assert.deepEqual(blank,[]);
 const unverified=structuredClone(state);unverified.portfolio.tokens[0].verified=false;
 assert.deepEqual(await financeOptions420({provider,config,state:unverified,kind:'swap',amountInput:'1.2'}),[]);
 const smart=makeState(smartAccount);
 const s=await financeOptions420({provider,config,state:smart,kind:'swap',amountInput:'1.2'});
 assert.equal(s[0].account,smartAccount);
});
test('finance approval requires exact spender and amount, and review is invalidated by changes',async()=>{
 const p=normalizeFinanceProvider420(providerRaw,CHAIN),config={financeProviders:[providerRaw]};
 const {provider}=mockRpc({allowance:0n}),state=makeState();
 const [option]=await financeOptions420({provider,config,state,kind:'swap',amountInput:'1',slippageBps:50});
 const feeQuote=async()=>({chainId:CHAIN,nonce:'0x1',blockHash:ID(55),gasLimit:'0x5208'});
 const prepared=await financePrepare420({provider,config,state,option,feeQuote});
 assert.equal(prepared.phase,'allowance');
 assert.equal(prepared.call.to,tokenIn);
 const ap=new Interface(['function approve(address,uint256)']);
 const [spenderArg,amountArg]=ap.decodeFunctionData('approve',prepared.call.data);
 assert.equal(spenderArg.toLowerCase(),spender);
 assert.equal(amountArg,1000000n);
 assertFinanceReview420(prepared,prepared);
 assert.throws(()=>assertFinanceReview420(prepared,{...prepared,spender:ADDRESS(7)}),/changed/);
 assert.throws(()=>assertFinanceReview420(prepared,{...prepared,fee:{nonce:'0x2'}}),/changed/);
 assert.throws(()=>financeApprovalCall420(tokenIn,account,spender,'0'),/Amount exceeds supported/);
});
test('finance execution needs live allowance and never trusts changed quote',async()=>{
 const config={financeProviders:[providerRaw]},state=makeState(),{provider}=mockRpc();
 const [option]=await financeOptions420({provider,config,state,kind:'swap',amountInput:'1'});
 const feeQuote=async()=>({chainId:CHAIN,nonce:'0x1',blockHash:ID(55)});
 const ready=await financePrepare420({provider,config,state,option,feeQuote});
 assert.equal(ready.phase,'execute');
 assert.equal(ready.call.to,router);
 await assert.rejects(()=>financePrepare420({provider,config,state,option:{...option,outputRaw:'999'},feeQuote}),/changed|Invalid slippage boundary/);
 await assert.rejects(()=>financePrepare420({provider,config,state:{...state,selectedAccount:ADDRESS(99)},option,feeQuote}),/payer or network changed/);
});
test('canonical bridge route binds source/destination, spender, fees and recipient without claiming delivery',()=>{
 const p=normalizeFinanceProvider420({id:'bridge1',label:'420Bridge',kind:'420bridge',
  releaseApproved:true,chainId:CHAIN,router,codeHash:HASH,spender,spenderCodeHash:HASH,
  adapterId:ID(4),routeId:ID(5),assetId:ID(6),asset:tokenIn,
  destinationChainId:'0x1',destinationRouter:ADDRESS(200),destinationCodeHash:HASH,
  destinationRegistry:ADDRESS(201),destinationRegistryCodeHash:HASH,destinationAdapterId:ID(4),
  recipientEncoding:'evm20',networkFeeWei:'100',extra:'0x'},CHAIN);
 const tx=financeBridgeCall420(p,{account,recipient:destination,amountRaw:'123'});
 assert.equal(tx.to,router);assert.equal(tx.value,'0x64');
 const args=bridge.decodeFunctionData('initiateOutbound',tx.data);
 assert.equal(args.adapterId,ID(4));
 assert.equal(args.amount,123n);
 assert.throws(()=>financeBridgeCall420(p,{account,recipient:'0x1',amountRaw:'123'}),/address/);
 assert.throws(()=>normalizeFinanceProvider420({...p,destinationChainId:CHAIN},CHAIN),/must differ/);
});
test('source bridge evidence demands canonical source receipt and exactly one event',()=>{
 const e=bridge.encodeEventLog(bridge.getEvent('OutboundInitiated'),[ID(5),ID(4),ID(77)]);
 const receipt={status:'0x1',blockHash:ID(9),transactionHash:ID(10),
  blockNumber:'0x20',logs:[{address:router,topics:e.topics,data:e.data}]};
 const proof=bridgeReceiptEvidence420({receipt,router,routeId:ID(5),adapterId:ID(4)});
 assert.equal(proof.sourceMessageId,ID(77));assert.equal(proof.state,'source-included');
 assert.throws(()=>bridgeReceiptEvidence420({...{receipt:{...receipt,logs:[]}},router,routeId:ID(5),adapterId:ID(4)}),/Exactly one/);
 assert.throws(()=>bridgeStage420('source-submitted','destination-finalized'),/Invalid/);
 assert.equal(bridgeStage420('source-included','source-finalized'),'source-finalized');
});
test('destination proof requires exact gateway event, transfer registry source binding and deployment',async()=>{
 const destinationRouter=ADDRESS(200),destinationRegistry=ADDRESS(201),policy={
   destinationRouter,destinationCodeHash:HASH,destinationRegistry,destinationRegistryCodeHash:HASH,
   destinationAdapterId:ID(4),routeId:ID(5),assetId:ID(6)
 };
 const iface=new Interface(FINANCE_TRANSFER_ABI_420);
 const log=bridge.encodeEventLog(bridge.getEvent('InboundAccepted'),[ID(88),ID(4)]);
 const receipt={status:'0x1',transactionHash:ID(90),blockHash:ID(91),blockNumber:'0x40',
   logs:[{address:destinationRouter,topics:log.topics,data:log.data}]};
 const transfer=[ID(5),ID(6),account,destination,123n,ID(80),ID(77),7,100,101];
 const mock={request:async(method,params)=>{
   if(method==='eth_getCode')return CODE;
   if(method==='eth_call')return iface.encodeFunctionResult('transfers',transfer);
   throw Error(method);
 }};
 const evidence=await bridgeDestinationEvidence420({provider:mock,policy,receipt,
   source:{sourceMessageId:ID(77)},expected:{sender:account,recipient:destination,amountRaw:'123'}});
 assert.equal(evidence.state,'inbound-accepted');
 assert.equal(evidence.transferId,ID(88));
 assert.equal(evidence.beneficiaryPaid,false);
 await assert.rejects(()=>bridgeDestinationEvidence420({provider:mock,policy,receipt,
   source:{sourceMessageId:ID(78)},expected:{sender:account,recipient:destination,amountRaw:'123'}}),/source message/);
 await assert.rejects(()=>bridgeDestinationEvidence420({provider:mock,policy,receipt,
   source:{sourceMessageId:ID(77)},expected:{sender:account,recipient:ADDRESS(300),amountRaw:'123'}}),/recipient or amount/);
 await assert.rejects(()=>bridgeDestinationEvidence420({provider:mock,policy:{...policy,destinationCodeHash:ID(100)},receipt,
   source:{sourceMessageId:ID(77)},expected:{sender:account,recipient:destination,amountRaw:'123'}}),/code hash/);
});
test('genesis 420Stake refuses public delegation and returns only validator evidence',async()=>{
 const raw={id:'stake',label:'420Stake',kind:'420stake',releaseApproved:true,chainId:CHAIN,
  router,codeHash:HASH};
 const iface=stake,p=normalizeFinanceProvider420(raw,CHAIN);
 const provider={async request(method,params){
  if(method==='eth_getCode')return CODE;
  if(method==='eth_call'){
   const sel=params[0].data.slice(0,10);
   if(sel===iface.getFunction('delegationEnabled').selector)return iface.encodeFunctionResult('delegationEnabled',[false]);
   if(sel===iface.getFunction('stakeWeightedVotingEnabled').selector)return iface.encodeFunctionResult('stakeWeightedVotingEnabled',[false]);
   if(sel===iface.getFunction('validatorStatus').selector)return iface.encodeFunctionResult('validatorStatus',[3]);
   if(sel===iface.getFunction('validatorBondComposition').selector)return iface.encodeFunctionResult('validatorBondComposition',[21000n,21000n,42000n,0n]);
   if(sel===iface.getFunction('validatorRewardAccrued').selector)return iface.encodeFunctionResult('validatorRewardAccrued',[42n]);
  }
  throw Error('Unsupported');
 }};
 const record=await readFinanceValidator420(provider,p,ID(50));
 assert.equal(record.effectiveBond,'42000');
 assert.equal(record.delegationEnabled,false);
 assert.equal(record.executionAvailable,false);
 const status=await financeStakeStatus420({provider,config:{financeProviders:[raw]},state:makeState(),validatorId:ID(50)});
 assert.equal(status.rewardAccrued,'42');
});
