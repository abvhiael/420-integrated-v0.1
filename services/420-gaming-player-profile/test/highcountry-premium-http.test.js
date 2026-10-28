import test from 'node:test';
import assert from 'node:assert/strict';
import {createHighCountryCloudHttp420} from '../src/highcountry-cloud-http.js';
const game='0x'+'a'.repeat(64),scope='0x'+'b'.repeat(64);
test('premium HTTP requires live issuer and never accepts caller wallet/account or bypasses bridge',async()=>{
 const calls=[];
 const authority={gameId:game,verifyToken:async t=>{if(t!=='valid')throw Error('invalid');return {sub:'alice',game};},
  registeredPrincipal:async t=>t==='valid'?'alice':null};
 const server=createHighCountryCloudHttp420({authority,
  poolForPrincipal:async()=>({connect:async()=>{throw Error('unexpected database');}}),
  provider:{put:async()=>{},get:async()=>{},delete:async()=>{}},
  premiumAuthorization:{eligible:async x=>{calls.push(x);return {eligible:true};}},
  origin:'https://game.example'});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try {
  const url='http://127.0.0.1:'+server.address().port+'/highcountry/premium/eligibility';
  async function request(body,token='valid',origin='https://game.example'){
   return fetch(url,{method:'POST',headers:{authorization:'Bearer '+token,
    origin,'content-type':'application/json'},body:JSON.stringify(body)});
  }
  assert.notEqual((await request({scopeId:scope,wallet:'0x'+'c'.repeat(40)})).status,200);
  assert.notEqual((await request({scopeId:scope,accountId:'bob'})).status,200);
  assert.equal((await request({scopeId:scope},'invalid')).status===200,false);
  assert.equal((await request({scopeId:scope},'valid','https://evil.example')).status,403);
  const accepted=await request({scopeId:scope});
  assert.equal(accepted.status,200);
  assert.deepEqual(calls,[{token:'valid',scopeId:scope}]);
 }finally{await new Promise(ok=>server.close(ok));}
});
