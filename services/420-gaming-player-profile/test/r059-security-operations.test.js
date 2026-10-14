import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createGamingAbuseGuard420,createGamingSecurityTelemetry420,createGamingAntiCheatGate420,requireGamingServerSecret420} from '../src/r059-security-operations.js';
import {createGamingEventHttp420} from '../src/gaming-event-http.js';
const G='0x'+'a'.repeat(64),H=x=>'0x'+x.repeat(64);
test('R05.9 invalid key and principal cannot weaken abuse quotas',async()=>{
 assert.throws(()=>createGamingAbuseGuard420({pool:{connect(){}},key:Buffer.alloc(8)}),/abuse-config-invalid/);
 const guard=createGamingAbuseGuard420({pool:{connect(){throw Error('should not connect');}},key:randomBytes(32)});
 await assert.rejects(()=>guard.consume({accountId:'bob\nsecret',gameId:G,action:'events'}),/abuse-input-invalid/);
});
test('R05.9 telemetry is strictly allowlisted and never includes player fields',async()=>{
 const recorded=[],telemetry=createGamingSecurityTelemetry420({publish:async x=>recorded.push(x),clock:()=>120000});
 await telemetry.record('anti_cheat','blocked');
 assert.deepEqual(recorded,[{service:'highcountry-gaming',kind:'anti_cheat',status:'blocked',at:120}]);
 await assert.rejects(()=>telemetry.record('password:secret','success'),/telemetry-invalid/);
 assert.equal(JSON.stringify(recorded).includes('secret'),false);
});
test('R05.9 anticheat requires independent policy and canonical proof',async()=>{
 let allow=true;
 let nonceUses=0;
 const guard=createGamingAntiCheatGate420({validateCommitment:async()=>allow,
  verifyCanonical:async()=>true,consumeNonce:async()=>{nonceUses++;return nonceUses===1;}});
 assert.equal((await guard.authorize({gameId:G,accountId:'bob',proof:H('b'),nonce:H('c')})).accepted,true);
 await assert.rejects(()=>guard.authorize({gameId:G,accountId:'bob',proof:H('b'),nonce:H('c')}),/anti-cheat-replay-denied/);
 allow=false;
 await assert.rejects(()=>guard.authorize({gameId:G,accountId:'bob',proof:H('b'),nonce:H('c')}),/anti-cheat-commitment-rejected/);
});
test('R05.9 server-side secret retrieval fail closed',async()=>{
 const load=requireGamingServerSecret420({name:'GAMING_RATE_SECRET',load:async()=> 'x'.repeat(40)});
 assert.equal((await load()).length,40);
 const absent=requireGamingServerSecret420({name:'GAMING_RATE_SECRET',load:async()=>''});
 await assert.rejects(()=>absent(),/secret-unavailable/);
});
test('R05.9 scoped HTTP rate limits only after authenticated session and no service bypass',async()=>{
 let attempts=0;const authority={verifyToken:async()=>({sub:'alice',game:G}),registeredPrincipal:async()=> 'alice'};
 const indexer={query:async()=>[{event_kind:'GameProfileCreated'}]};
 const guard={consume:async()=>{attempts++;if(attempts>1)throw Object.assign(Error('limit'),{code:'abuse-rate-limited'});}};
 const server=createGamingEventHttp420({indexer,authority,gameId:G,origin:'https://game.example',abuseGuard:guard});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/events';
 try{
  assert.equal((await fetch(url)).status,401);assert.equal(attempts,0);
  assert.equal((await fetch(url,{headers:{authorization:'Bearer signed'}})).status,200);
  assert.equal((await fetch(url,{headers:{authorization:'Bearer signed'}})).status,429);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
