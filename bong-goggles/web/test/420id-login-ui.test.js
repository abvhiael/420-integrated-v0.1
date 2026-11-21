import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderApplicationShell} from '../core/app-shell.js';
import {renderAccountSocial,renderHomeAccountSocial} from '../core/account-social.js';
import {AccountSocialController} from '../core/account-social-controller.js';

const me='12345678-1234-4123-8123-123456789abc';
const post={id:'34567890-1234-4345-8345-123456789abc',author:me,displayName:'Member',body:'Private post <script>alert(1)</script>',createdAt:'2026-11-21T18:01:41Z',reactions:0};
const ready={status:'ready',profile:{subject:me,displayName:'Member <script>alert(1)</script>'},posts:[post],comments:{},nextCursor:null};
const respond=(status,data)=>({status,ok:status>=200&&status<300,headers:{get:()=> 'application/json'},json:async()=>data});
const shell=(pathname,accountSocialState,enabled=true)=>renderApplicationShell({pathname,accountSocialState,accountSocialEnabled:enabled,walletView:null});

test('header exposes a prominent same-origin 420ID login with no Wallet requirement',()=>{
 for(const state of [null,{status:'loading'},{status:'guest'},{status:'error'}]){
  for(const route of ['/', '/social','/discover']){
   const html=shell(route,state);
   assert.match(html,/<a class="account-auth-link account-auth-link--login" href="\/social-api\/auth\/start"><span aria-hidden="true" class="account-auth-link__icon">↪<\/span><span>Log in with 420ID<\/span><\/a>/);
   assert.doesNotMatch(html,/<a class="account-auth-link[^"]*"[^>]*href="https?:/);
   assert.doesNotMatch(html,/Private post &lt;script&gt;/);
  }
 }
 const disabled=shell('/social',{status:'error'},false);
 assert.doesNotMatch(disabled,/account-auth-link/);
 assert.match(disabled,/Account social not activated/);
});

test('Account Social error has real login and live retry controls, not broken route reload',()=>{
 for(const status of ['error','unavailable']){
  const html=renderAccountSocial({status,posts:[post]},{enabled:true});
  assert.match(html,/href="\/social-api\/auth\/start">Sign in again with 420ID<\/a>/);
  assert.match(html,/data-social-action="refresh">Retry session check<\/button>/);
  assert.doesNotMatch(html,/<a href="\/social">Retry<\/a>/);
  assert.doesNotMatch(html,/Private post/);
 }
 const guest=renderAccountSocial({status:'guest'},{enabled:true});
 assert.match(guest,/href="\/social-api\/auth\/start">Sign in with 420ID/);
});

test('Home offers login and retry when backend times out; no cached community posts are shown',()=>{
 const error=shell('/',{status:'error',posts:[post]});
 assert.match(error,/href="\/social-api\/auth\/start">Sign in again with 420ID<\/a>/);
 assert.match(error,/data-social-action="refresh">Retry community feed<\/button>/);
 assert.doesNotMatch(error,/Private post/);
 const guest=shell('/',{status:'guest',posts:[post]});
 assert.match(guest,/Sign in to see community posts/);
 assert.doesNotMatch(guest,/Private post/);
});

test('verified 420ID member is not mislabelled as Wallet guest, and untrusted display name is escaped',()=>{
 const html=shell('/social',ready);
 assert.match(html,/class="account-auth-link account-auth-link--account" href="\/social" data-route="social" aria-label="Open your 420ID account"><span aria-hidden="true" class="account-auth-link__icon">●<\/span><span>My account: Member &lt;script&gt;/);
 assert.doesNotMatch(html,/class="account-auth-link account-auth-link--login" href="\/social-api\/auth\/start"/);
 assert.match(html,/420ID account · wallet optional/);
 assert.doesNotMatch(html,/Welcome, guest/);
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/read-only/);
 const loggedOut=shell('/social',{status:'guest'});
 assert.match(loggedOut,/Welcome, guest/);
});

test('expired session between profile and feed resolves to guest without displaying posts or enabling writes',async()=>{
 let calls=0;
 const controller=new AccountSocialController({enabled:true,fetchImpl:async(path)=>{
  calls++;
  if(path.endsWith('/v1/me'))return respond(200,{profile:{subject:me,displayName:'Member'},walletRequired:false});
  if(path.endsWith('/v1/feed'))return respond(401,{error:'Unauthorized'});
  throw Error('Unexpected path');
 }});
 const state=await controller.refresh();
 assert.equal(calls,2);
 assert.equal(state.status,'guest');
 assert.deepEqual(Object.keys(state).sort(),['status']);
 assert.doesNotMatch(renderHomeAccountSocial(state,{enabled:true}),/Private post/);
 await assert.rejects(controller.act('post',{body:'Must not publish'}),/Verified 420ID social session/);
});

test('temporary 420ID outage keeps failed data private but renders a reconnect path',async()=>{
 const controller=new AccountSocialController({enabled:true,fetchImpl:async()=>respond(503,{error:'Service Unavailable'})});
 await controller.refresh();
 assert.equal(controller.state.status,'error');
 const html=shell('/social',controller.state);
 assert.match(html,/Sign in again with 420ID/);
 assert.match(html,/Retry session check/);
 assert.doesNotMatch(html,/data-social-post/);
});

test('existing click binding supports Retry while disabled account social never creates login controls',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/if\(action==='refresh'\)\{void socialController\.refresh\(\);return;\}/);
 assert.match(app,/if\(!isAccountSocialSurface\(\)\|\|!socialController\?\.client\.enabled\)return/);
});

test('login and account actions remain obvious and keyboard-accessible at mobile sizes',async()=>{
 const css=await readFile(new URL('../dashboard.css',import.meta.url),'utf8');
 assert.match(css,/\.app-header \.account-auth-link--login\{background:#ffdf68;color:#0a2b1d/);
 assert.match(css,/\.app-header \.account-auth-link\{[^}]*min-height:44px/);
 assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.app-header \.header-state\{order:3;flex:1 0 100%;min-width:0\}/);
 assert.match(css,/\.app-header \.account-auth-link\{width:100%;min-height:46px/);
 assert.match(css,/\.app-header \.account-auth-link:focus-visible\{outline:3px solid #fff/);
 assert.match(css,/@media\(forced-colors:active\)/);
 const loggedOut=shell('/',{status:'guest'});
 const loggedIn=shell('/',ready);
 assert.match(loggedOut,/Log in with 420ID/);
 assert.match(loggedIn,/My account:/);
 assert.doesNotMatch(loggedIn,/class="account-auth-link account-auth-link--login"/);
});
