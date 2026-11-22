import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {renderChaosOnline,checkChaosProjection,ChaosRoomsClient,chaosCardHelp} from '../core/chaos-online.js';
import {renderApplicationShell} from '../core/app-shell.js';
const id='10000000-0000-4000-8000-000000000001';
const other='20000000-0000-4000-8000-000000000002';
const lobby={id,ruleset:'ccc-multiplayer-v1',revision:0,status:'lobby',host:true,seat:0,
 seats:[{seat:0,name:'Alice',joined:true,controller:'human',difficulty:null,vehicle:'wagon'},
 {seat:1,name:'Waiting',joined:false,controller:'human',difficulty:null,vehicle:'compact'}],
 joinCode:'A'.repeat(32)};
const game={...lobby,revision:3,status:'playing',host:false,seat:1,joinCode:null,
 seats:[{...lobby.seats[0]},{...lobby.seats[1],joined:true,name:'Bob'}],
 leg:0,stageName:'The Down East Disaster',turn:1,phase:'playing',step:'play',
 finishPending:false,roundStart:0,stockCount:220,discardCount:4,
 discardTop:{type:'mileage',km:100},results:[],log:[],
 players:[
  {id:0,name:'Alice',km:150,score:0,played:[],status:null,upgrades:[],used:[],shield:0},
  {id:1,name:'Bob',km:0,score:0,played:[],status:null,upgrades:[],used:[],shield:0}],
 hand:[{type:'mileage',km:400},{type:'fix',id:'help',name:'Roadside help'}],
 legal:[{action:'drive',index:0},{action:'pass'}],discardRemaining:0};
test('Account-only game route never renders pass-and-play or reveals any shared browser hand',()=>{
 const shell=renderApplicationShell({pathname:'/classics/cross-country-chaos',
  walletView:{connected:false},accountSocialEnabled:true,online:{status:'guest'}});
 assert.match(shell,/Every human player needs their own 420ID account/);
 assert.match(shell,/Log in with 420ID/);
 assert.doesNotMatch(shell,/Pass the device|Start the cross-Canada championship|Local pass-and-play only|data-chaos-start/);
 const loading=renderApplicationShell({pathname:'/classics/cross-country-chaos'});
 assert.match(loading,/Checking your 420ID session and current matches/);
 assert.doesNotMatch(loading,/Pass the device|data-chaos-start/);
 const disabled=renderApplicationShell({pathname:'/classics/cross-country-chaos',
  online:{status:'unavailable'}});
 assert.match(disabled,/Account multiplayer is not available yet/);
 assert.doesNotMatch(disabled,/Pass the device|data-chaos-start/);
});
test('Lobby has private invitation and seat-specific account participation',()=>{
 const html=renderChaosOnline({status:'ready',rooms:[],room:lobby});
 assert.match(html,/Private waiting room/);
 assert.match(html,/Share this code privately/);
 assert.match(html,/value="A{32}"/);
 assert.match(html,/Start championship/);
 assert.match(html,/disabled/);
 const joined=renderChaosOnline({status:'ready',rooms:[],room:{...lobby,seat:1,host:false,joinCode:null}});
 assert.doesNotMatch(joined,/A{32}|Share this code privately|data-chaos-online-action="start"/);
});
test('Each logged-in player sees only own private cards and legal move options',()=>{
 const html=renderChaosOnline({status:'ready',rooms:[],room:checkChaosProjection(game)});
 assert.match(html,/Your private hand/);
 assert.match(html,/Drive 400 km/);
 assert.match(html,/Roadside help/);
 assert.match(html,/Stock: 220 cards/);
 assert.match(html,/data-chaos-online-action="move"/);
 assert.doesNotMatch(html,/unrevealed|other hand|Pass the device|data-chaos-action="reveal"/);
 const waiting={...game,seat:0,turn:1,hand:[{type:'mileage',km:300}],
  legal:[]};
 const passive=renderChaosOnline({status:'ready',room:waiting});
 assert.match(passive,/Your private hand/);
 assert.doesNotMatch(passive,/data-chaos-online-action="move"/);
});
test('Untrusted backend responses exposing private deck or rival hands are rejected',()=>{
 for(const bad of [
  {...game,seed:1000},{...game,deck:[{km:500}]},{...game,legendaryByLeg:[['shortcut']]},
  {...game,players:[{...game.players[0],hand:[{type:'mileage',km:500}]},game.players[1]]},
  {...game,revision:-1}
 ])assert.throws(()=>checkChaosProjection(bad),/Untrusted/);
 const hostile={...game,seats:[{...game.seats[0],name:'<img src=x onerror=alert(1)>'},game.seats[1]]};
 const html=renderChaosOnline({status:'ready',room:hostile});
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(html,/<img src=x onerror/);
});
test('Client uses same-origin cookie transport and fails closed when 420ID is invalid',async()=>{
 const seen=[],fetchImpl=async(path,opts)=>{
  seen.push({path,opts});
  return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,
   headers:{'content-type':'application/json'}});
 };
 const c=new ChaosRoomsClient({fetchImpl});
 await c.refresh({preserve:false});
 assert.equal(c.state.status,'guest');
 assert.equal(seen[0].path,'/social-api/v1/chaos/rooms');
 assert.equal(seen[0].opts.credentials,'same-origin');
 assert.equal(seen[0].opts.cache,'no-store');
 assert.equal(seen[0].opts.redirect,'error');
 assert.equal(seen[0].opts.method,'GET');
});
test('Client sends only expected move and server revision; never scores, shuffle seed or rival cards',async()=>{
 const seen=[],fetchImpl=async(path,opts)=>{
  seen.push({path,opts});
  return new Response(JSON.stringify({room:{...game,revision:4}}),{status:200,
   headers:{'content-type':'application/json'}});
 };
 const c=new ChaosRoomsClient({fetchImpl});c.emit({status:'ready',rooms:[],room:game,error:null});
 await c.mutate('move',{move:{action:'drive',index:0}});
 const req=seen.at(-1);
 assert.equal(req.path,'/social-api/v1/chaos/rooms/'+id+'/move');
 assert.equal(req.opts.method,'POST');
 assert.equal(req.opts.credentials,'same-origin');
 assert.deepEqual(JSON.parse(req.opts.body),{expectedRevision:3,move:{action:'drive',index:0}});
 assert.doesNotMatch(req.opts.body,/seed|hand|winner|score|wallet/);
 assert.equal(c.state.room.revision,4);
});
test('Mobile game is route-scoped, accessible, and does not allow the local engine to become canonical',async()=>{
 const base=resolve(import.meta.dirname,'..');
 const [app,shell,css,gate]=await Promise.all(['app.js','core/app-shell.js','ccc-tabletop.css','scripts/qualify-web.mjs'].map(p=>readFile(resolve(base,p),'utf8')));
 assert.match(shell,/route\.path\.endsWith\('\/practice'\)\?renderClassicsRoute/);
 assert.match(app,/new ChaosRoomsClient/);
 assert.match(app,/bindChaosOnline\(root,chaosOnline,window\.location\.pathname\)/);
 assert.match(app,/\/classics\/cross-country-chaos\/practice/);
 assert.match(app,/bindAccountMonetization\(\);bindChaos\(\);/);
 assert.match(css,/app-shell\[data-route="chaos-game"\] \.app-sidebar/);
 assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:450px\)/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(gate,/CCC account multiplayer route must not expose pass-and-play/);
 assert.match(gate,/baseTotal:1189\*1024/);
 assert.match(gate,/onlineBindingsBytes>4\*1024/);
});


