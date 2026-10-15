import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalHighCountryIssuer420} from '../src/highcountry-local-issuer.js';
import {createHighCountryLocalAuthHttp420} from '../src/highcountry-local-auth-http.js';
const game='0x'+'a'.repeat(64);
test('HTTP registration, login, logout and rejected wrong-origin',async()=>{
 const issuer=createLocalHighCountryIssuer420({gameId:game,provisionAccount:async()=>{}});
 const server=createHighCountryLocalAuthHttp420({issuer,origin:'https://game.example'});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 const post=(path,body,token,origin='https://game.example')=>fetch(base+path,{method:'POST',
  headers:{origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 try{
  assert.equal((await post('/auth/register',{username:'devplayer',password:'password-for-local-tests'})).status,201);
  const resp=await post('/auth/login',{username:'devplayer',password:'password-for-local-tests'});
  assert.equal(resp.status,200);const {result}=await resp.json();assert.equal(typeof result.token,'string');
  assert.equal((await post('/auth/logout',{},result.token)).status,200);
  assert.throws(()=>issuer.verifyToken(result.token),/authentication-denied/);
  assert.equal((await post('/auth/login',{username:'devplayer',password:'password-for-local-tests'},null,'https://evil.example')).status,403);
 }finally{await new Promise(ok=>server.close(ok));}
});
