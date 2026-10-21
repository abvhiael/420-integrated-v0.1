import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import {createIdentityFlow} from './identity-flow.mjs';
import {parseExternalLink} from './hardening-policy.mjs';
WebBrowser.maybeCompleteAuthSession();
type Settings={authorizationEndpoint:string;tokenEndpoint:string;revocationEndpoint:string;clientId:string;redirectUri:string};
const random=()=>Array.from(Crypto.getRandomBytes(32),v=>v.toString(16).padStart(2,'0')).join('');
async function exchange({endpoint,grantType,code,codeVerifier,refreshToken,clientId,redirectUri}:any){
 const body=new URLSearchParams();
 if(grantType==='revoke'){body.set('token',refreshToken);body.set('token_type_hint','refresh_token');}
 else {body.set('grant_type',grantType);body.set('client_id',clientId);
 if(grantType==='authorization_code'){body.set('code',code);body.set('code_verifier',codeVerifier);body.set('redirect_uri',redirectUri);}
 else body.set('refresh_token',refreshToken);}
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetch(endpoint,{method:'POST',redirect:'error',signal:controller.signal,headers:{'content-type':'application/x-www-form-urlencoded','accept':'application/json'},body:body.toString()});
  if(!response.ok||response.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')throw Error('IDENTITY_EXCHANGE_DENIED');
  const raw=await response.text();if(raw.length>32768)throw Error('IDENTITY_EXCHANGE_OVERSIZE');
  if(grantType==='revoke')return {};
  const token=JSON.parse(raw);
  return {accessToken:token.access_token,refreshToken:token.refresh_token,expiresIn:token.expires_in,tokenType:token.token_type};
 }finally{clearTimeout(timer);}
}
export function createNativeIdentity(settings:Settings){
 const redirect=AuthSession.makeRedirectUri({scheme:'liftd-preview',path:'callback'});
 if(settings.redirectUri!==redirect)throw Error('REDIRECT_URI_MISMATCH');
 return createIdentityFlow({...settings,exchange,authorize:async ({authorizationEndpoint,clientId,redirectUri}:any)=>{
  const state=random(),verifier=random()+random();
  const challenge=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,verifier,{encoding:Crypto.CryptoEncoding.BASE64});
  const codeChallenge=challenge.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const url=new URL(authorizationEndpoint);
  for(const [k,v] of Object.entries({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:'openid offline_access',state,code_challenge_method:'S256',code_challenge:codeChallenge}))url.searchParams.set(k,v);
  const result=await WebBrowser.openAuthSessionAsync(url.toString(),redirectUri);
  if(result.type!=='success'||!result.url.startsWith(redirectUri+'?'))throw Error('AUTHORIZATION_DENIED');
  if(!parseExternalLink(result.url))throw Error('AUTHORIZATION_DENIED');
  const callback=new URL(result.url);
  if(callback.searchParams.has('error')||callback.searchParams.getAll('state').length!==1||callback.searchParams.getAll('code').length!==1)throw Error('AUTHORIZATION_DENIED');
  return {state:callback.searchParams.get('state'),expectedState:state,code:callback.searchParams.get('code'),codeVerifier:verifier};
 }});
}
