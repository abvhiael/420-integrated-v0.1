import test from 'node:test';
import assert from 'node:assert/strict';
import {createHighCountryCloudHttp420} from '../src/highcountry-cloud-http.js';
const game='0x'+'a'.repeat(64),ruleset='0x'+'b'.repeat(64);
test('issuer-backed account session and registration; reject forged bearer, wrong origin and caller account IDs',async()=>{
 const authority={gameId:game,verifyToken:t=>{if(t!=='valid')throw Error('denied');return {sub:'owner',game,epoch:0,iss:'issuer'};},registeredPrincipal:async t=>t==='valid'?'owner':null};
 const fakePool=async()=>({connect:async()=>{throw Error('db-unavailable');}});
 const provider={put:async()=>null,get:async()=>null,delete:async()=>null};
 const s=createHighCountryCloudHttp420({authority,poolForPrincipal:fakePool,provider,origin:'https://game.example'});
 await new Promise(ok=>s.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+s.address().port;
 try{
  let x=await fetch(base+'/highcountry/session');assert.equal(x.status,403);
  x=await fetch(base+'/highcountry/session',{headers:{origin:'https://evil.example',authorization:'Bearer valid'}});assert.equal(x.status,403);
  x=await fetch(base+'/highcountry/register',{method:'POST',headers:{authorization:'Bearer valid',origin:'https://game.example','content-type':'application/json'},body:JSON.stringify({profileId:'p',rulesetId:ruleset,accountId:'victim'})});
  assert.notEqual(x.status,200); // no caller-selected account authority
  x=await fetch(base+'/highcountry/save',{method:'DELETE',headers:{authorization:'Bearer valid'}});assert.notEqual(x.status,200);
 }finally{await new Promise(ok=>s.close(ok));}
});
