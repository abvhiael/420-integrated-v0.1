import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassicCommunicationsController} from '../core/classic-communications.js';
import {normalizeClassicRoom,renderClassicRooms} from '../core/classic-rooms.js';
import {createAccountSocialClient} from '../core/account-social.js';
import {validateRuntimeConfig} from '../core/runtime-config.js';
import {withAccountSocialBuildFlags} from '../scripts/account-social-build-config.mjs';

const host='10000000-1111-4111-8111-111111111111';
const peer='20000000-2222-4222-8222-222222222222';
const id='30000000-3333-4333-8333-333333333333';
const sessionId='40000000-4444-4444-8444-444444444444';
const stamp='2026-11-22T03:30:00Z';
const people=[{index:0,controller:'human',subject:host,team:0},{index:1,controller:'human',subject:peer,team:1}];
const room=(rev=2,status='ready')=>({id,host,gameId:'chess',seatCount:2,visibility:'private',
 status,revision:rev,seats:people,invites:[]});
const envelope=value=>({onChain:false,wager:false,rewards:false,playable:false,...value});
const api=(value)=>({onChain:false,wager:false,rewards:false,...value});
const res=(status,data)=>({status,ok:status>=200&&status<300,
 headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>data});
const event=(n,turnSeat)=>({sequence:n,kind:n===1?'started':'move',actorSeat:n===1?null:1-turnSeat,
 publicState:{status:'active',turnSeat,deadline:stamp,winnerSeat:null,finishedReason:''},occurredAt:stamp});
