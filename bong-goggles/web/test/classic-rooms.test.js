import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ROOM_LIMITS,ClassicRoomsController,renderClassicRooms} from '../core/classic-rooms.js';
import {CLASSIC_ROADMAP} from '../core/classics.js';
import {resolveRoute,routeAccess} from '../core/routes.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {validateRuntimeConfig} from '../core/runtime-config.js';

const host='10000000-1111-4111-8111-111111111111';
const friend='20000000-2222-4222-8222-222222222222';
const roomId='30000000-3333-4333-8333-333333333333';
const gameId='kaiser';
const bare={id:roomId,host,gameId,seatCount:4,visibility:'private',status:'open',revision:1};
const room={...bare,seats:[{index:0,controller:'human',subject:host,team:0},
 {index:1,controller:'empty',team:1},{index:2,controller:'empty',team:0},
 {index:3,controller:'empty',team:1}],invites:[]};
const friendList=[{subject:friend,displayName:'Buddie <img src=x onerror=1>'}];
const env=(data,extra={})=>({onChain:false,wager:false,rewards:false,playable:false,...data,...extra});
const res=(status,data)=>({status,ok:status>=200&&status<300,headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>data});
const mock=(overrides={})=>async(url,opts)=>{
 if(overrides[url])return overrides[url](url,opts);
 if(url==='/social-api/v1/me')return res(200,{walletRequired:false,profile:{subject:host,displayName:'Host'}});
 if(url==='/social-api/v1/classic-rooms')return res(200,env({rooms:[bare]}));
 if(url==='/social-api/v1/classic-rooms/friends')return res(200,{onChain:false,friends:friendList});
 if(url==='/social-api/v1/classic-rooms/'+roomId)return res(200,env({room}));
 throw Error('Unexpected account endpoint: '+url);
};
const shell=(pathname,roomsState,enabled=true)=>renderApplicationShell({pathname,walletView:null,
 classicRoomsState:roomsState,classicRoomsEnabled:enabled,accountIdentityState:{status:'guest'},
 accountIdentityEnabled:true});
