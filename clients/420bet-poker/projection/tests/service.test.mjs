import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createPokerProjection,createPokerProjectionHandler,projectCanonicalTable,verifyPokerSession,parseCookie} from '../service.mjs';
import {createCanonicalPokerReader} from '../chain-reader.mjs';
const address='0x'+'1'.repeat(40),other='0x'+'2'.repeat(40),zero='0x'+'0'.repeat(40),
 id='0x'+'a'.repeat(64),hash='0x'+'b'.repeat(64),secret=Buffer.alloc(32,9);
const now=Date.now(),chainId=1337;
const manifest={chainId,tables:[{tableId:id,configHash:hash,name:'Green Room',smallBlind:5,bigBlind:10}]};
const session={viewerId:'alice',subject:address,chainId,expiresAt:now+100000};
const raw=()=>({verified:true,finalized:true,finalityBlock:100,blockNumber:100,sequence:100,
 chainId,tableId:id,stateHash:'0x'+'c'.repeat(64),tableVersion:1,ledgerVersion:3,
 config:{hash,seatCount:2,smallBlind:5,bigBlind:10},
 seats:[{index:0,status:'active',owner:address,stack:500,committed:0},
 {index:1,status:'active',owner:other,stack:600,committed:0}],
 hand:{nonce:0,actionNonce:0,pot:0,deadline:0,turnSeat:0,dealerSeat:0,phase:'TABLE_OPEN',community:[]}
});
function cookie(s=session,key=secret){const data=Buffer.from(JSON.stringify({
 iss:'420bet-poker-auth-v1',scope:'poker:read',subject:s.subject,viewerId:s.viewerId,
 chainId:s.chainId,issuedAt:now-1000,expiresAt:s.expiresAt
 })).toString('base64url');
 return data+'.'+createHmac('sha256',key).update(data).digest('base64url');}
