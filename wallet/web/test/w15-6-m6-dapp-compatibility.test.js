import assert from 'node:assert/strict';
import test from 'node:test';
import {Wallet,getBytes,verifyMessage,verifyTypedData} from '../../extension/vendor/ethers-6.17.0.min.js';
import {encryptVault420} from '../../extension/core/vault.js';
import {signExtensionEoaMessage420} from '../../extension/core/eoa-local-signer.js';
import {dappAccountPermissions420,normalizeDappAccountPermission420,
 normalizeDappWalletCalls420,walletCallsStatus420,walletCapabilities420} from '../core/extension-dapp-compatibility.js';
import {verifyExtensionContractSignature420,isEip6492Signature420} from '../core/extension-contract-signatures.js';
import {normalizeBatchCalls,encodeExecuteBatch} from '../core/batch-execution.js';
import {estimateExtensionUserOpGas420} from '../core/extension-userop-gas.js';
import {quoteExtensionSend420} from '../core/extension-fee-preflight.js';

const chain='0x1a4',key='0x'+'11'.repeat(32),password='test-password-strong-420';
const owner=new Wallet(key).address.toLowerCase(),target='0x'+'22'.repeat(20),
 smartAccount='0x'+'33'.repeat(20),entryPoint='0x'+'44'.repeat(20);
const hash='0x'+'cd'.repeat(32),accountState={deployed:true,controllerIsOwner:true,
 owner,smartAccount,entryPoint,factoryAddress:'0x'+'55'.repeat(20)};
