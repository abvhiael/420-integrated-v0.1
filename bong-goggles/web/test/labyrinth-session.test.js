import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {LabyrinthSessionController,normalizeLabyrinthSession,LABYRINTH_RULES_HASH} from '../core/labyrinth-session.js';
import {LABYRINTH_MANIFEST_SHA,LABYRINTH_RULES_VERSION} from '../core/labyrinth-cribbage-ui.js';
const id='10000000-1111-4111-8111-111111111111',room='20000000-2222-4222-8222-222222222222';
const member='30000000-3333-4333-8333-333333333333';
const hash=createHash('sha256').update('labyrinth-cribbage\nv2.0\n'+
 'bc-labyrinth-cribbage-325@2.0.0;manifest-sha256='+LABYRINTH_MANIFEST_SHA+
 ';six-retained;six-crib;four-players-partners-or-individual;325;auto-count;no-muggins').digest('hex');
const view=()=>({gameId:'labyrinth-cribbage',variant:'labyrinth-2p',round:1,phase:'discard',
 dealer:1,turn:0,seat:0,scores:[0,0],hand:[0,1,2,3,4,5,6,7,8],
 cardCounts:[9,9],cribCount:0,discarded:[false,false],starter:-1,pegCount:0,
 pegPile:[],pegged:[[],[]],saidGo:[false,false],lastShow:[],lastAwards:[],
 losers:[],winner:null});
const wire=(v=view(),sequence=1)=>({status:200,data:{onChain:false,wager:false,rewards:false,
 session:{id,roomId:room,gameId:'labyrinth-cribbage',seatCount:2,status:'active',
 rulesVersion:LABYRINTH_RULES_VERSION,rulesHash:LABYRINTH_RULES_HASH,sequence,
 turnSeat:0,deadline:null,winnerSeat:null,updatedAt:'2026-11-23T18:00:00Z',viewerSeat:0,
 privateView:v}}});
test('BC-2.4 Labyrinth session hash is the SHA-256 of the exact compiled v2 Go identity',()=>{
 assert.equal(hash,LABYRINTH_RULES_HASH);
 assert.equal(LABYRINTH_RULES_VERSION,'v2.0');
});
test('BC-2.4 only authenticated server v2 seat snapshots enter the table',()=>{
 assert.ok(normalizeLabyrinthSession(wire(),member)?.view);
 const bad=[
  wire({...view(),deck:[1,2]}),wire({...view(),crib:[7,8]}),
  {...wire(),data:{...wire().data,rewards:true}},
  {...wire(),data:{...wire().data,session:{...wire().data.session,rulesVersion:'v1.0'}}},
  {...wire(),data:{...wire().data,session:{...wire().data.session,rulesHash:'0'.repeat(64)}}},
  {...wire(),data:{...wire().data,session:{...wire().data.session,viewerSeat:1}}},
  {...wire(),data:{...wire().data,session:{...wire().data.session,gameId:'cribbage'}}}
 ];
 for(const v of bad)assert.equal(normalizeLabyrinthSession(v,member),null);
 assert.equal(normalizeLabyrinthSession(wire(),'invalid'),null);
});
test('BC-2.4 maintain private table and reject replay after stale or rejected moves',async()=>{
 const events=[],requests=[];
 let server=wire(),auth=true;
 const fake=async(url,options={})=>{
  const u=new URL(url,'https://fake.local');
  u.pathname=u.pathname.replace(/^\/social-api(?=\/v1\/)/,'');
  requests.push({path:u.pathname,method:options.method||'GET',body:options.body});
  if(u.pathname==='/v1/me')return new Response(JSON.stringify(auth?{
   walletRequired:false,profile:{subject:member}}:{}),{status:auth?200:401,headers:{'Content-Type':'application/json'}});
  if(u.pathname.includes('/classic-sessions/')){
   const action=u.pathname.endsWith('/action');
   if(action){
    // POST remains server authoritative; never accept locally synthesized scores.
    return new Response(JSON.stringify({...server.data}),{status:403,headers:{'Content-Type':'application/json'}});
   }
   return new Response(JSON.stringify(server.data),{status:200,headers:{'Content-Type':'application/json'}});
  }
  return new Response('{}',{status:404,headers:{'Content-Type':'application/json'}});
 };
 const c=new LabyrinthSessionController({enabled:true,fetchImpl:fake,onChange:x=>events.push(x.status)});
 await c.open(id);
 assert.equal(c.state.status,'ready');
 assert.equal(c.state.view.hand.length,9);
 c.select([0,1,2]);
 assert.deepEqual(c.state.selection,[0,1,2]);
 await c.open(id,{quiet:true});
 assert.deepEqual(c.state.selection,[0,1,2],'same-sequence refresh cannot bounce table/menu');
 await assert.rejects(c.act({type:'discard',cards:[0,1,2]}));
 assert.equal(c.state.view,null,'auth revocation must clear private cards');
 assert.equal(c.state.status,'unavailable');
 assert.ok(requests.some(x=>x.path.endsWith('/action')&&x.method==='POST'));
 // A bad local move cannot generate an HTTP action request.
 const before=requests.filter(x=>x.path.endsWith('/action')).length;
 await assert.rejects(c.act({type:'play',card:51}));
 assert.equal(requests.filter(x=>x.path.endsWith('/action')).length,before);
});
test('BC-2.4 My Games only lists verified 325-point matching sessions, no hidden fields',async()=>{
 const sessions=[{id,roomId:room,gameId:'labyrinth-cribbage',rulesVersion:'v2.0',
  rulesHash:LABYRINTH_RULES_HASH,status:'active',sequence:2},
  {id:'40000000-4444-4444-8444-444444444444',roomId:room,gameId:'labyrinth-cribbage',
   rulesVersion:'v1.0',rulesHash:LABYRINTH_RULES_HASH,status:'active',sequence:1},
  {id:'50000000-5555-4555-8555-555555555555',roomId:room,gameId:'cribbage',
   rulesVersion:'v2.0',rulesHash:LABYRINTH_RULES_HASH,status:'active',sequence:1}];
 const fake=async(url)=>{
  const p=new URL(url,'https://fake.local').pathname.replace(/^\/social-api(?=\/v1\/)/,'');
  const data=p==='/v1/me'?{walletRequired:false,profile:{subject:member}}:
   {onChain:false,wager:false,rewards:false,sessions};
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const c=new LabyrinthSessionController({enabled:true,fetchImpl:fake});
 await c.list();
 assert.equal(c.state.recoverable.length,1);
 assert.equal(c.state.recoverable[0].id,id);
 assert.deepEqual(Object.keys(c.state.recoverable[0]).sort(),['id','roomId','sequence','status']);
});
