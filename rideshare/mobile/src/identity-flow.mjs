// Provider-neutral OAuth 2.0 code+PKCE exchange. The caller is a native system-browser adapter.
// Tokens never create an authenticated LIFTd role without separate session authority verification.
export class IdentityFlowError extends Error {constructor(code){super(code);this.code=code;this.name='IdentityFlowError';}}
function deny(code){throw new IdentityFlowError(code);}
const valid=(v)=>typeof v==='string'&&v.length>0&&!/[\r\n]/.test(v);
function https(endpoint){
 let u;try{u=new URL(endpoint);}catch{deny('CONFIGURATION_INVALID');}
 if(u.protocol!=='https:'||!u.hostname||u.username||u.password||u.search||u.hash)deny('CONFIGURATION_INVALID');
 return u.href;
}
export function createIdentityFlow({authorizationEndpoint,tokenEndpoint,revocationEndpoint,clientId,redirectUri,authorize,exchange,clock=()=>Math.floor(Date.now()/1000)}){
 const auth=https(authorizationEndpoint),token=https(tokenEndpoint),revoke=https(revocationEndpoint);
 if(!valid(clientId)||!valid(redirectUri)||typeof authorize!=='function'||typeof exchange!=='function')deny('CONFIGURATION_INVALID');
 function verifyToken(result){
  if(!result||typeof result!=='object'||typeof result.accessToken!=='string'||result.accessToken.length<10||result.accessToken.length>32768||typeof result.refreshToken!=='string'||result.refreshToken.length<10||result.refreshToken.length>32768||!Number.isSafeInteger(result.expiresIn)||result.expiresIn<1||result.expiresIn>3600||result.tokenType!=='Bearer')deny('TOKEN_RESPONSE_INVALID');
  return Object.freeze({accessToken:result.accessToken,refreshToken:result.refreshToken,expiresAt:clock()+result.expiresIn});
 }
 return Object.freeze({
  async signIn(){
   // authorize must use the OS browser with code challenge S256, redirect state and nonce binding.
   const result=await authorize({authorizationEndpoint:auth,clientId,redirectUri,codeChallengeMethod:'S256',responseType:'code'});
   if(!result||!valid(result.code)||!valid(result.codeVerifier)||!valid(result.state)||result.state!==result.expectedState)deny('AUTHORIZATION_DENIED');
   const credentials=await exchange({endpoint:token,grantType:'authorization_code',code:result.code,codeVerifier:result.codeVerifier,clientId,redirectUri});
   return verifyToken(credentials);
  },
  async refresh(credential){
   if(!credential||!valid(credential.refreshToken))deny('SESSION_EXPIRED');
   return verifyToken(await exchange({endpoint:token,grantType:'refresh_token',refreshToken:credential.refreshToken,clientId}));
  },
  async revoke(credential){
   if(credential?.refreshToken)await exchange({endpoint:revoke,grantType:'revoke',refreshToken:credential.refreshToken,clientId});
  }
 });
}
