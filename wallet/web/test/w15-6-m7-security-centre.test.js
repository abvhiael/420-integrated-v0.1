import assert from 'node:assert/strict';
import test from 'node:test';
import {
 normalizeSecurityAllowance420,readSecurityAllowance420,encodeSecurityAllowance420,
 encodeSecurityRevokeAllowance420,classifyWebsiteRisk420,assessSecuritySignature420,
 securityRecordSignature420,securityRevocationKind420,assertSecurityRevocationSnapshot420
} from '../core/extension-security-centre.js';
import {
 prepareSecurityRevocation420,assertSecurityTransaction420,readSecurityPasskey420
} from '../core/extension-security-actions.js';

const chainId='0x1a4',account='0x'+'11'.repeat(20),token='0x'+'22'.repeat(20),
 spender='0x'+'33'.repeat(20),smartAccount='0x'+'44'.repeat(20),
 registry='0x'+'56'.repeat(20),entryPoint='0x'+'66'.repeat(20);
const hash='0x'+'cd'.repeat(32),q=n=>'0x'+BigInt(n).toString(16).padStart(64,'0'),
  MAX=(1n<<256n)-1n;
function provider({wrongChain=false,allowance='0x'+MAX.toString(16).padStart(64,'0'),
 passkey=true,sessionEpoch=9n,throwCall=false}={}){
 const calls=[];
 return {calls,request:async(method,params=[])=>{
  calls.push({method,params});
  if(method==='eth_chainId')return wrongChain?'0x1':chainId;
  if(method==='eth_getCode')return '0x6001600055';
  if(method==='eth_estimateGas')return '0x15f90';
  if(method==='eth_call'){
   const d=params[0]?.data??'';
   if(throwCall)throw Error('contract reverted');
   if(d.startsWith('0xdd62ed3e'))return allowance;
   if(d.startsWith('0xd557e335'))return q(sessionEpoch);
   if(d.startsWith('0x'+''))return passkey?q(1):q(0);
   throw Error('unexpected data '+d);
  }
  throw Error('unexpected RPC method '+method);
 }};
}
const smart={deployed:true,controllerIsOwner:true,owner:account,
 smartAccount,entryPoint,capabilityRegistry:registry,verifiedCapabilityRegistry:registry,
 authorizationEpoch:9n,recoveryAuthority:'0x'+'77'.repeat(20)};
