import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {makeRoom,joinRoom,startRoom,moveRoom,continueRoom,appendChaosChat,reportChaosChat,projectRoom,summarizeRoom,MatchError} from '../room.mjs';
import {signature,handleChaos,authenticate} from '../http.mjs';

const alice='10000000-0000-4000-8000-000000000001';
const bob='20000000-0000-4000-8000-000000000002';
const clara='30000000-0000-4000-8000-000000000003';
const eve='40000000-0000-4000-8000-000000000004';
const key=randomBytes(32);
function req(subject,path,method='GET',data=null,name='Alice'){
 const raw=data===null?'':JSON.stringify(data),at=String(Math.floor(Date.now()/1000));
 const encoded=Buffer.from(name,'utf8').toString('base64url');
 return {method,url:path,body:raw,headers:{
  'content-type':method==='POST'?'application/json':undefined,
  'x-chaos-subject':subject,'x-chaos-time':at,'x-chaos-name':encoded,
  'x-chaos-signature':signature(key,{method,path,at,subject,name:encoded,raw})
 }};
}
class TestRooms{
 constructor(){this.rooms=new Map();}
 async create(r){this.rooms.set(r.id,r);return r;}
 async list(actor){return [...this.rooms.values()].filter(r=>r.seats.some(s=>s.subject===actor)).map(r=>summarizeRoom(r,actor));}
 async get(id,actor){
  const r=this.rooms.get(id);
  if(!r||!r.seats.some(s=>s.subject===actor))throw new MatchError(404,'Match not found');
  return r;
 }
 async mutate(id,actor,rev,apply,{code=null}={}){
  const room=code?[...this.rooms.values()].find(r=>r.code===code):await this.get(id,actor);
  if(!room)throw new MatchError(404,'Match not found');
  if(code===null&&rev!==room.revision)throw new MatchError(409,'Stale version');
  const next=apply(room);this.rooms.set(room.id,next);return next;
 }
 async join(actor,code,name){return projectRoom(await this.mutate(null,actor,null,room=>joinRoom(room,actor,name),{code}),actor);}
 async chat(id,actor,text){const updated=appendChaosChat(await this.get(id,actor),actor,text);this.rooms.set(id,updated);return updated;}
 async reportChat(id,actor,messageId){const updated=reportChaosChat(await this.get(id,actor),actor,messageId);this.rooms.set(id,updated);return true;}
}
const call=(repository,subject,path,method,data,name)=>
 handleChaos(req(subject,path,method,data,name),{repo:repository,key});
const path='/v1/chaos/rooms';

