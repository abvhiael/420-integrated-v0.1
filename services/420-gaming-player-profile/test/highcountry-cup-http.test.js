import test from 'node:test';
import assert from 'node:assert/strict';
import {createHighCountryCloudHttp420} from '../src/highcountry-cloud-http.js';
const game='0x'+'a'.repeat(64),cupId='0x'+'b'.repeat(64);
test('Global Cup HTTP verifies issuer scope, origin and field whitelist before canonical read',async()=>{
 const calls=[];
 const authority={gameId:game,
  verifyToken:t=>{if(t!=='valid')throw Error('unauthorized');return {sub:'alice',game,epoch:0,iss:'issuer-test'};},
  registeredPrincipal:async t=>t==='valid'?'alice':null};
 const server=createHighCountryCloudHttp420({
  authority,poolForPrincipal:async()=>({connect:async()=>{throw Error('unexpected db');}}),
  provider:{put:async()=>{},get:async()=>{},delete:async()=>{}},
  globalCup:{standings:async value=>{calls.push(value);return {cupId:value.cupId,champion:'0x'+'c'.repeat(40)};}},
  origin:'https://game.example'});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const url='http://127.0.0.1:'+server.address().port+'/highcountry/cup/standings';
 try{
  const request=(body,token='valid',origin='https://game.example')=>fetch(url,{
   method:'POST',headers:{authorization:'Bearer '+token,origin,'content-type':'application/json'},
   body:JSON.stringify(body)});
  assert.notEqual((await request({cupId,winner:'0x'+'d'.repeat(40)})).status,200);
  assert.notEqual((await request({cupId,accountId:'bob'})).status,200);
  assert.notEqual((await request({cupId},'invalid')).status,200);
  assert.equal((await request({cupId},'valid','https://evil.example')).status,403);
  const accepted=await request({cupId});assert.equal(accepted.status,200);
  assert.deepEqual(calls,[{cupId}]);
 }finally{await new Promise(ok=>server.close(ok));}
});