test('ERC-20 allowance inspection is chain bound, ABI strict and never treats local disconnect as a revoke',async()=>{
 const p=provider();
 const inspected=await readSecurityAllowance420(p,{chainId,owner:account,token,spender});
 assert.equal(inspected.value,MAX.toString());
 assert.equal(inspected.unlimited,true);
 assert.equal(inspected.token,token);
 assert.equal(p.calls.filter(x=>x.method==='eth_call').length,1);
 assert.equal(p.calls.find(x=>x.method==='eth_call').params[0].data,
  encodeSecurityAllowance420(account,spender));
 assert.equal(encodeSecurityRevokeAllowance420(spender),
  '0x095ea7b3'+spender.slice(2).padStart(64,'0')+'0'.repeat(64));
 assert.equal(securityRevocationKind420('site'),'local-only');
 assert.equal(securityRevocationKind420('allowance'),'on-chain-erc20');
 assert.equal(securityRevocationKind420('capability'),'on-chain-smartaccount-owner');
 assert.equal(securityRevocationKind420('session'),'on-chain-epoch-scoped-owner');
 assert.throws(()=>securityRevocationKind420('other'));
});
test('allowance verification fails closed on wrong chain, noncontract token, malformed amount and zero target',async()=>{
 await assert.rejects(readSecurityAllowance420(provider({wrongChain:true}),{
  chainId,owner:account,token,spender}),/chain identity/);
 await assert.rejects(readSecurityAllowance420(provider({allowance:'0xdead'}),{
  chainId,owner:account,token,spender}),/invalid ABI/);
 const nocode={request:async(m)=>m==='eth_chainId'?chainId:m==='eth_getCode'?'0x':'0x'};
 await assert.rejects(readSecurityAllowance420(nocode,{chainId,owner:account,token,spender}),/no deployed/);
 assert.throws(()=>normalizeSecurityAllowance420('0x'+'0'.repeat(40),spender),/nonzero/);
});
test('review preparation distinguishes contract owner from token owner and never signs or sends',async()=>{
 const p=provider();
 const prepared=await prepareSecurityRevocation420(p,{kind:'allowance',
  chainId,account,token,spender});
 assert.equal(prepared.authority,'eoa-owner');
 assert.equal(prepared.transaction.from,account);
 assert.equal(prepared.transaction.to,token);
 assert.equal(prepared.record.allowance,MAX.toString());
 assert.equal(p.calls.some(x=>x.method==='eth_sendTransaction'||x.method==='eth_sendRawTransaction'),false);
 const smartPrepared=await prepareSecurityRevocation420(p,{kind:'allowance',chainId,account,
  token,spender,smartState:{allowanceOwner:smartAccount}});
 assert.equal(smartPrepared.record.owner,smartAccount);
 assert.equal(smartPrepared.authority,'smart-account-owner');
 await assert.rejects(prepareSecurityRevocation420(provider({allowance:q(0)}),{
  kind:'allowance',chainId,account,token,spender}),/already zero/);
});
test('canonical session key revocation is tied to the current epoch and owner',async()=>{
 const p=provider({sessionEpoch:9n});
 const candidate=await prepareSecurityRevocation420(p,{
  kind:'session',chainId,account,key:spender,smartState:smart});
 assert.equal(candidate.transaction.to,smartAccount);
 assert.equal(candidate.transaction.data,'0x5ae7ab32'+spender.slice(2).padStart(64,'0'));
 assert.equal(candidate.record.sessionEpoch,'9');
 assert.equal(candidate.record.authorizationEpoch,'9');
 await assert.rejects(prepareSecurityRevocation420(provider({sessionEpoch:8n}),{
  kind:'session',chainId,account,key:spender,smartState:smart}),/expired authorization epoch/);
 await assert.rejects(prepareSecurityRevocation420(provider(),{
  kind:'session',chainId,account:key,smartState:smart,key:spender}),/owner authorization/);
});
test('passkey revocation verifies current credential is active, never edits local WebAuthn key to fake it',async()=>{
 const p=provider(),credentialIdHash='0x'+'de'.repeat(32);
 const state=await readSecurityPasskey420(p,smartAccount,credentialIdHash);
 assert.equal(state.active,true);
 const prepared=await prepareSecurityRevocation420(p,{kind:'passkey',
  chainId,account,smartState:smart,credentialIdHash});
 assert.equal(prepared.transaction.to,smartAccount);
 assert.equal(prepared.transaction.data.length,10+64);
 assert.ok(p.calls.every(x=>!x.method.startsWith('eth_send')));
 await assert.rejects(prepareSecurityRevocation420(provider({passkey:false}),{
  kind:'passkey',chainId,account,smartState:smart,credentialIdHash}),/not active/);
});
test('revocation review rejects changed spender, owner, calldata, nonce, epoch and preflight fee',()=>{
 const base={kind:'allowance',chainId,account,contract:token,spender,allowance:'100',
  epoch:2,nonce:'0x2',blockHash:hash,maxFeePerGas:'0x4'};
 assert.equal(assertSecurityRevocationSnapshot420(base,{...base}),true);
 for(const diff of [{spender:account},{allowance:'101'},{account:spender},{epoch:3},
  {nonce:'0x3'},{blockHash:'0x'+'ff'.repeat(32)},{maxFeePerGas:'0x5'}]){
  assert.throws(()=>assertSecurityRevocationSnapshot420(base,{...base,...diff}),/changed/);
 }
 const tx={kind:'allowance',chainId,account,contract:token,authority:'eoa-owner',
  transaction:{from:account,to:token,value:'0x0',data:encodeSecurityRevokeAllowance420(spender)},
  record:{token,spender,owner:account,allowance:'100'}};
 assert.equal(assertSecurityTransaction420(tx,{...tx}),true);
 for(const field of [{transaction:{...tx.transaction,data:'0x'}},{record:{...tx.record,allowance:'101'}},
  {authority:'smart-account-owner'},{transaction:{...tx.transaction,from:spender}}]){
  assert.throws(()=>assertSecurityTransaction420(tx,{...tx,...field}),/changed/);
 }
});
test('phishing heuristic detects punycode, embedded wallet brands and numeric IP origins without claiming safe status',()=>{
 assert.equal(classifyWebsiteRisk420('https://xn--metamask-8na.example').level,'warning');
 assert.equal(classifyWebsiteRisk420('https://metamask-support.example').level,'warning');
 assert.equal(classifyWebsiteRisk420('https://192.0.2.42').level,'warning');
 assert.equal(classifyWebsiteRisk420('https://normal.example').level,'unknown');
 const record=securityRecordSignature420({origin:'https://dapp.example',
  method:'personal_sign',account,chainId,risk:{flags:['warning'],severity:'high'}});
 assert.equal(record.status,'signed');
 assert.equal(record.flags[0],'warning');
 assert.equal(record.origin,'https://dapp.example');
 assert.equal(Object.hasOwn(record,'signature'),false);
 assert.equal(Object.hasOwn(record,'message'),false);
});
test('suspicious signature detection warns about permit typed data, max allowances, brand risks and opaque bytes',()=>{
 const permit={domain:{name:'Test',chainId:420,verifyingContract:token},
  primaryType:'Permit',types:{Permit:[{name:'value',type:'uint256'}]},
  message:{value:MAX.toString()}};
 const typed=assessSecuritySignature420('eth_signTypedData_v4',[account,JSON.stringify(permit)],{
  chainId,origin:'https://metamask-support.example'});
 assert.equal(typed.severity,'high');
 assert.ok(typed.flags.some(x=>/spending|execution/.test(x)));
 assert.ok(typed.flags.some(x=>/maximum uint256/.test(x)));
 const wrong=assessSecuritySignature420('eth_signTypedData_v4',[account,JSON.stringify({
  ...permit,domain:{...permit.domain,chainId:1}})],{chainId,origin:'https://dapp.example'});
 assert.ok(wrong.flags.some(x=>/chain differs/.test(x)));
 const opaque=assessSecuritySignature420('personal_sign',['0xfffe',account],{
  chainId,origin:'https://dapp.example'});
 assert.ok(opaque.flags.some(x=>/not readable/.test(x)));
});
