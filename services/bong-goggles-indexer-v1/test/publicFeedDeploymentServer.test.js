import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
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
// Node's fetch derives Host from the URL even if supplied in Headers. Use a
// real HTTP request with an explicit Host so ingress tests exercise the intended
// trusted-edge contract rather than the default loopback Host.
function request(base, path='/v1/public-feed', options={}) {
  return new Promise((resolve,reject)=>{
    const url = new URL(base+path);
    const req = httpRequest(url, {method:options.method??'GET', headers:{host,origin,...options.headers}}, response=>{
      const chunks=[];
      response.on('data',chunk=>chunks.push(chunk));
      response.on('error',reject);
      response.on('end',()=>{
        const raw=Buffer.concat(chunks).toString('utf8');
        resolve({status:response.statusCode,headers:{get:name=>response.headers[name.toLowerCase()]??null},json:async()=>JSON.parse(raw)});
      });
    });
    req.on('error',reject);
    req.end();
  });
}

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
    // An unsupported write never exposes data, regardless of whether the
    // HTTP client adds an empty-body framing header.
    assert.ok([403,405].includes((await request(base,'/v1/public-feed',{method:'POST'})).status));
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
