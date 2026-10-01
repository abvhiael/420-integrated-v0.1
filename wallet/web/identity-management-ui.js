import { ZERO_BYTES32 } from './core/abi.js';
import { classifyIdentity420Error, createIdentity420Client } from './core/identity-management.js';
import { InjectedProvider420 } from './core/provider.js';

let context=null;
let busy=false;
let lifecycleBound=false;
const $=(selector)=>document.querySelector(selector);

export function identityMarkup(){
  return `
    <section id="identity-management-panel" class="panel" aria-labelledby="identity-management-heading">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Canonical Identity420 · optional pseudonymous identity</p>
          <h2 id="identity-management-heading">420 Identity</h2>
          <p class="muted">Create and manage a public profile, controller transfer, primary .420 binding, and credentials. Identity420 does not prove legal identity or wallet ownership.</p>
        </div>
        <span id="identity-app-state" class="status-pill" data-state="idle">Not connected</span>
      </div>

      <div class="account-card identity-context" aria-live="polite">
        <div><p class="label">Connected account</p><strong id="identity-account">—</strong></div>
        <div><p class="label">Identity420</p><strong id="identity-contract">—</strong></div>
        <div><p class="label">Names420</p><strong id="identity-names-contract">—</strong></div>
        <button id="identity-connect" type="button">Connect / verify Identity</button>
      </div>

      <div class="split-panel">
        <div class="form-card" aria-labelledby="identity-profile-heading">
          <p class="eyebrow">Profile lifecycle</p>
          <h3 id="identity-profile-heading">Profile</h3>
          <label><span class="label">Profile ID (bytes32)</span><input id="identity-profile-id" type="text" autocomplete="off" spellcheck="false" placeholder="0x…64 hex chars" /></label>
          <label><span class="label">Metadata commitment (bytes32)</span><input id="identity-metadata-hash" type="text" autocomplete="off" spellcheck="false" placeholder="0x…64 hex chars" /></label>
          <label><span class="label">Active</span><select id="identity-profile-active"><option value="true">Active</option><option value="false">Inactive</option></select></label>
          <div class="button-row">
            <button id="identity-load-profile" type="button">Load profile</button>
            <button id="identity-create-profile" type="button" class="primary-action">Create profile</button>
            <button id="identity-update-profile" type="button">Update metadata/activity</button>
          </div>
          <dl class="names-state-list" aria-live="polite">
            <div><dt>Controller</dt><dd id="identity-profile-controller">—</dd></div>
            <div><dt>Pending controller</dt><dd id="identity-profile-pending">—</dd></div>
            <div><dt>Primary .420 hash</dt><dd id="identity-profile-primary">—</dd></div>
            <div><dt>State</dt><dd id="identity-profile-state">—</dd></div>
          </dl>

          <label><span class="label">New controller</span><input id="identity-new-controller" type="text" autocomplete="off" placeholder="0x…" /></label>
          <div class="button-row">
            <button id="identity-transfer-controller" type="button">Nominate controller</button>
            <button id="identity-accept-controller" type="button">Accept controller transfer</button>
          </div>
        </div>

        <div class="form-card" aria-labelledby="identity-name-heading">
          <p class="eyebrow">Bilateral 420Names binding</p>
          <h3 id="identity-name-heading">Primary .420 name</h3>
          <p class="muted">A strong binding is shown only when Names420 claims this profile and Identity420 points back to the same label hash.</p>
          <label><span class="label">Label hash (bytes32)</span><input id="identity-primary-label" type="text" autocomplete="off" spellcheck="false" placeholder="0x…64 hex chars" /></label>
          <div class="button-row">
            <button id="identity-check-name" type="button">Validate bilateral binding</button>
            <button id="identity-set-name" type="button">Set / change primary</button>
            <button id="identity-unlink-name" type="button">Unlink primary</button>
          </div>
          <div id="identity-name-validation" class="security-check" role="status" aria-live="polite">
            <span aria-hidden="true">i</span>
            <p><strong>Not checked</strong><small>Wallet will not describe a .420 name as bound unless both contracts agree.</small></p>
          </div>
        </div>
      </div>

      <div class="form-card" aria-labelledby="identity-credential-heading">
        <p class="eyebrow">Credential inspection</p>
        <h3 id="identity-credential-heading">Credential</h3>
        <label><span class="label">Credential ID (bytes32)</span><input id="identity-credential-id" type="text" autocomplete="off" spellcheck="false" placeholder="0x…64 hex chars" /></label>
        <div class="button-row">
          <button id="identity-load-credential" type="button">Inspect credential</button>
          <button id="identity-reject-credential" class="danger-button" type="button">Reject credential</button>
        </div>
        <dl class="names-state-list" aria-live="polite">
          <div><dt>Subject profile</dt><dd id="identity-credential-subject">—</dd></div>
          <div><dt>Issuer</dt><dd id="identity-credential-issuer">—</dd></div>
          <div><dt>Credential type</dt><dd id="identity-credential-type">—</dd></div>
          <div><dt>Claim commitment</dt><dd id="identity-credential-claim">—</dd></div>
          <div><dt>Validity</dt><dd id="identity-credential-validity">—</dd></div>
          <div><dt>Trust source</dt><dd id="identity-credential-trust">—</dd></div>
        </dl>
        <p class="muted">Validity reflects current on-chain credential, issuer and profile state. Trust class describes issuer policy only; it is not proof of legal identity, wallet ownership, reputation, or authorization.</p>
      </div>

      <div id="identity-transaction-state" class="security-check" role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        <p><strong>Ready</strong><small>Writes are simulated, gas-estimated, revalidated, and require explicit wallet approval.</small></p>
      </div>
      <p id="identity-error-recovery" class="muted" role="alert" aria-live="assertive"></p>
    </section>
  `;
}

