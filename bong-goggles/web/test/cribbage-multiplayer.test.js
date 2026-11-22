import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCribbageRoomStart,discoverCribbageMatches,resignCribbageMatch} from '../core/classic-cribbage-multiplayer.js';
import {normalizeCribbageSnapshot,cribbageLegalMoves,CRIBBAGE_RULES_HASH} from '../core/cribbage-session.js';
import {renderClassicRooms} from '../core/classic-rooms.js';
import {renderCribbageRoute} from '../core/cribbage-ui.js';

const host='10000000-1111-4111-8111-111111111111';
const peer='20000000-2222-4222-8222-222222222222';
const roomID='30000000-3333-4333-8333-333333333333';
const matchID='40000000-4444-4444-8444-444444444444';
const e=x=>({status:200,data:{...x,onChain:false,wager:false,rewards:false}});
const r=(n=2)=>({id:roomID,host,gameId:'cribbage',seatCount:n,status:'ready',
 revision:3,visibility:'public',seats:Array.from({length:n},(_,index)=>({
 index,controller:index===0?'human':index===1?'human':'bot',
 subject:index===0?host:index===1?peer:'',
 difficulty:index>1?'medium':'',team:n===4?index%2:index
 })),invites:[]});
function snap(n=2,actor=host){
 const seat=actor===host?0:1;
 const hand=Array.from({length:n===2?6:5},(_,i)=>[0,5,14,25,38,50][i]);
 return {id:matchID,roomId:roomID,gameId:'cribbage',seatCount:n,status:'active',
  rulesVersion:'v1.0',rulesHash:CRIBBAGE_RULES_HASH,sequence:1,
  turnSeat:0,deadline:'2026-11-22T20:00:00Z',winnerSeat:null,
  viewerSeat:seat,privateView:{gameId:'cribbage',variant:n===2?'standard-2p':n===3?'standard-3p':'standard-4p-partners',
   round:1,phase:'discard',dealer:1,turn:0,seat,scores:Array(n).fill(0),
   hand,cardCounts:Array(n).fill(n===2?6:5),cribCount:n===3?1:0,
   discarded:Array(n).fill(false),starter:-1,pegCount:0,pegPile:[],
   pegged:Array.from({length:n},()=>[]),saidGo:Array(n).fill(false),
   lastShow:[],lastAwards:[],losers:[],winner:null}};
}
const profile=subject=>({status:200,data:{walletRequired:false,profile:{subject}}});
function readyRoom(actor=host,n=2){
 const state={status:'ready',selected:r(n),viewer:actor,friends:[],rooms:[],notice:''};
 return {state,client:{enabled:true,request:async()=>{throw Error('unconfigured client')}},
  emit(delta){this.state={...delta};return this.state;}};
}
function uiForm(){
 let submit;
 const button={disabled:false,setAttribute(n){if(n==='disabled')this.disabled=true;},
  removeAttribute(n){if(n==='disabled')this.disabled=false;}};
 const form={dataset:{},querySelector:()=>button,
  addEventListener:(name,cb)=>{if(name==='submit')submit=cb;}};
 return {root:{querySelector:s=>s==='[data-cribbage-room-start]'?form:null},
  async click(){assert.ok(submit,'no room start listener');await submit({preventDefault(){}});},
  button,form};
}
test('BC-1.5 host starts exactly one server-owned 2p/3p/4p match and navigates to its private seat',async()=>{
 for(const n of [2,3,4]){
  const room=readyRoom(host,n),form=uiForm(),calls=[],nav=[];
  room.client.request=async(path,args)=>{
   calls.push({path,args});
   if(path==='/v1/me')return profile(host);
   assert.equal(path,'/v1/classic-sessions');
   assert.equal(args.method,'POST');
   assert.deepEqual(args.body,{roomId:roomID});
   return {status:201,data:{session:snap(n),onChain:false,wager:false,rewards:false}};
  };
  bindCribbageRoomStart(form.root,room,{history:{pushState:(a,b,url)=>nav.push(url)},
   onRouteChange:()=>nav.push('routed')});
  await form.click();
  assert.equal(calls.filter(x=>x.path==='/v1/classic-sessions').length,1);
  assert.deepEqual(nav,['/games/cribbage/play?session='+matchID,'routed']);
  assert.equal(form.button.disabled,false);
 }
});
test('BC-1.5 rejects nonhost, inactive or stale 420ID and unauthorized startup replies',async()=>{
 const cases=[
  {alter:room=>{room.state.viewer=peer;},status:201,actor:peer,called:0},
  {alter:room=>{room.state.selected.status='open';},status:201,actor:host,called:0},
  {alter:()=>{},status:404,actor:host,called:1},
  {alter:()=>{},status:201,actor:peer,called:0},
  {alter:()=>{},status:201,actor:host,called:1,poison:s=>{s.privateView.opponentHand=[10];}}
 ];
 for(const c of cases){
  const room=readyRoom(),form=uiForm(),nav=[];
  c.alter(room);
  let starts=0;
  room.client.request=async(path)=>{
   if(path==='/v1/me')return profile(c.actor);
   starts++;
   const state=snap();c.poison?.(state);
   return {status:c.status,data:{session:state,onChain:false,wager:false,rewards:false}};
  };
  bindCribbageRoomStart(form.root,room,{history:{pushState:(a,b,url)=>nav.push(url)}});
  await form.click().catch(()=>{});
  assert.equal(nav.length,0,'unauthorized route navigation');
  assert.equal(starts,c.called,'unauthorized startup request');
 }
});
test('BC-1.5 restart discovers only authenticated participant session summaries, never private cards',async()=>{
 for(const actor of [host,peer]){
  const history=[];
  const controller={generation:0,client:{enabled:true,request:async path=>{
   history.push(path);
   if(path==='/v1/me')return profile(actor);
   assert.equal(path,'/v1/classic-sessions');
   return e({sessions:[
    {id:matchID,roomId:roomID,gameId:'cribbage',seatCount:2,status:'active',
     rulesVersion:'v1.0',rulesHash:CRIBBAGE_RULES_HASH,sequence:17,turnSeat:1},
    {id:host,roomId:roomID,gameId:'chess',seatCount:2,sequence:9,status:'active'}
   ]});
  }},emit(next){this.state=next;},invalidate(){this.generation++;}};
  const matches=await discoverCribbageMatches(controller);
  assert.equal(matches.length,1);
  assert.equal(matches[0].sequence,17);
  assert.deepEqual(history,['/v1/me','/v1/classic-sessions','/v1/me']);
  assert.equal(controller.state.status,'idle');
  assert.equal(controller.state.session,null);
  assert.ok(!JSON.stringify(controller.state).includes('privateView'));
  assert.ok(!JSON.stringify(controller.state).includes('opponentHand'));
 }
});
test('BC-1.5 forged summary, revoked account and cross-account identity rotation fail closed',async()=>{
 const choices=['stolen','poison','switched'];
 for(const choice of choices){
  let reads=0;
  const controller={generation:0,client:{enabled:true,request:async path=>{
   if(path==='/v1/me')return profile(++reads===2&&choice==='switched'?peer:host);
   if(choice==='stolen')return {status:401,data:null};
   const item={id:matchID,roomId:roomID,gameId:'cribbage',seatCount:2,status:'active',
    rulesVersion:'v1.0',rulesHash:CRIBBAGE_RULES_HASH,sequence:4,turnSeat:1};
   if(choice==='poison')item.opponentHand=[0,1,2,3];
   return e({sessions:[item]});
  }},emit(next){this.state=next;},invalidate(){this.generation++;}};
  const items=await discoverCribbageMatches(controller);
  assert.deepEqual(items,[]);
  assert.ok(!controller.state?.recoverable?.length);
  assert.ok(['guest','unavailable'].includes(controller.state?.status));
 }
});
test('BC-1.5 room start is available only to host of a ready Cribbage room',()=>{
 for(const status of ['ready','open','in_game']){
  const item=r();item.status=status;
  const html=renderClassicRooms({status:'ready',viewer:host,rooms:[],friends:[],selected:item},{enabled:true,roomId:roomID});
  assert.equal(html.includes('data-cribbage-room-start'),status==='ready');
 }
 const html=renderClassicRooms({status:'ready',viewer:peer,rooms:[],friends:[],selected:r()},{enabled:true,roomId:roomID});
 assert.doesNotMatch(html,/data-cribbage-room-start/);
});
test('BC-1.5 completed/expired verified match is safely viewable but cannot submit a move',()=>{
 for(const status of ['timed_out','resigned','cancelled']){
  const s=snap();s.status=status;s.turnSeat=null;s.privateView.turn=0;
  const result=normalizeCribbageSnapshot(e({session:s}));
  assert.ok(result,'server timeout state unavailable: '+status);
  assert.deepEqual(cribbageLegalMoves(result),[]);
 }
});

