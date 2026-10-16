import test from 'node:test';import assert from 'node:assert/strict';
import {createHighCountryWalletHttp420} from '../src/wallet-link-service.js';
test('R06.4 wallet endpoint strict browser preflight, invalid origin and authenticated scope',async()=>{
 const server=createHighCountryWalletHttp420({session:async()=>({gameId:'0x'+'a'.repeat(64),wallet:null})},{origin:'https://game.example'});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  const preflight=await fetch(url+'/v1/session',{method:'OPTIONS',headers:{origin:'https://game.example','access-control-request-method':'GET','access-control-request-headers':'authorization'}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://game.example');
  const wrong=await fetch(url+'/v1/session',{headers:{origin:'https://attacker.example',authorization:'Bearer valid'}});
  assert.equal(wrong.status,403);assert.equal(wrong.headers.get('access-control-allow-origin'),null);
  const missing=await fetch(url+'/v1/session',{headers:{origin:'https://game.example'}});
  assert.equal(missing.status,403);
  const valid=await fetch(url+'/v1/session',{headers:{origin:'https://game.example',authorization:'Bearer valid'}});
  assert.equal(valid.status,200);
 }finally{await new Promise(ok=>server.close(ok));}
});
