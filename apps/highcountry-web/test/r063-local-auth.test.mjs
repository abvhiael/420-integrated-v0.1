import test from 'node:test';
import assert from 'node:assert/strict';
import {createHighCountryLocalAuthClient} from '../src/local-auth.js';
test('browser local auth does not persist credentials and clears token on logout/failure',async()=>{
 const sent=[];
 const client=createHighCountryLocalAuthClient({baseUrl:'http://127.0.0.1:9999',fetchImpl:async(u,o)=>{
  sent.push({url:String(u),headers:o.headers,body:JSON.parse(o.body)});
  if(String(u).endsWith('/auth/login'))return {ok:true,json:async()=>({result:{token:'short-lived',expiresAt:10000}})};
  return {ok:true,json:async()=>({result:{loggedOut:true}})};
 }});
 assert.equal(await client.getToken(),null);
 await client.register({username:'person',password:'private password'});
 await client.login({username:'person',password:'private password'});
 assert.equal(await client.getToken(),'short-lived');
 await client.logout();
 assert.equal(await client.getToken(),null);
 assert.equal(sent[2].headers.authorization,'Bearer short-lived');
 assert.throws(()=>createHighCountryLocalAuthClient({baseUrl:'http://evil.example'}),/local-auth-url-invalid/);
});