function setAppState(label,state='idle'){const el=$('#identity-app-state');if(el){el.textContent=label;el.dataset.state=state;}}
function setTxState(title,detail,state='idle'){const root=$('#identity-transaction-state');if(!root)return;root.querySelector('strong').textContent=title;root.querySelector('small').textContent=detail;root.dataset.state=state;}
function setBusy(value){
  busy=value;
  document.querySelectorAll('#identity-management-panel button').forEach((button)=>{if(button.id!=='identity-connect')button.disabled=value||!context;});
  const connect=$('#identity-connect');if(connect)connect.disabled=value;
}
async function loadRuntimeConfig(){
  const response=await fetch('./runtime-config.json',{cache:'no-store'});
  if(!response.ok)throw new Error(`runtime config ${response.status}`);
  const config=await response.json();
  if(!config?.network?.chainId||!config?.deployment?.identityAddress||!config?.deployment?.namesAddress) throw new Error('420 Identity requires a qualified chain-specific Identity420 and Names420 deployment');
  return config;
}
function invalidateContext(reason){
  context=null;
  setAppState('Reload required');
  setTxState('Wallet state changed',reason);
  $('#identity-error-recovery').textContent='Recovery: reconnect and reload canonical Identity state before continuing.';
  setBusy(false);
}
async function connectIdentity(){
  if(!globalThis.ethereum)throw new Error('No injected EIP-1193 wallet found');
  const config=await loadRuntimeConfig();
  const provider=new InjectedProvider420(globalThis.ethereum);
  let accounts=await provider.request('eth_accounts');
  if(!Array.isArray(accounts)||!accounts.length)accounts=await provider.requestAccounts();
  if(!Array.isArray(accounts)||!accounts.length)throw new Error('No account authorized for 420 Identity');
  const account=accounts[0].toLowerCase();
  const client=createIdentity420Client({provider,identityAddress:config.deployment.identityAddress,namesAddress:config.deployment.namesAddress,chainId:config.network.chainId,account});
  await client.verifySession();
  context=Object.freeze({config,provider,account,client});
  if(!lifecycleBound){
    provider.on('accountsChanged',()=>invalidateContext('The connected wallet account changed.'));
    provider.on('chainChanged',()=>invalidateContext('The connected wallet network changed.'));
    lifecycleBound=true;
  }
  $('#identity-account').textContent=account;
  $('#identity-contract').textContent=client.identityAddress;
  $('#identity-names-contract').textContent=client.namesAddress;
  setAppState('Verified','passed');
  setTxState('Identity420 verified','Account, chain, bytecode identity, protocol version, and Names420 code passed preflight.','passed');
}
async function withRecovery(button,action){
  if(busy)return;
  setBusy(true);$('#identity-error-recovery').textContent='';
  try{await action();}
  catch(error){
    const classified=classifyIdentity420Error(error);
    setAppState('Action blocked');
    setTxState('Action blocked',classified.message);
    $('#identity-error-recovery').textContent=`Recovery: ${classified.retryable?'correct the state shown above and retry. ':''}${classified.message}`;
    button?.focus();
  }finally{setBusy(false);}
}
async function confirmSubmission(submitted,successText){
  setAppState('Submitted','pending');setTxState('Transaction submitted',`${submitted.txHash} · waiting for chain confirmation`,'pending');
  const receipt=await context.client.confirm(submitted.txHash);
  setAppState('Confirmed','passed');setTxState('Confirmed',`${successText} · block ${receipt.blockNumber||'confirmed'}`,'passed');
  return receipt;
}
function profileId(){return $('#identity-profile-id').value.trim();}
async function loadProfile(){
  const p=await context.client.profile(profileId());
  $('#identity-profile-controller').textContent=p.exists?p.controller:'Profile not found';
  $('#identity-profile-pending').textContent=p.exists?p.pendingController:'—';
  $('#identity-profile-primary').textContent=p.exists?p.primaryName:'—';
  $('#identity-profile-state').textContent=p.exists?(p.active?'Active':'Inactive'):'Empty';
  if(p.exists){$('#identity-metadata-hash').value=p.metadataHash;$('#identity-profile-active').value=String(p.active);}
  return p;
}
async function checkName(){
  const label=$('#identity-primary-label').value.trim();
  const check=await context.client.bilateralPrimaryName(profileId(),label);
  const root=$('#identity-name-validation');
  root.querySelector('strong').textContent=check.bilateral?'Bilateral binding verified':'Binding incomplete';
  root.querySelector('small').textContent=check.bilateral
    ? 'Names420 claims this profile and Identity420 points to the same primary label hash.'
    : `Names→profile: ${check.namesClaims?'yes':'no'} · Identity→name: ${check.identityClaims?'yes':'no'}. Do not present this as a verified .420 binding.`;
  root.dataset.state=check.bilateral?'passed':'idle';
  return check;
}
async function loadCredential(){
  const c=await context.client.credential($('#identity-credential-id').value.trim());
  $('#identity-credential-subject').textContent=c.exists?c.subjectProfileId:'Credential not found';
  $('#identity-credential-issuer').textContent=c.exists?c.issuerId:'—';
  $('#identity-credential-type').textContent=c.exists?c.credentialType:'—';
  $('#identity-credential-claim').textContent=c.exists?c.claimHash:'—';
  $('#identity-credential-validity').textContent=c.exists?(c.valid?'Currently valid':'Currently invalid'):'Unknown';
  $('#identity-credential-trust').textContent=c.exists&&c.issuer?`${c.issuer.trustLabel} issuer · ${c.issuer.active?'active':'inactive'} · policy source only`:'—';
  return c;
}
function confirmAction(message){return !globalThis.confirm||globalThis.confirm(message);}

