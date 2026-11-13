import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteExtensionEoa420} from '../core/extension-eoa-preflight.js';
import {resolveExtensionRecipient420,assertExtensionRecipientSnapshot420} from '../core/extension-recipient-resolver.js';
import {validateEoaReplacement420,validateUserOpReplacement420,reconcileUserOpReplacement420} from '../core/extension-replacement-policy.js';

const chainId='0x1',from='0x'+'11'.repeat(20),to='0x'+'22'.repeat(20);
const other='0x'+'33'.repeat(20),txHash='0x'+'ab'.repeat(32),opHash='0x'+'cd'.repeat(32);
function eoaProvider(overrides={}){
 const calls=[];
 return {calls,request:async(method)=>{
  calls.push(method);
  if(Object.hasOwn(overrides,method))return overrides[method];
  const values={eth_chainId:chainId,eth_call:'0x',eth_estimateGas:'0x5208',
    eth_getTransactionCount:'0x1',eth_getBlockByNumber:{hash:txHash,baseFeePerGas:'0x20'},
    eth_getBalance:'0xffffffffffffffff',eth_maxPriorityFeePerGas:'0x10'};
  if(Object.hasOwn(values,method))return values[method];
  throw Error('unexpected '+method);
 }};
}
const send={to,value:'0x100',data:'0x'};
test('preflight fails closed on reverted call; does not estimate or submit gas',async()=>{
 const p=eoaProvider({'eth_call':undefined});
 p.request=async(method)=>{p.calls.push(method);if(method==='eth_chainId')return chainId;if(method==='eth_call')throw Error('revert: recipient trap');throw Error('unexpected '+method);};
 await assert.rejects(quoteExtensionEoa420(p,{chainId,from,transaction:send,choice:{level:'standard'}}),/simulation reverted/);
 assert.equal(p.calls.includes('eth_estimateGas'),false);
});
test('preflight refuses wrong chain before call and detects changed chain after quote',async()=>{
 const wrong=eoaProvider({eth_chainId:'0x2'});
 await assert.rejects(quoteExtensionEoa420(wrong,{chainId,from,transaction:send,choice:{level:'standard'}}),/chain/i);
 assert.equal(wrong.calls.includes('eth_call'),false);
 const p=eoaProvider();
 let reads=0;
 const base=p.request;
 p.request=async(method,...args)=>method==='eth_chainId'?(++reads===1?chainId:'0x2'):base(method,...args);
 await assert.rejects(quoteExtensionEoa420(p,{chainId,from,transaction:send,choice:{level:'standard'}}),/chain/i);
});
test('EOA signing preflight rejects insufficient value-plus-fee balance and stale nonce',async()=>{
 await assert.rejects(quoteExtensionEoa420(eoaProvider({eth_getBalance:'0x1'}),{
  chainId,from,transaction:send,choice:{level:'standard'}}),/insufficient/);
 const p=eoaProvider({eth_getTransactionCount:'0x2'});
 await assert.rejects(quoteExtensionEoa420(p,{
  chainId,from,transaction:send,choice:{level:'standard'},nonceOverride:'0x1'}),/pending nonce changed/);
});
test('EOA rejects malformed calldata and unreasonable custom fee parameters before signing',async()=>{
 await assert.rejects(quoteExtensionEoa420(eoaProvider(),{
  chainId,from,transaction:{...send,data:'0x123'},choice:{level:'standard'}}),/calldata/);
 await assert.rejects(quoteExtensionEoa420(eoaProvider(),{
  chainId,from,transaction:send,choice:{level:'custom',maxFeePerGas:'0x1',maxPriorityFeePerGas:'0x1'}}),/fee caps/);
});
test('recipient resolver fails closed on malicious, unsupported or changed name',async()=>{
 const p={request:async method=>method==='eth_chainId'?chainId:'0x'};
 for(const input of ['alice.eth\\u0000','ALICE.eth','alice.420','https://evil.test','0x'+'0'.repeat(40)]){
  await assert.rejects(resolveExtensionRecipient420(p,{input,chainId}));
 }
 const prior={kind:'ens',input:'alice.eth',recipient:to,chainId,resolver:other,registry:from,node:txHash};
 for(const change of [{recipient:other},{resolver:from},{chainId:'0x2'},{node:opHash}]){
  assert.throws(()=>assertExtensionRecipientSnapshot420(prior,{...prior,...change}),/changed/);
 }
});
test('EOA replacement rejects retargeting, data tampering, nonce hijack and finalized original',()=>{
 const old={executionModel:'eoa',status:'submitted',hash:txHash,chainId,from,to,value:'0x1',data:'0x',
  nonce:'0x1',maxFeePerGas:'0x64',maxPriorityFeePerGas:'0x14'};
 const candidate={...old,action:'speed-up',maxFeePerGas:'0x90',maxPriorityFeePerGas:'0x20'};
 for(const change of [{to:other},{value:'0x2'},{data:'0x1234'},{from:other},{nonce:'0x2'},
   {maxFeePerGas:'0x64'},{maxPriorityFeePerGas:'0x14'}]){
  assert.throws(()=>validateEoaReplacement420(old,{...candidate,...change}));
 }
 assert.throws(()=>validateEoaReplacement420({...old,status:'confirmed'},candidate),/unfinalized/);
 assert.throws(()=>validateEoaReplacement420(old,{...candidate,action:'cancel',to:from,value:'0x1'}),/zero-value/);
});
test('UserOperation replacement cannot cross EntryPoint, nonce lane, fee cap or calldata',()=>{
 const old={executionModel:'erc4337',status:'submitted',userOpHash:txHash,chainId,sender:from,
  entryPoint:other,entryPointVersion:'0.7',nonce:'0x10000000000000005',
  nonceKey:'0x1',nonceSequence:'0x5',callData:'0xabcd',initCode:'0x',
  maxFeePerGas:'0x64',maxPriorityFeePerGas:'0x14'};
 const candidate={...old,action:'speed-up',maxFeePerGas:'0x90',maxPriorityFeePerGas:'0x20'};
 for(const change of [{nonce:'0x5'},{entryPoint:to},{sender:to},{callData:'0xdead'},
   {initCode:'0x12'},{maxFeePerGas:'0x64'},{maxPriorityFeePerGas:'0x14'},
   {entryPointVersion:'0.6'},{action:'cancel',callData:'0xdead',verifiedNoOp:false}]){
  assert.throws(()=>validateUserOpReplacement420(old,{...candidate,...change}));
 }
 assert.throws(()=>validateUserOpReplacement420({...old,status:'confirmed'},candidate),/unfinalized/);
});
test('adversarial bundler receipts cannot falsely finalize a UserOperation replacement',async()=>{
 const old={executionModel:'erc4337',status:'pending',userOpHash:txHash,chainId,sender:from,entryPoint:other,nonce:'0x5'};
 const next={executionModel:'erc4337',status:'confirmed',userOpHash:opHash,replaces:txHash,
  chainId,sender:from,entryPoint:other,nonce:'0x5',hash:'0x'+'ee'.repeat(32),action:'speed-up'};
 for(const fake of [
  {success:false,sender:from,nonce:'0x5',receipt:{transactionHash:next.hash}},
  {success:true,sender:to,nonce:'0x5',receipt:{transactionHash:next.hash}},
  {success:true,sender:from,nonce:'0x6',receipt:{transactionHash:next.hash}},
  {success:true,sender:from,nonce:'0x5',receipt:{transactionHash:txHash}}
 ]){
  const provider={request:async()=>fake};
  await assert.rejects(reconcileUserOpReplacement420(provider,old,next),/evidence/);
 }
});
