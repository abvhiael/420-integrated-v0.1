import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {renderChaosOnline,checkChaosProjection,ChaosRoomsClient} from '../core/chaos-online.js';
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
  walletView:{connected:false},accountSocialEnabled:true,chaosOnlineState:{status:'guest'}});
 assert.match(shell,/Every human player needs their own 420ID account/);
 assert.match(shell,/Log in with 420ID/);
 assert.doesNotMatch(shell,/Pass the device|Start the cross-Canada championship|Local pass-and-play only|data-chaos-start/);
 const disabled=renderApplicationShell({pathname:'/classics/cross-country-chaos',
  chaosOnlineState:{status:'unavailable'}});
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
 assert.match(shell,/if\(route\.id==='chaos-game'\)return renderChaosOnline/);
 assert.match(app,/new ChaosRoomsClient/);
 assert.match(app,/bindChaosOnline\(\)/);
 assert.match(app,/\/classics\/cross-country-chaos\/practice/);
 assert.doesNotMatch(app,/bindAccountMonetization\(\);bindChaos\(\);/);
 assert.match(css,/app-shell\[data-route="chaos-game"\] \.app-sidebar/);
 assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:450px\)/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(gate,/CCC account multiplayer route must not expose pass-and-play/);
 assert.match(gate,/baseTotal:1189\*1024/);
});
