import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AccountIdentityController,normalizeAccountIdentity,verifiedAccount,renderAccountHeader,renderGameAccountPanel} from '../core/account-identity.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {CLASSIC_ROADMAP} from '../core/classics.js';
import {resolveRoute,routeAccess} from '../core/routes.js';

const subject='12345678-1234-4123-8123-123456789abc';
const profile={subject,displayName:'Classic Player',bio:''};
const me={walletRequired:false,profile};
const ready={status:'ready',profile};
const response=(status,data)=>({status,ok:status>=200&&status<300,headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>data});
const page=(pathname,state,{enabled=true,social={status:'error'}}={})=>
 renderApplicationShell({pathname,walletView:null,accountIdentityState:state,accountIdentityEnabled:enabled,
  accountSocialState:social,accountSocialEnabled:enabled});

test('BC-0.4 accepts only a server-confirmed wallet-optional 420ID profile',()=>{
 assert.deepEqual(normalizeAccountIdentity(me),{subject,displayName:'Classic Player'});
 for(const dto of [null,{}, {...me,walletRequired:true},{...me,walletRequired:undefined},
  {...me,profile:{...profile,subject:'0x'+'1'.repeat(40)}},
  {...me,profile:{...profile,subject:'abc'}},
  {...me,profile:{...profile,displayName:''}},
  {...me,profile:{...profile,displayName:'x'.repeat(81)}},
  {...me,profile:{...profile,displayName:'bad\u0000name'}}])
  assert.equal(normalizeAccountIdentity(dto),null);
 assert.equal(verifiedAccount({status:'guest',profile}),null);
 assert.equal(verifiedAccount({status:'error',profile}),null);
 assert.equal(verifiedAccount({status:'ready',profile:{...profile,subject:'forged'}}),null);
 assert.equal(verifiedAccount(ready)?.subject,subject);
});
test('BC-0.4 reads /v1/me using existing same-origin HttpOnly session with no wallet, feed or token storage',async()=>{
 const calls=[],state=[];
 const auth=new AccountIdentityController({enabled:true,fetchImpl:async(url,options)=>{
  calls.push({url,options});return response(200,me);
 },onChange:s=>state.push(s.status)});
 const result=await auth.refresh();
 assert.equal(result.status,'ready');
 assert.deepEqual(result.profile,{subject,displayName:profile.displayName});
 assert.deepEqual(calls.map(x=>x.url),['/social-api/v1/me']);
 assert.deepEqual(calls.map(x=>x.options.method),['GET']);
 assert.equal(calls[0].options.credentials,'same-origin');
 assert.equal(calls[0].options.cache,'no-store');
 assert.equal(calls[0].options.redirect,'error');
 assert.equal(calls[0].options.body,undefined);
 assert.deepEqual(state,['loading','ready']);
 assert.deepEqual(Object.keys(auth.state).sort(),['profile','status']);
});
test('BC-0.4 a 401 or invalid session clears previous account instead of showing stale data',async()=>{
 let ok=true;
 const auth=new AccountIdentityController({enabled:true,fetchImpl:async()=>ok?response(200,me):response(401,{error:'expired'})});
 await auth.refresh();
 assert.equal(auth.state.status,'ready');
 ok=false;
 const expired=await auth.refresh({quiet:true});
 assert.deepEqual(expired,{status:'guest'});
 assert.equal(verifiedAccount(expired),null);
 assert.match(renderAccountHeader(expired,{enabled:true}),/Sign In/);
 const wrong=new AccountIdentityController({enabled:true,fetchImpl:async()=>response(200,{...me,walletRequired:true})});
 assert.deepEqual(await wrong.refresh(),{status:'error'});
});
test('BC-0.4 fail-closed outage retries only idempotent account reads and never invents guest state',async()=>{
 const calls=[],scheduled=[];
 let status=503;
 const auth=new AccountIdentityController({enabled:true,fetchImpl:async(url,opts)=>{
  calls.push([url,opts.method]);return response(status,status===200?me:{error:'temporarily unavailable'});
 },wakeRetryDelays:[10],scheduleWakeRetry:(fn,ms)=>scheduled.push({fn,ms})});
 assert.deepEqual(await auth.refresh(),{status:'error',temporary:true});
 assert.equal(scheduled.length,1);
 assert.equal(scheduled[0].ms,10);
 assert.match(renderAccountHeader(auth.state,{enabled:true}),/Retry 420ID check/);
 status=200;
 scheduled[0].fn();
 // The scheduled callback launches an idempotent GET asynchronously.
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(auth.state.status,'ready');
 assert.deepEqual(calls.map(x=>x[1]),['GET','GET']);
});
test('BC-0.4 out-of-order authentication results cannot overwrite a newer account',async()=>{
 const pending=[];
 const auth=new AccountIdentityController({enabled:true,fetchImpl:()=>new Promise(done=>pending.push(done))});
 const first=auth.refresh();
 const second=auth.refresh();
 pending[1](response(401,{error:'expired'}));
 await second;
 assert.equal(auth.state.status,'guest');
 pending[0](response(200,me));
 await first;
 assert.deepEqual(auth.state,{status:'guest'});
});
test('BC-0.4 quiet revalidation preserves active drafts but detects an identity change',async()=>{
 const another={...me,profile:{...profile,subject:'23456789-1234-4234-8234-123456789abc',displayName:'Other member'}};
 let current=me;const emissions=[];
 const auth=new AccountIdentityController({enabled:true,fetchImpl:async()=>response(200,current),onChange:s=>emissions.push(s.status)});
 await auth.refresh();
 const before=emissions.length;
 await auth.refresh({quiet:true});
 assert.equal(emissions.length,before,'unchanged session must not rerender the active draft');
 current=another;
 await auth.refresh({quiet:true});
 assert.equal(auth.state.profile.displayName,'Other member');
 assert.equal(emissions.length,before+1,'a changed account must replace the visible identity');
});
test('BC-0.4 signout posts exactly once, revokes the same 420ID session and clears profile',async()=>{
 const calls=[];
 const auth=new AccountIdentityController({enabled:true,fetchImpl:async(url,opts)=>{
  calls.push({url,opts});
  return url.endsWith('/auth/logout')?response(200,{signedOut:true}):response(200,me);
 }});
 await auth.refresh();
 const out=await auth.logout();
 assert.deepEqual(out,{status:'guest'});
 assert.deepEqual(calls.map(x=>x.url),['/social-api/v1/me','/social-api/auth/logout']);
 assert.equal(calls[1].opts.method,'POST');
 assert.equal(calls[1].opts.credentials,'same-origin');
 assert.equal(calls[1].opts.cache,'no-store');
 assert.equal(calls[1].opts.redirect,'error');
 assert.deepEqual(JSON.parse(calls[1].opts.body),{});
 await assert.rejects(auth.logout(),/Verified 420ID session/);
 assert.equal(calls.length,2);
});
test('BC-0.4 failed signout clears local identity and never retries a write',async()=>{
 let writes=0;
 const auth=new AccountIdentityController({enabled:true,fetchImpl:async(url)=>{
  if(url.endsWith('/auth/logout')){writes++;return response(503,{error:'unavailable'});}
  return response(200,me);
 },wakeRetryDelays:[0],scheduleWakeRetry:()=>{throw Error('no retries for logout');}});
 await auth.refresh();
 await assert.rejects(auth.logout(),/logout not confirmed/);
 assert.deepEqual(auth.state,{status:'error'});
 assert.equal(writes,1);
});
test('BC-0.4 signout fences overlapping identity rechecks and cannot be duplicated',async()=>{
 let finish;const calls=[];
 const auth=new AccountIdentityController({enabled:true,fetchImpl:async(url)=>{
  calls.push(url);
  if(url.endsWith('/auth/logout'))return new Promise(resolve=>{finish=resolve;});
  return response(200,me);
 }});
 await auth.refresh();
 const pending=auth.logout();
 assert.equal(auth.state.status,'loading');
 await auth.refresh({quiet:true});
 auth.invalidate();
 assert.equal(auth.state.status,'loading');
 await assert.rejects(auth.logout(),/Verified 420ID session/);
 assert.deepEqual(calls,['/social-api/v1/me','/social-api/auth/logout']);
 finish(response(200,{signedOut:true}));
 await pending;
 assert.deepEqual(auth.state,{status:'guest'});
});

