import test from 'node:test';
import assert from 'node:assert/strict';
import {SaladController,normalizeSalad} from '../core/word-salad-session.js';
import {createSaladRuntime} from '../core/word-salad-runtime.js';
const id='11111111-1111-4111-8111-111111111111',roomId='22222222-2222-4222-8222-222222222222',actor='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
const envelope={onChain:false,wager:false,rewards:false};
const snapshot=()=>({id,roomId,gameId:'scrabble',rulesVersion:'v1',rulesHash:'a'.repeat(64),sequence:1,seatCount:2,viewerSeat:0,status:'active',turnSeat:0,deadline:null,winnerSeat:null,privateView:{variant:'11:classic-salad:untimed',board:{},blankCells:[],rack:[{id:0,symbol:'A',value:1},{id:1,symbol:'?',value:0}],rackCounts:[2,7],bagCount:71,scores:[0,0],turn:0,terminal:false,winners:null,forfeit:[false,false],ending:''}});
const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const wrap=s=>({status:200,data:{...envelope,session:s}});
function harness(){
 let s=snapshot(),subject=actor,mode=400,posts=[],down=false,hold=null,readHold=null,readStatus=200;
 const fetchImpl=async(url,opts)=>{
 if(down)throw Error('offline');
 if(url.endsWith('/v1/me'))return subject?response(200,{walletRequired:false,profile:{subject}}):response(401,{});
 if(url.endsWith('/action')){posts.push(JSON.parse(opts.body));if(hold)await hold;if(posts.at(-1).expectedSequence!==s.sequence+1)return response(409,{...envelope,session:s});if(mode===200){s.sequence++;s.turnSeat=1;s.privateView.turn=1;}return response(mode,{...envelope,session:s});}
 if(url.endsWith('/classic-sessions'))return response(200,{...envelope,sessions:[s]});
 if(url.endsWith('/classic-rooms/'+roomId))return response(200,{...envelope,room:{id:roomId,gameId:'scrabble',seats:[{index:0,controller:'human',subject:actor},{index:1,controller:'bot',difficulty:'hard'}]}});
 if(readHold)await readHold;return response(readStatus,{...envelope,session:s});
 };
 const c=new SaladController({enabled:true,fetchImpl});
 return {c,fetchImpl,posts,get s(){return s;},set subject(x){subject=x;},set mode(x){mode=x;},set down(x){down=x;},set hold(x){hold=x;},set readStatus(x){readStatus=x;},set readHold(x){readHold=x;}};
}
test('valid private snapshot and malformed or concealed fields fail closed',()=>{
 assert.ok(normalizeSalad(wrap(snapshot()),id));
 for(const corrupt of [s=>s.privateView.rack.push(s.privateView.rack[0]),s=>s.privateView.opponentRack=[],s=>s.privateView.board[121]='A',s=>s.privateView.blankCells=[0],s=>s.privateView.rack[0].value=9,s=>s.privateView.variant='11:bad',s=>s.rulesHash='bad',s=>s.privateView.turn=1,s=>s.seed='private',s=>s.privateView.bagCount=80]){const s=snapshot();corrupt(s);assert.equal(normalizeSalad(wrap(s),id),null);}
});
test('rejected placement preserves draft at same revision; conflict clears it',async()=>{
 const h=harness(),c=h.c;await c.refresh(id);assert.equal(c.state.status,'ready');c.select(1);c.place(60,'T');const draft=structuredClone(c.state.draft);
 await c.act({type:'place',tiles:Object.values(draft)});assert.deepEqual(c.state.draft,draft);assert.match(c.state.error,/rejected/);
 h.mode=409;h.s.sequence++;await c.act({type:'place',tiles:Object.values(draft)});assert.deepEqual(c.state.draft,{});assert.equal(c.state.session.sequence,2);
});
test('duplicate submission prevented, accepted revision confirmed by GET',async()=>{
 const h=harness(),c=h.c;await c.refresh(id);h.mode=200;let release;h.hold=new Promise(r=>release=r);const pending=c.act({type:'pass'});await c.act({type:'pass'});release();await pending;
 assert.equal(h.posts.length,1);assert.equal(h.posts[0].expectedSequence,2);assert.equal(c.state.session.sequence,2);assert.equal(c.canPlay(),false);
});
test('stale and conflicting revisions conceal rack',async()=>{
 const h=harness(),c=h.c;h.s.sequence=3;await c.refresh(id);h.s.sequence=2;await c.refresh(id);assert.equal(c.state.session,null);assert.equal(c.state.status,'unavailable');
});
test('expired authentication and changed account clear draft and private projection',async()=>{
 const h=harness(),c=h.c;await c.refresh(id);c.select(0);c.place(60);h.subject=null;await c.refresh(id);assert.equal(c.state.status,'guest');assert.equal(c.state.session,null);assert.deepEqual(c.state.draft,{});
 h.subject=actor;await c.refresh(id);h.subject=other;await c.refresh(id);assert.equal(c.state.session,null);assert.equal(c.state.status,'unavailable');
});
test('transport failure hides rack; fresh controller recovers completed shared victory',async()=>{
 const h=harness(),c=h.c;await c.refresh(id);h.down=true;await c.refresh(id);assert.equal(c.state.session,null);h.down=false;await c.refresh(id);assert.equal(c.state.status,'ready');
 h.s.status='finished';h.s.sequence++;h.s.turnSeat=null;Object.assign(h.s.privateView,{turn:-1,terminal:true,winners:[0,1],ending:'scoreless'});const next=new SaladController({enabled:true,fetchImpl:h.fetchImpl});await next.refresh(null);assert.equal(next.state.matches[0].status,'finished');assert.equal(Object.hasOwn(next.state.matches[0],'privateView'),false);await next.refresh(id);assert.equal(next.state.status,'ready');assert.deepEqual(next.state.session.privateView.winners,[0,1]);assert.equal(next.canPlay(),false);
});
test('runtime invalidates on offline, hidden page, logout and destruction',async()=>{
 const h=harness(),win=new EventTarget(),doc=new EventTarget();win.location={pathname:'/games/scrabble/play',search:'?session='+id};win.setInterval=()=>1;win.clearInterval=()=>{};doc.hidden=false;
 const runtime=createSaladRuntime({enabled:true,win,doc,fetchImpl:h.fetchImpl});await runtime.refresh();assert.equal(runtime.state.status,'ready');win.dispatchEvent(new Event('offline'));assert.equal(runtime.state.session,null);await runtime.refresh();doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(runtime.state.session,null);doc.hidden=false;await runtime.refresh();runtime.suspend();await runtime.refresh();assert.equal(runtime.state.session,null);await runtime.resume();assert.equal(runtime.state.status,'ready');runtime.destroy();assert.equal(runtime.state.session,null);
});

