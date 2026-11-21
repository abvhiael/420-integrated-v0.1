import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountExtrasController,renderAccountExtra} from '../core/account-extras.js';
import {resolveRoute,routeAccess} from '../core/routes.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {validateRuntimeConfig} from '../core/runtime-config.js';

const me='12345678-1234-4123-8123-123456789abc';
const peer='23456789-1234-4234-8234-123456789abc';
const msg='34567890-1234-4345-8345-123456789abc';
const game='456789ab-1234-4456-8456-123456789abc';
const JSONOK=(data,status=200)=>({status,ok:status>=200&&status<300,headers:{get:()=> 'application/json'},json:async()=>data});
const myself={walletRequired:false,profile:{subject:me,displayName:'User',bio:''}};
const games={onChain:false,wager:false,rewards:false,games:[{id:game,kind:'tic_tac_toe',status:'active',board:'.........',moves:0,nextTurn:me,inviter:me,invited:peer}]};
const messages={onChain:false,encryption:'server-at-rest',peers:[{subject:peer,displayName:'Name <script>',lastAt:'2026-11-20T12:00:00Z'}]};
test('AUTH-9 routes are wallet-independent but explicitly disabled',()=>{
 for(const path of ['/account/messages','/account/games']){
  const route=resolveRoute(path);
  assert.equal(routeAccess(route,{connected:false,supportedNetwork:false}).allowed,true);
  const html=renderApplicationShell({pathname:path,walletView:null});
  assert.match(html,/not activated|disabled/i);
  assert.doesNotMatch(html,/Connect 420Wallet on the configured network to view your canonical social game sessions/);
 }
 const testConfig={environment:'testnet',appOrigin:'https://bonggoggles.420integrated.org',chainId:420420,
  rpcUrl:'https://rpc.testnet.420integrated.org',indexerUrl:'https://api.bonggoggles.testnet.420integrated.org',
  mediaUrl:'https://media.testnet.420integrated.org',messengerUrl:'https://messenger.testnet.420integrated.org',
  notificationsUrl:'https://notifications.testnet.420integrated.org',walletUrl:'https://wallet.testnet.420integrated.org',
  explorerUrl:'https://explorer.testnet.420integrated.org'};
 let config=validateRuntimeConfig({...testConfig,features:{accountMessaging:true,accountGames:true}});
 assert.equal(config.features.accountMessaging,false);
 assert.equal(config.features.accountGames,false);
 config=validateRuntimeConfig({...testConfig,features:{accountSocial:true,accountMessaging:true,accountGames:true}});
 assert.equal(config.features.accountMessaging,true);
 assert.equal(config.features.accountGames,true);
});
test('messages render with HTML escaped, no fake E2EE or wallet claims',()=>{
 const html=renderAccountExtra('messages',{status:'ready',viewer:me,peers:messages.peers,peer,thread:[
  {id:msg,sender:peer,recipient:me,body:'Secret <script>alert(1)</script>',createdAt:'2026-11-20T12:00:00Z'}
 ]},{enabled:true});
 assert.match(html,/server at rest/i);
 assert.match(html,/not end-to-end encrypted/i);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/data-extra-action="delete-message"/);
 assert.match(renderAccountExtra('messages',{status:'guest'},{enabled:true}),/Sign in with 420ID/);
 assert.match(renderAccountExtra('messages',{status:'error'},{enabled:true}),/No messages or games/);
});
test('account games show actual free turn and never reward or wager',()=>{
 const html=renderAccountExtra('games',{status:'ready',viewer:me,games:games.games,selected:games.games[0]},{enabled:true});
 assert.match(html,/no wager, rewards, on-chain game outcome/i);
 assert.match(html,/data-extra-action="move"/);
 assert.match(html,/<h2>Zero-wager account games<\/h2>/);
 const invite={...games.games[0],status:'invited',invited:me,nextTurn:''};
 const accept=renderAccountExtra('games',{status:'ready',viewer:me,games:[invite],selected:invite},{enabled:true});
 assert.match(accept,/data-extra-action="accept"/);
 assert.match(accept,/data-extra-action="decline"/);
});
test('private message controller checks session then only fetches same-origin account scope',async()=>{
 let authorized=true;const seen=[];
 const c=new AccountExtrasController({kind:'messages',enabled:true,fetchImpl:async(url,opts)=>{
  seen.push({url,opts});
  if(url==='/social-api/v1/me')return authorized?JSONOK(myself):JSONOK({},401);
  if(url==='/social-api/v1/messages'&&opts.method==='GET')return JSONOK(messages);
  if(url==='/social-api/v1/messages/'+peer)return JSONOK({onChain:false,encryption:'server-at-rest',messages:[{id:msg,sender:peer,recipient:me,body:'hello',createdAt:'now'}]});
  if(url==='/social-api/v1/messages'&&opts.method==='POST')return JSONOK({message:{id:msg}},201);
  return JSONOK({deletedForCaller:true});
 }});
 await assert.rejects(c.act('send',{target:peer,body:'no session'}));
 await c.refresh();
 assert.equal(c.state.status,'ready');
 await c.act('open-thread',{peer});
 assert.equal(c.state.thread[0].body,'hello');
 await c.act('send',{target:peer,body:'reply'});
 assert.ok(seen.some(s=>s.url==='/social-api/v1/messages'&&s.opts.method==='POST'&&JSON.parse(s.opts.body).target===peer));
 assert.ok(seen.every(s=>s.opts.credentials==='same-origin'&&s.opts.redirect==='error'&&s.opts.cache==='no-store'));
 authorized=false;
 await c.refresh();
 assert.equal(c.state.status,'guest');
 await assert.rejects(c.act('open-thread',{peer}));
});
test('game controller rejects stale/off-chain response mismatches and wrong-turn moves',async()=>{
 const seen=[];
 const c=new AccountExtrasController({kind:'games',enabled:true,fetchImpl:async(url,opts)=>{
  seen.push({url,opts});
  if(url==='/social-api/v1/me')return JSONOK(myself);
  if(url==='/social-api/v1/account-games')return JSONOK(games);
  if(url==='/social-api/v1/account-games/'+game)return JSONOK({game:games.games[0],history:[],onChain:false,wager:false,rewards:false});
  if(url==='/social-api/v1/account-games/'+game+'/move')return JSONOK({game:{...games.games[0],moves:1},onChain:false,wager:false,rewards:false});
  return JSONOK({onChain:false,wager:false},200);
 }});
 await c.refresh();
 await c.act('open-game',{id:game});
 assert.equal(c.state.selected.nextTurn,me);
 await assert.rejects(c.act('move',{position:42}));
 await c.act('move',{position:0});
 assert.ok(seen.some(s=>s.url.endsWith('/move')&&JSON.parse(s.opts.body).expectedMove===1));
 const rejected=new AccountExtrasController({kind:'games',enabled:true,fetchImpl:async(url)=>{
  if(url.endsWith('/me'))return JSONOK(myself);
  return JSONOK({...games,wager:true});
 }});
 await rejected.refresh();
 assert.equal(rejected.state.status,'error');
});
