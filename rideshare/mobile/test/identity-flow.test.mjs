import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdentityFlow} from '../src/identity-flow.mjs';
function factory(overrides={}) {
 const exchanges=[];
 const cfg={authorizationEndpoint:'https://identity.example/authorize',tokenEndpoint:'https://identity.example/token',revocationEndpoint:'https://identity.example/revoke',clientId:'liftd-preview',redirectUri:'liftd-preview://callback',clock:()=>1000,authorize:async()=>({code:'valid-code',codeVerifier:'pkce-verifier',state:'state1',expectedState:'state1'}),exchange:async input=>{exchanges.push(input);return {accessToken:'long-access-token',refreshToken:'long-refresh-token',expiresIn:60,tokenType:'Bearer'};},...overrides};
 return {flow:createIdentityFlow(cfg),exchanges};
}
test('PKCE state-bound authorization and constrained token response',async()=>{
 const {flow,exchanges}=factory();const t=await flow.signIn();
 assert.equal(t.expiresAt,1060);assert.equal(exchanges[0].codeVerifier,'pkce-verifier');assert.equal(exchanges[0].grantType,'authorization_code');
});
test('state mismatch is denied before any exchange',async()=>{
 const {flow,exchanges}=factory({authorize:async()=>({code:'valid-code',codeVerifier:'pkce-verifier',state:'evil',expectedState:'good'})});
 await assert.rejects(flow.signIn(),{code:'AUTHORIZATION_DENIED'});assert.equal(exchanges.length,0);
});
test('refresh and revoke require explicit trusted endpoints',async()=>{
 const {flow,exchanges}=factory();const ref=await flow.refresh({refreshToken:'long-refresh-token'});
 assert.equal(ref.accessToken,'long-access-token');
 await flow.revoke({refreshToken:'long-refresh-token'});
 assert.deepEqual(exchanges.map(x=>x.grantType),['refresh_token','revoke']);
});
test('forged endpoint, token response and short expiry denied',async()=>{
 assert.throws(()=>factory({tokenEndpoint:'http://identity.example/token'}),{code:'CONFIGURATION_INVALID'});
 const {flow}=factory({exchange:async()=>({accessToken:'fake',refreshToken:'fake',expiresIn:90000,tokenType:'Bearer'})});
 await assert.rejects(flow.signIn(),{code:'TOKEN_RESPONSE_INVALID'});
});
