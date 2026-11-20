// AUTH-7 reusable approved-application adapter. Initiation and callback
// validation belong to the app backend; the client secret and exchanged
// bearer must never be bundled in the public site's JavaScript.
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const isToken=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s);
function endpoint(origin,path){
 if(typeof origin!=='string')throw new Error('Invalid SSO authority');
 const u=new URL(origin);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.port||
    u.origin+'/'!==origin)throw new Error('Unsafe SSO authority');
 return new URL(path,u);
}
function callback(redirectUri){
 const u=new URL(redirectUri);
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||!u.pathname||!u.hostname.endsWith('.420integrated.org'))throw new Error('Unsafe callback');
 return u;
}
export async function createSSOAuthorization({authority,app,redirectUri},crypto=globalThis.crypto){
 const auth=endpoint(authority,'/sso/authorize'),cb=callback(redirectUri);
 if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(app)||!crypto?.getRandomValues||!crypto?.subtle)throw new Error('Invalid SSO parameters');
 const state=encode(crypto.getRandomValues(new Uint8Array(32)));
 const codeVerifier=encode(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(codeVerifier))));
 auth.searchParams.set('app',app);
 auth.searchParams.set('redirect_uri',cb.toString());
 auth.searchParams.set('state',state);
 auth.searchParams.set('code_challenge',challenge);
 auth.searchParams.set('code_challenge_method','S256');
 // Persist state and codeVerifier in an app-owned server-side or authenticated
 // HttpOnly state store with a 5-minute TTL; never localStorage or a public URL.
 return {authorizationUrl:auth.toString(),state,codeVerifier};
}
async function confidentialRequest({authority,app,secret,path,body,fetchImpl}){
 const url=endpoint(authority,path);
 if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(app)||!isToken(secret))throw new Error('Invalid confidential client');
 const credentials=btoa(app+':'+secret);
 const res=await fetchImpl(url.toString(),{
  method:'POST',redirect:'error',credentials:'omit',cache:'no-store',
  headers:{'Authorization':'Basic '+credentials,'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify(body)
 });
 if(!res.ok||!String(res.headers?.get?.('content-type')??'').includes('application/json'))throw new Error('420ID confidential operation denied');
 return res.json();
}
export async function exchangeSSOCode({authority,app,secret,redirectUri,callbackUrl,expectedState,codeVerifier,fetchImpl=fetch}){
 const expected=callback(redirectUri),incoming=new URL(callbackUrl);
 if(incoming.origin!==expected.origin||incoming.pathname!==expected.pathname||incoming.hash||incoming.searchParams.has('error')||
    [...incoming.searchParams.keys()].length!==2||
    incoming.searchParams.getAll('state').length!==1||incoming.searchParams.getAll('code').length!==1||
    !isToken(expectedState)||incoming.searchParams.get('state')!==expectedState||
    !isToken(incoming.searchParams.get('code'))||
    typeof codeVerifier!=='string'||!/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier))throw new Error('Invalid or mismatched SSO callback');
 const result=await confidentialRequest({authority,app,secret,path:'/v1/sso/token',fetchImpl,
  body:{code:incoming.searchParams.get('code'),codeVerifier,redirectUri:expected.toString()}});
 if(!isToken(result.accessToken)||result.tokenType!=='Bearer'||result.session?.subject?.app!==app||
    typeof result.session?.subject?.sub!=='string'||!result.session.subject.sub||
    result.session.method!=='sso')throw new Error('Invalid scoped SSO grant');
 // Store accessToken only in the approved application's backend session
 // store. Set a separate Secure, HttpOnly, SameSite cookie on the app host.
 return result;
}
export async function introspectSSOSession({authority,app,secret,accessToken,fetchImpl=fetch}){
 if(!isToken(accessToken))return {active:false};
 const result=await confidentialRequest({authority,app,secret,path:'/v1/sso/introspect',fetchImpl,body:{token:accessToken}});
 if(result.active===false)return {active:false};
 if(result.active!==true||result.subject?.app!==app||!result.subject?.sub||result.method!=='sso')throw new Error('Invalid app-scoped introspection');
 return result;
}
export async function revokeSSOSession({authority,app,secret,accessToken,fetchImpl=fetch}){
 if(!isToken(accessToken))throw new Error('Invalid bearer');
 const result=await confidentialRequest({authority,app,secret,path:'/v1/sso/revoke',fetchImpl,body:{token:accessToken}});
 if(result.revoked!==true)throw new Error('SSO revocation not confirmed');
 return true;
}
