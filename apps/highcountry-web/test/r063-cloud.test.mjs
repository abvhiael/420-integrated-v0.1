import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudClient} from '../src/cloud.js';
const id='0x'+'a'.repeat(64);
test('guest not authenticated implicitly; fail closed',async()=>{
 const c=createCloudClient({apiUrl:'https://api.example',gameId:id,authenticate:async()=>null,fetchImpl:async()=>{throw Error('must not fetch');}});
 await assert.rejects(c.session(),/authentication-required/);
 assert.throws(()=>createCloudClient({apiUrl:'http://localhost',gameId:id,authenticate:()=>''}),/cloud-config-invalid/);
});
test('exact game and revision conflict enforced without replacing local save',async()=>{
 let count=0;
 const c=createCloudClient({apiUrl:'https://api.example',gameId:id,authenticate:async()=> 'validtoken',fetchImpl:async(_url,opts)=>{
  assert.equal(opts.credentials,'omit');assert.match(opts.headers.Authorization,/^Bearer /);
  count++;return {ok:false,status:409};
 }});
 await assert.rejects(c.publish({expectedRevision:'2',consentId:'consent1',schemaLabel:'highcountry-guest-v1',save:{schema:1}}),/cloud-save-conflict/);
 assert.equal(count,1);
});
test('cloud responses require correct game scope; never trust cross-game save',async()=>{
 const c=createCloudClient({apiUrl:'https://api.example',gameId:id,authenticate:async()=> 'validtoken',fetchImpl:async()=>({ok:true,json:async()=>({gameId:'0x'+'b'.repeat(64),revision:'1'})})});
 await assert.rejects(c.read(),/cloud-scope-invalid/);
});