function server(){
 const state={viewer:host,rev:2,status:'ready',count:1,turnSeat:0,missing:false,
  forbidden:false,stale:false,offline:false,gap:false,presence:[{seat:0,online:true},{seat:1,online:false}],
  calls:[]};
 const fetchImpl=async(path,options)=>{
  state.calls.push({path,options});
  if(state.offline)return res(503,{});
  if(path==='/social-api/v1/me')return res(state.forbidden?401:200,{walletRequired:false,profile:{subject:state.viewer}});
  if(path==='/social-api/v1/classic-rooms/'+id)return res(state.missing?404:200,
   envelope({room:room(state.rev,state.status)}));
  if(path==='/social-api/v1/classic-rooms/'+id+'/presence'){
   if(state.missing)return res(404,{});
   return res(200,envelope({presence:{roomId:id,revision:state.rev,seats:state.presence,leaseSeconds:20}}));
  }
  if(path==='/social-api/v1/classic-sessions')
   return res(200,api({sessions:[{id:sessionId,roomId:id,gameId:'chess',seatCount:2,status:'active',
    sequence:state.count,turnSeat:state.turnSeat}]}));
  if(path==='/social-api/v1/classic-sessions/'+sessionId)
   return res(200,api({session:{id:sessionId,roomId:id,gameId:'chess',seatCount:2,status:'active',
    sequence:state.count,turnSeat:state.turnSeat,viewerSeat:state.viewer===host?0:1,
    deadline:stamp,privateView:{secret:'only-me',opponentHand:'never-render'}}}));
  if(path.startsWith('/social-api/v1/classic-sessions/'+sessionId+'/events?after=')){
   const after=Number(path.split('after=')[1]);
   if(state.gap||after>state.count)return res(409,{error:'Conflict'});
   return res(200,api({events:Array.from({length:state.count-after},(_,i)=>
    event(after+i+1,after+i+1===state.count?state.turnSeat:0)),sequence:state.count}));
  }
  throw Error('Unexpected transport '+path);
 };
 return {state,fetchImpl};
}
test('BC-0.10 multi-account same-origin room heartbeat + revision reconciliation and turn notification',async()=>{
 const srv=server();
 const seen=[];
 const live=new ClassicCommunicationsController({enabled:true,fetchImpl:srv.fetchImpl,
  onRoom:next=>seen.push(next),onChange:next=>seen.push(next.status)});
 const first=await live.sync({room:room(),viewer:host});
 assert.equal(first.status,'connected');
 assert.equal(first.room.revision,2);
 assert.equal(first.presence.seats[0].online,true);
 assert.equal(first.presence.seats[1].online,false);
 assert.equal(first.session.viewerSeat,0);
 assert.match(first.notice,/your turn/i);
 assert.equal(JSON.stringify(first).includes('only-me'),false);
 assert.equal(JSON.stringify(first).includes('opponentHand'),false);
 assert.ok(srv.state.calls.every(c=>c.options.credentials==='same-origin'&&
  c.options.cache==='no-store'&&c.options.redirect==='error'));
 assert.ok(srv.state.calls.some(c=>c.path.endsWith('/presence')&&c.options.method==='POST'&&
  c.options.body==='{}'));
 srv.state.status='in_game';srv.state.rev=3;srv.state.count=2;srv.state.turnSeat=1;
 srv.state.presence[1].online=true;
 const second=await live.sync({room:room(2),viewer:host});
 assert.equal(second.status,'connected');
 assert.equal(second.room.revision,3);
 assert.equal(second.session.sequence,2);
 assert.match(second.notice,/other player made a move/);
 assert.ok(srv.state.calls.some(c=>c.path.endsWith('/events?after=1')));
 const html=renderClassicRooms({status:'ready',viewer:host,rooms:[],selected:second.room,
  friends:[],notice:''},{enabled:true,roomId:id,live:second});
 assert.match(html,/Live room status/);
 assert.match(html,/Seat 1: Online/);
 assert.match(html,/Seat 2: Online/);
 assert.match(html,/Waiting for another player/);
 assert.match(html,/sequence 2/);
 assert.doesNotMatch(html,/only-me|opponentHand|<button[^>]*data-game-action/);
 assert.ok(seen.some(x=>x?.revision===3));
});
test('BC-0.10 second device on the next turn gets its own seat-only notification',async()=>{
 const srv=server();srv.state.viewer=peer;srv.state.rev=3;srv.state.status='in_game';
 srv.state.turnSeat=1;srv.state.count=3;
 const live=new ClassicCommunicationsController({enabled:true,fetchImpl:srv.fetchImpl});
 const state=await live.sync({room:room(3,'in_game'),viewer:peer});
 assert.equal(state.status,'connected');
 assert.equal(state.session.viewerSeat,1);
 assert.match(state.notice,/your turn/i);
 assert.equal(JSON.stringify(state).includes('only-me'),false);
});
test('BC-0.10 event gaps resnapshot without fabricating moves, stale or future revisions reject',async()=>{
 const srv=server();srv.state.status='in_game';srv.state.count=3;
 const live=new ClassicCommunicationsController({enabled:true,fetchImpl:srv.fetchImpl});
 const initial=await live.sync({room:room(),viewer:host});assert.equal(initial.status,'connected');
 srv.state.gap=true;srv.state.count=59;srv.state.turnSeat=1;
 const rebuilt=await live.sync({room:room(),viewer:host});
 assert.equal(rebuilt.status,'connected');
 assert.match(rebuilt.notice,/restored from the latest verified match snapshot/);
 assert.equal(rebuilt.session.sequence,59);
 assert.equal(JSON.stringify(rebuilt).includes('moves:'),false);
 srv.state.gap=false;srv.state.rev=1;
 const stale=await live.sync({room:room(),viewer:host});
 assert.equal(stale.status,'reconnecting');
 assert.equal(stale.room,undefined);
 const html=renderClassicRooms({status:'ready',viewer:host,selected:room(),
  rooms:[],friends:[],notice:''},{enabled:true,roomId:id,live:stale});
 assert.match(html,/cached private room data is hidden/);
 assert.doesNotMatch(html,/Seat 1 ·/);
});
test('BC-0.10 revoked cookie, removed room and disabled backend fail closed without cached state',async()=>{
 const srv=server();
 const live=new ClassicCommunicationsController({enabled:true,fetchImpl:srv.fetchImpl});
 assert.equal((await live.sync({room:room(),viewer:host})).status,'connected');
 srv.state.forbidden=true;
 assert.equal((await live.sync({room:room(),viewer:host})).status,'guest');
 assert.equal(live.state.presence,undefined);
 srv.state.forbidden=false;srv.state.missing=true;
 assert.equal((await live.sync({room:room(),viewer:host})).status,'revoked');
 srv.state.missing=false;srv.state.offline=true;
 assert.equal((await live.sync({room:room(),viewer:host})).status,'reconnecting');
 const visitor=await live.sync({room:{...room(),seats:[{index:0,controller:'empty',team:0},people[1]]},
  viewer:host});
 assert.equal(visitor.status,'spectator');
 const off=new ClassicCommunicationsController({enabled:false,fetchImpl:srv.fetchImpl});
 assert.equal((await off.sync({room:room(),viewer:host})).status,'disabled');
});
test('BC-0.10 stale in-flight requests after sign-out/navigation never restore old 420ID projections',async()=>{
 let release;
 const live=new ClassicCommunicationsController({enabled:true,fetchImpl:async path=>{
  if(path==='/social-api/v1/me')return new Promise(resolve=>{release=resolve;});
  throw Error('unexpected resumed read');
 }});
 const pending=live.sync({room:room(),viewer:host});
 live.invalidate();
 release(res(200,{walletRequired:false,profile:{subject:host}}));
 await pending;
 assert.deepEqual(live.state,{status:'idle'});
});
test('BC-0.10 authorized cursor URL only; arbitrary query, identity and cross-origin URLs rejected',async()=>{
 const calls=[];
 const c=createAccountSocialClient({enabled:true,fetchImpl:async(path,opts)=>{
  calls.push({path,opts});return res(200,api({events:[],sequence:1}));
 }});
 const good=await c.request('/v1/classic-sessions/'+sessionId+'/events?after=42');
 assert.equal(good.status,200);
 assert.equal(calls[0].path,'/social-api/v1/classic-sessions/'+sessionId+'/events?after=42');
 for(const bad of ['/v1/classic-sessions/'+sessionId+'/events?after=-1',
  '/v1/classic-sessions/'+sessionId+'/events?after=1&subject='+host,
  '/v1/classic-sessions/'+sessionId+'/events?after=01','//evil/endpoint',
  '/v1/classic-sessions/../../events?after=0'])
  await assert.rejects(c.request(bad));
 assert.equal(calls.length,1);
});
test('BC-0.10 UI communications is an independent opt-in requiring activated rooms and 420ID',()=>{
 const base={environment:'testnet',appOrigin:'https://bonggoggles.420integrated.org',chainId:420420,
 rpcUrl:'https://rpc.testnet.420integrated.org',indexerUrl:'https://indexer.testnet.420integrated.org',
 mediaUrl:'https://media.testnet.420integrated.org',messengerUrl:'https://messages.testnet.420integrated.org',
 notificationsUrl:'https://notices.testnet.420integrated.org',walletUrl:'https://wallet.testnet.420integrated.org',
 explorerUrl:'https://explorer.testnet.420integrated.org'};
 assert.equal(validateRuntimeConfig({...base,features:{classicCommunications:true}}).features.classicCommunications,false);
 assert.equal(validateRuntimeConfig({...base,features:{
  accountSocial:true,accountGames:true,classicRooms:true,classicCommunications:true}}).features.classicCommunications,true);
 assert.equal(withAccountSocialBuildFlags({...base,features:{}},'true','true','false').features.classicCommunications,false);
 assert.equal(withAccountSocialBuildFlags({...base,features:{}},'true','true','true').features.classicCommunications,true);
 assert.throws(()=>withAccountSocialBuildFlags({...base,features:{}},'true','false','true'),/require active/);
 assert.throws(()=>withAccountSocialBuildFlags({...base,features:{}},'true','true','enable'),/exactly true or false/);
});
