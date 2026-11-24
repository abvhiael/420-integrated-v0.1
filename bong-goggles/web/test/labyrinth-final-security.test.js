import test from 'node:test';
import assert from 'node:assert/strict';
import {LabyrinthSessionController,LABYRINTH_RULES_HASH} from '../core/labyrinth-session.js';
import {LABYRINTH_RULES_VERSION} from '../core/labyrinth-cribbage-ui.js';
const id='10000000-1111-4111-8111-111111111111';
const room='20000000-2222-4222-8222-222222222222';
const people=['30000000-3333-4333-8333-333333333333','40000000-4444-4444-8444-444444444444'];
const cards=[[0,1,2,3,4,5,6,7,8],[13,14,15,16,17,18,19,20,21]];
const reply=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'Content-Type':'application/json'}
});
const snapshot=seat=>({onChain:false,wager:false,rewards:false,session:{
 id,roomId:room,gameId:'labyrinth-cribbage',seatCount:2,status:'active',
 rulesVersion:LABYRINTH_RULES_VERSION,rulesHash:LABYRINTH_RULES_HASH,
 sequence:1,turnSeat:0,deadline:'2027-01-03T05:00:00Z',
 winnerSeat:null,finishedReason:'',updatedAt:'2026-11-23T22:30:00Z',
 viewerSeat:seat,privateView:{
 gameId:'labyrinth-cribbage',variant:'labyrinth-2p',round:1,
 phase:'discard',dealer:1,turn:0,seat,scores:[0,0],hand:cards[seat],
 cardCounts:[9,9],cribCount:0,discarded:[false,false],starter:-1,
 pegCount:0,pegPile:[],pegged:[[],[]],saidGo:[false,false],
 lastShow:[],lastAwards:[],losers:[],winner:null
 }}});
test('BC-2.7 same-session sequence cannot retain another 420ID seat private cards',async()=>{
 let seat=0,deny=false;
 const client=new LabyrinthSessionController({enabled:true,fetchImpl:async url=>{
  const path=new URL(url,'https://fixture.test').pathname.replace(/^\/social-api/,'');
  if(path==='/v1/me')return reply({walletRequired:false,profile:{subject:people[seat]}});
  if(path==='/v1/classic-sessions/'+id)return deny?reply({},403):reply(snapshot(seat));
  if(path==='/v1/classic-sessions')return reply({onChain:false,wager:false,rewards:false,sessions:[{
   id,roomId:room,gameId:'labyrinth-cribbage',rulesVersion:LABYRINTH_RULES_VERSION,
   rulesHash:LABYRINTH_RULES_HASH,sequence:1,status:'active'}]});
  throw Error('Unexpected '+path);
 }});
 await client.open(id);
 assert.equal(client.state.status,'ready');
 assert.deepEqual(client.state.view.hand,cards[0]);
 seat=1;
 await client.open(id,{quiet:true});
 assert.equal(client.state.status,'ready');
 assert.equal(client.state.session.sequence,1,'no new turn is required for account switch');
 assert.equal(client.state.session.viewerSeat,1);
 assert.deepEqual(client.state.view.hand,cards[1]);
 assert.ok(!client.state.view.hand.includes(cards[0][0]));
 // Account switch while loading My Games cannot retain the old private table.
 seat=0;
 await client.list();
 assert.equal(client.state.view,null);
 assert.equal(client.state.session,null);
 assert.deepEqual(client.state.recoverable.map(x=>x.id),[id]);
 deny=true;
 await client.open(id);
 assert.equal(client.state.view,null);
 assert.equal(client.state.status,'unavailable');
});
test('BC-2.7 signed-out 420ID clears previously verified private state',async()=>{
 let valid=true;
 const client=new LabyrinthSessionController({enabled:true,fetchImpl:async url=>{
  const path=new URL(url,'https://fixture.test').pathname.replace(/^\/social-api/,'');
  if(path==='/v1/me')return valid?reply({walletRequired:false,profile:{subject:people[0]}}):reply({},401);
  if(path==='/v1/classic-sessions/'+id)return reply(snapshot(0));
  throw Error('Unexpected '+path);
 }});
 await client.open(id);assert.equal(client.state.view.hand.length,9);
 valid=false;
 await client.open(id,{quiet:true});
 assert.equal(client.state.view,null);assert.equal(client.state.session,null);
 assert.equal(client.state.status,'guest');
});
