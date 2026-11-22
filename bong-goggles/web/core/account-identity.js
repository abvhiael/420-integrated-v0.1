// BC-0.4: wallet-independent 420ID identity, using the existing BongGoggles
// same-origin, HttpOnly session. Not an OAuth client, token cache or game authority.
import {createAccountSocialClient,isSubjectID} from './account-social.js';
import {escapeHtml} from './design-system.js';

const DEFAULT_RETRIES=Object.freeze([2000,4000,8000,12000,12000,12000]);
function scheduleRetry(fn,ms){const timer=setTimeout(fn,ms);timer?.unref?.();}
export function normalizeAccountIdentity(dto){
 if(dto?.walletRequired!==false||!isSubjectID(dto?.profile?.subject)||
   typeof dto.profile.displayName!=='string'||dto.profile.displayName.length>80||
   !dto.profile.displayName.trim()||/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(dto.profile.displayName))return null;
 return Object.freeze({subject:dto.profile.subject,displayName:dto.profile.displayName});
}
export function verifiedAccount(state){
 if(state?.status!=='ready')return null;
 return normalizeAccountIdentity({walletRequired:false,profile:state.profile});
}
export class AccountIdentityController{
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{},wakeRetryDelays=DEFAULT_RETRIES,scheduleWakeRetry=scheduleRetry}={}){
  this.client=createAccountSocialClient({enabled,fetchImpl});
  this.onChange=onChange;
  this.state={status:enabled?'loading':'disabled'};
  this.generation=0;
  this.signOutInProgress=false;
  this.wakeAttempts=0;
  this.wakeRetryDelays=wakeRetryDelays;
  this.scheduleWakeRetry=scheduleWakeRetry;
 }
 emit(state){this.state={...state};this.onChange(this.state);return this.state;}
 invalidate(){if(!this.signOutInProgress)this.generation++;this.wakeAttempts=0;this.emit({status:this.client.enabled?'loading':'disabled'});}
 temporary(gen){
  const ms=this.wakeRetryDelays[this.wakeAttempts];
  if(Number.isSafeInteger(ms)&&ms>=0){
   this.wakeAttempts++;
   this.scheduleWakeRetry(()=>{
    if(gen===this.generation&&this.state.status==='error')void this.refresh({waking:true});
   },ms);
  }
  return this.emit({status:'error',temporary:true});
 }
 async refresh({waking=false,quiet=false}={}){
  if(!this.client.enabled)return this.emit({status:'disabled'});
  if(this.signOutInProgress)return this.state;
  if(!waking)this.wakeAttempts=0;
  const gen=++this.generation;
  const prior=this.state;
  if(!quiet||prior.status!=='ready')this.emit({status:'loading'});
  try{
   const response=await this.client.request('/v1/me');
   if(gen!==this.generation)return this.state;
   if(response.status===401){this.wakeAttempts=0;return this.emit({status:'guest'});}
   if([502,503,504].includes(response.status))return this.temporary(gen);
   const profile=response.status===200?normalizeAccountIdentity(response.data):null;
   if(!profile)throw Error('Unverified 420ID profile');
   this.wakeAttempts=0;
   if(quiet&&prior.status==='ready'&&prior.profile?.subject===profile.subject&&
      prior.profile?.displayName===profile.displayName)return this.state;
   return this.emit({status:'ready',profile});
  }catch(error){
   if(gen!==this.generation)return this.state;
   if(error instanceof TypeError)return this.temporary(gen);
   return this.emit({status:'error'});
  }
 }
 async logout(){
  if(this.signOutInProgress||!this.client.enabled||this.state.status!=='ready'||!verifiedAccount(this.state))
   throw Error('Verified 420ID session required to sign out');
  const gen=++this.generation;
  this.signOutInProgress=true;
  this.wakeAttempts=0;
  this.emit({status:'loading'});
  try{
   // One intentional POST only. Never retry a mutation or cache its cookie.
   const response=await this.client.request('/auth/logout',{method:'POST',body:{}});
   if(gen!==this.generation)return this.state;
   if(response.status===401||response.status===200&&response.data?.signedOut===true)
    return this.emit({status:'guest'});
   throw Error('420ID logout not confirmed');
  }catch{
   if(gen===this.generation)this.emit({status:'error'});
   throw Error('420ID logout not confirmed');
  }finally{this.signOutInProgress=false;}
 }
}
export function renderAccountHeader(state,{enabled=false}={}){
 if(!enabled)return '';
 const profile=verifiedAccount(state);
 if(profile)return '<a class="account-auth-link account-auth-link--account" href="/social" data-route="social" aria-label="Open your 420ID account"><span aria-hidden="true" class="account-auth-link__icon">●</span><span>My account: '+escapeHtml(profile.displayName)+'</span></a>'+
  '<button type="button" class="account-logout" data-account-action="logout" aria-label="Sign out of 420ID">Sign Out</button>';
 if(state?.status==='loading')return '<span class="account-auth-pending" role="status">Checking 420ID sign-in…</span>';
 return '<a class="account-auth-link account-auth-link--login" href="/social-api/auth/start" aria-label="Sign In with 420ID"><span aria-hidden="true" class="account-auth-link__icon">↪</span><span><strong>Sign In</strong> · Log in with 420ID</span></a>'+
  (state?.status==='error'?'<button type="button" class="account-auth-retry" data-account-action="retry">Retry 420ID check</button>':'');
}
export function renderGameAccountPanel(state,{enabled=false}={}){
 const heading='<section class="games-account" aria-label="420ID game account"><h3>420ID game account</h3>';
 if(!enabled)return heading+'<p>420ID account sign-in is not enabled for this deployment. Games remain browseable without a wallet.</p></section>';
 const profile=verifiedAccount(state);
 if(profile)return heading+'<p>Signed in as <strong>'+escapeHtml(profile.displayName)+'</strong> <small>(420ID account · wallet optional)</small></p>'+
  '<p>Profile and member settings are shared with BongGoggles Account Social. Match invitations must independently pass server-enforced membership, block and game policies.</p>'+
  '<div class="games-account__actions"><a href="/social" data-route="social">My 420ID profile</a><a href="/account/games" data-route="account-games">Existing account games</a></div></section>';
 if(state?.status==='loading')return heading+'<p role="status">Checking your existing 420ID session…</p></section>';
 return heading+'<p>'+(state?.status==='error'?'Your 420ID session could not be verified. No personal profile or game data is displayed.':'Sign in to use your existing 420ID account for wallet-free games.')+'</p>'+
  '<div class="games-account__actions"><a class="account-auth-link account-auth-link--login" href="/social-api/auth/start">Sign In with 420ID</a>'+
  (state?.status==='error'?'<button type="button" data-account-action="retry">Retry account check</button>':'')+'</div></section>';
}
