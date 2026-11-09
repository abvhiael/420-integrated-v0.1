import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createBetWalletSessions} from '../server/wallet-identity-sessions.mjs';
import {createBetSessionHttpHandler} from '../server/wallet-session-http.mjs';
import {createWalletSessionClient} from '../src/wallet-session.js';
const A='0x'+'a'.repeat(40),B='0x'+'b'.repeat(40);
const SIGN='0x'+'b'.repeat(130),ORIGIN='https://420bet.example';
function sessionProvider(){
 return createBetWalletSessions({origin:ORIGIN,chainId:'420',verifySignature:async({account,signature,message})=>
  account===A&&signature===SIGN&&message.includes('420Bet read-only session'),
 verifyIdentity:async()=>({authorized:true,revoked:false,authorizationVersion:'identity-v1'})});
}
function makeHttp(sessions=sessionProvider()){
 const handle=createBetSessionHttpHandler({sessions,origin:ORIGIN});
 return async(action,payload={},headers={},options={})=>{
  const raw=JSON.stringify(payload);
  const req=Readable.from([Buffer.from(raw)]);
  req.method=options.method||'POST';req.url='/api/420bet/session/'+action;
  req.headers={origin:ORIGIN,'content-type':'application/json',...headers};
  if(options.badOrigin)req.headers.origin='https://attacker.example';
  let code,json;
  const res={writeHead(n){code=n},end(s){json=JSON.parse(s)}};
  await handle(req,res);
  return {code,json};
 };
}
test('same-origin HTTP challenge, signed login, scoped status and explicit revoke',async()=>{
 const http=makeHttp();
 const c=await http('challenge',{account:A,chainId:'420'});
 assert.equal(c.code,200);assert.match(c.json.message,/read-only/);
 const auth=await http('authenticate',{account:A,chainId:'420',nonce:c.json.nonce,signature:SIGN});
 assert.equal(auth.code,200);
 const headers={authorization:'Bearer '+auth.json.token,'x-bet-account':A,'x-bet-chain-id':'420'};
 const status=await http('status',{},headers);
 assert.equal(status.code,200);assert.equal(status.json.readOnly,true);
 assert.equal((await http('revoke',{},headers)).code,200);
 assert.equal((await http('status',{},headers)).code,401);
});
test('HTTP rejects foreign origin, cookies, invalid paths, missing bearer and wrong account',async()=>{
 const http=makeHttp();
 assert.equal((await http('challenge',{account:A,chainId:'420'},{},{badOrigin:true})).code,403);
 assert.equal((await http('challenge',{account:A,chainId:'420'},{cookie:'sid=some'})).code,403);
 assert.equal((await http('status',{})).code,401);
 const c=(await http('challenge',{account:A,chainId:'420'})).json;
 const auth=(await http('authenticate',{account:A,chainId:'420',nonce:c.nonce,signature:SIGN})).json;
 const h={authorization:'Bearer '+auth.token,'x-bet-account':B,'x-bet-chain-id':'420'};
 assert.equal((await http('status',{},h)).code,401);
});
test('explicit client wallet login can only present verified read-only session',async()=>{
 const listeners=new Map(),calls=[];
 const provider={on(e,fn){listeners.set(e,fn)},removeListener(e){listeners.delete(e)},
  async request({method,params}){
   calls.push(method);
   if(method==='eth_requestAccounts')return [A];
   if(method==='eth_chainId')return '0x1a4';
   if(method==='personal_sign'){assert.match(params[0],/No wagering/);return SIGN;}
   throw Error('unexpected method');
  }};
 const http=makeHttp();
 const client=createWalletSessionClient({provider,fetcher:async(url,options)=>{
  const headers=Object.fromEntries(Object.entries(options.headers).map(([k,v])=>[k.toLowerCase(),v]));
  const result=await http(url.split('/').at(-1),JSON.parse(options.body),headers);
  return {ok:result.code===200,json:async()=>result.json};
 }});
 assert.equal(calls.length,0);
 const login=await client.connect();assert.equal(login.readOnly,true);
 assert.equal(calls.at(-1),'personal_sign');
 assert.equal((await client.status()).readOnly,true);
 listeners.get('accountsChanged')();
 assert.equal(client.authenticated,false);
 await assert.rejects(client.status());
 client.dispose();assert.equal(listeners.size,0);
});
