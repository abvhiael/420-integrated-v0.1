import {createAccountSocialClient,isSubjectID} from './account-social.js';
import {card,emptyState,escapeHtml} from './design-system.js';

export const XP_POLICY=Object.freeze({version:1,postPoints:5,commentPoints:2,postMinChars:25,commentMinChars:15,postDailyCap:3,commentDailyCap:10,levelStep:100});
const n=v=>Number.isSafeInteger(v)&&v>=0;
function parseSummary(payload,subject){
 if(!payload||payload.source!=='bonggoggles-account-xp'||
 payload.onChain!==false||payload.redeemable!==false||
 payload.policyVersion!==XP_POLICY.version||payload.subject!==subject||
 !isSubjectID(payload.subject)||!n(payload.total)||!n(payload.level)||
 payload.level!==Math.floor(payload.total/100)+1||
 !n(payload.toNextLevel)||payload.toNextLevel!==100-payload.total%100||
 !n(payload.todayPosts)||payload.todayPosts>XP_POLICY.postDailyCap||
 !n(payload.todayComments)||payload.todayComments>XP_POLICY.commentDailyCap||
 !Array.isArray(payload.events)||payload.events.length>30)return null;
 const events=[];
 for(const e of payload.events){
  if(!e||!['post','comment'].includes(e.kind)||!isSubjectID(e.sourceId)||
    !['grant','revoke'].includes(e.action)||
    (e.points!==(e.kind==='post'?XP_POLICY.postPoints:XP_POLICY.commentPoints)*(e.action==='grant'?1:-1))||
    typeof e.at!=='string'||!Number.isFinite(Date.parse(e.at)))return null;
  events.push({kind:e.kind,sourceId:e.sourceId,action:e.action,points:e.points,at:e.at});
 }
 return {...payload,events};
}
export class AccountXPController {
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{}}={}){
  this.client=createAccountSocialClient({enabled,fetchImpl});
  this.onChange=onChange;this.generation=0;
  this.state={status:enabled?'loading':'disabled'};
 }
 emit(v){this.state={...v};this.onChange(this.state);return this.state;}
 invalidate(){this.generation++;this.emit({status:'loading'});}
 async refresh(){
  if(!this.client.enabled)return this.emit({status:'disabled'});
  const gen=++this.generation;this.emit({status:'loading'});
  try{
   const me=await this.client.request('/v1/me');
   if(gen!==this.generation)return this.state;
   if(me.status===401)return this.emit({status:'guest'});
   if(me.status!==200||me.data?.walletRequired!==false||!isSubjectID(me.data.profile?.subject))throw Error('420ID session required');
   const reply=await this.client.request('/v1/xp');
   if(gen!==this.generation)return this.state;
   if(reply.status!==200)throw Error('XP service unavailable');
   const summary=parseSummary(reply.data,me.data.profile.subject);
   if(!summary)throw Error('Untrusted XP projection');
   return this.emit({status:'ready',summary});
  }catch{
   if(gen===this.generation)return this.emit({status:'error'});
   return this.state;
  }
 }
}
export function renderAccountXP(state,{enabled=false}={}){
 if(!enabled)return card({title:'Community XP not activated',eyebrow:'420ID community',
  body:emptyState({title:'No XP available',message:'The separate off-chain community XP service has not completed live deployment qualification. Canonical on-chain rewards remain independent.'})});
 if(!state||state.status==='loading')return card({title:'Checking your 420ID community XP',body:'<p role="status">Verifying your account session.</p>'});
 if(state.status==='guest')return card({title:'Sign in to view your community XP',body:'<p>Use 420ID email or passkey sign-in. No wallet is required.</p><a href="/social-api/auth/start">Sign in with 420ID</a>'});
 if(state.status!=='ready')return card({title:'Community XP temporarily unavailable',
  body:'<p role="status">Your 420ID session or XP ledger could not be verified. No previously cached points are displayed.</p><a href="/account/xp">Retry</a>'});
 const s=state.summary;
 const label=e=>e.action==='grant'?'Earned':'Reversed';
 return '<section class="account-social account-xp"><p class="eyebrow">Wallet-independent · off-chain community XP</p>'+
  '<h2>Your community contribution</h2>'+
  '<p>XP is private community feedback, not 420Token, currency, a wager, redeemable credit, or eligibility for blockchain rewards.</p>'+
  '<div class="account-xp__stats"><div><strong>'+s.total+'</strong><span>Current XP</span></div>'+
  '<div><strong>'+s.level+'</strong><span>Community level</span></div>'+
  '<div><strong>'+s.toNextLevel+'</strong><span>XP to next level</span></div></div>'+
  '<p>Today (UTC): '+s.todayPosts+'/'+XP_POLICY.postDailyCap+' XP-eligible posts and '+
  s.todayComments+'/'+XP_POLICY.commentDailyCap+' XP-eligible comments.</p>'+
  '<p>Policy v1: +5 XP for an original post of at least 25 characters; +2 XP for a comment of at least 15 characters on another member’s post. Exact repeated content earns no additional XP. Deleted or hidden content loses its XP. Likes, follows, private messages and games never earn XP.</p>'+
  '<h3>Recent XP activity</h3><ul aria-label="Private XP history">'+
  (s.events.length?s.events.map(e=>'<li>'+escapeHtml(label(e))+' '+(e.points>0?'+':'')+e.points+
  ' XP · '+escapeHtml(e.kind)+' · '+escapeHtml(e.at)+'</li>').join(''):
  '<li>No eligible contributions yet.</li>')+'</ul>'+
  '<p><a href="/social" data-route="social">Back to community</a> <button type="button" data-xp-refresh>Refresh verified XP</button></p></section>';
}