test('BC-0.5 canonical 25-game catalogue and strict seat limits are pinned without new game engines',()=>{
 assert.deepEqual(Object.keys(ROOM_LIMITS).sort(),CLASSIC_ROADMAP.map(x=>x.id).sort());
 assert.deepEqual(ROOM_LIMITS.chess,[2,2]);
 assert.deepEqual(ROOM_LIMITS.kaiser,[4,4]);
 assert.deepEqual(ROOM_LIMITS.hearts,[3,4]);
 assert.deepEqual(ROOM_LIMITS.cribbage,[2,4]);
 assert.deepEqual(ROOM_LIMITS['labyrinth-cribbage'],[2,2]); // Do not activate unqualified 3/4-player rooms.
 assert.equal(ROOM_LIMITS['russian-cribbage'],undefined);
 assert.equal(ROOM_LIMITS['cross-country-chaos'],undefined);
});
test('BC-0.5 browse and detail routes are public and do not require a wallet',()=>{
 assert.equal(resolveRoute('/games/rooms').id,'classic-rooms');
 const detail=resolveRoute('/games/rooms/'+roomId);
 assert.equal(detail.id,'classic-room');
 assert.equal(detail.roomId,roomId);
 for(const r of [resolveRoute('/games/rooms'),detail])
  assert.equal(routeAccess(r,{connected:false,supportedNetwork:false}).allowed,true);
 for(const path of ['/games/rooms/foo','/games/rooms/'+roomId+'/change','/games/rooms/..',
  '/games/rooms/123','/games/unknown/setup'])
  assert.equal(resolveRoute(path).id,'not-found',path);
 assert.equal(resolveRoute('/games/chess').id,'classic-game');
 assert.equal(resolveRoute('/classics/cross-country-chaos').id,'chaos-game');
});
test('BC-0.5 login/disabled/loading fail closed; empty-state does not advertise playable matches',()=>{
 const disabled=shell('/games/rooms',{status:'ready',viewer:host,rooms:[bare],friends:[],selected:room},false);
 assert.match(disabled,/not activated for this deployment/);
 assert.doesNotMatch(disabled,/data-classic-room-create/);
 const guest=shell('/games/rooms',{status:'guest'});
 assert.match(guest,/Sign In with 420ID/);
 assert.match(guest,/href="\/social-api\/auth\/start"/);
 assert.doesNotMatch(guest,/data-classic-room-create/);
 const loading=shell('/games/rooms',{status:'loading'});
 assert.match(loading,/Checking your 420ID session/);
 const unavailable=shell('/games/rooms',{status:'error'});
 assert.match(unavailable,/No private room data is shown/);
 assert.doesNotMatch(unavailable,/data-classic-room-create/);
});
test('BC-0.5 room list renders public/private creation and safe game links',()=>{
 const html=shell('/games/rooms',{status:'ready',viewer:host,rooms:[bare],friends:friendList,selected:null,notice:''});
 assert.match(html,/Create a private or public room/);
 assert.match(html,/data-classic-room-create/);
 assert.match(html,/value="private"/);
 assert.match(html,/value="public"/);
 assert.match(html,/value="chess"/);
 assert.match(html,/href="\/games\/rooms\/30000000-3333-4333-8333-333333333333"/);
 assert.match(html,/Lobby seats do not start gameplay/i);
 assert.doesNotMatch(html,/wallet connection required/i);
});
test('BC-0.5 seat controls display team, friend invite and bot difficulty by authority',()=>{
 const ready={status:'ready',viewer:host,rooms:[bare],friends:friendList,selected:room,notice:''};
 const html=shell('/games/rooms/'+roomId,ready);
 assert.match(html,/Seat 3 · Team A/);
 assert.match(html,/Seat 4 · Team B/);
 assert.match(html,/data-classic-room-action="invite" data-room-seat="1"/);
 assert.match(html,/data-classic-room-action="bot" data-room-seat="1"/);
 assert.match(html,/value="hard"/);
 assert.match(html,/data-classic-room-action="cancel-room" data-room-seat="0"/);
 assert.match(html,/Buddie &lt;img src=x onerror=1&gt;/);
 assert.doesNotMatch(html,/<img src=x onerror/);
 const guest={...ready,viewer:friend};
 const privateHtml=shell('/games/rooms/'+roomId,guest);
 assert.doesNotMatch(privateHtml,/data-classic-room-action="invite"/);
 assert.doesNotMatch(privateHtml,/data-classic-room-action="join"/);
 const publicRoom={...room,visibility:'public'};
 const team500={...room,gameId:'500'};
 assert.match(shell('/games/rooms/'+roomId,{...ready,selected:team500}),/Seat 3 · Team A/);
 const joinHtml=shell('/games/rooms/'+roomId,{...guest,selected:publicRoom});
 assert.match(joinHtml,/data-classic-room-action="join" data-room-seat="1"/);
 const invitedRoom={...room,seats:room.seats.map((s,i)=>i===1?{index:1,controller:'invited',subject:friend,team:1}:s),
  invites:[{id:'40000000-4444-4444-8444-444444444444',seat:1,target:friend,status:'pending'}]};
 const inviteHtml=shell('/games/rooms/'+roomId,{...guest,selected:invitedRoom});
 assert.match(inviteHtml,/data-classic-room-action="accept" data-room-seat="1"/);
 assert.match(inviteHtml,/data-classic-room-action="decline" data-room-seat="1"/);
 assert.doesNotMatch(inviteHtml,/data-classic-room-action="cancel-room"/);
 const full={...room,status:'ready',seats:room.seats.map((s,i)=>i===0?s:{index:i,controller:'bot',difficulty:'medium',team:i%2})};
 assert.match(shell('/games/rooms/'+roomId,{...ready,selected:full}),/Game start and turns require BC-0.6/);
 assert.doesNotMatch(shell('/games/rooms/'+roomId,{...ready,selected:full}),/data-room-action="start"/);
});
test('BC-0.5 same-origin 420ID loading and server room/friend reads',async()=>{
 const calls=[];
 const controller=new ClassicRoomsController({enabled:true,fetchImpl:async(url,opts)=>{calls.push({url,opts});return mock()(url,opts);}});
 const state=await controller.refresh(roomId);
 assert.equal(state.status,'ready');
 assert.equal(state.viewer,host);
 assert.equal(state.selected.id,roomId);
 assert.equal(state.rooms[0].gameId,gameId);
 assert.equal(state.friends[0].subject,friend);
 assert.deepEqual(calls.map(x=>x.url),['/social-api/v1/me','/social-api/v1/classic-rooms',
  '/social-api/v1/classic-rooms/friends','/social-api/v1/classic-rooms/'+roomId]);
 assert.ok(calls.every(x=>x.opts.credentials==='same-origin'&&x.opts.cache==='no-store'&&x.opts.redirect==='error'));
 assert.ok(calls.every(x=>x.opts.method==='GET'&&x.opts.body===undefined));
});
test('BC-0.5 creates a room with server-defined host and revision, never a wallet',async()=>{
 const calls=[];
 const client=new ClassicRoomsController({enabled:true,fetchImpl:async(url,opts)=>{
  calls.push({url,opts});
  if(url==='/social-api/v1/classic-rooms'&&opts.method==='POST')return res(201,env({room}));
  return mock()(url,opts);
 }});
 await client.refresh();
 const result=await client.act('create',{gameId:'kaiser',visibility:'private',seatCount:4});
 assert.equal(result.status,'ready');assert.equal(result.selected.id,roomId);
 const submitted=calls.find(x=>x.opts.method==='POST');
 assert.equal(submitted.url,'/social-api/v1/classic-rooms');
 assert.deepEqual(JSON.parse(submitted.opts.body),{gameId:'kaiser',seatCount:4,visibility:'private'});
 assert.equal(submitted.opts.credentials,'same-origin');
 await assert.rejects(client.act('create',{gameId:'chess',seatCount:4,visibility:'public'}));
 assert.equal(calls.filter(x=>x.opts.method==='POST').length,1);
});
test('BC-0.5 invitation target and bot difficulty are validated before one-shot POST',async()=>{
 const calls=[];
 const client=new ClassicRoomsController({enabled:true,fetchImpl:async(url,opts)=>{
  calls.push({url,opts});
  if(opts.method==='POST')return res(200,env({room}));
  return mock()(url,opts);
 }});
 await client.refresh(roomId);
 await assert.rejects(client.act('invite',{seat:1,target:'50000000-5555-4555-8555-555555555555'}));
 await assert.rejects(client.act('bot',{seat:1,difficulty:'unlimited'}));
 await assert.rejects(client.act('start',{seat:0}));
 assert.equal(client.state.status,'ready','Local invalid forms must not erase a verified room');
 assert.equal(calls.filter(c=>c.opts.method==='POST').length,0);
 await client.act('invite',{seat:1,target:friend});
 const submit=calls.find(c=>c.opts.method==='POST');
 assert.deepEqual(JSON.parse(submit.opts.body),{action:'invite',seat:1,expectedRevision:1,target:friend});
 assert.equal(submit.opts.credentials,'same-origin');
});
test('BC-0.5 invalid 420ID, bad room data, private data and false on-chain flag fail closed',async()=>{
 const invalids=[
 {'/social-api/v1/me':()=>res(401,{error:'expired'})},
 {'/social-api/v1/classic-rooms':()=>res(200,env({rooms:[{...bare,id:'made-up'}]}))},
 {'/social-api/v1/classic-rooms':()=>res(200,env({rooms:[bare]},{playable:true}))},
 {['/social-api/v1/classic-rooms/'+roomId]:()=>res(200,env({room:{...room,seats:[]}}))},
 ];
 for(const mockResponses of invalids){
  const client=new ClassicRoomsController({enabled:true,fetchImpl:mock(mockResponses)});
  const result=await client.refresh(roomId);
  assert.ok(result.status==='guest'||result.status==='error');
  assert.equal(result.selected,undefined);
 }
});
test('BC-0.5 session and stale response ordering never restore a previous room',async()=>{
 let pending;
 const client=new ClassicRoomsController({enabled:true,fetchImpl:(url)=>url.endsWith('/v1/me')?
  new Promise(resolve=>{pending=resolve;}):mock()(url)});
 const first=client.refresh(roomId);
 client.invalidate();
 pending(res(200,{walletRequired:false,profile:{subject:host}}));
 await first;
 assert.deepEqual(client.state,{status:'loading'});
});
test('BC-0.5 an unconfirmed room mutation immediately drops cached private room data',async()=>{
 const client=new ClassicRoomsController({enabled:true,fetchImpl:async(url,opts)=>{
  if(opts.method==='POST')return res(403,{error:'blocked'});
  return mock()(url,opts);
 }});
 await client.refresh(roomId);
 assert.equal(client.state.status,'ready');
 await assert.rejects(client.act('bot',{seat:1,difficulty:'medium'}));
 assert.equal(client.state.status,'error');
 assert.equal(client.state.selected,undefined);
 assert.doesNotMatch(renderClassicRooms(client.state,{enabled:true,roomId}),/Host.*Seat 1/);
});
test('BC-0.5 feature flag remains explicit and bound to the existing off-chain account-games gate',()=>{
 const base={environment:'testnet',appOrigin:'https://bonggoggles.420integrated.org',chainId:420420,
 rpcUrl:'https://rpc.testnet.420integrated.org',indexerUrl:'https://indexer.testnet.420integrated.org',
 mediaUrl:'https://media.testnet.420integrated.org',messengerUrl:'https://messages.testnet.420integrated.org',
 notificationsUrl:'https://notices.testnet.420integrated.org',walletUrl:'https://wallet.testnet.420integrated.org',
 explorerUrl:'https://explorer.testnet.420integrated.org'};
 assert.equal(validateRuntimeConfig({...base,features:{classicRooms:true}}).features.classicRooms,false);
 assert.equal(validateRuntimeConfig({...base,features:{accountSocial:true,classicRooms:true}}).features.classicRooms,false);
 assert.equal(validateRuntimeConfig({...base,features:{accountSocial:true,accountGames:true,classicRooms:true}}).features.classicRooms,true);
});
test('BC-0.5 browser forms are actually wired; prior Classic UI and Wallet actions remain intact',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const bindings=await readFile(new URL('../core/classic-room-bindings.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(app,/classicRoomsController=new ClassicRoomsController/);
 assert.match(app,/bindClassicRooms\(\)/);
 assert.match(bindings,/data-classic-room-create/);
 assert.match(bindings,/data-classic-room-action/);
 assert.match(app,/classicRoomsController\?\.invalidate\(\)/);
 for(const token of ['classic-room__seats','classic-room__actions','forced-colors:active','focus-visible'])
  assert.ok(css.includes(token),token);
 assert.match(shell('/games/rooms',{status:'ready',viewer:host,rooms:[],friends:[],selected:null}),/No visible rooms yet/);
 assert.match(shell('/games/rooms/'+roomId,{status:'ready',viewer:host,rooms:[],friends:[],selected:null,notFound:true}),/Room not found or access denied/);
 const catalogue=shell('/games',{status:'guest'});
 assert.match(catalogue,/Multiplayer rooms/);
 const game=shell('/games/chess',{status:'guest'});
 assert.match(game,/\/games\/rooms/);
 assert.match(game,/not yet playable|not released/i);
});

test('BC-0.6 active/completed rooms lock seats and omit lobby actions',()=>{
 const started={...room,status:'in_game'};
 const state={status:'ready',viewer:host,rooms:[bare],friends:friendList,selected:started,notice:''};
 const running=shell('/games/rooms/'+roomId,state);
 assert.match(running,/server-owned session/);
 assert.doesNotMatch(running,/data-classic-room-action/);
 const ended=shell('/games/rooms/'+roomId,{...state,selected:{...started,status:'completed'}});
 assert.match(ended,/session has ended/);
 assert.doesNotMatch(ended,/data-classic-room-action/);
});

test('Cribbage room link resolves only same-420ID rule-bound match and returns to My Games',async()=>{
 const game={...room,gameId:'cribbage',seatCount:2,status:'in_game',revision:4,
  seats:[{index:0,controller:'human',subject:host,team:0},
   {index:1,controller:'bot',difficulty:'easy',team:1}],invites:[]};
 const match={id:'40000000-4444-4444-8444-444444444444',roomId,gameId:'cribbage',
  seatCount:2,status:'active',rulesHash:'6f13bd77568efc5d0836eaa61458ca0cc2c500d1db2d9c38e228b1c668f71e24'};
 const requests=[];
 const client=new ClassicRoomsController({enabled:true,fetchImpl:async(url,opts)=>{
  requests.push(url);
  if(url==='/social-api/v1/classic-rooms/'+roomId)return res(200,env({room:game}));
  if(url==='/social-api/v1/classic-sessions')return res(200,env({sessions:[match]}));
  return mock()(url,opts);
 }});
 const state=await client.refresh(roomId);
 assert.equal(state.status,'ready');
 assert.equal(state.gameSession?.id,match.id);
 assert.ok(requests.some(x=>x.endsWith('/v1/classic-sessions')));
 const html=renderClassicRooms(state,{enabled:true,roomId});
 assert.match(html,/Resume active Cribbage game/);
 assert.match(html,new RegExp('games/cribbage/play\\?session='+match.id));
 assert.match(html,/href="\/games\/cribbage\/history"/);
 const reconnect=renderClassicRooms(state,{enabled:true,roomId,live:{status:'reconnecting'}});
 assert.match(reconnect,/cached private room data is hidden/);
 assert.doesNotMatch(reconnect,/Seat 1 ·/);
 assert.match(reconnect,/href="\/games\/cribbage\/history"/);
 const revoked={...state,gameSession:null};
 const fallback=renderClassicRooms(revoked,{enabled:true,roomId});
 assert.match(fallback,/Find this game in My Games/);
 assert.doesNotMatch(fallback,/play\\?session=/);
});
