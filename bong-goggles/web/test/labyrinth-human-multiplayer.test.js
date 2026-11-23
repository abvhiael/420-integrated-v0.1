import test from 'node:test';
import assert from 'node:assert/strict';
import {LabyrinthSessionController,normalizeLabyrinthSession,LABYRINTH_RULES_HASH} from '../core/labyrinth-session.js';
import {LABYRINTH_MANIFEST_SHA,LABYRINTH_RULES_VERSION,renderLabyrinthScreen,verifyLabyrinthProjection} from '../core/labyrinth-cribbage-ui.js';

const id='10000000-1111-4111-8111-111111111111';
const room='20000000-2222-4222-8222-222222222222';
const host='30000000-3333-4333-8333-333333333333';
const peer='40000000-4444-4444-8444-444444444444';
const nextRoom='50000000-5555-4555-8555-555555555555';
const v=()=>({gameId:'labyrinth-cribbage',variant:'labyrinth-2p',round:1,phase:'discard',
 dealer:1,turn:0,seat:0,scores:[0,0],hand:[0,1,2,3,4,5,6,7,8],
 cardCounts:[9,9],cribCount:0,discarded:[false,false],starter:-1,pegCount:0,
 pegPile:[],pegged:[[],[]],saidGo:[false,false],lastShow:[],lastAwards:[],losers:[],winner:null});
const wire=(status='active',sequence=1,who=host)=>({
 status:200,data:{onChain:false,wager:false,rewards:false,session:{
 id,roomId:room,gameId:'labyrinth-cribbage',seatCount:2,status,
 rulesVersion:LABYRINTH_RULES_VERSION,rulesHash:LABYRINTH_RULES_HASH,
 sequence,turnSeat:status==='active'?0:null,
 deadline:status==='active'?'2027-01-02T01:02:03Z':null,
 winnerSeat:status==='resigned'?1:null,finishedReason:status==='active'?'':status,
 updatedAt:'2026-11-23T18:00:00Z',viewerSeat:0,privateView:v()
 }}});
function response(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
}
test('BC-2.5 server terminal snapshots remain verifiable without inventing a finished game hand',()=>{
 for(const status of ['resigned','timed_out','cancelled']){
  const normalized=normalizeLabyrinthSession(wire(status,2),host);
  assert.ok(normalized,status);
  assert.equal(normalized.session.status,status);
  assert.equal(normalized.session.turnSeat,null);
  assert.equal(normalized.view.status,status);
  assert.equal(verifyLabyrinthProjection(normalized.view)?.status,status);
  const html=renderLabyrinthScreen({screen:'play',session:normalized.session,view:normalized.view});
  assert.match(html,new RegExp('Match ended: '+status));
  assert.match(html,/data-lab-rematch/);
  assert.doesNotMatch(html,/data-lab-action="play"|data-lab-action="cut"|data-lab-action="discard"|data-lab-lifecycle="resign"/);
 }
 assert.equal(normalizeLabyrinthSession({...wire('resigned',2),data:{...wire('resigned',2).data,wager:true}},host),null);
});
test('BC-2.5 resign is server-confirmed, idempotency sequence bound and no optimistic winner',async()=>{
 let current=wire(),seen=[],requestCount=0;
 const fake=async(url,options={})=>{
  const path=new URL(url,'https://example.test').pathname.replace(/^\/social-api/,'');
  if(path==='/v1/me')return response({walletRequired:false,profile:{subject:host}});
  if(path.endsWith('/action')){
   requestCount++;
   const body=JSON.parse(options.body);
   seen.push(body);
   assert.equal(body.action,'resign');
   assert.equal(body.expectedSequence,2);
   assert.ok(body.requestId);
   assert.equal(Object.hasOwn(body,'move'),false);
   current=wire('resigned',2);return response(current.data);
  }
  if(path.endsWith('/'+id))return response(current.data);
  throw Error('unexpected '+path);
 };
 const ctl=new LabyrinthSessionController({enabled:true,fetchImpl:fake});
 await ctl.open(id);
 assert.equal(ctl.state.status,'ready');
 assert.match(renderLabyrinthScreen({screen:'play',view:ctl.state.view,session:ctl.state.session}),/turn deadline/);
 await ctl.lifecycle('resign');
 assert.equal(ctl.state.session.status,'resigned');
 assert.equal(ctl.state.session.sequence,2);
 assert.equal(requestCount,1);
 await assert.rejects(ctl.lifecycle('resign'),/active Labyrinth/);
 assert.equal(requestCount,1);
});
test('BC-2.5 rematch is a fresh private room and requires server-verified human consent',async()=>{
 let current=wire('resigned',2),attempts=0;
 let actor=host;
 const roomResponse={id:nextRoom,host,gameId:'labyrinth-cribbage',seatCount:2,
  status:'open',visibility:'private',revision:1,variantId:'labyrinth-2p',
  seats:[{index:0,team:0,controller:'human',subject:host},
   {index:1,team:1,controller:'invited',subject:peer}],
  invites:[{id:'60000000-6666-4666-8666-666666666666',seat:1,target:peer,status:'pending'}]};
 const fake=async(url,options={})=>{
  const path=new URL(url,'https://example.test').pathname.replace(/^\/social-api/,'');
  if(path==='/v1/me')return response({walletRequired:false,profile:{subject:actor}});
  if(path.endsWith('/rematch')){
   attempts++;const body=JSON.parse(options.body);
   assert.ok(body.requestId);
   assert.equal(options.method,'POST');
   return response({room:roomResponse,onChain:false,wager:false,rewards:false,playable:false},201);
  }
  if(path.endsWith('/'+id))return response(current.data);
  throw Error('unexpected '+path);
 };
 const ctl=new LabyrinthSessionController({enabled:true,fetchImpl:fake});
 await ctl.open(id);
 assert.equal(await ctl.rematch(),nextRoom);
 assert.equal(attempts,1);
 actor=peer;
 await assert.rejects(ctl.rematch(),/420ID account changed|Rematch lobby/);
 assert.equal(attempts,2);
});
test('BC-2.5 a revoked account cannot expose the private hand on reconnect',async()=>{
 let valid=true;
 const fake=async url=>{
  const path=new URL(url,'https://example.test').pathname.replace(/^\/social-api/,'');
  if(path==='/v1/me')return valid?response({walletRequired:false,profile:{subject:host}}):response({},401);
  if(path.endsWith('/'+id))return response(wire().data);
  throw Error('unexpected '+path);
 };
 const ctl=new LabyrinthSessionController({enabled:true,fetchImpl:fake});
 await ctl.open(id);assert.equal(ctl.state.view.hand.length,9);
 valid=false;await ctl.open(id,{quiet:true});
 assert.equal(ctl.state.view,null);assert.equal(ctl.state.status,'guest');
});
