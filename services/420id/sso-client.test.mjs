import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createSSOAuthorization,exchangeSSOCode,introspectSSOSession,revokeSSOSession} from './sso-client.mjs';
const authority='https://auth.420integrated.org/';
const redirectUri='https://doobtube.420integrated.org/auth/420id/callback';
const app='doobtube';
const secret='A'.repeat(43);
const code='B'.repeat(43);
const token='C'.repeat(43);
test('PKCE state generated with WebCrypto, exact registered callback, S256',async()=>{
 const x=await createSSOAuthorization({authority,app,redirectUri},webcrypto);
 const url=new URL(x.authorizationUrl);
 assert.equal(url.origin,'https://auth.420integrated.org');
 assert.equal(url.pathname,'/sso/authorize');
 assert.equal(url.searchParams.get('redirect_uri'),redirectUri);
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.match(x.state,/^[A-Za-z0-9_-]{43}$/);
 assert.match(x.codeVerifier,/^[A-Za-z0-9_-]{43}$/);
 assert.notEqual(x.state,x.codeVerifier);
 assert.notEqual(url.searchParams.get('code_challenge'),x.codeVerifier);
 assert.equal(url.searchParams.get('state'),x.state);
 await assert.rejects(createSSOAuthorization({authority:'http://auth.420integrated.org/',app,redirectUri},webcrypto));
 await assert.rejects(createSSOAuthorization({authority,app,redirectUri:'https://evil.org/callback'},webcrypto));
});
test('backend token exchange fails closed before fetch on callback CSRF, substitution and replay shape',async()=>{
 let seen=[];
 const fetchImpl=async(url,options)=>{
  seen.push({url,options});
  return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({
   accessToken:token,tokenType:'Bearer',session:{method:'sso',subject:{app,sub:'app-specific-subject'}}
  })};
 };
 const request={authority,app,secret,redirectUri,codeVerifier:'D'.repeat(43),expectedState:'E'.repeat(43),fetchImpl};
 const callbackUrl=redirectUri+'?code='+code+'&state='+request.expectedState;
 for(const value of [
  redirectUri+'?code='+code+'&state='+'F'.repeat(43),
  'https://evil.org/callback?code='+code+'&state='+request.expectedState,
  callbackUrl+'&extra=1',callbackUrl+'&state='+request.expectedState,
  redirectUri+'?code=bad&state='+request.expectedState,
  redirectUri+'?error=access_denied&state='+request.expectedState
 ])await assert.rejects(exchangeSSOCode({...request,callbackUrl:value}));
 assert.equal(seen.length,0);
 const result=await exchangeSSOCode({...request,callbackUrl});
 assert.equal(result.accessToken,token);
 assert.equal(seen.length,1);
 assert.equal(seen[0].url,'https://auth.420integrated.org/v1/sso/token');
 assert.equal(seen[0].options.redirect,'error');
 assert.equal(seen[0].options.credentials,'omit');
 assert.equal(seen[0].options.cache,'no-store');
 assert.equal(JSON.parse(seen[0].options.body).redirectUri,redirectUri);
 assert.ok(!seen[0].url.includes(code));
 assert.ok(!seen[0].url.includes(token));
 assert.ok(!seen[0].options.body.includes(token));
 assert.ok(seen[0].options.headers.Authorization.startsWith('Basic '));
});
test('app-specific introspection, inactive and revocation remain confidential',async()=>{
 const calls=[];
 const good=async(url,opt)=>{
  calls.push({url,opt});
  if(url.endsWith('/revoke'))return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({revoked:true})};
  return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({active:true,subject:{app,sub:'opaque'},method:'sso'})};
 };
 const args={authority,app,secret,accessToken:token,fetchImpl:good};
 const result=await introspectSSOSession(args);
 assert.equal(result.subject.app,app);
 assert.equal(await revokeSSOSession(args),true);
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>!x.url.includes(token)&&!x.url.includes(secret)));
 assert.deepEqual(await introspectSSOSession({...args,accessToken:'bad'}),{active:false});
 await assert.rejects(introspectSSOSession({...args,app:'420pay'}));
 await assert.rejects(introspectSSOSession({...args,fetchImpl:async()=>({
  ok:true,headers:{get:()=> 'application/json'},json:async()=>({active:true,subject:{app:'foreign',sub:'opaque'},method:'sso'})
 })}));
});