test('Multiplayer road map and exposed public tables remain visible without opponents private hands',()=>{
 const tables={
  ...game,
  players:[
   {...game.players[0],vehicle:'wagon',km:700,played:[{type:'mileage',km:200},{type:'mileage',km:200}],
    upgrades:[{type:'upgrade',id:'winter-tires',name:'Canadian Winter Tires'}],
    status:{type:'hazard',id:'fog',name:'Fog Thicker Than Pea Soup',kind:'slow'},
    used:['winter-tires'],shield:2},
   {...game.players[1],vehicle:'compact',km:400,played:[{type:'mileage',km:400}],
    upgrades:[],status:null,used:[],shield:0}
  ],
  hand:[{type:'fix',id:'help',name:'MY_PRIVATE_CARD'}]
 };
 const html=renderChaosOnline({status:'ready',room:checkChaosProjection(tables)});
 assert.match(html,/east-atlas-underlay.webp/);
 assert.equal((html.match(/class="ccc-map-vehicle ccc-map-vehicle--/g)||[]).length,2);
 assert.match(html,/Visible cards only/);
 assert.match(html,/200 km × 2/);
 assert.match(html,/400 km × 1/);
 assert.match(html,/Fog Thicker Than Pea Soup/);
 assert.match(html,/Canadian Winter Tires · USED/);
 assert.match(html,/2 shields/);
 assert.match(html,/MY_PRIVATE_CARD/);
 assert.doesNotMatch(html,/class="ccc-map-foreground"/);
 const noLeak=checkChaosProjection({...tables,hand:[],players:tables.players});
 assert.doesNotMatch(renderChaosOnline({status:'ready',room:noLeak}),/MY_PRIVATE_CARD/);
});

test('Gameplay layout places highway above public tables, deck and bottom private hand with room chat',()=>{
 const room={...game,chat:[{id:'30000000-0000-4000-8000-000000000003',seat:0,text:'A moose walks into the chat!',at:'2026-11-21T22:00:00Z'}]};
 const html=renderChaosOnline({status:'ready',room});
 for(const key of ['ccc-online-stage','ccc-online-track','ccc-online-middle','ccc-online-decks','ccc-online-hand','ccc-online-chat'])
  assert.ok(html.includes(key),key);
 assert.ok(html.indexOf('ccc-online-track')<html.indexOf('ccc-online-middle'));
 assert.ok(html.indexOf('ccc-online-middle')<html.indexOf('ccc-online-hand'));
 assert.match(html,/east-atlas-underlay\.webp/);
 assert.match(html,/Stock: 220 cards/);
 assert.match(html,/A moose walks into the chat!/);
 assert.match(html,/data-chaos-online-chat/);
 assert.match(html,/data-chaos-online-select="0"/);
 assert.match(html,/aria-label="Your private hand"/);
 assert.doesNotMatch(html,/Your communities|Upcoming events|Discover people/);
 const hidden=renderChaosOnline({status:'ready',room:{...room,seat:0,hand:[],legal:[]}});
 assert.doesNotMatch(hidden,/Roadside help/,'opponent private card stays hidden');
});
test('Room chat escapes player markup, supports local mute and server URL allowlist',async()=>{
 const room={...game,chat:[{id:'30000000-0000-4000-8000-000000000003',seat:0,text:'<img src=x onerror=alert(1)>',at:'2026-11-21T22:00:00Z'}]};
 const html=renderChaosOnline({status:'ready',room});
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(html,/<img src=x onerror/);
 assert.doesNotMatch(renderChaosOnline({status:'ready',room,mutedSeats:[0]}),/&lt;img src=x/);
 const seen=[],client=new ChaosRoomsClient({fetchImpl:async(url,opts)=>{
  seen.push({url,opts});return new Response(JSON.stringify({room}),{status:200});
 }});
 client.emit({status:'ready',room,rooms:[],selectedCard:0,chatOpen:false,mutedSeats:[],unreadChat:0});
 await client.sendChat('just a friendly hello');
 assert.equal(seen[0].url,'/social-api/v1/chaos/rooms/'+id+'/chat');
 assert.equal(seen[0].opts.credentials,'same-origin');
 assert.deepEqual(JSON.parse(seen[0].opts.body),{text:'just a friendly hello'});
 client.toggleMute(0);
 assert.deepEqual(client.state.mutedSeats,[0]);
});

test('Room chat reporting appears for peers and sends an authenticated message ID only',async()=>{
 const room={...game,chat:[{id:'30000000-0000-4000-8000-000000000003',seat:0,text:'Questionable shortcut',at:'2026-11-21T22:00:00Z'}]};
 assert.match(renderChaosOnline({status:'ready',room}),/data-chaos-online-action="chat-report"/);
 assert.doesNotMatch(renderChaosOnline({status:'ready',room:{...room,seat:0}}),/data-chaos-online-action="chat-report"/);
 const seen=[],client=new ChaosRoomsClient({fetchImpl:async(path,opts)=>{
  seen.push({path,opts});return new Response(JSON.stringify({reported:true}),{status:200});
 }});
 client.emit({status:'ready',room,rooms:[],selectedCard:0});
 await client.reportChat(room.chat[0].id);
 assert.equal(seen[0].path,'/social-api/v1/chaos/rooms/'+id+'/chat/report');
 assert.deepEqual(JSON.parse(seen[0].opts.body),{messageId:room.chat[0].id});
 assert.match(client.state.chatNotice,/operator review/);
});

test('multiplayer selected card explains its effect without revealing other hands',()=>{
 const state={...game,hand:[{type:'mileage',km:400},{type:'hazard',id:'fog',kind:'slow',name:'Fog'}]};
 const html=renderChaosOnline({status:'ready',room:checkChaosProjection(state),selectedCard:0});
 assert.match(html,/ccc-online-card-help/);
 assert.match(html,/Advance 400 km\. Drives over 300 km risk a regional hazard/);
 assert.match(renderChaosOnline({status:'ready',room:state,selectedCard:1}),/Slow an opponent on their next drive/);
 assert.equal(chaosCardHelp({type:'fix',id:'atlas'}),'Take a safe +150 km shortcut.');
 assert.doesNotMatch(html,/data-chaos-practice|Pass the device/);
});