export function installIdentity420ManagementUi(){
  if($('#identity-management-panel'))return;
  const main=document.querySelector('main.shell')||document.querySelector('main');if(!main)return;
  const anchor=$('#services-section')||$('#status');
  const wrapper=document.createElement('div');wrapper.innerHTML=identityMarkup();
  const panel=wrapper.firstElementChild;if(anchor)main.insertBefore(panel,anchor);else main.append(panel);

  $('#identity-connect').addEventListener('click',(e)=>withRecovery(e.currentTarget,connectIdentity));
  $('#identity-load-profile').addEventListener('click',(e)=>withRecovery(e.currentTarget,async()=>{await loadProfile();setTxState('Canonical profile loaded','Profile state was read directly from Identity420.','passed');}));
  $('#identity-create-profile').addEventListener('click',(e)=>withRecovery(e.currentTarget,async()=>{
    if(!confirmAction('Create this public pseudonymous Identity420 profile? The profile ID and metadata commitment will be public chain data.'))return;
    const submitted=await context.client.createProfile({profileId:profileId(),metadataHash:$('#identity-metadata-hash').value.trim()});
    await confirmSubmission(submitted,'Profile created');await loadProfile();
  }));
  $('#identity-update-profile').addEventListener('click',(e)=>withRecovery(e.currentTarget,async()=>{
    if(!confirmAction('Update this public profile metadata commitment/activity state?'))return;
    const submitted=await context.client.updateProfile({profileId:profileId(),metadataHash:$('#identity-metadata-hash').value.trim(),active:$('#identity-profile-active').value==='true'});
    await confirmSubmission(submitted,'Profile updated');await loadProfile();
  }));
  $('#identity-transfer-controller').addEventListener('click',(e)=>withRecovery(e.currentTarget,async()=>{
    const next=$('#identity-new-controller').value.trim();
    if(!confirmAction(`Nominate ${next} as the new profile controller? Control changes only after that account accepts.`))return;
    const submitted=await context.client.transferController({profileId:profileId(),newController:next});
    await confirmSubmission(submitted,'Controller nomination confirmed');await loadProfile();
  }));
  $('#identity-accept-controller').addEventListener('click',(e)=>withRecovery(e.currentTarget,async()=>{
    if(!confirmAction('Accept control of this Identity420 profile?'))return;
    const submitted=await context.client.acceptController({profileId:profileId()});
    await confirmSubmission(submitted,'Controller transfer accepted');await loadProfile();
  }));
  $('#identity-check-name').addEventListener('click',(e)=>withRecovery(e.currentTarget,checkName));
  $('#identity-set-name').addEventListener('click',(e)=>withRecovery(e.currentTarget,async()=>{
    const labelHash=$('#identity-primary-label').value.trim();
    const pre=await context.client.bilateralPrimaryName(profileId(),labelHash);
    if(!pre.namesClaims)throw new Error('Names420 does not currently claim this profile; update the Names420 resolution profileId first');
    if(!confirmAction('Set this label hash as the Identity420 primary .420 name? Wallet will still show a strong binding only while both contracts agree.'))return;
    const submitted=await context.client.setPrimaryName({profileId:profileId(),labelHash});
    await confirmSubmission(submitted,'Primary .420 pointer updated');await loadProfile();await checkName();
  }));
  $('#identity-unlink-name').addEventListener('click',(e)=>withRecovery(e.currentTarget,async()=>{
    if(!confirmAction('Clear this profile’s Identity420 primary .420 pointer? Names420 state will not be modified.'))return;
    const submitted=await context.client.setPrimaryName({profileId:profileId(),labelHash:ZERO_BYTES32});
    await confirmSubmission(submitted,'Primary .420 pointer cleared');await loadProfile();
    const root=$('#identity-name-validation');root.querySelector('strong').textContent='Unlinked';root.querySelector('small').textContent='Identity420 no longer claims a primary .420 name for this profile.';root.dataset.state='idle';
  }));
  $('#identity-load-credential').addEventListener('click',(e)=>withRecovery(e.currentTarget,async()=>{await loadCredential();setTxState('Credential loaded','Validity and issuer trust source were read from current Identity420 state.','passed');}));
  $('#identity-reject-credential').addEventListener('click',(e)=>withRecovery(e.currentTarget,async()=>{
    const c=await loadCredential();if(!c.exists)throw new Error('Identity420 credential does not exist');
    if(!confirmAction('Reject this credential for its subject profile? Rejection is irreversible in the current Identity420 protocol.'))return;
    const submitted=await context.client.rejectCredential({credentialId:c.credentialId});
    await confirmSubmission(submitted,'Credential rejected');await loadCredential();
  }));

  setBusy(false);
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installIdentity420ManagementUi,{once:true});
  else installIdentity420ManagementUi();
}
