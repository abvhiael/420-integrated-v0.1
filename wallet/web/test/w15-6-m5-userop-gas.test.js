import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExtensionUserOpGasEstimate420,estimateExtensionUserOpGas420,maxExtensionUserOpFee420} from '../core/extension-userop-gas.js';
import {quoteExtensionSend420,packExtensionUserOpFees420} from '../core/extension-fee-preflight.js';
const owner='0x'+'11'.repeat(20),entryPoint='0x'+'22'.repeat(20),recipient='0x'+'33'.repeat(20);
const chainId='0x1a4',hash='0x'+'cd'.repeat(32);
const estimate={callGasLimit:'0x186a0',verificationGasLimit:'0x30d40',preVerificationGas:'0xc350'};
const gasFees=packExtensionUserOpFees420({maxFeePerGas:'0x64',maxPriorityFeePerGas:'0x14'});
function mockProvider({wrongChain=false,missingEstimate=false,customEstimate=estimate}={}){
 const requests=[];
 return {
  requests,
  request:async(method,params)=>{
   requests.push({method,params});
   if(method==='eth_chainId')return wrongChain?'0x1':chainId;
   if(method==='eth_call')return params[0].data.startsWith('0xd86f2b3c')?'0x'+'0'.repeat(64):'0x';
   if(method==='eth_getBlockByNumber')return {baseFeePerGas:'0x20',hash};
   if(method==='eth_maxPriorityFeePerGas')return '0x14';
   if(method==='eth_estimateGas')return '0x5208';
   if(method==='eth_estimateUserOperationGas'){
     if(missingEstimate)throw Error('no supported bundler');
     return customEstimate;
   }
   throw Error('unexpected '+method);
  },
 };
}
test('bundler call/verification/preVerification estimates are padded and packed correctly',()=>{
 const x=parseExtensionUserOpGasEstimate420(estimate);
 assert.equal(BigInt(x.callGasLimit),120000n);
 assert.equal(BigInt(x.verificationGasLimit),240000n);
 assert.equal(BigInt(x.preVerificationGas),60000n);
 assert.equal(x.accountGasLimits,'0x'+(240000n).toString(16).padStart(32,'0')+(120000n).toString(16).padStart(32,'0'));
 assert.equal(maxExtensionUserOpFee420(x,gasFees),'42000000');
});
test('signed budget is approved before user sees final review and matches packed v0.7 data',async()=>{
 const p=mockProvider();
 const quote=await quoteExtensionSend420(p,{
  chainId,smartAccount:owner,entryPoint,transaction:{from:owner,to:recipient,value:'0x0',data:'0x'},
  choice:{level:'custom',maxFeePerGas:'0x64',maxPriorityFeePerGas:'0x14'},
  strictUserOpGas:true,
 });
 assert.equal(quote.nonce,'0x0');
 assert.equal(quote.totalFeeWei,'42000000');
 assert.equal(quote.gasBudget.estimateVerified,true);
 assert.equal(quote.gasBudget.entryPoint,entryPoint);
 assert.ok(p.requests.some(x=>x.method==='eth_estimateUserOperationGas'&&x.params[0].sender===owner));
 const observed=await estimateExtensionUserOpGas420(p,{
  chainId,sender:owner,entryPoint,nonce:quote.nonce,target:recipient,value:'0x0',gasFees:quote.gasFees,
  approvedLimits:quote.gasBudget,
 });
 assert.equal(observed.accountGasLimits,quote.gasBudget.accountGasLimits);
});
test('excess gas, unsupported bundler or chain mismatch fail closed',async()=>{
 const p=mockProvider();
 await assert.rejects(estimateExtensionUserOpGas420(p,{chainId,sender:owner,entryPoint,nonce:'0x0',target:recipient,
   gasFees,approvedLimits:{accountGasLimits:'0x'+'0'.repeat(64),preVerificationGas:'0x0'}}),/exceeds approved/);
 await assert.rejects(estimateExtensionUserOpGas420(mockProvider({missingEstimate:true}),{
   chainId,sender:owner,entryPoint,nonce:'0x0',target:recipient,gasFees}),/bundler gas estimate unavailable/);
 await assert.rejects(estimateExtensionUserOpGas420(mockProvider({wrongChain:true}),{
   chainId,sender:owner,entryPoint,nonce:'0x0',target:recipient,gasFees}),/chain changed/);
 assert.throws(()=>parseExtensionUserOpGasEstimate420({callGasLimit:'0x0',verificationGasLimit:'0x1',
    preVerificationGas:'0x1'}),/invalid call gas range/);
});
