// AUTH-11 owner-only 420ID display. No browser financial authority, stored
// payout identities, reward amount, pricing or XP conversion.
const get=id=>document.getElementById(id);
let version=null,active=false,busy=false;
const clear=()=>{version=null;active=false;get('monetization-stage').textContent='Sign in to review programme readiness.';get('monetization-save').disabled=true;};
function display(s){
 if(!s||s.app!=='bong-goggles'||s.policyVersion!==1||s.source!=='420id-consent-v1'||
  !Number.isSafeInteger(s.version)||s.version<0||
  typeof s.rewardOptIn!=='boolean'||typeof s.creatorOptIn!=='boolean'||
  typeof s.walletLinked!=='boolean'||s.canClaim!==false||
  s.paid!==false||s.paymentAuthorized!==false||s.financialAuthority!==false||
  !['not_enrolled','wallet_required','canonical_verification_required'].includes(s.rewardStage)||
  !['not_enrolled','operator_programme_required'].includes(s.creatorStage)){
  throw Error('Untrusted programme status');
 }
 version=s.version;active=true;
 get('monetization-rewards').checked=s.rewardOptIn;
 get('monetization-creator').checked=s.creatorOptIn;
 get('monetization-stage').textContent=
   'Rewards: '+s.rewardStage.replaceAll('_',' ')+
   ' · Creator programme: '+s.creatorStage.replaceAll('_',' ')+
   ' · Verified wallet association: '+(s.walletLinked?'present':'not linked')+
   ' · Nothing claimable or paid.';
 get('monetization-save').disabled=false;
}
async function post(path,payload){
 const response=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(!response.ok)throw Error('Programme status unavailable ('+response.status+').');
 return response.json();
}
async function refresh(){
 clear();if(busy)return;
 busy=true;get('monetization-refresh').disabled=true;
 try{display(await post('/v1/monetization/status',{}))}
 catch{clear()}
 finally{busy=false;get('monetization-refresh').disabled=false}
}
get('monetization-refresh').addEventListener('click',()=>void refresh());
get('monetization-form').addEventListener('submit',event=>{
 event.preventDefault();
 if(!active||busy||version===null)return;
 const rewards=get('monetization-rewards').checked,creator=get('monetization-creator').checked;
 if((rewards||creator)&&!get('monetization-consent').checked){
  get('monetization-stage').textContent='Explicit consent is required before opting in.';return;
 }
 busy=true;get('monetization-save').disabled=true;
 void post('/v1/monetization/consent',{
  rewardOptIn:rewards,creatorOptIn:creator,consentAccepted:get('monetization-consent').checked,
  expectedVersion:version
 }).then(display).catch(clear).finally(()=>{
  busy=false;get('monetization-consent').checked=false;
  if(active)get('monetization-save').disabled=false;
 });
});
for(const id of ['logout','logout-all']){
 get(id).addEventListener('click',clear,{capture:true});
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh()});
void refresh();