test('Two separate 420ID account subjects join an unguessable private room',async()=>{
 const repo=new TestRooms();
 const created=(await call(repo,alice,path,'POST',{humanSeats:2,bots:[],vehicle:'wagon'},'Martha')).room;
 assert.equal(created.seat,0);assert.equal(created.status,'lobby');assert.match(created.joinCode,/^[\w-]{32}$/);
 assert.deepEqual(created.seats.map(s=>s.joined),[true,false]);
 assert.equal(created.host,true);
 assert.deepEqual(await call(repo,eve,path),{rooms:[],onChain:false});
 await assert.rejects(()=>call(repo,eve,path+'/'+created.id),e=>e.status===404);
 await assert.rejects(()=>call(repo,bob,path+'/'+created.id+'/start','POST',{expectedRevision:0}),e=>e.status===404);
 const joined=(await call(repo,bob,path+'/join','POST',{code:created.joinCode},'Bobby')).room;
 assert.equal(joined.seat,1);assert.equal(joined.joinCode,null);
 assert.equal(joined.seats[0].name,'Martha');assert.equal(joined.seats[1].name,'Bobby');
 assert.deepEqual((await call(repo,bob,path)).rooms.map(x=>x.id),[created.id]);
 const active=(await call(repo,alice,path+'/'+created.id+'/start','POST',{expectedRevision:joined.revision})).room;
 assert.equal(active.status,'playing');assert.equal(active.seat,0);
 assert.equal(active.hand.length,7);assert.equal(active.players.length,2);
 assert.equal(active.legal.length>0,true);
 assert.equal(JSON.stringify(active).includes('legendaryByLeg'),false);
 assert.equal(JSON.stringify(active).includes('"deck"'),false);
 assert.equal(JSON.stringify(active).includes('"seed"'),false);
 assert.equal(JSON.stringify(active.players).includes('"hand"'),false);
 const other=(await call(repo,bob,path+'/'+created.id)).room;
 assert.equal(other.legal.length,0);
 assert.equal(other.hand.length,7);
 assert.equal(other.players[0].km,active.players[0].km);
 assert.equal(other.hand.every((c,i)=>!active.hand[i]||c.type!==undefined),true);
 assert.equal(other.joinCode,null);
 assert.equal(JSON.stringify(other).includes('"seed"'),false);
 await assert.rejects(()=>call(repo,bob,path+'/'+created.id+'/move','POST',{
  expectedRevision:other.revision,move:{action:'pass'}}),e=>e.status===409);
 let next=(await call(repo,alice,path+'/'+created.id+'/move','POST',{
  expectedRevision:active.revision,move:{action:'pass'}})).room;
 assert.equal(next.seat,0);
 assert.equal(next.discardRemaining,2);
 await assert.rejects(()=>call(repo,alice,path+'/'+created.id+'/move','POST',{
  expectedRevision:active.revision,move:{action:'pass'}}),e=>e.status===409);
 for(let n=0;n<2;n++)next=(await call(repo,alice,path+'/'+created.id+'/move','POST',{
  expectedRevision:next.revision,move:{action:'discard',index:0}})).room;
 assert.equal(next.turn,1);
 assert.equal(next.legal.length,0);
 const bobTurn=(await call(repo,bob,path+'/'+created.id)).room;
 assert.equal(bobTurn.legal.length>0,true);
 assert.equal(bobTurn.hand.length,7);
 await assert.rejects(()=>call(repo,eve,path+'/'+created.id),e=>e.status===404);
});
test('Room authorization, invalid seats, code expiry on start and race revisions',async()=>{
 const r=makeRoom(alice,'Very long username that is truncated gracefully',{humanSeats:2,bots:['hard']});
 assert.equal(r.seats.length,3);
 assert.equal(r.seats[2].controller,'computer');
 assert.equal(r.seats[2].difficulty,'hard');
 assert.throws(()=>makeRoom(alice,'A',{humanSeats:4,bots:['normal']}),e=>e.status===400);
 assert.throws(()=>startRoom(r,alice),e=>e.status===409);
 const joined=joinRoom(r,bob,'Bobby');
 const started=startRoom(joined,alice);
 assert.equal(started.status,'playing');
 assert.equal(started.game.players.length,3);
 assert.equal(started.game.players[2].difficulty,'hard');
 assert.equal(projectRoom(started,alice).hand.length,7);
 assert.equal(projectRoom(started,bob).hand.length,7);
 assert.throws(()=>projectRoom(started,eve),e=>e.status===404);
 assert.throws(()=>joinRoom(started,clara,'Clara'),e=>e.status===409);
 assert.throws(()=>startRoom(joined,bob),e=>e.status===404);
});
test('Server-owned computer turns resolve without exposing AI or rival private stock',()=>{
 let room=makeRoom(alice,'Martha',{humanSeats:1,bots:['hard']});
 room=startRoom(room,alice);
 let guard=0;
 while(room.status==='playing'&&room.game.turn===0&&guard++<12){
  const state=projectRoom(room,alice);
  const o=state.legal.find(x=>x.action==='pass')||state.legal[0];
  room=moveRoom(room,alice,o);
 }
 assert.equal(room.game.turn,0,'computer finishes its move before next human');
 const view=projectRoom(room,alice);
 assert.ok(view.players[1].controller==='computer');
 assert.equal(JSON.stringify(view).includes('deck'),false);
 assert.equal(JSON.stringify(view).includes('legendaryByLeg'),false);
 assert.equal(JSON.stringify(view).includes('fresh'),false);
});
test('Server signatures bind subject, exact method/path, body and time, never browser cookies',async()=>{
 const repo=new TestRooms();
 const correct=req(alice,path,'POST',{humanSeats:2},'Alice');
 assert.equal(authenticate(correct,correct.body,key).subject,alice);
 await handleChaos(correct,{repo,key});
 for(const change of [
  {...correct,body:'{"humanSeats":4}'},
  {...correct,url:'/v1/chaos/rooms/alternate'},
  {...correct,method:'GET'},
  {...correct,headers:{...correct.headers,'x-chaos-subject':bob}},
  {...correct,headers:{...correct.headers,'x-chaos-signature':'A'.repeat(43)}},
  {...correct,headers:{...correct.headers,'x-chaos-time':String(Math.floor(Date.now()/1000)-240)}}
 ])await assert.rejects(()=>handleChaos(change,{repo,key}),e=>[400,401,404].includes(e.status));
 const outsider={...correct,headers:{...correct.headers,'x-chaos-subject':eve,'x-chaos-signature':'B'.repeat(43)}};
 await assert.rejects(()=>handleChaos(outsider,{repo,key}),e=>e.status===401);
 assert.equal(JSON.stringify(await call(repo,alice,path)).includes('onChain'),true);
});
test('Malicious client-provided seed, hand, winner, score and action fields are rejected',async()=>{
 const repo=new TestRooms();
 for(const fields of [
  {humanSeats:2,seed:0},{humanSeats:2,deck:['cheat']},{humanSeats:2,score:9999},
  {humanSeats:4,bots:['hard']},{humanSeats:2,bots:['expert']}
 ])await assert.rejects(()=>call(repo,alice,path,'POST',fields),e=>[400,503].includes(e.status));
 const active=startRoom(joinRoom(makeRoom(alice,'A',{humanSeats:2}),bob,'B'),alice);
 const movePath=path+'/'+active.id+'/move';
 repo.rooms.set(active.id,active);
 await assert.rejects(()=>call(repo,alice,movePath,'POST',
  {expectedRevision:active.revision,move:{action:'pass',winner:alice}}),e=>e.status===400);
 await assert.rejects(()=>call(repo,alice,movePath,'POST',
  {expectedRevision:active.revision,move:{action:'hazard',index:0,target:0}}),e=>e.status===409);
 await assert.rejects(()=>call(repo,alice,movePath,'POST',
  {expectedRevision:active.revision,move:{action:'pass',seed:0}}),e=>e.status===400);
});

