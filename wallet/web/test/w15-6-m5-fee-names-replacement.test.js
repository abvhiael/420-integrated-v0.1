import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteExtensionSend420,packExtensionUserOpFees420,normalizeExtensionFeeChoice420} from '../core/extension-fee-preflight.js';
import {resolveExtensionRecipient420,assertExtensionRecipientSnapshot420,ensNamehash420} from '../core/extension-recipient-resolver.js';
import {validateEoaReplacement420,validateUserOpReplacement420,transitionReplacement420,reconcileUserOpReplacement420} from '../core/extension-replacement-policy.js';
const chainId='0x1',sender='0x'+'11'.repeat(20),to='0x'+'22'.repeat(20);
const h='0x'+'ab'.repeat(32),node='0x'+'cd'.repeat(32),reg='0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e';
const addressWord=(a)=>'0x'+'0'.repeat(24)+a.slice(2);
test('fee quote shows target-only simulation and revalidates chain',async()=>{
 let calls=[];
 const provider={request:async(method,params)=>{
  calls.push(method);
  if(method==='eth_chainId')return chainId;
  if(method==='eth_call')return '0x';
  if(method==='eth_getBlockByNumber')return {baseFeePerGas:'0x64',hash:node};
  if(method==='eth_maxPriorityFeePerGas')return '0xa';
  throw new Error(method);
 }};
 const quote=await quoteExtensionSend420(provider,{chainId,smartAccount:sender,transaction:{to,value:'0x0',data:'0x'},choice:{level:'priority'}});
 assert.equal(quote.maxFeePerGas,'0xe6');
 assert.equal(quote.maxPriorityFeePerGas,'0x1e');
 assert.equal(quote.simulation,'target-only');
 assert.equal(quote.entryPointSimulation,'required-after-passkey');
 assert.equal(quote.totalFeeWei,null);
 assert.ok(calls.includes('eth_call'));
});
test('invalid fees are rejected before signing and exact AA packing is preserved',()=>{
 assert.throws(()=>normalizeExtensionFeeChoice420({level:'custom',maxFeePerGas:'0xa',maxPriorityFeePerGas:'0xb'}),/priority fee/);
 assert.throws(()=>normalizeExtensionFeeChoice420({level:'turbo'}),/unsupported/);
 assert.equal(packExtensionUserOpFees420({maxFeePerGas:'0x64',maxPriorityFeePerGas:'0xa'}),
  '0x'+'0'.repeat(31)+'a'+'0'.repeat(30)+'64');
});
test('ENS verified resolver on mainnet with immutable snapshot',async()=>{
 const resolver='0x'+'33'.repeat(20);
 const provider={request:async(method,params)=>{
  if(method==='eth_chainId')return '0x1';
  if(method==='eth_getCode')return '0x60016000';
  if(method==='eth_call'){
   const tx=params[0];
   if(tx.to===reg)return addressWord(resolver);
   if(tx.to===resolver)return addressWord(to);
  }
  throw Error(method);
 }};
 const resolved=await resolveExtensionRecipient420(provider,{input:'alice.eth',chainId:'0x1'});
 assert.equal(resolved.recipient,to);
 assert.equal(resolved.kind,'ens');
 assert.equal(assertExtensionRecipientSnapshot420(resolved,{...resolved}),to);
 assert.throws(()=>assertExtensionRecipientSnapshot420(resolved,{...resolved,recipient:sender}),/changed/);
 assert.match(ensNamehash420('alice.eth'),/^0x[0-9a-f]{64}$/);
});
test('unsupported name and unqualified 420Names fail closed',async()=>{
 const provider={request:async method=>method==='eth_chainId'?'0x1':null};
 await assert.rejects(resolveExtensionRecipient420(provider,{input:'mixed.Case.eth',chainId}),/unsupported/);
 await assert.rejects(resolveExtensionRecipient420(provider,{input:'alice.420',chainId}),/qualified/);
 await assert.rejects(resolveExtensionRecipient420(provider,{input:'alice.eth',chainId:'0x2'}),/mismatch/);
});
test('EOA replaces only exact sender/nonce/chain with a strict gas bump',()=>{
 const original={executionModel:'eoa',hash:h,from:sender,nonce:'0x2',chainId:'0x1',status:'submitted',
  to,value:'0x0',data:'0x',maxFeePerGas:'0x64',maxPriorityFeePerGas:'0x14'};
 const replacement={...original,action:'speed-up',maxFeePerGas:'0x78',maxPriorityFeePerGas:'0x18'};
 assert.equal(validateEoaReplacement420(original,replacement).model,'eoa');
 assert.throws(()=>validateEoaReplacement420(original,{...replacement,nonce:'0x3'}),/same EOA/);
 assert.throws(()=>validateEoaReplacement420(original,{...replacement,maxFeePerGas:'0x65'}),/increase/);
 assert.throws(()=>validateEoaReplacement420(original,{...replacement,action:'cancel',to}),/self-transfer/);
});
test('AA replacement uses FULL nonce, correct EntryPoint and independent signed operation',()=>{
 const original={executionModel:'erc4337',userOpHash:h,chainId:'0x1',sender,
  entryPoint:to,entryPointVersion:'0.7',nonce:'0x10000000000000005',nonceKey:'0x1',nonceSequence:'0x5',
  status:'submitted',maxFeePerGas:'0x64',maxPriorityFeePerGas:'0x14',callData:'0xabcd',initCode:'0x'};
 const candidate={...original,action:'speed-up',maxFeePerGas:'0x78',maxPriorityFeePerGas:'0x18'};
 const qualified=validateUserOpReplacement420(original,candidate);
 assert.equal(qualified.nonceKey,'0x1');assert.equal(qualified.nonceSequence,'0x5');
 assert.equal(qualified.requiresNewPasskeySignature,true);
 assert.throws(()=>validateUserOpReplacement420(original,{...candidate,nonce:'0x5'}),/FULL nonce/);
 assert.throws(()=>validateUserOpReplacement420(original,{...candidate,callData:'0x00'}),/preserve/);
 assert.throws(()=>validateUserOpReplacement420(original,{...candidate,action:'cancel',callData:'0x1234'}),/verified account-specific/);
});
test('never mark replaced or cancelled without canonical chain evidence',()=>{
 const original={hash:h,status:'submitted'};
 const replacement={txHash:node,action:'speed-up'};
 assert.throws(()=>transitionReplacement420(original,replacement,{}),/canonical/);
 const result=transitionReplacement420(original,replacement,{canonicalEvidence:{
  sameChain:true,sameSenderAndNonce:true,replacementIncluded:true,originalNotCanonical:true
 }});
 assert.equal(result.status,'replaced');assert.equal(result.replacedBy,node);
});

