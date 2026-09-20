import test from 'node:test';
import assert from 'node:assert/strict';
import {createScopedSocialHttp} from '../src/scopedSocialHttp.js';
const account=`0x${'a'.repeat(40)}`;
const hash=`0x${'b'.repeat(64)}`;
const feedItem={objectId:hash,author:account,objectType:'POST',status:'ACTIVE',audienceType:'PUBLIC',contentHash:hash,version:1};
const page={feedClass:'HOME',items:[feedItem],snapshotBlock:40,hasMore:false,cursor:null,authoritative:false};
const record={records:[{account,displayName:'public',active:true}],snapshotBlock:40,authoritative:false};
const pagination={configured:true,read:async()=>({status:'ready',data:page})};
const scopedRead={configured:true,read:async()=>({status:'ready',data:record})};
const create=(overrides={})=>createScopedSocialHttp({enabled:true,pagination,scopedRead,...overrides});
const feed=(route,extra={})=>route({method:'GET',requestUrl:'/v1/scoped/feed?feedClass=HOME&limit=20',credential:'opaque',...extra});

test('BG-19.19 scoped route disabled unless explicitly enabled with both qualified guards',async()=>{
 for(const options of [{},{enabled:true},{enabled:true,pagination:{...pagination,configured:false},scopedRead}]){
  const api=createScopedSocialHttp(options);
  assert.equal(api.configured,false);
  assert.equal((await feed(api.route)).status,503);
 }
});

test('BG-19.19 HTTP feed is least-data and does not accept viewer overrides',async()=>{
 let call;
 const api=create({pagination:{configured:true,read:async args=>{call=args;return {status:'ready',data:page};}}});
 const response=await feed(api.route);
 assert.equal(response.status,200);
 assert.equal(response.headers['cache-control'],'no-store');
 assert.equal(response.body.apiVersion,'bg-scoped-social-read-v1');
 assert.deepEqual(response.body.data.items,[feedItem]);
 assert.equal(call.credential,'opaque');
 assert.equal(call.feedClass,'HOME');
 assert.equal((await feed(api.route,{requestUrl:'/v1/scoped/feed?feedClass=HOME&viewer='+account})).status,400);
 assert.equal((await feed(api.route,{requestUrl:'/v1/scoped/feed?feedClass=HOME&limit=2&limit=3'})).status,400);
 assert.equal((await feed(api.route,{requestUrl:'/v1/scoped/feed?feedClass=DISCOVER'})).status,400);
 assert.equal((await feed(api.route,{credential:null})).status,401);
});

test('BG-19.19 feed denies private metadata or dishonest cursor, status and snapshot',async()=>{
 for(const data of [
  {...page,items:[{...feedItem,privateNote:'secret'}]},
  {...page,items:[{...feedItem,audienceType:'FRIENDS'}]},
  {...page,items:[{...feedItem,status:'WITHDRAWN'}]},
  {...page,hasMore:true,cursor:null},
  {...page,hasMore:false,cursor:'eyJmb28iOiJiYXIifQ.sig'},
  {...page,snapshotBlock:-1},
  {...page,authoritative:true},
 ]){
  const api=create({pagination:{configured:true,read:async()=>({status:'ready',data})}});
  const result=await feed(api.route);
  assert.equal(result.status,503);
  assert.equal(JSON.stringify(result).includes('secret'),false);
 }
});

test('BG-19.19 scoped records are allowlisted and cannot serialize raw or cross-scope fields',async()=>{
 const api=create();
 const response=await api.route({method:'GET',requestUrl:'/v1/scoped/record?resource=profile',credential:'opaque'});
 assert.equal(response.status,200);
 assert.deepEqual(response.body.data.records,record.records);
 for(const data of [{...record,records:[{...record.records[0],email:'private'}]},
  {...record,records:[{account,displayName:'public',active:false}]},
  {...record,records:[{account:'not-account',displayName:'public',active:true}]}]){
  const bad=create({scopedRead:{configured:true,read:async()=>({status:'ready',data})}});
  const result=await bad.route({method:'GET',requestUrl:'/v1/scoped/record?resource=profile',credential:'opaque'});
  assert.equal(result.status,503);
  assert.equal(JSON.stringify(result).includes('private'),false);
 }
});

test('BG-19.19 rejects bad routes, unauthenticated access and upstream failures without details',async()=>{
 const api=create();
 for(const req of [{method:'POST',requestUrl:'/v1/scoped/feed?feedClass=HOME',credential:'opaque'},
  {method:'GET',requestUrl:'/v1/scoped/feed?feedClass=HOME&cursor=bad',credential:'opaque'},
  {method:'GET',requestUrl:'/v1/scoped/record?resource=community&subject=bad',credential:'opaque'},
  {method:'GET',requestUrl:'/v1/scoped/record?resource=relationships&subject='+account,credential:'opaque'},
  {method:'GET',requestUrl:'/v1/scoped/not-found',credential:'opaque'}]){
  assert.notEqual((await api.route(req)).status,200);
 }
 const broken=create({pagination:{configured:true,read:async()=>{throw Error('secret downstream failure');}}});
 const response=await feed(broken.route);
 assert.equal(response.status,503);
 assert.equal(JSON.stringify(response).includes('secret'),false);
});
