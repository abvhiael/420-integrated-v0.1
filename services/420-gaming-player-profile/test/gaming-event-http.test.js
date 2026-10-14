import test from 'node:test';
import assert from 'node:assert/strict';
import {createGamingEventHttp420} from '../src/gaming-event-http.js';
const G='0x'+'a'.repeat(64);
test('R05.6 HTTP event feed is session-bound, scope-free from caller and read-only',async()=>{
 let calls=[],expireAfterRead=false,verifications=0;
 const authority={
  verifyToken:async token=>{
   verifications++;
   if(token!=='good')throw Error('bad token');
   return {sub:expireAfterRead&&verifications>=2?'revoked':'alice',game:G};
  },
  registeredPrincipal:async token=>token==='good'?'alice':null
 };
 const indexer={query:async payload=>{
  calls.push(payload);
  return [{event_kind:'MigrationClaimConsumed',block_number:'2'}];
 }};
 const server=createGamingEventHttp420({indexer,authority,gameId:G,origin:'http://client.local'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const go=(path,headers={})=>fetch(base+path,{headers});
  assert.equal((await go('/events')).status,401);
  assert.equal((await go('/events?accountId=bob',{authorization:'Bearer good'})).status,400);
  assert.equal((await go('/events',{authorization:'Bearer good',origin:'https://evil.example'})).status,403);
  assert.equal((await fetch(base+'/events',{method:'POST',headers:{authorization:'Bearer good'}})).status,405);
  const r=await go('/events?limit=1',{authorization:'Bearer good',origin:'http://client.local'});
  assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal((await r.json()).events[0].event_kind,'MigrationClaimConsumed');
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0],{accountId:'alice',gameId:G,authority:'good',limit:1,before:null});
  const c=await go('/events?limit=1&beforeBlock=2&beforeTxIndex=0&beforeLogIndex=1&beforeContract=0x'+'b'.repeat(40),
   {authorization:'Bearer good'});
  assert.equal(c.status,200);
  assert.equal(calls[1].before.blockNumber,'2');
  verifications=0;expireAfterRead=true;
  const revoked=await go('/events',{authorization:'Bearer good'});
  assert.equal(revoked.status,403);
  assert.ok(!(JSON.stringify(await revoked.json())).includes('MigrationClaimConsumed'));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
