import test from 'node:test';
import assert from 'node:assert/strict';
import {create420IDPasskey,authenticate420IDPasskey} from './browser.mjs';
const options={challengeId:'test',rpId:'accounts.example.org',challenge:'A'.repeat(43),userHandle:'A'.repeat(43),userName:'test@example.org'};
const buf=Uint8Array.from([1,2,3]).buffer;
const result={type:'public-key',rawId:buf,response:{clientDataJSON:buf,attestationObject:buf,authenticatorData:buf,signature:buf,userHandle:buf}};
test('registration requires secure origin and discoverable user-verified ES256 credentials',async()=>{
 let request;
 const env={isSecureContext:true,location:{origin:'https://accounts.example.org'},navigator:{credentials:{create:async x=>(request=x,result)}}};
 const body=await create420IDPasskey(options,env);
 assert.equal(request.publicKey.authenticatorSelection.residentKey,'required');
 assert.equal(request.publicKey.authenticatorSelection.userVerification,'required');
 assert.deepEqual(request.publicKey.pubKeyCredParams,[{type:'public-key',alg:-7}]);
 assert.equal(request.publicKey.attestation,'none');assert.equal(body.credentialId,'AQID');
 await assert.rejects(create420IDPasskey(options,{...env,location:{origin:'https://evil.example.org'}}));
});
test('login is discoverable and never treats an absent assertion as success',async()=>{
 let request;
 const env={isSecureContext:true,location:{origin:'https://accounts.example.org'},navigator:{credentials:{get:async x=>(request=x,result)}}};
 const body=await authenticate420IDPasskey(options,env);
 assert.equal(request.publicKey.userVerification,'required');
 assert.equal('allowCredentials' in request.publicKey,false);
 assert.equal(body.userHandle,'AQID');
 await assert.rejects(authenticate420IDPasskey(options,{...env,navigator:{credentials:{get:async()=>null}}}));
});