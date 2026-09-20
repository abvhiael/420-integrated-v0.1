import test from 'node:test';
import assert from 'node:assert/strict';
import { routePublicFeedHttp } from '../src/publicFeedHttp.js';

const id = n => `0x${n.toString(16).padStart(64,'0')}`;
const address = `0x${'a'.repeat(40)}`;
function view() {
  const objects = [
    {objectId:id(1),author:address,objectType:'POST',status:'ACTIVE',audienceType:'PUBLIC',contentHash:id(11),version:1,secret:'never serialize'},
    {objectId:id(2),author:address,objectType:'POST',status:'ACTIVE',audienceType:'FRIENDS',contentHash:id(12),version:1},
    {objectId:id(3),author:address,objectType:'POST',status:'ACTIVE',audienceType:'PUBLIC',contentHash:id(13),version:1},
    {objectId:id(4),author:address,objectType:'POST',status:'WITHDRAWN',audienceType:'PUBLIC',contentHash:id(14),version:1},
    {objectId:id(5),author:address,objectType:'COMMENT',status:'ACTIVE',audienceType:'PUBLIC',contentHash:id(15),version:1},
  ];
  return { checkpoint:{chainId:420,indexedBlock:55}, socialObjects:new Map(objects.map(o=>[o.objectId,o])), profiles:new Map([[address,{account:address,active:true}]]), feeds:new Map([['DISCOVER:*',objects.map(o=>({objectId:o.objectId,feedClass:'DISCOVER',viewerKey:'*'}))]]) };
}
const call = (args={}) => routePublicFeedHttp({method:'GET',requestUrl:'/v1/public-feed?feedClass=DISCOVER&limit=20',getView:async()=>view(),canShowPublicObject:async({object})=>object.objectId!==id(3),...args});

test('anonymous feed returns only public active policy-authorized posts in a bounded envelope',async()=>{
 const result=await call();
 assert.equal(result.status,200);
 assert.equal(result.headers['cache-control'],'no-store');
 assert.equal(result.body.apiVersion,'bg-social-read-v1');
 assert.equal(result.body.data.snapshotBlock,55);
 assert.equal(result.body.data.authoritative,false);
 assert.deepEqual(result.body.data.items.map(o=>o.objectId),[id(1)]);
 assert.equal(result.body.data.items[0].secret,undefined);
 assert.equal(JSON.stringify(result).includes('never serialize'),false);
});

test('missing or rejecting server visibility policy and unavailable snapshot never expose data',async()=>{
 assert.equal((await call({canShowPublicObject:undefined})).status,503);
 assert.equal((await call({canShowPublicObject:async()=>false})).body.data.items.length,0);
 assert.equal((await call({canShowPublicObject:async()=>{throw new Error('private');}})).status,503);
 assert.equal((await call({getView:async()=>null})).status,503);
 assert.equal((await call({getView:async()=>({...view(),checkpoint:{chainId:420,indexedBlock:'55'}})})).status,503);
 assert.equal((await call({getView:async()=>({...view(),checkpoint:{chainId:0,indexedBlock:55}})})).status,503);
});

test('only GET, the exact public route, DISCOVER and bounded query are accepted',async()=>{
 for(const overrides of [
  {method:'POST'}, {requestUrl:'/v1/private-feed'}, {requestUrl:'/v1/public-feed?feedClass=FRIENDS'},
  {requestUrl:'/v1/public-feed?viewer=0xdead'}, {requestUrl:'/v1/public-feed?limit=0'},
  {requestUrl:'/v1/public-feed?limit=51'}, {requestUrl:'/v1/public-feed?limit=2&limit=3'},
  {requestUrl:'/v1/public-feed?feedClass=DISCOVER&feedClass=DISCOVER'},
 ]) assert.notEqual((await call(overrides)).status,200);
});

test('inactive author and absent public feed index fail closed',async()=>{
 assert.equal((await call({getView:async()=>({...view(),profiles:new Map([[address,{active:false}]])})})).body.data.items.length,0);
 assert.equal((await call({getView:async()=>({...view(),feeds:new Map()})})).status,503);
});
