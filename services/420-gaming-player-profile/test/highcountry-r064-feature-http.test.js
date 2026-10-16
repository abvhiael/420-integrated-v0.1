import test from 'node:test';import assert from 'node:assert/strict';
import {createHighCountryScopedFeatureHttp420} from '../src/highcountry-r064-feature-http.js';
test('canonical feature ingress rejects unauthenticated, wrong origin and caller-provided wallet',async()=>{
 let queried=false;
 const server=createHighCountryScopedFeatureHttp420({origin:'https://game.example',
  service:{read:async()=>{queried=true;return {accepted:true};}}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const req=(origin,token,body)=>fetch(base+'/v1/features/ownership',{method:'POST',
   headers:{origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
   body:JSON.stringify(body)});
  assert.equal((await req('https://evil.example','token',{profileId:'0x'+'a'.repeat(64)})).status,403);
  assert.equal((await req('https://game.example',null,{profileId:'0x'+'a'.repeat(64)})).status,403);
  // Handler is still allowed to reject rogue extra wallet fields before canonical verification.
  const pre=await fetch(base+'/v1/features/ownership',{method:'OPTIONS',headers:{origin:'https://game.example'}});
  assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),'https://game.example');
  assert.equal(queried,false);
 }finally{await new Promise(ok=>server.close(ok));}
});