let encrypted;
async function vault(){
 if(!encrypted)encrypted=await encryptVault420({schema:'420-wallet-secret-payload-v1',
  autoLockMinutes:5,wallets:[{id:'1'.repeat(32),type:'private-key',label:'Test',
    privateKey:key,accounts:[{address:owner,label:'Owner'}]}]},password);
 return encrypted;
}
test('EIP-2255 permission request accepts only eth_accounts and never delegates signing',()=>{
 assert.equal(normalizeDappAccountPermission420([{eth_accounts:{}}]),true);
 for(const bad of [[],[{}],[{eth_accounts:{},eth_sendTransaction:{}}],[{eth_accounts:{caveat:true}}],
  [{personal_sign:{}}],[{eth_accounts:null}]]){
  assert.throws(()=>normalizeDappAccountPermission420(bad),/only eth_accounts/);
 }
 const record=dappAccountPermissions420([owner],'https://dapp.example',1700000000000);
 assert.equal(record.length,1);
 assert.equal(record[0].parentCapability,'eth_accounts');
 assert.equal(record[0].invoker,'https://dapp.example');
 assert.deepEqual(dappAccountPermissions420([],'https://other.example'),[]);
});
test('EIP-5792 accepts 2–8 exact-chain atomic calls, rejecting EOA and authority targets upstream',()=>{
 const input=[{version:'2.0.0',from:owner,chainId:chain,
  calls:[{to:target,value:'0x1',data:'0x1234'},{to:'0x'+'66'.repeat(20)}],
  capabilities:{atomic:{required:true}}}];
 const parsed=normalizeDappWalletCalls420(input,{account:owner,chainId:chain});
 assert.equal(parsed.calls.length,2);
 assert.equal(parsed.calls[1].value,'0x0');
 assert.equal(parsed.calls[1].data,'0x');
 const batch=normalizeBatchCalls(accountState,parsed.calls);
 assert.match(encodeExecuteBatch(batch.calls),/^0x34fcd5be/);
 for(const inputChange of [
  {from:target},{chainId:'0x2'},{version:'1.0.0'},{capabilities:{paymaster:{required:true}}},
  {calls:[{to:target}]},{calls:[{to:smartAccount},{to:target}]}
 ]){
  const candidate=[{...input[0],...inputChange}];
  if(inputChange.calls?.[0]?.to===smartAccount){
   const parsed2=normalizeDappWalletCalls420(candidate,{account:owner,chainId:chain});
   assert.throws(()=>normalizeBatchCalls(accountState,parsed2.calls),/authority contract/);
  }else assert.throws(()=>normalizeDappWalletCalls420(candidate,{account:owner,chainId:chain}));
 }
 assert.equal(walletCapabilities420(chain,{atomicBatch:true})[chain].atomicBatch.supported,true);
 assert.equal(walletCapabilities420(chain,{atomicBatch:false})[chain].atomicBatch.supported,false);
});
test('EIP-5792 status is tied to known call ID and canonical lifecycle',()=>{
 const id='0x'+'ab'.repeat(32);
 const base={callsId:id,chainId:chain,status:'submitted'};
 assert.equal(walletCallsStatus420([base],id).status,100);
 assert.equal(walletCallsStatus420([{...base,status:'confirmed'}],id).status,200);
 assert.equal(walletCallsStatus420([{...base,status:'reverted'}],id).status,400);
 assert.throws(()=>walletCallsStatus420([],'0x'+'fe'.repeat(32)),/unknown/);
 assert.throws(()=>walletCallsStatus420([base],'bad'),/32-byte/);
});
test('atomic batch quotes and estimates the direct account executeBatch, not a nested execute',async()=>{
 const calls=normalizeBatchCalls(accountState,[{target,value:'0x1',data:'0x'},{target:'0x'+'66'.repeat(20),value:'0x0',data:'0x1234'}]);
 const direct=encodeExecuteBatch(calls.calls),observed=[];
 const provider={request:async(method,params)=>{
  observed.push({method,params});
  if(method==='eth_chainId')return chain;
  if(method==='eth_call'){
   if(params[0]?.data?.startsWith('0xd86f2b3c'))return '0x'+'0'.repeat(64);
   return '0x';
  }
  if(method==='eth_getBlockByNumber')return {hash,baseFeePerGas:'0x10'};
  if(method==='eth_maxPriorityFeePerGas')return '0x2';
  if(method==='eth_estimateGas')return '0x5208';
  if(method==='eth_estimateUserOperationGas')return {callGasLimit:'0x5208',verificationGasLimit:'0x10000',preVerificationGas:'0x1000'};
  throw Error('unexpected '+method);
 }};
 const quote=await quoteExtensionSend420(provider,{chainId:chain,smartAccount,entryPoint,
  transaction:{to:smartAccount,value:'0x0',data:direct},choice:{level:'standard'},
  strictUserOpGas:true,accountCallData:direct});
 assert.equal(quote.gasBudget.estimateVerified,true);
 const estimated=observed.find(x=>x.method==='eth_estimateUserOperationGas');
 assert.equal(estimated.params[0].callData,direct);
 const simulated=observed.find(x=>x.method==='eth_call');
 assert.equal(simulated.params[0].to,smartAccount);
 assert.equal(simulated.params[0].from,entryPoint);
 await assert.rejects(estimateExtensionUserOpGas420(provider,{chainId:chain,sender:smartAccount,
  entryPoint,nonce:'0x0',target:smartAccount,gasFees:quote.gasFees,
  accountCallData:'0x1234'}),/executeBatch/);
});
test('EOA EIP-191 signing is local and recovers the exact approved account',async()=>{
 const record=await vault();
 const signature=await signExtensionEoaMessage420({vaultRecord:record,password,
  account:owner,method:'personal_sign',params:['0x68656c6c6f',owner],chainId:chain});
 assert.equal(verifyMessage(getBytes('0x68656c6c6f'),signature).toLowerCase(),owner);
 assert.ok(!signature.includes(key));
 await assert.rejects(signExtensionEoaMessage420({vaultRecord:record,password,account:owner,
  method:'personal_sign',params:['hello',owner],chainId:chain}),/hex-encoded/);
 await assert.rejects(signExtensionEoaMessage420({vaultRecord:record,password,account:owner,
  method:'personal_sign',params:['0x6869',target],chainId:chain}),/signer/);
});
test('EOA EIP-712 signs only the approved account and current chain-domain',async()=>{
 const record=await vault(),domain={name:'420 DApp',version:'1',chainId:420,verifyingContract:target};
 const types={Permit:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}]};
 const message={spender:target,amount:'5'};
 const typed=JSON.stringify({domain,types,message,primaryType:'Permit'});
 const signature=await signExtensionEoaMessage420({vaultRecord:record,password,account:owner,
  method:'eth_signTypedData_v4',params:[owner,typed],chainId:chain});
 assert.equal(verifyTypedData(domain,types,message,signature).toLowerCase(),owner);
 await assert.rejects(signExtensionEoaMessage420({vaultRecord:record,password,account:owner,
  method:'eth_signTypedData_v4',params:[owner,JSON.stringify({domain:{...domain,chainId:1},types,message,primaryType:'Permit'})],
  chainId:chain}),/domain chain ID/);
 await assert.rejects(signExtensionEoaMessage420({vaultRecord:record,password:'not-the-password',account:owner,
  method:'eth_signTypedData_v4',params:[owner,typed],chainId:chain}),/password|integrity/);
});
test('EIP-1271 validates canonical deployed code, signer digest, magic response and chain',async()=>{
 const calls=[];
 const provider={request:async(method,params)=>{
  calls.push({method,params});
  if(method==='eth_chainId')return chain;
  if(method==='eth_getCode')return '0x6001600055';
  if(method==='eth_call')return '0x1626ba7e'+'0'.repeat(56);
  throw Error('unexpected '+method);
 }};
 assert.equal(await verifyExtensionContractSignature420(provider,{
  chainId:chain,contract:smartAccount,digest:hash,signature:'0x1234'}),true);
 assert.ok(calls.some(x=>x.method==='eth_call'&&x.params[0].to===smartAccount&&
  x.params[0].data.startsWith('0x1626ba7e'+hash.slice(2))));
 const bad={request:async m=>m==='eth_chainId'?chain:m==='eth_getCode'?'0x6001600055':'0xffffffff'};
 assert.equal(await verifyExtensionContractSignature420(bad,{
  chainId:chain,contract:smartAccount,digest:hash,signature:'0x1234'}),false);
 await assert.rejects(verifyExtensionContractSignature420({request:async m=>m==='eth_chainId'?chain:'0x'},{
  chainId:chain,contract:smartAccount,digest:hash,signature:'0x1234'}),/not a deployed contract/);
});
test('EIP-6492 wrapped counterfactual signatures are not executed with untrusted factories',async()=>{
 const wrapped='0x1234'+'6492'.repeat(16);
 assert.equal(isEip6492Signature420(wrapped),true);
 let requested=false;
 await assert.rejects(verifyExtensionContractSignature420({request:async()=>{requested=true;}},{
  chainId:chain,contract:smartAccount,digest:hash,signature:wrapped
 }),/independently qualified universal validator/);
 assert.equal(requested,false,'no unverified RPC/factory call is allowed');
});
