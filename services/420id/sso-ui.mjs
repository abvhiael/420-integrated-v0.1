// AUTH-7: first-party, explicit SSO consent. OAuth authorization codes
// travel only to a pinned backend callback; no application bearer is ever
// delivered to JavaScript. No external scripts, identity IDs or CORS.
export function installSSOUI({get,post,run,status,isAuthenticated}){
 const clientStatus=get('sso-client'),transferStatus=get('sso-status'),approve=get('sso-approve');
 let request=null,info=null,cancelled=false;
 function params(){
  const raw=new URLSearchParams(window.location.search);
  const keys=['app','redirect_uri','state','code_challenge','code_challenge_method'];
  if([...raw.keys()].length!==keys.length||keys.some(k=>raw.getAll(k).length!==1)||raw.get('code_challenge_method')!=='S256')throw new Error('Invalid requesting application handoff.');
  const state=raw.get('state'),challenge=raw.get('code_challenge');
  if(!/^[A-Za-z0-9_-]{43}$/.test(state)||!/^[A-Za-z0-9_-]{43}$/.test(challenge))throw new Error('Invalid sign-in request.');
  return {app:raw.get('app'),redirectUri:raw.get('redirect_uri'),state,codeChallenge:challenge};
 }
 try{request=params()}catch{cancelled=true;transferStatus.textContent='Invalid sign-in request. Start again from the approved application.';}
 function visibility(){
  approve.disabled=!request||cancelled||!isAuthenticated();
  if(!request||cancelled)return;
  clientStatus.textContent=isAuthenticated()?
    info?'Requested application: '+info.name+' ('+info.app+'). You may approve or cancel.':'Verify the registered requesting application before approving.':
    'Sign in with your approved 420ID email or passkey first. No application has been authorized.';
 }
 get('sso-cancel').addEventListener('click',()=>{
  cancelled=true;request=null;info=null;visibility();
  transferStatus.textContent='Sign-in cancelled. No authorization code was issued. Return to the application and start again.';
 });
 approve.addEventListener('click',()=>void run(async()=>{
  if(cancelled||!request||!isAuthenticated())throw new Error('Sign in and restart from the requesting application.');
  // Prepare validates the exact registered app and callback. Its public name
  // comes from the server, never from untrusted URL query parameters.
  const preview=await post('/v1/sso/prepare',{...request,consentAccepted:false});
  if(preview.client.app!==request.app||preview.client.redirectUri!==request.redirectUri)throw new Error('Registered callback mismatch.');
  info=preview.client;visibility();
  const result=await post('/v1/sso/authorize',{...request,consentAccepted:true});
  const dest=new URL(result.redirectUri),expected=new URL(info.redirectUri);
  if(dest.origin!==expected.origin||dest.pathname!==expected.pathname||dest.hash||dest.searchParams.get('state')!==request.state||
     !/^[A-Za-z0-9_-]{43}$/.test(dest.searchParams.get('code')??'')||
     [...dest.searchParams.keys()].length!==2)throw new Error('Authorization callback mismatch.');
  transferStatus.textContent='Authorization approved. Returning to '+info.name+' through its registered callback.';
  window.location.assign(result.redirectUri);
 }));
 visibility();
 return {visibility};
}
