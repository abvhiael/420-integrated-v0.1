import test from 'node:test';import assert from 'node:assert/strict';
import {validateRuntimeConfig,readiness,IDS} from '../core/config.js';
import {connectWallet,validNetwork} from '../core/wallet.js';
import {parseRoute,href} from '../core/routes.js';
import {DoobTubeService,MediaService,safeMediaURL} from '../core/service.js';
import {idempotencyKey,rememberRetry,retryState,resetAuthorityState} from '../core/state.js';

function config(){return {schema:'doobtube-web-runtime-v1',site:{name:'DoobTube',productionOrigin:null},network:{chainId:null,network:null},services:{doobtube:{baseUrl:null},media:{serviceId:IDS.media,baseUrl:null},search:{serviceId:IDS.search,baseUrl:null},notifications:{serviceId:IDS.notifications,baseUrl:null}},features:{feed:true,search:true,playback:true,library:true,upload:true,livestreaming:true,subscriptions:true,moderation:true,preferences:true,delete:false,export:false},execution:{status:'DISABLED_UNTIL_CANONICAL_RUNTIME_RESOLVED',requireWalletChainMatch:true,requireHTTPS:true}};}

test('runtime config is fail-closed and canonical service IDs are exact',()=>{
 const c=validateRuntimeConfig(config());assert.equal(readiness(c).ready,false);assert.deepEqual(readiness(c).missing,['chainId','network','doobtubeApi','mediaApi']);
 assert.throws(()=>validateRuntimeConfig({...c,site:{...c.site,productionOrigin:'https://doobtube.example'}}),/production origin/);
 assert.throws(()=>validateRuntimeConfig({...c,services:{...c.services,media:{serviceId:'wrong',baseUrl:null}}}),/service id/);
});

test('wallet connection blocks wrong network without blocking anonymous routes',async()=>{
 const eth={async request({method}){if(method==='eth_requestAccounts')return ['0x1111111111111111111111111111111111111111'];if(method==='eth_chainId')return '0x1a4';}};
 const w=await connectWallet(eth,420);assert.equal(validNetwork(w,420),true);await assert.rejects(()=>connectWallet(eth,421),/WRONG_NETWORK/);
 assert.equal(parseRoute('#/home').name,'home');assert.equal(parseRoute('#/watch/asset-1').param,'asset-1');
});

test('canonical route set includes all V1 user surfaces',()=>{
 for(const name of ['home','search','watch','creator','library','upload','live','subscriptions','moderation','data','status'])assert.equal(parseRoute(href(name,'x')).name,name);
 assert.equal(parseRoute('#/unknown').name,'home');
});

test('safe playback rejects script/credential URLs',()=>{
 assert.equal(safeMediaURL('javascript:alert(1)','https://doobtube.example'),null);
 assert.equal(safeMediaURL('https://user:pass@cdn.example/x','https://doobtube.example'),null);
 assert.equal(safeMediaURL('https://cdn.example/video.mp4','https://doobtube.example'),'https://cdn.example/video.mp4');
});

test('fixture browser flow composes DoobTube feed and exact Media API routes',async()=>{
 const calls=[];
 const fetchImpl=async(url,options={})=>{
   calls.push({url,options});let data={};
   if(url.includes('/v1/feed?'))data={items:[{media_asset_id:'asset-1',title:'Public video',creator_ref:'creator-1'}],next_cursor:''};
   else if(url.endsWith('/v1/compatibility'))data={service_id:IDS.media,api_version:'v1',compatibility_major:1,chain_id:420,network:'testnet'};
   else if(url.endsWith('/v1/capabilities'))data={service_id:IDS.media,api_version:'v1',compatibility_major:1};
   else if(url.includes('/v1/assets/asset-1'))data={id:'asset-1',status:'READY',visibility:'PUBLIC',playback_url:'https://cdn.example/asset-1.mp4',owner_ref:'creator-1'};
   else if(url.includes('/v1/search?'))data={items:[{id:'asset-1',title:'Public video'}],next_cursor:''};
   else if(url.endsWith('/v1/notifications/subscriptions'))data={id:'sub-1',promotional_opt_in:false};
   else if(url.endsWith('/v1/moderation/reports'))data={id:'report-1',target_id:'asset-1'};
   else if(url.includes('/v1/moderation/decisions/decision-1/appeals'))data={id:'appeal-1',decision_id:'decision-1'};
   return {ok:true,status:200,async text(){return JSON.stringify({version:'v1',data});}};
 };
 const dt=new DoobTubeService({baseUrl:'https://doobtube.example',fetchImpl});const media=new MediaService({baseUrl:'https://media.example',fetchImpl});
 assert.equal((await dt.feed()).items[0].media_asset_id,'asset-1');
 assert.equal((await media.asset('asset-1')).status,'READY');
 assert.equal((await media.search('public')).items.length,1);
 await media.subscribe({id:'s',user_ref:'0x1111111111111111111111111111111111111111',topic:'creator:c',channel:'in_app',minimum_severity:0,minimum_finality:'FINALIZED',promotional_opt_in:false},'sub-key');
 await media.report({id:'r',reporter_ref:'0x1111111111111111111111111111111111111111',target_kind:'MediaAsset',target_id:'asset-1',reason:'abuse',evidence_ref:''},'report-key');
 await media.appeal('decision-1',{id:'a',appellant_ref:'0x1111111111111111111111111111111111111111',reason:'review'},'appeal-key');
 assert.ok(calls.some(x=>x.url.endsWith('/v1/notifications/subscriptions')&&x.options.method==='POST'));
 assert.ok(calls.some(x=>x.url.endsWith('/v1/moderation/reports')&&x.options.method==='POST'));
 assert.ok(calls.some(x=>x.url.includes('/v1/moderation/decisions/decision-1/appeals')));
});

test('upload transport and mutation idempotency remain safe',async()=>{
 let method='';const media=new MediaService({baseUrl:'https://media.example',fetchImpl:async(_u,o={})=>{method=o.method;return {ok:true,status:200,async text(){return JSON.stringify({version:'v1',data:{}});}};}});
 await assert.rejects(()=>media.uploadBytes('http://evil.example/upload',new Blob(['x'],{type:'video/mp4'})),/unsafe upload endpoint/);
 await media.uploadBytes('https://storage.example/upload',new Blob(['x'],{type:'video/mp4'}));assert.equal(method,'PUT');
});

test('retry state is memory-only and resets on authority invalidation',()=>{
 resetAuthorityState();const key=idempotencyKey('upload');rememberRetry('upload',key,{asset:'a'});assert.equal(retryState('upload').key,key);resetAuthorityState();assert.equal(retryState('upload'),null);
});
