import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeHttpServer} from '../src/runtime-service.js';
test('R06.4 browser origin preflight and authenticated market intent deny unauthenticated/foreign callers',async()=>{
 let touched=0;
 const runtime={
  identity:{registeredPrincipal:async()=>{touched++;return 'player';}},
  rewards:{claim:async()=>{touched++;return null;}},
  market:{list:async()=>{touched++;return null;},importAsset:async()=>{touched++;return null;}},
  settlement:{prepare:async()=>{touched++;return {status:'prepared'};}},
  worker:{tick:async()=>{touched++;return null;}}
 };
 const server=runtimeHttpServer(runtime,{origin:'https://game.example'});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  const pre=await fetch(url+'/market/prepare',{method:'OPTIONS',headers:{origin:'https://game.example',
    'access-control-request-method':'POST','access-control-request-headers':'authorization,content-type'}});
  assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),'https://game.example');
  const wrong=await fetch(url+'/market/prepare',{method:'POST',headers:{origin:'https://evil.example',
    authorization:'Bearer account','content-type':'application/json'},body:'{}'});
  assert.equal(wrong.status,403);
  assert.equal(wrong.headers.get('access-control-allow-origin'),null);
  const guest=await fetch(url+'/market/prepare',{method:'POST',headers:{origin:'https://game.example',
    'content-type':'application/json'},body:'{}'});
  assert.equal(guest.status,403);assert.equal(touched,0);
  const valid=await fetch(url+'/market/prepare',{method:'POST',headers:{origin:'https://game.example',
    authorization:'Bearer account','content-type':'application/json'},body:JSON.stringify({operation:'o',listing:'l',transferOperation:'t'})});
  assert.equal(valid.status,200);assert.equal(touched,1);
  assert.equal((await valid.json()).result.status,'prepared');
 }finally{await new Promise(ok=>server.close(ok));}
});
