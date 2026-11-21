import {createAccountSocialClient,isSubjectID} from './account-social.js';
import {card,emptyState,escapeHtml} from './design-system.js';

// AUTH-11 is a 420ID-consented, wallet-optional participation status.
// These are NOT claimable rewards, billing tiers, tokens or XP conversion.
const REWARDS=new Set(['not_enrolled','wallet_required','canonical_verification_required']);
const CREATOR=new Set(['not_enrolled','operator_programme_required']);
export function parseMonetization(payload){
 if(!payload||payload.app!=='bong-goggles'||payload.policyVersion!==1||
  !Number.isSafeInteger(payload.version)||payload.version<0||
  payload.source!=='420id-consent-v1'||typeof payload.rewardOptIn!=='boolean'||
  typeof payload.creatorOptIn!=='boolean'||typeof payload.walletLinked!=='boolean'||
  payload.canClaim!==false||payload.paid!==false||payload.paymentAuthorized!==false||
  payload.financialAuthority!==false||!REWARDS.has(payload.rewardStage)||
  !CREATOR.has(payload.creatorStage)||
  (payload.rewardOptIn?(payload.rewardStage!==(payload.walletLinked?'canonical_verification_required':'wallet_required')):payload.rewardStage!=='not_enrolled')||
  (payload.creatorOptIn?payload.creatorStage!=='operator_programme_required':payload.creatorStage!=='not_enrolled')||
  (!payload.rewardOptIn&&!payload.creatorOptIn&&payload.walletLinked))return null;
 return Object.freeze({...payload});
}
export class AccountMonetizationController{
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{}}={}){
  this.client=createAccountSocialClient({enabled,fetchImpl});
  this.onChange=onChange;this.generation=0;this.state={status:enabled?'loading':'disabled'};
 }
 emit(state){this.state={...state};this.onChange(this.state);return this.state}
 invalidate(){++this.generation;this.emit({status:'loading'})}
 async refresh(){
  if(!this.client.enabled)return this.emit({status:'disabled'});
  const gen=++this.generation;this.emit({status:'loading'});
  try{
   const me=await this.client.request('/v1/me');
   if(gen!==this.generation)return this.state;
   if(me.status===401)return this.emit({status:'guest'});
   if(me.status!==200||me.data?.walletRequired!==false||!isSubjectID(me.data?.profile?.subject))throw Error('No 420ID app session');
   const response=await this.client.request('/v1/monetization');
   if(gen!==this.generation)return this.state;
   const status=response.status===200?parseMonetization(response.data):null;
   if(!status)throw Error('Unverified programme state');
   return this.emit({status:'ready',programme:status});
  }catch{if(gen===this.generation)return this.emit({status:'error'});return this.state}
 }
}
export function renderAccountMonetization(state,{enabled=false}={}){
 if(!enabled)return card({title:'Community programmes are not active',eyebrow:'420ID · AUTH-11',
  body:emptyState({title:'Programme activation not verified',message:'BongGoggles remains free to use without a wallet. No payouts or paid membership are enabled.'})});
 if(!state||state.status==='loading')return card({title:'Checking programme participation',body:'<p role="status">Verifying your private 420ID session and programme readiness.</p>'});
 if(state.status==='guest')return card({title:'Sign in with 420ID',body:'<p>A wallet is not required to use the community or opt into programme review.</p><a href="/social-api/auth/start">Sign in with 420ID</a>'});
 if(state.status!=='ready'||!parseMonetization(state.programme))return card({title:'Programme verification unavailable',body:'<p role="status">No stale rewards, wallet details, payments or saved participation state are displayed.</p><a href="/account/monetization">Retry</a>'});
 const p=state.programme;
 const names={not_enrolled:'Not enrolled',wallet_required:'Optional verified wallet required for canonical reward review',canonical_verification_required:'Awaiting canonical reward verification',operator_programme_required:'Awaiting an approved creator programme'};
 const stage=key=>escapeHtml(names[key]??'Unavailable');
 return '<section class="account-social account-monetization"><p class="eyebrow">Wallet-independent · 420ID participation</p>'+
  '<h2>Monetization and community rewards</h2>'+
  '<p>Participation is voluntary. Normal posts, messages, free games and XP work without a wallet. This is not a wallet payment, a subscription or a reward claim.</p>'+
  '<dl class="mini-grid"><div><dt>Canonical contribution rewards</dt><dd>'+stage(p.rewardStage)+'</dd></div>'+
  '<div><dt>Creator monetization</dt><dd>'+stage(p.creatorStage)+'</dd></div>'+
  '<div><dt>Verified wallet association</dt><dd>'+(p.walletLinked?'Linked':'Not shared or not linked')+'</dd></div>'+
  '<div><dt>Claimable or paid here</dt><dd>None</dd></div></dl>'+
  '<p>420ID opt-in '+(p.rewardOptIn||p.creatorOptIn?'recorded':'not enabled')+
  '. A separate canonical rewards contract must establish an eligible contribution, funded campaign, accrual and claim. Only a wallet-confirmed canonical claim can lead to a payout; a posted item or XP level is not enough.</p>'+
  '<p><a href="https://auth.420integrated.org/" rel="noopener noreferrer">Manage participation and optional wallet link at 420ID</a></p>'+
  '<p><a href="/account/xp" data-route="account-xp">Your separate off-chain XP</a> <button type="button" data-monetization-refresh>Refresh verified status</button></p>'+
  '</section>';
}