test('temporary service failures suspend moves, retain session identity and recover without mutation',async()=>{const h=harness(),c=h.c;await c.refresh(id);for(const status of [429,503,504]){h.readStatus=status;await c.refresh(id);assert.equal(c.state.status,'reconnecting');assert.equal(c.state.session.id,id);assert.equal(c.canPlay(),false);await c.act({type:'pass'});assert.equal(h.posts.length,0);h.readStatus=200;await c.refresh(id);assert.equal(c.state.status,'ready');assert.equal(c.canPlay(),true);}h.readStatus=403;await c.refresh(id);assert.equal(c.state.session,null);});

test('accepted move snapshot is published before follow-up read and stalled bot is recovered',async()=>{
 const initial=snapshot();let s=structuredClone(initial),now=0,recoveries=0,reads=0,seen=[];
 const clock=Date.now;Date.now=()=>now;
 try{
 const c=new SaladController({enabled:true,onChange:()=>seen.push([c.state.status,c.state.session?.sequence]),fetchImpl:async(url,opts)=>{
  if(url.endsWith('/v1/me'))return response(200,{walletRequired:false,profile:{subject:actor}});
  if(url.endsWith('/classic-rooms/'+roomId))return response(200,{...envelope,room:{id:roomId,gameId:'scrabble',seats:[{index:0,controller:'human',subject:actor},{index:1,controller:'bot',difficulty:'hard'}]}});
  if(url.endsWith('/action')){s.sequence=2;s.turnSeat=1;s.privateView.turn=1;return response(200,{...envelope,session:s});}
  if(url.endsWith('/recover-bot')){recoveries++;assert.deepEqual(JSON.parse(opts.body),{});s.sequence=3;s.turnSeat=0;s.privateView.turn=0;return response(200,{...envelope,session:s});}
  reads++;if(reads===2)assert.ok(seen.some(x=>x[0]==='ready'&&x[1]===2),'acknowledgement discarded');return response(200,{...envelope,session:s});
 }});
 await c.refresh(id);await c.act({type:'pass'});assert.equal(c.state.session.sequence,2);assert.equal(c.canPlay(),false);
 now=9000;await c.refresh(id);assert.equal(recoveries,0);
 now=11000;await c.refresh(id);assert.equal(recoveries,1);assert.equal(c.state.session.sequence,3);assert.equal(c.canPlay(),true);
 await c.refresh(id);assert.equal(recoveries,1);
 }finally{Date.now=clock;}
});

test('player commands during polling are sent once when the same revision is confirmed',async()=>{
 for(const [move,action] of [[{type:'pass'},'move'],[{type:'exchange',ids:[0]},'move'],[{type:'place',tiles:[{row:5,col:5,id:0}]},'move'],[undefined,'resign']]){
 const h=harness(),c=h.c;await c.refresh(id);let release;h.readHold=new Promise(r=>release=r);const poll=c.refresh(id);await new Promise(r=>setTimeout(r,0));const command=c.act(move,action);assert.equal(c.state.status,'submitting');await c.act(move,action);await new Promise(r=>setTimeout(r,0));assert.equal(h.posts.length,1,'first click must reach server before background read releases');h.readHold=null;release();await Promise.all([poll,command]);assert.equal(h.posts.length,1);assert.equal(h.posts[0].action,action);assert.deepEqual(h.posts[0].move,move);
 }
});
test('superseded poll cannot publish stale state and server rejects stale expected sequence',async()=>{const h=harness(),c=h.c;await c.refresh(id);let release;h.readHold=new Promise(r=>release=r);const poll=c.refresh(id);await new Promise(r=>setTimeout(r,0));h.s.sequence++;const command=c.act({type:'pass'});h.readHold=null;release();await Promise.all([poll,command]);assert.equal(h.posts.length,1);assert.equal(h.posts[0].expectedSequence,2);assert.equal(c.state.session.sequence,2);assert.match(c.state.error,/changed/);});

test('superseding a poll still verifies principal before any mutation',async()=>{const h=harness(),c=h.c;await c.refresh(id);let release;h.readHold=new Promise(r=>release=r);const poll=c.refresh(id);await new Promise(r=>setTimeout(r,0));h.subject=other;const command=c.act({type:'pass'});h.readHold=null;release();await Promise.all([poll,command]);assert.equal(h.posts.length,0);assert.equal(c.state.session,null);});
