import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHttpHandler} from '../core/http.mjs';
async function withServer(fn,options,body){
  const server=http.createServer(createHttpHandler(fn,options));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const url='http'+':'+'//127.0.0.1:'+server.address().port+'/v1/launchpad/runtime';
    return await body(url);
  }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test('HTTP ingress rejects malformed, oversized, cross-origin and duplicate input',async()=>{
  let called=0;const dispatch=async()=>{called++;return {status:200,body:{ok:true}};};
  await withServer(dispatch,{allowedOrigin:'https://launchpad.example'},async url=>{
    const badOrigin=await fetch(url,{headers:{origin:'https://evil.example'}});assert.equal(badOrigin.status,403);
    const preflight=await fetch(url,{method:'OPTIONS',headers:{origin:'https://launchpad.example'}});
    assert.equal(preflight.status,204);
    const duplicate=await fetch(url+'?account=a&account=b');assert.equal(duplicate.status,400);
    const malformed=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:'{invalid'});
    assert.equal(malformed.status,400);
    const huge=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({payload:'x'.repeat(66000)})});
    assert.equal(huge.status,413);
    const forbidden=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:'{"__proto__":{"admin":true}}'});
    assert.equal(forbidden.status,400);
    const success=await fetch(url);assert.equal(success.status,200);
    assert.equal(success.headers.get('x-content-type-options'),'nosniff');
    assert.equal(called,1);
  });
});
test('HTTP caps ingress rate, hides dispatch exceptions and refuses unsafe configuration',async()=>{
  assert.throws(()=>createHttpHandler(async()=>({status:200,body:{}}),{allowedOrigin:'http'+':'+'//example.com'}),/HTTPS origin/);
  let t=0;
  await withServer(async()=>{throw Error('private database password');},{now:()=>t},async url=>{
    const first=await fetch(url);assert.equal(first.status,503);
    assert.doesNotMatch(JSON.stringify(await first.json()),/password/);
    for(let i=1;i<120;i++)await fetch(url);
    const rate=await fetch(url);assert.equal(rate.status,429);
  });
});
