import {validateAttentionRuntimeConfig,attentionRuntimeReadiness} from './core/config.js';
import {AttentionService420,normalizeCampaign} from './core/service.js';
import {AttentionWallet420,executionGate,submitReviewedAttentionTransaction,waitForAttentionTransaction} from './core/wallet.js';

const state={config:null,service:null,wallet:null,campaigns:[],selected:null,accountProjection:null,reward:null,review:null};
const $=s=>document.querySelector(s);
const setText=(s,v)=>{const n=$(s);if(n)n.textContent=String(v??'');};
function status(message,error=false){setText('#status',message);$('#status')?.setAttribute('data-state',error?'error':'ready');}
function busy(value){for(const b of document.querySelectorAll('button'))b.disabled=value||b.dataset.locked==='true';if(!value)refreshActionLocks();}
function format420(raw){try{return BigInt(raw).toString()+' wei';}catch{return String(raw??'—');}}
function short(v){const s=String(v||'');return s.length>18?s.slice(0,10)+'…'+s.slice(-6):s;}
function refreshRuntime(){if(!state.config)return;const r=attentionRuntimeReadiness(state.config,{walletChainId:state.wallet?.chainId});setText('#runtime-state',r.ready?'Canonical runtime resolved':'Execution locked · '+r.missing.join(', '));}
function refreshWallet(){setText('#wallet-state',state.wallet?.account?short(state.wallet.account):'Not connected');refreshRuntime();}
function feature(name){return state.config?.features?.[name]===true;}
function refreshActionLocks(){
  const connected=!!state.wallet?.account;
  for(const f of ['#global-consent-form button','#campaign-consent-form button']){const b=$(f);if(b){b.dataset.locked=String(!(connected&&feature('consentManagement')));b.disabled=b.dataset.locked==='true';}}
  const claim=$('#review-claim');if(claim){const ready=connected&&feature('rewardClaims')&&state.reward?.state==='RESERVED';claim.dataset.locked=String(!ready);claim.disabled=!ready;}
  for(const el of document.querySelectorAll('#sponsor-panel button')){const ready=connected&&feature('sponsorCampaignManagement');el.dataset.locked=String(!ready);el.disabled=!ready;}
  $('#connect-wallet').disabled=!feature('walletConnection');
}
function campaignButton(c){
  const b=document.createElement('button');b.type='button';b.className='campaign-card';
  const title=document.createElement('strong');title.textContent=short(c.campaignId);
  const stateEl=document.createElement('span');stateEl.textContent=c.state;
  const sponsor=document.createElement('small');sponsor.textContent='Sponsor '+short(c.sponsor);
  const economics=document.createElement('small');economics.textContent='Reward '+c.rewardPerUnit+' wei · cap '+c.maxRewardPerAccount+' wei';
  b.append(title,stateEl,sponsor,economics);b.addEventListener('click',()=>openCampaign(c.campaignId));return b;
}
function renderCampaigns(){const list=$('#campaign-list');list.replaceChildren(...state.campaigns.map(campaignButton));$('#campaign-empty').hidden=state.campaigns.length>0;}
function renderCampaign(c){
  state.selected=c;$('#campaign-detail').hidden=false;
  const pairs=[['#campaign-id',c.campaignId],['#campaign-state',c.state],['#campaign-sponsor',c.sponsor],['#campaign-verifier',c.verifier],['#campaign-budget',format420(c.declaredBudget)],['#campaign-funded',format420(c.funded)],['#campaign-rate',format420(c.rewardPerUnit)],['#campaign-cap',format420(c.maxRewardPerAccount)],['#campaign-reserved',format420(c.reserved)],['#campaign-paid',format420(c.paid)],['#campaign-window',c.startsAt+' → '+c.endsAt],['#campaign-metadata',c.metadataHash],['#campaign-policy',c.audiencePolicyHash]];
  for(const [s,v] of pairs)setText(s,v);
  $('#campaign-consent-form [name="campaignId"]').value=c.campaignId;$('#sponsor-campaign-id').value=c.campaignId;
}
async function loadCampaigns(){
  if(!state.service)return;busy(true);status('Loading campaigns…');
  try{const p=await state.service.campaigns();state.campaigns=(p.items||[]).map(normalizeCampaign);renderCampaigns();status(state.campaigns.length?'Campaigns loaded.':'No campaigns are currently published.');}
  catch(e){state.campaigns=[];renderCampaigns();status(e.message||String(e),true);}finally{busy(false);}
}
async function openCampaign(id){
  if(!state.service)return;busy(true);status('Loading campaign…');
  try{const p=await state.service.campaign(id);renderCampaign(normalizeCampaign(p.campaign));status('Campaign canonical projection loaded.');}
  catch(e){status(e.message||String(e),true);}finally{busy(false);}
}
async function loadAccount(){
  if(!state.service||!state.wallet?.account)return;
  try{const p=await state.service.account(state.wallet.account);state.accountProjection=p;setText('#consent-state',p.consent?.summary||'Consent projection loaded.');}
  catch(e){setText('#consent-state','Account projection unavailable: '+(e.message||String(e)));}
}
async function connect(){
  if(!globalThis.ethereum)return status('Injected EIP-1193 Wallet unavailable.',true);
  busy(true);
  try{
    const wallet=new AttentionWallet420(globalThis.ethereum);await wallet.connect(state.config.network.chainId);wallet.installInvalidation(reason=>{state.wallet=null;state.accountProjection=null;refreshWallet();setText('#consent-state','Wallet authority changed: '+reason+'. Reconnect before any action.');refreshActionLocks();});state.wallet=wallet;refreshWallet();await loadAccount();status('Wallet connected. Review every prepared transaction before signing.');
  }catch(e){state.wallet=null;refreshWallet();status(e.message||String(e),true);}finally{busy(false);}
}
function showReview(review){
  state.review=review;$('#transaction-review').hidden=false;
  setText('#review-kind',review.kind);setText('#review-summary',review.summary||'Review canonical action');setText('#review-target',review.transaction.to);setText('#review-value',review.transaction.value||'0x0');setText('#review-data',review.transaction.data);setText('#review-block',review.source.blockHash);
  const gate=executionGate({config:state.config,wallet:state.wallet,review});setText('#review-gate',gate.ok?'Ready for Wallet simulation and review.':gate.reason);$('#submit-review').disabled=!gate.ok;
}
async function prepare(kind,payload){
  if(!state.service||!state.wallet?.account)return status('Connect Wallet and resolve canonical runtime first.',true);
  busy(true);
  try{const review=await state.service.prepare(kind,{account:state.wallet.account,...payload});showReview(review);status('Transaction prepared from canonical projection for explicit Wallet review.');}
  catch(e){status(e.message||String(e),true);}finally{busy(false);}
}
function formObject(form){return Object.fromEntries(new FormData(form).entries());}
async function submitReview(){
  if(!state.review)return;busy(true);
  try{
    const txHash=await submitReviewedAttentionTransaction({wallet:state.wallet,config:state.config,review:state.review,onState:s=>setText('#tx-state',s.state)});setText('#tx-hash',txHash);
    const final=await waitForAttentionTransaction(state.wallet.provider,txHash,{...state.config.transactions,onState:s=>setText('#tx-state',s.state+(s.confirmations!=null?' · '+s.confirmations+' confirmations':''))});
    if(final.state!=='CONFIRMED')throw new Error('transaction '+final.state.toLowerCase());
    state.review=null;$('#transaction-review').hidden=true;status('Transaction confirmed. Refresh canonical state before any retry.');await loadAccount();if(state.selected)await openCampaign(state.selected.campaignId);
  }catch(e){status(e.message||String(e),true);}finally{busy(false);}
}
async function lookupProof(){if(!state.service)return;busy(true);try{const p=await state.service.proof($('#proof-id').value.trim());setText('#proof-state',JSON.stringify(p.proof??p,null,2));status('Proof projection loaded.');}catch(e){status(e.message||String(e),true);}finally{busy(false);}}
async function lookupReward(){if(!state.service)return;busy(true);try{const p=await state.service.reward($('#reward-id').value.trim());state.reward=p.reward??p;setText('#reward-state',JSON.stringify(state.reward,null,2));status('Reward projection loaded.');}catch(e){state.reward=null;status(e.message||String(e),true);}finally{busy(false);}}
async function boot(){
  try{
    const r=await fetch('./runtime-config.json',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('runtime configuration unavailable');state.config=validateAttentionRuntimeConfig(await r.json());refreshRuntime();refreshActionLocks();
    if(!state.config.api.baseUrl)return status('Attention runtime is intentionally unresolved. Read and mutation workflows remain fail-closed until ATTENTION-AUDIT-7/8 materialization.');
    state.service=new AttentionService420({baseUrl:state.config.api.baseUrl,expectedSchema:state.config.api.projectionSchema});const rt=await state.service.runtime();
    if(state.config.network.chainId&&String(rt.chainId).toLowerCase()!==state.config.network.chainId.toLowerCase())throw new Error('Attention service chain mismatch');
    const addressKeys=['attentionRouterAddress','consentRegistryAddress','proofRegistryAddress','rewardRegistryAddress'];const registry={...state.config.registry};for(const key of addressKeys)if(rt[key])registry[key]=rt[key];
    state.config={...state.config,network:{...state.config.network,chainId:state.config.network.chainId||rt.chainId},registry};refreshRuntime();refreshActionLocks();await loadCampaigns();
  }catch(e){status(e.message||String(e),true);}
}
$('#connect-wallet')?.addEventListener('click',connect);
$('#refresh-campaigns')?.addEventListener('click',loadCampaigns);
$('#global-consent-form')?.addEventListener('submit',e=>{e.preventDefault();const v=formObject(e.currentTarget);prepare('set-global-consent',{enabled:v.enabled==='true',policyHash:v.policyHash});});
$('#campaign-consent-form')?.addEventListener('submit',e=>{e.preventDefault();const v=formObject(e.currentTarget);prepare('set-campaign-consent',{campaignId:v.campaignId,enabled:v.enabled==='true',policyHash:v.policyHash});});
$('#lookup-proof')?.addEventListener('click',lookupProof);
$('#lookup-reward')?.addEventListener('click',lookupReward);
$('#review-claim')?.addEventListener('click',()=>prepare('claim-reward',{rewardId:$('#reward-id').value.trim()}));
$('#create-campaign-form')?.addEventListener('submit',e=>{e.preventDefault();prepare('create-campaign',formObject(e.currentTarget));});
$('#review-fund')?.addEventListener('click',()=>prepare('fund-campaign',{campaignId:$('#sponsor-campaign-id').value.trim(),amount:$('#funding-amount').value.trim()}));
for(const b of document.querySelectorAll('[data-lifecycle]'))b.addEventListener('click',()=>prepare(b.dataset.lifecycle,{campaignId:$('#sponsor-campaign-id').value.trim()}));
$('#submit-review')?.addEventListener('click',submitReview);
$('#close-review')?.addEventListener('click',()=>{state.review=null;$('#transaction-review').hidden=true;});
boot();