test('BC-1.5 resignation needs two-step UI confirmation and one verified server action',async()=>{
 const room=snap(),actions=[];
 const ctl={state:{status:'ready',session:room,queue:[],settings:{motion:'standard',stinkhole:false}},
  client:{enabled:true,request:async (path,opt)=>{
   actions.push({path,opt});
   const last={...room,status:'resigned',sequence:2,turnSeat:null};
   return e({session:last});
  }},generation:0,busy:false,timer:null,
  emit(delta){this.state={...this.state,...delta};return this.state;}
 };
 const html=renderCribbageRoute({screen:'play',state:ctl.state});
 assert.match(html,/data-cribbage-action="request-resign"/);
 assert.doesNotMatch(html,/data-cribbage-action="confirm-resign"/);
 ctl.emit({resignPending:true});
 const confirming=renderCribbageRoute({screen:'play',state:ctl.state});
 assert.match(confirming,/data-cribbage-action="confirm-resign"/);
 assert.match(confirming,/data-cribbage-action="cancel-resign"/);
 const state=await resignCribbageMatch(ctl);
 assert.equal(state.session.status,'resigned');
 assert.equal(state.session.sequence,2);
 assert.equal(state.resignPending,false);
 assert.equal(actions.length,1);
 assert.equal(actions[0].opt.method,'POST');
 assert.deepEqual({...actions[0].opt.body,requestId:'PINNED'},{
  requestId:'PINNED',action:'resign',expectedSequence:2});
 assert.equal(actions[0].path,'/v1/classic-sessions/'+matchID+'/action');
 assert.deepEqual(cribbageLegalMoves(state.session),[]);
});
test('BC-1.5 rejected resignation discards cached private view and cannot be replayed locally',async()=>{
 const room=snap();
 let attempts=0;
 const ctl={state:{status:'ready',session:room,queue:[]},
  client:{enabled:true,request:async()=>{attempts++;return {status:403,data:null};}},
  generation:0,busy:false,timer:null,
  emit(delta){this.state={...this.state,...delta};return this.state;}
 };
 await assert.rejects(resignCribbageMatch(ctl));
 assert.equal(attempts,1);
 assert.equal(ctl.state.status,'error');
 assert.equal(ctl.state.session,null);
 assert.equal(ctl.busy,false);
 await assert.rejects(resignCribbageMatch(ctl));
 assert.equal(attempts,1,'denied action was automatically retried');
});
