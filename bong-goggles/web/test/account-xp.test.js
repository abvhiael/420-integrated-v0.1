import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountXPController,renderAccountXP,XP_POLICY} from '../core/account-xp.js';
import {resolveRoute,routeAccess} from '../core/routes.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {validateRuntimeConfig} from '../core/runtime-config.js';

const who='12345678-1234-4123-8123-123456789abc';
const post='23456789-1234-4234-8234-123456789abc';
const summary={subject:who,total:7,level:1,toNextLevel:93,todayPosts:1,todayComments:1,
 events:[{kind:'post',sourceId:post,action:'grant',points:5,at:'2026-11-20T18:00:00Z'},
 {kind:'comment',sourceId:post,action:'grant',points:2,at:'2026-11-20T17:00:00Z'}],
 policyVersion:1,onChain:false,redeemable:false,source:'bonggoggles-account-xp'};
const ok=(value,status=200)=>({status,ok:status>=200&&status<300,headers:{get:()=> 'application/json'},json:async()=>value});
const config={environment:'testnet',appOrigin:'https://bonggoggles.420integrated.org',
 chainId:420420,rpcUrl:'https://rpc.testnet.420integrated.org',
 indexerUrl:'https://api.bonggoggles.testnet.420integrated.org',
 mediaUrl:'https://media.testnet.420integrated.org',messengerUrl:'https://messenger.testnet.420integrated.org',
 notificationsUrl:'https://notifications.testnet.420integrated.org',
 walletUrl:'https://wallet.testnet.420integrated.org',
 explorerUrl:'https://explorer.testnet.420integrated.org'};
test('AUTH-10 route accessible without wallet but ledger disabled by default',()=>{
 const route=resolveRoute('/account/xp');
 assert.equal(route.id,'account-xp');
 assert.equal(routeAccess(route,{connected:false,supportedNetwork:false}).allowed,true);
 assert.equal(validateRuntimeConfig({...config,features:{accountXP:true}}).features.accountXP,false);
 assert.equal(validateRuntimeConfig({...config,features:{accountSocial:true,accountXP:true}}).features.accountXP,true);
 const html=renderApplicationShell({pathname:'/account/xp',walletView:null});
 assert.match(html,/Community XP not activated/);
 assert.doesNotMatch(html,/XP to next level/);
});
test('AUTH-10 never presents XP as a token or spendable reward',()=>{
 const html=renderAccountXP({status:'ready',summary},{enabled:true});
 assert.match(html,/not 420Token, currency, a wager, redeemable credit/i);
 assert.match(html,/Wallet-independent/);
 assert.match(html,/7<\/strong>/);
 assert.match(html,/Earned \+5 XP/);
 assert.match(html,/Policy v1/);
 assert.match(renderAccountXP({status:'guest'},{enabled:true}),/Sign in with 420ID/);
 assert.match(renderAccountXP({status:'error'},{enabled:true}),/No previously cached points/);
 assert.equal(XP_POLICY.postDailyCap,3);
 assert.equal(XP_POLICY.commentDailyCap,10);
});
test('AUTH-10 controller checks authenticated subject, private API and no cached fallback',async()=>{
 let authorized=true,valid=true;const calls=[];
 const client=new AccountXPController({enabled:true,fetchImpl:async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/v1/me'))return authorized?ok({walletRequired:false,profile:{subject:who}}):ok({},401);
  if(url.endsWith('/v1/xp'))return ok(valid?summary:{...summary,onChain:true});
  throw Error('unexpected network request');
 }});
 await client.refresh();
 assert.equal(client.state.status,'ready');
 assert.equal(client.state.summary.total,7);
 assert.deepEqual(calls.map(v=>v.url),['/social-api/v1/me','/social-api/v1/xp']);
 assert.ok(calls.every(v=>v.options.credentials==='same-origin'&&v.options.cache==='no-store'&&v.options.redirect==='error'));
 valid=false;await client.refresh();assert.equal(client.state.status,'error');
 assert.equal(client.state.summary,undefined);
 authorized=false;await client.refresh();assert.equal(client.state.status,'guest');
 assert.equal(client.state.summary,undefined);
});
test('AUTH-10 rejects cross-account subjects, inflated and malformed XP journals',async()=>{
 const invalid=[
 {...summary,subject:'34567890-1234-4345-8345-123456789abc'},
 {...summary,level:99},{...summary,total:-3},{...summary,total:100000,level:1001},
 {...summary,redeemable:true},{...summary,source:'onchain-rewards'},
 {...summary,todayPosts:4},{...summary,events:[{...summary.events[0],points:50000}]},
 {...summary,events:[{...summary.events[0],action:'revoke',points:5}]}
 ];
 for(const payload of invalid){
  const c=new AccountXPController({enabled:true,fetchImpl:async url=>
   url.endsWith('/v1/me')?ok({walletRequired:false,profile:{subject:who}}):ok(payload)});
  await c.refresh();
  assert.equal(c.state.status,'error');
 }
});
test('AUTH-10 HTML escapes untrusted event display and never injects wallet authority',()=>{
 const trick={...summary,events:[{...summary.events[0],at:'2026-11-20T18:00:00Z<script>alert(1)</script>'}]};
 const html=renderAccountXP({status:'ready',summary:trick},{enabled:true});
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/data-wallet-sign|eth_sendTransaction|personal_sign/);
});