test('BC-0.4 Sign In is visible on every Games screen and signed-in account identity is wallet optional',()=>{
 for(const game of CLASSIC_ROADMAP){
  for(const path of [game.href,game.href+'/setup']){
   const guest=page(path,{status:'guest'});
   assert.match(guest,/data-game-screen=/);
   assert.match(guest,/aria-label="420ID game account"/);
   assert.match(guest,/Sign In with 420ID/);
   assert.match(guest,/href="\/social-api\/auth\/start"/);
   assert.doesNotMatch(guest,/Signed in as <strong>Classic Player<\/strong>/);
   assert.equal(routeAccess(resolveRoute(path),{connected:false}).allowed,true);
   const authenticated=page(path,ready);
   assert.match(authenticated,/My account: Classic Player/);
   assert.match(authenticated,/Signed in as <strong>Classic Player<\/strong>/);
   assert.match(authenticated,/href="\/social" data-route="social">My 420ID profile/);
   assert.match(authenticated,/href="\/account\/games" data-route="account-games">Existing account games/);
   assert.doesNotMatch(authenticated,/class="account-auth-link account-auth-link--login" href="\/social-api\/auth\/start"/);
   assert.match(authenticated,/data-account-action="logout"/);
   assert.match(authenticated,/420ID account · wallet optional/);
  }
 }
});
test('BC-0.4 identity is independent of social feed loading, failure, wallet and sign-in expiry',()=>{
 const html=page('/games/cribbage/play',ready,{social:{status:'error'}});
 assert.match(html,/My account: Classic Player/);
 assert.match(html,/Signed in as <strong>Classic Player<\/strong>/);
 assert.doesNotMatch(html,/account-auth-link--login/);
 const error=page('/games/cribbage',{status:'error',profile});
 assert.match(error,/Your 420ID session could not be verified/);
 assert.doesNotMatch(error,/My account: Classic Player/);
 assert.doesNotMatch(error,/Signed in as <strong>Classic Player<\/strong>/);
 assert.match(error,/data-account-action="retry"/);
 const loading=page('/games',{status:'loading',profile});
 assert.match(loading,/Checking your existing 420ID session/);
 assert.doesNotMatch(loading,/My account: Classic Player/);
 const disabled=page('/games',{status:'guest'},{enabled:false});
 assert.doesNotMatch(disabled,/account-auth-link--login/);
 assert.match(disabled,/420ID account sign-in is not enabled/);
});
test('BC-0.4 untrusted display names are HTML-escaped on header, game pages and sidebar',()=>{
 const injected='<img src=x onerror=alert(1)>';
 const html=page('/games/kaiser',{status:'ready',profile:{subject,displayName:injected}});
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(html,/<img src=x onerror=/);
 assert.match(html,/data-account-action="logout"/);
});
test('BC-0.4 browser wiring revalidates identities on every route and visibility, keeps mutation paths separate',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/identityController=new AccountIdentityController\(\{enabled:runtimeConfig\.features\.accountSocial===true/);
 assert.match(app,/accountIdentityState:identityController\?\.state/);
 assert.match(app,/bindAccountActions\(\)/);
 assert.match(app,/if\(control\.dataset\.accountAction==='logout'\)void signOut420ID\(\)/);
 assert.match(app,/const pending=identityController\.logout\(\)/);
 assert.match(app,/if\(identityController\?\.client\.enabled\)void identityController\.refresh\(\);/);
 assert.match(app,/identityController\.refresh\(\{quiet:true\}\)/);
 assert.match(app,/if\(action==='logout'\)\{void signOut420ID\(\);return;\}/);
 assert.match(app,/if\(action==='profile'\)void identityController\?\.refresh\(\)/);
 assert.match(app,/socialController\?\.invalidate\(\);identityController\?\.invalidate\(\)/);
 assert.doesNotMatch(app,/localStorage\.setItem\(['"]420id/i);
});
