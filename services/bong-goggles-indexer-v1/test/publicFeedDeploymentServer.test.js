import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPublicFeedDeploymentServer} from '../src/publicFeedDeploymentServer.js';

const host = 'social-api.internal.example';
const origin = 'https://bonggoggles.420integrated.org';
const objectId = `0x${'1'.repeat(64)}`;
const author = `0x${'a'.repeat(40)}`;
const qualification = {
  configured: true,
  async getView() {
    return {checkpoint:{chainId:420,indexedBlock:55},
      profiles:new Map([[author,{active:true}]]),
      socialObjects:new Map([[objectId,{objectId,author,objectType:'POST',status:'ACTIVE',audienceType:'PUBLIC',contentHash:`0x${'b'.repeat(64)}`,version:1}]]),
      feeds:new Map([['DISCOVER:*',[{objectId,feedClass:'DISCOVER',viewerKey:'*'}]]])};
  },
  async canShowPublicObject(){return true;},
};
async function withServer(options, check) {
  const server = createPublicFeedDeploymentServer(options);
  server.listen(0,'127.0.0.1');
  try {
    await once(server,'listening');
    const address=server.address();
    await check(`http://127.0.0.1:${address.port}`);
  } finally {await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
const request=(base, path='/v1/public-feed', options={})=>fetch(base+path,{...options,headers:{host,origin,...options.headers}});

test('BG-19.17 never enables ingress by default or with absent qualification',async()=>{
  await withServer({qualification,expectedHost:host},async base=>{
    const response=await request(base);
    assert.equal(response.status,503);
    assert.deepEqual((await response.json()).error,{code:'unavailable'});
  });
  await withServer({enabled:true,expectedHost:host},async base=>{
    assert.equal((await request(base)).status,503);
  });
  await withServer({enabled:true,qualification:{...qualification,configured:false},expectedHost:host},async base=>{
    assert.equal((await request(base)).status,503);
  });
});

test('explicitly gated ingress returns bounded read-only DTO and exact CORS origin',async()=>{
  await withServer({enabled:true,qualification,expectedHost:host},async base=>{
    const response=await request(base);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('access-control-allow-origin'),origin);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.equal(response.headers.get('referrer-policy'),'no-referrer');
    assert.equal((await response.json()).data.items[0].objectId,objectId);
    assert.equal((await request(base,'/v1/public-feed',{method:'POST'})).status,405);
  });
});

test('host spoofing, foreign origins, credentials and request bodies are rejected',async()=>{
  await withServer({enabled:true,qualification,expectedHost:host},async base=>{
    for(const headers of [{host:'evil.example'},{origin:'https://evil.example'},{authorization:'Bearer private'},{cookie:'session=private'},{'proxy-authorization':'private'},{'x-forwarded-user':'victim'},{'content-length':'1'}]){
      const result=await request(base,'/v1/public-feed',{headers});
      assert.equal(result.status,403,JSON.stringify(headers));
      assert.equal(JSON.stringify(await result.json()).includes('private'),false);
    }
  });
});

test('per-peer window throttles, resets and returns only minimal rate-limit error',async()=>{
  let clock=10_000;
  await withServer({enabled:true,qualification,expectedHost:host,maxRequestsPerWindow:1,windowMs:1_000,now:()=>clock},async base=>{
    assert.equal((await request(base)).status,200);
    const limited=await request(base);
    assert.equal(limited.status,429);
    assert.deepEqual((await limited.json()).error,{code:'rate_limited'});
    clock+=1_000;
    assert.equal((await request(base)).status,200);
  });
});

test('upstream policy failure, slow response and excessive response length fail closed',async()=>{
  await withServer({enabled:true,qualification:{...qualification,async getView(){throw Error('private details');}},expectedHost:host},async base=>{
    const result=await request(base);
    assert.equal(result.status,503);
    assert.equal(JSON.stringify(await result.json()).includes('private details'),false);
  });
  await withServer({enabled:true,qualification:{...qualification,async getView(){return new Promise(()=>{});}},expectedHost:host,requestTimeoutMs:30},async base=>{
    const result=await request(base);
    assert.equal(result.status,503);
  });
  await withServer({enabled:true,qualification,expectedHost:host,maxResponseBytes:50},async base=>{
    const result=await request(base);
    assert.equal(result.status,503);
    assert.deepEqual((await result.json()).error,{code:'unavailable'});
  });
});
