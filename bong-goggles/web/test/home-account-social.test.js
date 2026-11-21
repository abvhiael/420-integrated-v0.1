import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderHomeAccountSocial} from '../core/account-social.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {AccountSocialController} from '../core/account-social-controller.js';

const me='12345678-1234-4123-8123-123456789abc';
const other='23456789-1234-4234-8234-123456789abc';
const postId='34567890-1234-4345-8345-123456789abc';
const item={id:postId,author:other,displayName:'Team <script>hello</script>',body:'First post <img src=x onerror=alert(1)>',createdAt:'2026-11-21T18:01:41Z',reactions:3};
const ready=()=>({status:'ready',profile:{subject:me,displayName:'Member & friends',bio:''},posts:[item],comments:{},nextCursor:null,notice:''});
const renderHome=(state,enabled=true)=>renderApplicationShell({pathname:'/',walletView:{connected:false,supportedNetwork:false},accountSocialEnabled:enabled,accountSocialState:state});

test('Home prioritizes authenticated off-chain feed with working post and moderation affordances',()=>{
 const html=renderHome(ready());
 assert.match(html,/Wallet-free community · off-chain/);
 assert.match(html,/OFF-CHAIN/);
 assert.match(html,/data-social-post/);
 assert.match(html,/name="body" maxlength="2000" required/);
 assert.match(html,/Publish post/);
 assert.match(html,/Off-chain community posts/);
 assert.match(html,/First post &lt;img src=x onerror=alert\(1\)&gt;/);
 assert.match(html,/Team &lt;script&gt;hello&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>hello<\/script>/);
 assert.doesNotMatch(html,/<img src=x onerror/);
 assert.match(html,/data-social-action="comments"/);
 assert.match(html,/data-social-action="report"/);
 assert.match(html,/data-social-action="react"/);
 assert.match(html,/data-social-action="refresh"/);
 assert.match(html,/data-route="social"/);
 assert.match(html,/Blockchain publishing &amp; indexed feed/);
 assert.ok(html.indexOf('Off-chain community posts')<html.indexOf('Blockchain publishing &amp; indexed feed'));
});

test('canonical blockchain composer and feed are separate and remain non-writable without wallet approval',()=>{
 const html=renderHome(ready());
 assert.match(html,/<details class="home-canonical"/);
 assert.match(html,/Separate from the off-chain community/);
 assert.match(html,/Off-chain community posts are not submitted to the chain/);
 assert.match(html,/Canonical publishing/);
 assert.match(html,/Blockchain feed/);
 assert.match(html,/Review in 420Wallet/);
 assert.match(html,/data-action="publish-review" disabled/);
 assert.equal((html.match(/data-social-post/g)||[]).length,1);
 assert.equal((html.match(/data-composer-text/g)||[]).length,1);
});

test('Home fails closed when social activation is disabled or the 420ID session is unverified',()=>{
 const disabled=renderHome(ready(),false);
 assert.match(disabled,/Canonical publishing/);
 assert.match(disabled,/Home feed/);
 assert.doesNotMatch(disabled,/Wallet-free community · off-chain/);
 assert.doesNotMatch(disabled,/First post/);
 assert.doesNotMatch(disabled,/data-social-post/);
 assert.doesNotMatch(disabled,/home-canonical/);
 assert.match(renderHomeAccountSocial(ready(),{enabled:false}),/Account Social is not activated/);
 const loading=renderHome(null);
 assert.match(loading,/Checking your 420ID session/);
 assert.doesNotMatch(loading,/First post/);
 const guest=renderHome({status:'guest',posts:[item]});
 assert.match(guest,/Sign in with 420ID/);
 assert.match(guest,/\/social-api\/auth\/start/);
 assert.doesNotMatch(guest,/First post/);
 assert.doesNotMatch(guest,/data-social-post/);
 const failure=renderHome({status:'error',posts:[item]});
 assert.match(failure,/Retry community feed/);
 assert.match(failure,/No cached or private content is shown/);
 assert.doesNotMatch(failure,/First post/);
 assert.doesNotMatch(failure,/data-social-post/);
});

test('Home session state keeps separate public canonical projection unavailable',()=>{
 const html=renderHome(ready());
 assert.match(html,/Canonical feed unavailable/);
 assert.doesNotMatch(html,/Post text<\/span>\s*<textarea name="body"/);
 assert.match(html,/wallet is not needed/i);
 const htmlNoState=renderHome(undefined);
 assert.doesNotMatch(htmlNoState,/First post/);
});

test('Home uses same 420ID verified social API, and posting refetches authoritative feed',async()=>{
 const calls=[];let posted=false;
 const response=(status,data)=>({ok:status>=200&&status<300,status,headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>data});
 const controller=new AccountSocialController({enabled:true,fetchImpl:async(url,options)=>{
  calls.push({url,options});
  if(url==='/social-api/v1/me')return response(200,{profile:ready().profile,walletRequired:false});
  if(url==='/social-api/v1/feed')return response(200,{source:'bonggoggles-account-social',onChain:false,nextCursor:null,posts:posted?[item]:[]});
  if(url==='/social-api/v1/posts'&&options.method==='POST'){posted=true;return response(201,{post:item,onChain:false});}
  throw Error('Unexpected backend route');
 }});
 await controller.refresh();
 assert.equal(controller.state.status,'ready');
 assert.equal(controller.state.posts.length,0);
 assert.doesNotMatch(renderHomeAccountSocial(controller.state,{enabled:true}),/First post/);
 await controller.act('post',{body:'Hello community'});
 assert.equal(controller.state.status,'ready');
 assert.equal(controller.state.posts.length,1);
 assert.match(renderHomeAccountSocial(controller.state,{enabled:true}),/First post/);
 assert.deepEqual(calls.map(x=>x.url),['/social-api/v1/me','/social-api/v1/feed','/social-api/v1/posts','/social-api/v1/me','/social-api/v1/feed']);
 assert.ok(calls.every(x=>x.options.credentials==='same-origin'&&x.options.cache==='no-store'));
 assert.equal(JSON.parse(calls[2].options.body).body,'Hello community');
 assert.equal(calls[2].options.headers.Accept,'application/json');
});

test('Home wires existing social lifecycle without a parallel unverified API or exposing it to other routes',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/const isAccountSocialSurface=\(\)=>window\.location\.pathname==='\/'\|\|window\.location\.pathname==='\/social'/);
 assert.match(app,/if\(!isAccountSocialSurface\(\)\|\|!socialController\?\.client\.enabled\)return;/);
 assert.match(app,/onChange:\(\)=>\{if\(isAccountSocialSurface\(\)\)renderCurrent\(\);\}/);
 assert.match(app,/if\(isAccountSocialSurface\(\)&&socialController\?\.client\.enabled\)void socialController\.refresh\(\);/);
 assert.match(app,/if\(isAccountSocialSurface\(\)&&socialController\.client\.enabled\)void socialController\.refresh\(\);/);
 assert.match(app,/socialController\?\.invalidate\(\)/);
 assert.match(app,/runtimeConfig\.features\.accountSocial===true\?null:/);
 const autoRefresh=app.match(/if\(publicFeedReader\?\.enabled&&!socialController\?\.client\.enabled\)void refreshPublicFeed\(\);/g)||[];
 assert.equal(autoRefresh.length,2,'Visibility and 15-second canonical polling must not erase an off-chain post draft');
});
