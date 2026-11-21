// AUTH-13 browser-only display for app-scoped 420ID sessions.
// This is NOT a payment, wallet, game, moderation or API authorization.
// No provider bearer or client secret ever appears in browser code.
const ORIGINS=Object.freeze({
 '420town':'https://town.420integrated.org',
 doobtube:'https://doobtube.420integrated.org',
 '420mail':'https://420mail.420integrated.org',
 '420grow':'https://grow.420integrated.org',
 '420pay':'https://420pay.420integrated.org',
 '420exchange':'https://420exchange.420integrated.org',
 '420launchpad':'https://launchpad.420integrated.org'
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function validateAppSession(result,app){
 if(result?.authenticated===false)return {authenticated:false};
 if(!result||result.authenticated!==true||result.app!==app||
  !UUID.test(result.subject)||result.financialAuthority!==false||
  !Array.isArray(result.permissions)||result.permissions.length!==0){
  throw new Error('Untrusted or cross-application 420ID response');
 }
 return {authenticated:true,app,subject:result.subject};
}
export function createAppSessionClient({app,fetchImpl=fetch}={}){
 if(!Object.hasOwn(ORIGINS,app))throw new Error('Unknown 420ID application');
 const request=async(path,method)=>{
  const response=await fetchImpl('/420id-api/'+path,{
   method,credentials:'same-origin',redirect:'error',cache:'no-store',
   headers:{Accept:'application/json'}
  });
  if(response.status!==200||
    !String(response.headers?.get('content-type')??'').startsWith('application/json')){
   throw new Error('420ID application gateway unavailable');
  }
  return response.json();
 };
 return {
  loginPath:'/420id-api/auth/start',
  async session(){return validateAppSession(await request('auth/session','GET'),app)},
  async logout(){
   const response=await request('auth/logout','POST');
   if(response.signedOut!==true)throw new Error('420ID application logout unconfirmed');
   return true;
  },
 };
}
export function mountAppSession({root,app,enabled=false,
 fetchImpl=fetch,origin=globalThis.location?.origin,
 visibilityDocument=globalThis.document}={}){
 if(!root)throw new Error('Missing 420ID panel');
 root.hidden=true;
 if(!enabled)return {enabled:false,invalidate(){}};
 if(!Object.hasOwn(ORIGINS,app)||origin!==ORIGINS[app]){
  // No dynamic origin, app ID or host substitution in production.
  return {enabled:false,invalidate(){}};
 }
 const status=root.querySelector('[data-420id-status]');
 const login=root.querySelector('[data-420id-login]');
 const logout=root.querySelector('[data-420id-logout]');
 const refresh=root.querySelector('[data-420id-refresh]');
 if(!status||!login||!logout||!refresh)throw new Error('Incomplete account panel');
 const client=createAppSessionClient({app,fetchImpl});
 login.setAttribute('href',client.loginPath);
 root.hidden=false;
 let epoch=0,busy=false,loggingOut=false;
 const display=(message,signedIn=false)=>{
  status.textContent=message;
  login.hidden=signedIn;logout.hidden=!signedIn;
 };
 const invalidate=()=>{
  ++epoch;
  display('420ID session not verified.');
 };
 async function read(){
  if(busy||loggingOut)return;
  const ticket=++epoch;busy=true;
  display('Verifying your 420ID account…');
  try{
   const state=await client.session();
   if(ticket!==epoch)return;
   display(state.authenticated?
    'Signed in to this app with 420ID. Wallet and paid permissions are separate.':
    'Not signed in. Public browsing remains available.',state.authenticated);
  }catch{
   if(ticket===epoch)display('420ID status unavailable. No prior account is trusted.');
  }finally{busy=false}
 }
 async function signOut(){
  if(loggingOut)return;
  // Logout must still invalidate a pending status response: an old
  // identity may never return to the screen after account switching.
  loggingOut=true;invalidate();busy=true;
  try{
   await client.logout();
   display('Signed out of this app. Other application sessions are unchanged.');
  }catch{
   display('Sign-out could not be verified. Refresh your account status.');
  }finally{busy=false;loggingOut=false}
 }
 logout.addEventListener('click',()=>void signOut());
 refresh.addEventListener('click',()=>void read());
 visibilityDocument?.addEventListener?.('visibilitychange',()=>{
  if(visibilityDocument.visibilityState==='hidden')invalidate();
  else void read();
 });
 // Starting a separate application session is a top-level navigation.
 // The confidential OAuth token exchange is performed by the app server.
 void read();
 return {enabled:true,invalidate,refresh:read,signOut};
}
export function bootAppSession(root=globalThis.document?.querySelector?.('[data-420id-app]')){
 if(!root)return {enabled:false};
 return mountAppSession({root,app:root.dataset.app,enabled:root.dataset.enabled==='true'});
}
if(typeof document!=='undefined'&&document.querySelector?.('[data-420id-app]')){
 bootAppSession();
}