test('ERC-4337 replacement is finalized only with matching included UserOperation and absent original',async()=>{
  const old={executionModel:'erc4337',userOpHash:h,chainId,sender,entryPoint:to,nonce:'0x4',status:'submitted'};
  const replacement={executionModel:'erc4337',userOpHash:node,replaces:h,chainId,sender,entryPoint:to,
    nonce:'0x4',status:'confirmed',action:'speed-up',hash:'0x'+'ef'.repeat(32)};
  const provider={request:async(method,params)=>{
    assert.equal(method,'eth_getUserOperationReceipt');
    if(params[0]===node)return {success:true,sender,nonce:'0x4',receipt:{transactionHash:replacement.hash}};
    if(params[0]===h)return null;
    throw Error('unexpected hash');
  }};
  const updated=await reconcileUserOpReplacement420(provider,old,replacement);
  assert.equal(updated.status,'replaced');
  assert.equal(updated.replacementUserOpHash,node);
  await assert.rejects(reconcileUserOpReplacement420({request:async()=>null},old,replacement),/evidence/);
  await assert.rejects(reconcileUserOpReplacement420({request:async(_,params)=>params[0]===h?{success:true}:{
    success:true,sender,nonce:'0x4',receipt:{transactionHash:replacement.hash}
  }},old,replacement),/original UserOperation/);
});
test('ERC-4337 cancel outcome requires confirmed verified no-op and proof',async()=>{
 const old={executionModel:'erc4337',userOpHash:h,chainId,sender,entryPoint:to,nonce:'0x4',status:'pending'};
 const replacement={executionModel:'erc4337',userOpHash:node,replaces:h,chainId,sender,entryPoint:to,
   nonce:'0x4',status:'confirmed',action:'cancel',hash:'0x'+'ef'.repeat(32)};
 const provider={request:async(_,params)=>params[0]===h?null:{
   success:true,sender,nonce:'0x4',receipt:{transactionHash:replacement.hash}
 }};
 assert.equal((await reconcileUserOpReplacement420(provider,old,replacement)).status,'cancelled');
});

test('420Names rejects a forged deployment at the canonical address with wrong runtime code',async()=>{
  const provider={request:async(method)=>{
    if(method==='eth_chainId')return chainId;
    if(method==='eth_getCode')return '0x6001600055';
    throw new Error('Name resolution reached unqualified chain call: '+method);
  }};
  const config={schema:'420-wallet-runtime-config-v1',
    network:{chainId},manifest:{url:'https://manifest.example.test/deployment'},
    deployment:{namesAddress:'0x0000000000000000000000000000000000000435',
      environment:'testnet',sourceInventoryPhase:'W15'}};
  await assert.rejects(resolveExtensionRecipient420(provider,{
    input:'alice.420',chainId,qualifiedNamesConfig:config
  }),/runtime hash/);
});
test('420Names requires frozen Genesis address, not an alternate lookalike registry',async()=>{
  const provider={request:async method=>method==='eth_chainId'?chainId:null};
  const config={schema:'420-wallet-runtime-config-v1',network:{chainId},
    manifest:{url:'https://manifest.example.test/deployment'},
    deployment:{namesAddress:to,environment:'testnet',sourceInventoryPhase:'W15'}};
  await assert.rejects(resolveExtensionRecipient420(provider,{
    input:'alice.420',chainId,qualifiedNamesConfig:config
  }),/frozen Genesis/);
});
