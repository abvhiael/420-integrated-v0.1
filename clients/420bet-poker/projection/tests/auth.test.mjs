import test from 'node:test';
import assert from 'node:assert/strict';
import {privateKeyToAccount} from 'viem/accounts';
import {createPokerWalletAuth} from '../auth.mjs';
import {verifyPokerSession,parseCookie} from '../service.mjs';
const key='0x'+'1'.repeat(64);
const account=privateKeyToAccount(key);
const origin='https://420bet.420integrated.org',chainId=11155111,secret=Buffer.alloc(32,7);
const now=Date.now();
function req(url,body,{method='POST',from=origin,contentType='application/json'}={}){
 const data=Buffer.from(JSON.stringify(body));
 return {method,url,headers:{origin:from,'content-type':contentType},
  socket:{remoteAddress:'192.0.2.5'},
  async *[Symbol.asyncIterator](){yield data;}};
}
function res(){
 const state={status:null,headers:null,body:null};
 return {state,writeHead(n,h){state.status=n;state.headers=h;},end(x){state.body=JSON.parse(x);}};
}
test('EIP-191 challenge is real wallet-authenticated, single-use and issues secure read-only cookie',async()=>{
 const auth=createPokerWalletAuth({origin,chainId,secret,clock:()=>now});
 let r=res();await auth.handle(req('/api/420bet/poker/v1/auth/challenge',{address:account.address,chainId}),r);
 assert.equal(r.state.status,200);
 const c=r.state.body;
 assert.match(c.message,/Statement: Read-only poker tables/);
 assert.match(c.message,/Nonce:/);
 assert.equal(c.chainId,chainId);
 const signature=await account.signMessage({message:c.message});
 r=res();await auth.handle(req('/api/420bet/poker/v1/auth/verify',{nonce:c.nonce,signature}),r);
 assert.equal(r.state.status,200);
 const cookie=r.state.headers['Set-Cookie'];
 assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);
 assert.match(cookie,/__Host-poker_session=/);
 const token=parseCookie(cookie);
 const claims=verifyPokerSession(token,secret,{chainId,now});
 assert.equal(claims.subject,account.address.toLowerCase());
 assert.equal(claims.scope,undefined); // public session consumes validated read scope
 assert.equal(claims.viewerId,account.address.slice(2).toLowerCase());
 r=res();await auth.handle(req('/api/420bet/poker/v1/auth/verify',{nonce:c.nonce,signature}),r);
 assert.equal(r.state.status,403,'replay must fail');
});
test('Wrong origin, chain, nonce, content-type and bad signature are rejected',async()=>{
 const auth=createPokerWalletAuth({origin,chainId,secret,clock:()=>now});
 for(const p of [
  req('/api/420bet/poker/v1/auth/challenge',{address:account.address,chainId},{from:'https://evil.test'}),
  req('/api/420bet/poker/v1/auth/challenge',{address:account.address,chainId:1}),
  req('/api/420bet/poker/v1/auth/challenge',{address:account.address,chainId},{contentType:'text/plain'})
 ]){const r=res();await auth.handle(p,r);assert.notEqual(r.state.status,200);}
 const r=res();await auth.handle(req('/api/420bet/poker/v1/auth/verify',{nonce:'bad',signature:'0x12'}),r);
 assert.equal(r.state.status,403);
});
test('Failed wallet signature consumes challenge (no retry with a corrected signature)',async()=>{
 const auth=createPokerWalletAuth({origin,chainId,secret,clock:()=>now});
 let r=res();await auth.handle(req('/api/420bet/poker/v1/auth/challenge',{address:account.address,chainId}),r);
 const challenge=r.state.body;
 const wrong=await privateKeyToAccount('0x'+'2'.repeat(64)).signMessage({message:challenge.message});
 r=res();await auth.handle(req('/api/420bet/poker/v1/auth/verify',{nonce:challenge.nonce,signature:wrong}),r);
 assert.equal(r.state.status,403);
 const right=await account.signMessage({message:challenge.message});
 r=res();await auth.handle(req('/api/420bet/poker/v1/auth/verify',{nonce:challenge.nonce,signature:right}),r);
 assert.equal(r.state.status,403);
});
