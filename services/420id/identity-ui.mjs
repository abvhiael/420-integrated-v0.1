// AUTH-6: separate optional presentation preference. Only server-verified,
// pinned finalized state can be shown as verified. No on-chain writes,
// wallet keys, account IDs, chain override, or claims in browser storage.
export function installIdentityUI({get,post,run,status,isAuthenticated}){
 let saved=null;
 const readFields=()=>({identityProfileId:get('identity-profile-id').value.trim(),nameLabelHash:get('identity-label-hash').value.trim()});
 function visible(){
  get('identity-section').hidden=!isAuthenticated();
  for(const b of get('identity-section').querySelectorAll('[data-identity]'))b.disabled=!isAuthenticated();
  get('identity-clear').disabled=!isAuthenticated()||!saved;
 }
 function display(verified){
  const body=verified.nameLabelHash
   ? verified.bilateralNameVerified===true?'Identity420 controller and bilateral Names420 binding VERIFIED at pinned finalized chain block.':'Name binding NOT VERIFIED.'
   : 'Active Identity420 profile controller VERIFIED at pinned finalized chain block; no .420 name is claimed.';
  get('identity-result').textContent=body+' Block: '+verified.finalizedBlockHash+'; chain: '+verified.chainId+'; checked: '+verified.verifiedAt;
 }
 function clear(){saved=null;get('identity-consent').checked=false;get('identity-profile-id').value='';get('identity-label-hash').value='';get('identity-result').textContent='No on-chain presentation verified.';visible();}
 get('identity-preview').addEventListener('click',()=>void run(async()=>{
  get('identity-result').textContent='Verification in progress. No claims are assumed.';
  const result=await post('/v1/identity/preview',readFields());display(result.verification);
  status('Verified only the selected on-chain presentation. Nothing has been saved.');
 }));
 get('identity-form').addEventListener('submit',event=>{event.preventDefault();void run(async()=>{
  if(!get('identity-consent').checked)throw new Error('Explicit 420ID presentation consent is required.');
  // A missing local preference revision must not silently overwrite a
  // preference saved from another browser or app.
  const current=await post('/v1/identity/current',{});
  const existing=current.preference;
  if(!saved&&existing)throw new Error('A saved preference exists. Recheck it before changing.');
  const version=saved?saved.revision:0;
  const result=await post('/v1/identity/save',{...readFields(),consentAccepted:true,expectedRevision:version});
  saved=result.preference;display(saved);get('identity-consent').checked=false;
  status('Stored a non-authoritative display preference. On-chain state is reverified on every read.');
  visible();
 }));
 get('identity-current').addEventListener('click',()=>void run(async()=>{
  get('identity-result').textContent='Rechecking current finalized chain state.';
  const result=await post('/v1/identity/current',{});
  saved=result.preference;
  if(!saved){get('identity-result').textContent='No preference saved.';}
  else{get('identity-profile-id').value=saved.identityProfileId;get('identity-label-hash').value=saved.nameLabelHash??'';display(saved);}
  visible();
 }));
 get('identity-clear').addEventListener('click',()=>void run(async()=>{
  await post('/v1/identity/clear',{});clear();
  status('420ID display preference cleared. No on-chain record or wallet link changed.');
 }));
 clear();return {clear,visible};
}