test('Session rejects unauthenticated, forged, expired and wrong-network cookies',()=>{
 const valid=cookie(),v=verifyPokerSession(valid,secret,{chainId,now});
 assert.equal(v.subject,address);
 assert.equal(parseCookie('__Host-poker_session='+valid+'; a=b'),valid);
 assert.throws(()=>verifyPokerSession(valid.slice(0,-2)+'zz',secret,{chainId,now}),/signature/i);
 assert.throws(()=>verifyPokerSession(valid,secret,{chainId:1,now}),/unauthorized/i);
 assert.throws(()=>verifyPokerSession(cookie({...session,expiresAt:now-1}),secret,{chainId,now}),/expired/i);
 assert.throws(()=>verifyPokerSession(valid,Buffer.alloc(8),{chainId,now}),/signing key/i);
});
test('Verified public table projection preserves only safe viewer-private fields',()=>{
 const table=projectCanonicalTable(raw(),session,manifest.tables[0]&&{...manifest.tables[0],chainId},now);
 assert.equal(table.authority,'verified');
 assert.equal(table.table.viewer.seatPlusOne,1);
 assert.deepEqual(table.table.viewer.holeCards,[]);
 assert.equal(table.table.seats[0].playerId,'alice');
 assert.equal(table.table.seats[1].playerId,other);
 assert(!JSON.stringify(table).includes('shuffleSeed'));
});
test('Missing source authority, config, finality or hand proofs fails closed',()=>{
 const m={...manifest.tables[0],chainId};
 for(const field of ['verified','finalized','finalityBlock','stateHash']){
  const r=raw();
  if(field==='verified'||field==='finalized')r[field]=false;
  else if(field==='finalityBlock')r[field]=99;
  else r[field]='0x'+'0'.repeat(64);
  assert.throws(()=>projectCanonicalTable(r,session,m,now));
 }
 assert.throws(()=>projectCanonicalTable({...raw(),config:{...raw().config,hash:'0x'+'d'.repeat(64)}},session,m,now));
 const funded=raw();funded.hand={...funded.hand,nonce:1,phase:'PREFLOP'};
 assert.throws(()=>projectCanonicalTable(funded,session,m,now),/proof/i);
});
test('No spectator or other player can receive plaintext hole cards',()=>{
 const m={...manifest.tables[0],chainId},r=raw();
 r.privateCards=[{rank:'A',suit:'♥'},{rank:'K',suit:'♥'}];r.privateDeliveryVerified=true;
 r.privateRecipient=other;r.privateHandNonce=0;
 assert.throws(()=>projectCanonicalTable(r,session,m,now),/private-card/i);
 const another={...session,subject:'0x'+'3'.repeat(40),viewerId:'spectator'};
 r.privateRecipient=another.subject;
 assert.throws(()=>projectCanonicalTable(r,another,m,now),/private-card/i);
});
test('Discovery and table snapshot require verified read adapter',async()=>{
 let calls=0;
 const reader={readTable:async()=>{calls++;return raw();}};
 const service=createPokerProjection({manifest,reader,secret,clock:()=>now});
 const s=verifyPokerSession(cookie(),secret,{chainId,now});
 const snapshot=await service.snapshot(id,s);
 assert.equal(snapshot.table.pot,0);
 const discovery=await service.tables(s);
 assert.equal(discovery.tables.length,1);
 assert.equal(discovery.tables[0].occupied,2);
 assert.equal(discovery.tables[0].name,'Green Room');
 assert(calls>=2);
 await assert.rejects(()=>service.snapshot('0x'+'f'.repeat(64),s),/not registered/i);
});
function response(){
 const calls=[];return {calls,writeHead:(status,headers)=>calls.push({status,headers}),
 end:(body)=>calls.push({body:JSON.parse(body)})};
}
test('HTTP routes are GET only, cookie-gated, same-origin and non-cacheable',async()=>{
 const reader={readTable:async()=>raw()};
 const p=createPokerProjection({manifest,reader,secret,clock:()=>now});
 const handle=createPokerProjectionHandler(p,{origin:'https://420bet.420integrated.org'});
 const req=(url,method='GET',token=cookie(),origin='https://420bet.420integrated.org')=>({url,method,headers:{cookie:'__Host-poker_session='+token,origin}});
 let res=response();await handle(req('/api/420bet/poker/v1/session'),res);
 assert.equal(res.calls[0].status,200);
 assert.equal(res.calls[1].body.viewerId,'alice');
 assert.match(res.calls[0].headers['Cache-Control'],/no-store/);
 res=response();await handle(req('/api/420bet/poker/v1/tables'),res);
 assert.equal(res.calls[0].status,200);assert.equal(res.calls[1].body.tables[0].id,id);
 res=response();await handle(req('/api/420bet/poker/v1/tables/'+id+'/snapshot'),res);
 assert.equal(res.calls[0].status,200);assert.equal(res.calls[1].body.table.id,id);
 for(const bad of [req('/api/420bet/poker/v1/session','POST'),req('/api/420bet/poker/v1/session','GET','bad'),req('/api/420bet/poker/v1/tables','GET',cookie(),'https://evil.test')]){
  res=response();await handle(bad,res);assert.notEqual(res.calls[0].status,200);
 }
});
test('Chain adapter requires complete pinned contract code hashes and network config',()=>{
 assert.throws(()=>createCanonicalPokerReader({chainId,rpcUrl:'https://rpc.example',contracts:{}}),/contract/i);
 assert.throws(()=>createCanonicalPokerReader({chainId:0,contracts:{}}),/chain/i);
});

test('native hand phases preserve waiting-for-proof vs completed meaning',async()=>{
 const {NATIVE_PHASES}=await import('../chain-reader.mjs');
 assert.deepEqual(NATIVE_PHASES,[
  'NONE','PREFLOP','AWAIT_FLOP','FLOP','AWAIT_TURN','TURN',
  'AWAIT_RIVER','RIVER','SHOWDOWN','UNCONTESTED'
 ]);
 assert.notEqual(NATIVE_PHASES[9],'SETTLED','uncontested is not necessarily settled');
 const r=raw();r.hand={...r.hand,phase:'AWAIT_FLOP'};
 assert.equal(projectCanonicalTable(r,session,{...manifest.tables[0],chainId},now).table.phase,'AWAIT_FLOP');
});
