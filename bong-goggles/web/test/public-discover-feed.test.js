import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRuntimeConfig} from '../core/runtime-config.js';
import {validatePublicDiscoverResponse,createPublicDiscoverFeedReader} from '../core/public-discover-feed.js';
const id=`0x${'1'.repeat(64)}`,author=`0x${'a'.repeat(40)}`,hash=`0x${'b'.repeat(64)}`;
const item={objectId:id,author,objectType:'POST',status:'ACTIVE',audienceType:'PUBLIC',contentHash:hash,version:1};
const payload={apiVersion:'bg-social-read-v1',data:{feedClass:'DISCOVER',items:[item],snapshotBlock:55,hasMore:false,authoritative:false}};
const config={environment:'staging',appOrigin:'https://bonggoggles.420integrated.org',chainId:420,
 rpcUrl:'https://rpc.example',indexerUrl:'https://indexer.example',mediaUrl:'https://media.example',
 messengerUrl:'https://messenger.example',notificationsUrl:'https://notifications.example',walletUrl:'https://wallet.example',explorerUrl:'https://explorer.example',
 socialApiUrl:'https://social-api.example',features:{publicDiscoverFeed:true}};
const reply=(body=payload,status=200,type='application/json')=>({ok:status===200,status,headers:{get:key=>key==='content-type'?type:null},json:async()=>body});

test('BG-19.18 disabled unless explicitly enabled and given independent safe social API origin',async()=>{
  const off=validateRuntimeConfig({...config,features:{}});
  let called=false;
  const reader=createPublicDiscoverFeedReader({config:off,fetchImpl:async()=>{called=true;return reply();}});
  assert.equal(reader.enabled,false);assert.equal((await reader.read()).status,'unavailable');assert.equal(called,false);
  assert.throws(()=>validateRuntimeConfig({...config,socialApiUrl:null}),/qualified socialApiUrl/);
  for(const url of ['http://remote.example','https://user:password@social.example','https://social.example/path','https://social.example/?x=1',config.appOrigin,config.indexerUrl])
    assert.throws(()=>validateRuntimeConfig({...config,environment:'production',socialApiUrl:url}));
});

test('BG-19.18 explicitly enabled browser GET omits credentials and reads only public DISCOVER projection',async()=>{
  let request;
  const reader=createPublicDiscoverFeedReader({config:validateRuntimeConfig(config),fetchImpl:async(url,options)=>{request={url,options};return reply();}});
  const result=await reader.read();
  assert.equal(result.status,'ready');assert.equal(result.data.items[0].objectId,id);
  assert.equal(result.data.authoritative,false);assert.equal(result.data.canonical,false);
  assert.equal(request.url,'https://social-api.example/v1/public-feed?feedClass=DISCOVER&limit=20');
  assert.equal(request.options.method,'GET');assert.equal(request.options.credentials,'omit');
  assert.equal(request.options.cache,'no-store');assert.equal(request.options.referrerPolicy,'no-referrer');
  assert.equal(request.options.headers.accept,'application/json');
  assert.equal('authorization' in request.options.headers,false);
});

test('BG-19.18 rejects nonpublic, unexpected or expanded server DTOs without showing content',async()=>{
  const invalid=[
    {...payload,apiVersion:'wrong'},
    {...payload,data:{...payload.data,feedClass:'FRIENDS'}},
    {...payload,data:{...payload.data,authoritative:true}},
    {...payload,data:{...payload.data,hasMore:true}},
    {...payload,data:{...payload.data,snapshotBlock:-1}},
    {...payload,data:{...payload.data,items:[item,item]}},
    {...payload,data:{...payload.data,items:[{...item,audienceType:'FRIENDS'}]}},
    {...payload,data:{...payload.data,items:[{...item,secret:'private'}]}},
    {...payload,data:{...payload.data,items:[{...item,objectType:'COMMENT'}]}},
    {...payload,data:{...payload.data,items:[{...item,status:'DELETED'}]}},
    {...payload,data:{...payload.data,items:[{...item,contentHash:'not-a-hash'}]}},
    {...payload,data:{...payload.data,viewer:'private'}},
  ];
  for(const invalidPayload of invalid){
    assert.throws(()=>validatePublicDiscoverResponse(invalidPayload));
    const reader=createPublicDiscoverFeedReader({config:validateRuntimeConfig(config),fetchImpl:async()=>reply(invalidPayload)});
    assert.deepEqual(await reader.read(),{status:'unavailable',data:null});
  }
});

test('BG-19.18 errors, non-JSON and policy withdrawal never reuse a previously visible page',async()=>{
  let next=reply();
  const reader=createPublicDiscoverFeedReader({config:validateRuntimeConfig(config),fetchImpl:async()=>next});
  assert.equal((await reader.read()).status,'ready');
  next=reply({apiVersion:'bg-social-read-v1',data:{...payload.data,items:[]}});
  assert.deepEqual((await reader.read()).data.items,[]);
  next=reply({},503);
  assert.deepEqual(await reader.read(),{status:'unavailable',data:null});
  next=reply(payload,200,'text/plain');
  assert.deepEqual(await reader.read(),{status:'unavailable',data:null});
});

test('BG-19.18 invalidated and superseded requests cannot resurrect stale public content',async()=>{
  const pending=[];
  const reader=createPublicDiscoverFeedReader({config:validateRuntimeConfig(config),fetchImpl:async()=>new Promise(resolve=>pending.push(resolve))});
  const first=reader.read();const second=reader.read();
  pending[1](reply({apiVersion:'bg-social-read-v1',data:{...payload.data,items:[]}}));
  assert.deepEqual((await second).data.items,[]);
  pending[0](reply());assert.equal((await first).status,'stale');
  const third=reader.read();reader.invalidate();pending[2](reply());
  assert.equal((await third).status,'stale');
});
