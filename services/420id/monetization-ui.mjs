// AUTH-12: owner-only, no-cache participation status. A response from an
// earlier session must never appear after logout, a fresh refresh, visibility
// changes or another account signing in on the same browser.
const get=id=>document.getElementById(id);
let version=null,active=false,busy=false,epoch=0;
const rewards=get('monetization-rewards'),creator=get('monetization-creator');
const consent=get('monetization-consent'),save=get('monetization-save');
const status=get('monetization-stage'),refreshButton=get('monetization-refresh');
function clear(){
 ++epoch;version=null;active=false;
 rewards.checked=false;creator.checked=false;consent.checked=false;
 status.textContent='Sign in to review programme readiness.';
 save.disabled=true;
}
function valid(s){
 return !!s&&s.app==='bong-goggles'&&s.policyVersion===1&&
  s.source==='420id-consent-v1'&&Number.isSafeInteger(s.version)&&s.version>=0&&
  typeof s.rewardOptIn==='boolean'&&typeof s.creatorOptIn==='boolean'&&
  typeof s.walletLinked==='boolean'&&s.canClaim===false&&
  s.paid===false&&s.paymentAuthorized===false&&s.financialAuthority===false&&
  s.rewardStage===(s.rewardOptIn?
   (s.walletLinked?'canonical_verification_required':'wallet_required'):'not_enrolled')&&
  s.creatorStage===(s.creatorOptIn?'operator_programme_required':'not_enrolled');
}
function display(s,ticket){
 if(ticket!==epoch)return;
 if(!valid(s))throw Error('Untrusted programme status');
 version=s.version;active=true;rewards.checked=s.rewardOptIn;creator.checked=s.creatorOptIn;
 status.textContent='Rewards: '+s.rewardStage.replaceAll('_',' ')+
  ' · Creator programme: '+s.creatorStage.replaceAll('_',' ')+
  ' · Verified wallet association: '+(s.walletLinked?'present':'not linked')+
  ' · Nothing claimable or paid.';
 save.disabled=false;
}
async function post(path,payload){
 const response=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(!response.ok)throw Error('Programme status unavailable ('+response.status+').');
 return response.json();
}
async function refresh(){
 // A pending consent POST must not be overridden by a stale GET. Any
 // explicit refresh supersedes prior GETs, and a logout invalidates all.
 if(busy)return;
 clear();const ticket=epoch;
 busy=true;refreshButton.disabled=true;
 try{display(await post('/v1/monetization/status',{}),ticket)}
 catch{if(ticket===epoch)clear()}
 finally{
  busy=false;refreshButton.disabled=false;
 }
}
refreshButton.addEventListener('click',()=>void refresh());
get('monetization-form').addEventListener('submit',event=>{
 event.preventDefault();
 if(!active||busy||version===null)return;
 const rewardOptIn=rewards.checked,creatorOptIn=creator.checked;
 if((rewardOptIn||creatorOptIn)&&!consent.checked){
  status.textContent='Explicit consent is required before opting in.';return;
 }
 const ticket=++epoch;busy=true;save.disabled=true;
 void post('/v1/monetization/consent',{
  rewardOptIn,creatorOptIn,consentAccepted:consent.checked,expectedVersion:version
 }).then(s=>display(s,ticket)).catch(()=>{if(ticket===epoch)clear()}).finally(()=>{
  busy=false;
  if(ticket===epoch){consent.checked=false;if(active)save.disabled=false}
 });
});
for(const id of ['logout','logout-all']){
 get(id).addEventListener('click',clear,{capture:true});
}
// Do not show a frozen status when navigating back into a restored tab.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh();else clear()});
void refresh();
