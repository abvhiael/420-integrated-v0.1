import test from 'node:test';
import assert from 'node:assert/strict';
import { qualifyLiveTestnetBridge, BridgeQualificationError } from '../core/live-bridge-qualification.js';
import { keccak256, uintWord } from '../core/abi.js';
const addr=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const tx='0x'+'ab'.repeat(32), block='0x'+'cd'.repeat(32), sourceMsg=id(123), transfer=id(321);
const sourceRuntime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'},contracts:{GatewayRouter420:addr(20),ExchangeAuthorization420:addr(21)}};
const destRuntime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x421'},contracts:{GatewayRouter420:addr(30),ExchangeAuthorization420:addr(31)}};
const execution={adapterId:id(5),routeId:id(6),assetId:id(7),recipientBytes:'0x1234',amountRaw:'100',extra:'0x',feeValueWei:'0'};
const reviewedIntent={kind:'BRIDGE_WITHDRAWAL',adapterId:id(5),routeId:id(6),exchangeAssetId:id(7)};
const checks=[{action:'BRIDGE_WITHDRAW',principal:addr(1),subjectId:id(7),amountRaw:'100'}];
function provider(chain,account,router,{revert=false,wrongEvent=false}={}){
 let send=0; const calls=[];
 return {calls,async request({method,params=[]}){
  calls.push(method);
  if(method==='eth_chainId') return chain;
  if(method==='eth_accounts') return [account];
  if(method==='eth_call') return params[0].to.toLowerCase()===addr(21)?'0x'+uintWord(1):'0x';
  if(method==='eth_estimateGas') return '0x90000';
  if(method==='eth_sendTransaction') {send++;return tx;}
  if(method==='eth_getTransactionByHash') return {hash:tx};
  if(method==='eth_getTransactionReceipt') return {transactionHash:tx,blockHash:block,blockNumber:'0xa',status:revert?'0x0':'0x1',logs:[chain==='0x420'?{address:router,topics:[keccak256('OutboundInitiated(bytes32,bytes32,bytes32)'),id(6),id(wrongEvent?99:5)],data:sourceMsg}:{address:router,topics:[keccak256('InboundAccepted(bytes32,bytes32)'),transfer,id(wrongEvent?99:8)],data:'0x'}]};
  if(method==='eth_getBlockByNumber') {if(params[0]==='0xa') return {number:'0xa',hash:block};if(params[0]==='safe'||params[0]==='finalized'||params[0]==='latest') return {number:'0xb',hash:id(1)};}
  throw Error('unexpected '+method);
 }};
}
const proofProvider=async()=>({sourceTxHash:tx,sourceMessageId:sourceMsg,destinationAdapterId:id(8),proof:'0x1234'});
const common=()=>({sourceProvider:provider('0x420',addr(1),addr(20)),destinationProvider:provider('0x421',addr(2),addr(30)),sourceRuntime,destinationRuntime,reviewedIntent,execution,sourceAuthorizationChecks:checks,destinationAdapterId:id(8),proofProvider,maxAttempts:1,pollMs:0});
test('V15.8 requires finalized source, bound external proof, and finalized destination event',async()=>{
 const options=common();const result=await qualifyLiveTestnetBridge(options);
 assert.equal(result.qualified,true);assert.equal(result.sourceMessageId,sourceMsg);assert.equal(result.destinationTransferId,transfer);
 assert.equal(result.sourceState,'FINALIZED');assert.equal(result.destinationState,'FINALIZED');
 assert.equal(options.sourceProvider.calls.includes('eth_sendTransaction'),true);
 assert.equal(options.destinationProvider.calls.includes('eth_sendTransaction'),true);
});
test('missing proof provider blocks outbound transaction',async()=>{
 const options=common();options.proofProvider=null;
 await assert.rejects(qualifyLiveTestnetBridge(options),e=>e.code==='PROOF_PROVIDER_REQUIRED');
 assert.equal(options.sourceProvider.calls.includes('eth_sendTransaction'),false);
});
test('unresolved destination blocks outbound transaction',async()=>{
 const options=common();options.destinationRuntime={...destRuntime,deployment:{environment:'testnet',status:'UNRESOLVED_UNTIL_DEPLOYMENT'}};
 await assert.rejects(qualifyLiveTestnetBridge(options),e=>e.code==='DEPLOYMENT_UNRESOLVED');
 assert.equal(options.sourceProvider.calls.includes('eth_sendTransaction'),false);
});
test('source revert prevents proof and destination submission',async()=>{
 const options=common();options.sourceProvider=provider('0x420',addr(1),addr(20),{revert:true});
 await assert.rejects(qualifyLiveTestnetBridge(options),e=>e.code==='TRANSACTION_FAILED');
 assert.equal(options.destinationProvider.calls.includes('eth_sendTransaction'),false);
});
test('unbound external proof blocks destination transaction',async()=>{
 const options=common();options.proofProvider=async()=>({...await proofProvider(),sourceMessageId:id(77)});
 await assert.rejects(qualifyLiveTestnetBridge(options),e=>e.code==='PROOF_BINDING_MISMATCH');
 assert.equal(options.destinationProvider.calls.includes('eth_sendTransaction'),false);
});
test('missing matching outbound event blocks destination transaction',async()=>{
 const options=common();options.sourceProvider=provider('0x420',addr(1),addr(20),{wrongEvent:true});
 await assert.rejects(qualifyLiveTestnetBridge(options),e=>e.code==='OUTBOUND_EVENT_MISMATCH');
 assert.equal(options.destinationProvider.calls.includes('eth_sendTransaction'),false);
});
test('mismatched destination adapter event fails final qualification',async()=>{
 const options=common();options.destinationProvider=provider('0x421',addr(2),addr(30),{wrongEvent:true});
 await assert.rejects(qualifyLiveTestnetBridge(options),e=>e.code==='INBOUND_EVENT_MISMATCH');
});
