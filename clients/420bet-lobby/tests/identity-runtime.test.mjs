import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {keccak256,verifyMessage} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {approvedSessionSettings,createBetIdentityRuntime} from '../server/identity-runtime.mjs';
const KEY='0x'+'1'.repeat(64),account=privateKeyToAccount(KEY);
const CHAIN='420',K='0x'+'c'.repeat(64),S='0x'+'d'.repeat(64),D='0x'+'e'.repeat(64);
const ORIGIN='https://420bet.example',token='p'.repeat(64),edge='q'.repeat(64);
const inputs={BET_SESSION_ORIGIN:ORIGIN,BET_SESSION_CHAIN_ID:CHAIN,
 BET_IDENTITY_RPC_URL:'https://rpc.example/',BET_IDENTITY_CONTRACT_ADDRESS:'0x'+'4'.repeat(40),
 BET_IDENTITY_RUNTIME_CODE_HASH:keccak256('0x6001'),BET_IDENTITY_CREDENTIAL_TYPES:JSON.stringify([K]),
 BET_IDENTITY_AUTHORITY_URL:'https://authority.example/',BET_IDENTITY_AUTHORITY_TOKEN:token,
 BET_IDENTITY_POLICY_VERSION:'bet-v1',BET_IDENTITY_POLICY_APPROVAL_DIGEST:D,
 BET_SESSION_BACKEND_TOKEN:edge};
function fixture(){
 const settings=approvedSessionSettings(inputs),calls=[];
 const runtime=createBetIdentityRuntime({settings,
  publicClient:{getChainId:async()=>420,verifyMessage},
  fetcher:async(url,options)=>{
   calls.push({url,options});
   const input=JSON.parse(options.body);
   let result;
   if(new URL(url).origin==='https://rpc.example'&&new URL(url).pathname==='/'){
    result=input.method==='eth_chainId'?'0x1a4':
      input.method==='eth_getCode'?'0x6001':'0x'+'0'.repeat(63)+'1';
    return {ok:true,text:async()=>JSON.stringify({jsonrpc:'2.0',id:1,result})};
   }
   if(url.endsWith('/v1/420bet/health'))return {ok:true,text:async()=>JSON.stringify({ready:true,chainId:CHAIN,policyVersion:'bet-v1',policyApprovalDigest:D})};
   if(url.endsWith('/v1/wallet-subject')){
    return {ok:true,text:async()=>JSON.stringify({account:input.account,chainId:CHAIN,subjectId:S,revoked:false})};
   }
   return {ok:true,text:async()=>JSON.stringify({account:input.account,subjectId:S,chainId:CHAIN,
    policyVersion:'bet-v1',policyApprovalDigest:D,authorized:true,revoked:false,
    authorizationVersion:'decision-1',expiresAt:Date.now()+60000})};
  }});
 async function http(route,body,secret=edge,headers={},method='POST'){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method=method;req.url='/api/420bet/session/'+route;
  req.headers={origin:ORIGIN,'content-type':'application/json','x-bet-edge-secret':secret,...headers};
  let status,output;
  const res={headersSent:false,writeHead(code){status=code;this.headersSent=true},
    end(data){output=JSON.parse(data)}};
  await new Promise((resolve,reject)=>{
   // runtime httpHandler returns before asynchronously awaited verification;
   // completion is signaled by the response end callback.
   res.end=(data)=>{try{output=JSON.parse(data);resolve();}catch(e){reject(e)}};
   runtime.httpHandler(req,res);
  });
  return {status,output};
 }
 return {runtime,calls,http};
}
test('runtime refuses implicit or unapproved Identity credentials and policy settings',()=>{
 assert.throws(()=>approvedSessionSettings({}),/missing required/);
 assert.throws(()=>approvedSessionSettings({...inputs,BET_IDENTITY_CREDENTIAL_TYPES:'[]'}),/credential/);
 assert.throws(()=>approvedSessionSettings({...inputs,BET_IDENTITY_POLICY_APPROVAL_DIGEST:'0x'+'0'.repeat(64)}),/approval digest/);
 assert.throws(()=>approvedSessionSettings({...inputs,BET_SESSION_BACKEND_TOKEN:'short'}),/backend/);
});
test('real EIP-191 signature, canonical on-chain read and policy authority create read-only session end-to-end',async()=>{
 const {runtime,http,calls}=fixture();
 const ready=await http('ready',{},edge,{},'GET');
 assert.equal(ready.status,200);assert.equal(ready.output.ready,true);
 const denied=await http('challenge',{account:account.address.toLowerCase(),chainId:CHAIN},'wrong');
 assert.equal(denied.status,403);
 const a=account.address.toLowerCase();
 const challenge=await http('challenge',{account:a,chainId:CHAIN});
 assert.equal(challenge.status,200);
 const signature=await account.signMessage({message:challenge.output.message});
 const auth=await http('authenticate',{account:a,chainId:CHAIN,
  nonce:challenge.output.nonce,signature});
 if(auth.status!==200){
  // A second challenge exercises the underlying qualified providers directly
  // so failures aren't hidden by the intentionally generic HTTP 401 response.
  const retry=runtime.sessions.challenge({account:a,requestedChainId:CHAIN});
  const secondSignature=await account.signMessage({message:retry.message});
  await runtime.sessions.authenticate({account:a,requestedChainId:CHAIN,nonce:retry.nonce,signature:secondSignature});
 }
 assert.equal(auth.status,200);
 assert.equal(auth.output.account,a);
 assert(calls.some(x=>JSON.parse(x.options.body).method==='eth_call'));
 assert(calls.some(x=>x.url==='https://authority.example/v1/420bet/eligibility'));
 const headers={authorization:'Bearer '+auth.output.token,
  'x-bet-account':a,'x-bet-chain-id':CHAIN};
 const state=await http('status',{},edge,headers);
 assert.equal(state.status,200);assert.equal(state.output.readOnly,true);
 const revoke=await http('revoke',{},edge,headers);
 assert.equal(revoke.status,200);
 const after=await http('status',{},edge,headers);
 assert.equal(after.status,401);
});
test('invalid actual EIP-191 wallet signature is rejected before policy authority access',async()=>{
 const {http,calls}=fixture(),a=account.address.toLowerCase();
 const c=await http('challenge',{account:a,chainId:CHAIN});
 const other=privateKeyToAccount('0x'+'2'.repeat(64));
 const signature=await other.signMessage({message:c.output.message});
 const denied=await http('authenticate',{account:a,chainId:CHAIN,nonce:c.output.nonce,signature});
 assert.equal(denied.status,401);
 assert.equal(calls.filter(x=>x.url.includes('authority.example')).length,0);
});
