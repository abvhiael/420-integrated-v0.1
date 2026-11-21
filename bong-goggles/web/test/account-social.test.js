import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountSocialClient,normalizeAccountSocialFeed,renderAccountSocial,socialInput} from '../core/account-social.js';
import {AccountSocialController} from '../core/account-social-controller.js';
import {resolveRoute,routeAccess} from '../core/routes.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {validateRuntimeConfig} from '../core/runtime-config.js';

const me='12345678-1234-4123-8123-123456789abc';
const target='23456789-1234-4234-8234-123456789abc';
const postID='34567890-1234-4345-8345-123456789abc';
const post={id:postID,author:target,displayName:'Another member',body:'Hello! <script>alert(1)</script>',createdAt:'2026-11-20T18:00:00Z',reactions:0};
const feed={source:'bonggoggles-account-social',onChain:false,posts:[post],nextCursor:null};
function fakeResponse(status,data){return {ok:status>=200&&status<300,status,headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>data};}
test('wallet independent social route and disabled-by-default config',async()=>{
 const route=resolveRoute('/social');
 assert.equal(route.id,'social');
 assert.equal(routeAccess(route,{connected:false}).allowed,true);
 const config=validateRuntimeConfig({
 environment:'testnet',appOrigin:'https://bonggoggles.420integrated.org',
 chainId:420420,rpcUrl:'https://rpc.testnet.420integrated.org',
 indexerUrl:'https://api.bonggoggles.testnet.420integrated.org',
 mediaUrl:'https://media.testnet.420integrated.org',
 messengerUrl:'https://messenger.testnet.420integrated.org',
 notificationsUrl:'https://notifications.testnet.420integrated.org',
 walletUrl:'https://wallet.testnet.420integrated.org',
 explorerUrl:'https://explorer.testnet.420integrated.org',
 features:{profiles:true}
 });
 assert.equal(config.features.accountSocial,false);
 assert.equal(createAccountSocialClient({enabled:false}).enabled,false);
 const html=renderApplicationShell({pathname:'/social',walletView:null,accountSocialEnabled:false});
 assert.match(html,/Account social not activated/);
 assert.doesNotMatch(html,/Sign in with 420ID/);
});
test('approved off-chain DTO, HTML escape, and no wallet gating',async()=>{
 assert.deepEqual(normalizeAccountSocialFeed(feed).posts[0].body,post.body);
 for(const invalid of [
  {...feed,onChain:true}, {...feed,source:'canonical-chain-feed'},
  {...feed,posts:[{...post,author:'0x'+'f'.repeat(40)}]},
  {...feed,nextCursor:'https://evil.invalid'}
 ])assert.equal(normalizeAccountSocialFeed(invalid),null);
 const guest=renderAccountSocial({status:'guest'},{enabled:true});
 assert.match(guest,/Sign in with 420ID/);
 assert.match(guest,/No wallet/);
 const html=renderAccountSocial({status:'ready',profile:{subject:me,displayName:'User <h1>'},posts:[post],comments:{[postID]:[{displayName:'<b>bad</b>',body:'<script>',id:postID}]},nextCursor:null},{enabled:true});
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>alert/);
 assert.doesNotMatch(html,/<b>bad/);
 assert.match(html,/off-chain/);
 assert.match(html,/data-social-action="block"/);
 assert.match(html,/Comment/);
});
test('client never sends a wallet or cross-origin credential',async()=>{
 const calls=[];
 const client=createAccountSocialClient({enabled:true,fetchImpl:async(url,opts)=>{
  calls.push({url,opts});return fakeResponse(200,{walletRequired:false});
 }});
 const result=await client.request('/v1/me');
 assert.equal(result.status,200);
 const logout=await client.request('/auth/logout',{method:'POST',body:{}});
 assert.equal(logout.status,200);
 assert.deepEqual(calls.map(x=>x.url),['/social-api/v1/me','/social-api/auth/logout']);
 assert.ok(calls.every(x=>x.opts.credentials==='same-origin'&&x.opts.cache==='no-store'&&x.opts.redirect==='error'));
 for(const invalid of ['/v1/../admin','//evil.invalid/','https://evil.invalid','/v1/foo?token=abc'])
  await assert.rejects(client.request(invalid));
 assert.equal(calls.length,2);
});
test('central session and feed are mandatory for authenticated actions',async()=>{
 let valid=true;const calls=[];
 const controller=new AccountSocialController({enabled:true,fetchImpl:async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith('/v1/me'))return valid?fakeResponse(200,{walletRequired:false,profile:{subject:me,displayName:'Test',bio:''}}):fakeResponse(401,{error:'unauthorized'});
  if(url.endsWith('/v1/feed'))return fakeResponse(200,feed);
  if(url.endsWith('/v1/posts')&&opts.method==='POST')return fakeResponse(201,{post});
  if(url.endsWith('/v1/posts/'+postID+'/comments')&&opts.method==='GET')return fakeResponse(200,{comments:[]});
  if(url.endsWith('/auth/logout')){valid=false;return fakeResponse(200,{signedOut:true});}
  return fakeResponse(200,{updated:true});
 }});
 await assert.rejects(controller.act('post',{body:'Not authenticated'}));
 await controller.refresh();
 assert.equal(controller.state.status,'ready');
 assert.equal(controller.state.posts[0].body,post.body);
 await controller.act('comments',{postID});
 assert.ok(Array.isArray(controller.state.comments[postID]));
 await controller.act('post',{body:'A real post'});
 assert.ok(calls.some(c=>c.url==='/social-api/v1/posts'&&JSON.parse(c.opts.body).body==='A real post'));
 await controller.act('logout');
 assert.equal(controller.state.status,'guest');
 await assert.rejects(controller.act('post',{body:'Cannot write'}));
});
test('content inputs reject invisible controls and oversized data',()=>{
 for(const text of ['<hello>',"Hello\nWorld"])assert.equal(socialInput(text,'post'),text);
 for(const text of ['   ',' leading','bad\x00','bad\u202e','x'.repeat(2001)])
  assert.throws(()=>socialInput(text,'post'));
 assert.equal(socialInput('','bio'),'');
 assert.throws(()=>socialInput('test','unknown'));
});