test('Online regional hands are CSPRNG shuffled, independent of the 32-bit event seed',async()=>{
 const joined=joinRoom(makeRoom(alice,'Alice',{humanSeats:2}),bob,'Bobby');
 const started=startRoom(joined,alice);
 const g=started.game;
 const cards=[...g.deck,...g.players.flatMap(p=>p.hand)];
 assert.ok(cards.length>50);
 assert.equal(new Set(cards.map(c=>c.uid)).size,cards.length,'every card is in exactly one hand or stock');
 assert.ok(g.players.every(p=>p.hand.length===7));
 const view=projectRoom(started,alice);
 assert.equal(view.stockCount,g.deck.length);
 assert.equal(view.hand.length,7);
 assert.doesNotMatch(JSON.stringify(view),/"seed"|"deck"|"legendaryByLeg"/);
 const source=await readFile(new URL('../room.mjs',import.meta.url),'utf8');
 assert.match(source,/randomInt\(i\+1\)/);
 assert.match(source,/secureRegionalDeal\(advanceChaosLeg\(room\.game\)\)/);
});

test('Account-only chat persists across turns and legs without changing game revision or leaking identities',async()=>{
 const repo=new TestRooms(),lobby=joinRoom(makeRoom(alice,'Alice',{humanSeats:2}),bob,'Bobby');
 repo.rooms.set(lobby.id,lobby);
 const url=path+'/'+lobby.id+'/chat';
 const original=lobby.revision;
 const sent=(await call(repo,alice,url,'POST',{text:'The ferry is NEVER on time!'})).room;
 assert.equal(sent.revision,original);
 assert.equal(sent.chat.length,1);
 assert.equal(sent.chat[0].seat,0);
 assert.equal(sent.chat[0].text,'The ferry is NEVER on time!');
 assert.equal(JSON.stringify(sent.chat).includes(alice),false);
 assert.equal((await call(repo,bob,path+'/'+lobby.id)).room.chat[0].text,sent.chat[0].text);
 await assert.rejects(()=>call(repo,eve,url,'POST',{text:'Intrusion'}),e=>e.status===404);
});
test('Chat blocks forged payloads, markup control characters, flood and untrusted account claims',async()=>{
 const r=joinRoom(makeRoom(alice,'A',{humanSeats:2}),bob,'B');
 const time=Date.now();
 assert.throws(()=>appendChaosChat(r,eve,'Hi'),e=>e.status===404);
 for(const input of ['', '  ','x'.repeat(281),'<img>\u0000',123])
  assert.throws(()=>appendChaosChat(r,alice,input),e=>e.status===400);
 const one=appendChaosChat(r,alice,'<script>alert(1)</script>',{now:time});
 assert.equal(one.revision,r.revision);
 assert.equal(one.chat[0].seat,0);
 assert.throws(()=>appendChaosChat(one,alice,'spam',{now:time+500}),e=>e.status===429);
 const two=appendChaosChat(one,bob,'nice try',{now:time+500});
 assert.equal(two.chat.length,2);
 const repo=new TestRooms();repo.rooms.set(r.id,r);
 const url=path+'/'+r.id+'/chat';
 await assert.rejects(()=>call(repo,alice,url,'POST',{text:'hi',subject:eve}),e=>e.status===400);
 await assert.rejects(()=>call(repo,alice,url,'POST',{message:'hi'}),e=>e.status===400);
});

test('Chat reports are member-only, persisted privately, deduplicated and revision-neutral',async()=>{
 const repo=new TestRooms(),room=joinRoom(makeRoom(alice,'A',{humanSeats:2}),bob,'B');
 repo.rooms.set(room.id,room);
 const chat=(await call(repo,alice,path+'/'+room.id+'/chat','POST',{text:'Questionable shortcut!'})).room;
 const messageId=chat.chat[0].id,url=path+'/'+room.id+'/chat/report';
 assert.deepEqual(await call(repo,bob,url,'POST',{messageId}),{reported:true,onChain:false});
 const record=await repo.get(room.id,bob);
 assert.equal(record.revision,room.revision);
 assert.equal(record.chatReports[0].reporter,bob);
 assert.equal(record.chatReports[0].messageId,messageId);
 assert.equal(JSON.stringify(projectRoom(record,alice)).includes('chatReports'),false);
 assert.equal(JSON.stringify(projectRoom(record,alice)).includes(bob),false);
 await assert.rejects(()=>call(repo,eve,url,'POST',{messageId}),e=>e.status===404);
 await assert.rejects(()=>call(repo,alice,url,'POST',{messageId}),e=>e.status===400);
 await assert.rejects(()=>call(repo,bob,url,'POST',{messageId}),e=>e.status===409);
});
