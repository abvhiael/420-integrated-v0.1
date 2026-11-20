import {validateRuntimeConfig,runtimeReadiness} from './core/config.js';
import {LaunchpadService,normalizeCampaign,progress,remaining} from './core/service.js';
import {connectWallet,executionGate,submitReviewedTransaction} from './core/wallet.js';

const HASH=/^0x[0-9a-fA-F]{64}$/;
const state={config:null,service:null,wallet:null,campaigns:[],selected:null,position:null,checkout:null,
  review:null,quote:null,filters:{},cursor:null,total:0,lastTx:null,busy:false};
const $=s=>document.querySelector(s);
const setText=(s,v)=>{const n=$(s);if(n)n.textContent=String(v??'');};
function status(message,error=false){setText('#status',message);$('#status')?.setAttribute('data-state',error?'error':'ready');}
function setBusy(b){state.busy=b;for(const el of document.querySelectorAll('button'))el.disabled=b||el.dataset.blocked==='true';}
function label(v){return String(v||'UNKNOWN').replaceAll('_',' ');}
function renderRuntime(){const r=runtimeReadiness(state.config,{walletChainId:state.wallet?.chainId});setText('#runtime-state',r.ready?'Canonical runtime resolved':'Execution locked - '+r.missing.join(', '));}
function renderWallet(){setText('#wallet-state',state.wallet?state.wallet.account.slice(0,6)+'...'+state.wallet.account.slice(-4):'Not connected');renderRuntime();}
function card(c){
  const b=document.createElement('button');b.type='button';b.className='campaign-card';
  b.innerHTML='<span class="mode"></span><strong></strong><span class="state"></span><p></p><div class="meter"><span></span></div><small></small>';
  b.querySelector('.mode').textContent=label(c.mode);b.querySelector('strong').textContent=c.title;
  b.querySelector('.state').textContent=label(c.state);b.querySelector('p').textContent=c.summary;
  const p=progress(c);b.querySelector('.meter span').style.width=p+'%';
  b.querySelector('small').textContent=c.raised+' / '+c.hardCap+' - '+p+'% - '+remaining(c)+' remaining';
  b.addEventListener('click',()=>openCampaign(c.saleId));return b;
}
function renderCampaigns(){
  $('#campaign-grid').replaceChildren(...state.campaigns.map(card));
  $('#empty-state').hidden=state.campaigns.length>0;$('#load-more').hidden=!state.cursor;
  setText('#campaign-count',state.campaigns.length+' of '+state.total+' campaigns');
}
function actionable(selector,enabled){
  const b=$(selector);if(!b)return;b.dataset.blocked=enabled?'false':'true';b.disabled=state.busy||!enabled;
}
function actionState(){
  const w=!!state.wallet,p=state.position,c=state.selected,checkout=state.checkout;
  const amount=$('#contribution-amount')?.value||'',nonce=$('#intent-nonce')?.value||'';
  const amountOk=/^[1-9][0-9]*$/.test(amount)&&BigInt(amount)<=2n**128n-1n&&
    !!p&&BigInt(amount)<=BigInt(p.remaining)&&BigInt(amount)<=BigInt(p.walletRemaining);
  const active=w&&p?.sale?.state==='ACTIVE'&&p.source.at>=p.sale.startsAt&&p.source.at<=p.sale.endsAt;
  const eligible=active&&p.identity.bound;
  actionable('#refresh',!!state.service);actionable('#load-more',!!state.cursor);
  actionable('#refresh-position',w&&!!c);
  actionable('#bind-identity',w&&!!c&&HASH.test($('#identity-profile').value));
  actionable('#register-intent',eligible&&amountOk&&!!nonce&&!checkout?.registered);
  actionable('#check-checkout',eligible&&amountOk&&!!nonce);
  actionable('#new-intent',w&&!!c);
  const terms=conversionTerms();const hasTerms=HASH.test(terms.marketId)&&/^0x[0-9a-fA-F]{40}$/.test(terms.inputAsset)&&
    /^[1-9][0-9]*$/.test(terms.maxInput)&&/^[1-9][0-9]*$/.test(terms.minOutput);
  const canQuote=eligible&&checkout?.registered&&checkout?.invoiceExists&&!checkout?.paymentId&&hasTerms;
  actionable('#get-conversion-quote',canQuote);
  actionable('#approve-conversion',canQuote&&!!state.quote?.approveRequired&&BigInt(state.quote.balance)>=BigInt(state.quote.maxInput));
  actionable('#pay-conversion',canQuote&&!!state.quote?.canPay);
  actionable('#contribute',eligible&&checkout?.registered&&checkout?.invoiceExists&&checkout?.paymentStatus==='SETTLED'&&!checkout?.recorded&&checkout.amount===amount);
  actionable('#claim',w&&!!p?.claimable);
  const refundable=w&&p&&!p.refunded&&['FAILED','CANCELLED'].includes(p.sale.state)&&p.history.length>0;
  const fullyDelivered=refundable&&p.history.every(x=>BigInt(x.refundPrincipalDelivered)===BigInt(x.settlementAmount));
  actionable('#refund',fullyDelivered&&!p.preparedRefundCommitment);
  actionable('#record-refund',fullyDelivered&&!!p.preparedRefundCommitment);
  actionable('#open-dispute',w&&!!p&&HASH.test($('#dispute-claim').value)&&HASH.test($('#dispute-remedy').value)&&!p.dispute);
  actionable('#link-dispute',w&&!!p&&!p.dispute&&HASH.test($('#dispute-case').value));
  actionable('#publish-outcome',w&&p?.dispute?.state==='FINALIZED'&&!p.dispute.published);
  actionable('#submit-review',w&&!!state.review&&executionGate({config:state.config,wallet:state.wallet,review:state.review}).ok);
  actionable('#refresh-tx',w&&!!state.lastTx?.hash);
}
function appendMessage(host,text,tag='p'){
  const el=document.createElement(tag);el.textContent=String(text);host.append(el);return el;
}
function renderHistory(){
  const node=$('#contribution-history');node.replaceChildren();
  const history=state.position?.history||[];
  if(!history.length){appendMessage(node,'No canonical contribution records for this wallet.');return;}
  for(const p of history){
    const row=document.createElement('div');row.className='history-row';
    appendMessage(row,'Payment '+p.paymentId,'code');
    appendMessage(row,'Principal '+p.settlementAmount+' | '+p.status+' | 420Pay refund delivered '+p.refundDelivered+
      ' | Principal refunded '+p.refundPrincipalDelivered);
    node.append(row);
  }
}
function conversionTerms(){return {amount:$('#contribution-amount')?.value||'',nonce:$('#intent-nonce')?.value||'',
  marketId:$('#pay-market')?.value.trim()||'',inputAsset:$('#pay-input-asset')?.value.trim()||'',
  maxInput:$('#pay-max-input')?.value.trim()||'',minOutput:$('#pay-min-output')?.value.trim()||''};}
function renderQuote(){const q=state.quote;
  setText('#conversion-state',q?'420Pay quote '+q.quoteId+' | spend '+q.maxInput+' input token units | exactly '+q.quotedSettlement+
    ' settlement units | conversion fee '+q.conversionFee+' input units | price impact '+q.slippageBps+
    ' bps | pool allowance '+q.allowance+' | balance '+q.balance+' | expires '+new Date(q.expiresAt*1000).toISOString()+
    '. Refresh quote after approval or expiry. Gas fees are reviewed in Wallet.':
    'No verified 420Pay conversion quote. The merchant must first create the exact intent invoice.');
  actionState();}
function renderCheckout(){
  const c=state.checkout;setText('#invoice-id',c?.invoiceId||'-');
  $('#payment-id').value=c?.paymentId||'';
  const link=$('#pay-checkout-link');
  link.hidden=!c?.checkoutUrl;if(c?.checkoutUrl)link.href=c.checkoutUrl;else link.removeAttribute('href');
  const messages={REGISTER_INTENT:'Intent is not yet registered. Review and confirm the registration transaction.',
    WAIT_FOR_MERCHANT_INVOICE:'Intent registered. Merchant must create the exact canonical single-use invoice before payment.',
    QUOTE_CONVERSION:'Invoice ready. Use a qualified ERC-20 market conversion quote below; native 420 checkout cannot settle a Launchpad sale.',
    CONTRIBUTION_UNAVAILABLE:'A new contribution is unavailable due to sale status, capacity or eligibility. Existing paid intents can still be recovered.',
    RECOVER_OR_EXPIRED:'Do not pay this invoice: the contribution window or eligibility is no longer valid. Check Pay refund and recovery.',
    AWAIT_CANONICAL_SETTLEMENT:'420Pay payment is not yet settled. Verify canonical payment and Wallet history before any retry.',
    RECORD_CONTRIBUTION:'420Pay shows a matching settled payment. Review recording the Launchpad contribution.'};
  setText('#checkout-state',c?(messages[c.next]||('Payment recorded: '+c.paymentStatus)):'No checkout context loaded.');
}
function renderPosition(){
  const p=state.position;
  setText('#participant-state',p?'Contributed '+p.contributed+' | claimed '+p.claimed+' | refunded '+(p.refunded?'yes':'no'):
    'Connect wallet for canonical participant status.');
  setText('#identity-state',p?label(p.eligibility):'Wallet not connected');
  setText('#profile-state',p?.identity?.profileId?'Bound profile: '+p.identity.profileId:'Bind an owned active Identity profile with a valid sale-specific credential.');
  setText('#wallet-capacity',p?p.walletRemaining:'-');
  setText('#fee-state',p?p.fees.reason:'420Pay quote and Wallet gas required');
  if(p?.identity?.profileId)$('#identity-profile').value=p.identity.profileId;
  $('#delivery-commitment').value=p?.deliveryAttestation||'';
  $('#refund-commitment').value=p?.preparedRefundCommitment||'';
  setText('#refund-state',p?.refunded?'Launchpad refund record complete.':
    p?.history?.length?'Refund principal delivery must be confirmed in 420Pay for each backing payment.':
    'No recorded contribution to refund.');
  let fulfillment='No contribution';
  if(p?.claimed!=='0')fulfillment='Claim recorded ('+p.claimed+' units)';
  else if(p?.sale.state==='SUCCEEDED')fulfillment=p.claimable?'Ready to claim ('+p.expectedClaim+' units)':
    p.deliveryAttestation?'Check claim start and settlement status':'Awaiting controller delivery attestation';
  else if(p?.contributed!=='0')fulfillment=p.sale.state==='ACTIVE'?'Campaign active':label(p.sale.state);
  setText('#fulfillment-state',fulfillment);
  setText('#dispute-state',p?.dispute?'Case '+p.dispute.caseId+' - '+p.dispute.state+
    (p.dispute.published?' (ruling published)':''):'No case linked to this campaign.');
  if(p?.dispute?.caseId)$('#dispute-case').value=p.dispute.caseId;
  renderHistory();renderRecovery();actionState();
}
function renderRecovery(){
  const node=$('#recovery-actions');node.replaceChildren();
  if(!state.position)return;
  for(const payment of state.position.history){
    if(BigInt(payment.refundPrincipalDelivered)>0n){
      const b=document.createElement('button');b.type='button';b.textContent='Reconcile delivered refund for '+payment.paymentId.slice(0,10);
      b.disabled=state.busy;b.addEventListener('click',()=>prepare('reconcile-refund',{paymentId:payment.paymentId}));node.append(b);
    }
  }
  if(state.checkout?.paymentId&&!state.checkout.recorded&&
    ['REFUNDED','PARTIALLY_REFUNDED'].includes(state.checkout.paymentStatus)){
    const b=document.createElement('button');b.type='button';b.textContent='Review unallocated payment refund recovery';
    b.addEventListener('click',()=>prepare('recover-unallocated',{paymentId:state.checkout.paymentId}));node.append(b);
  }
}
function renderDetail(){
  const c=state.selected;$('#detail').hidden=!c;if(!c)return;
  const live=state.position?.sale;
  for(const [s,v] of [['#detail-title',c.title],['#detail-summary',c.summary],['#detail-mode',label(c.mode)],
    ['#detail-state',label(live?.state||c.state)],['#detail-sale',c.saleId],['#detail-project',c.projectId],
    ['#detail-controller',state.position?.project?.controller||c.controller],['#detail-payment',live?.paymentAsset||c.paymentAsset],
    ['#detail-receiver',live?.proceedsReceiver||c.proceedsReceiver],['#detail-raised',live?.raised??c.raised],
    ['#detail-hardcap',live?.hardCap??c.hardCap],['#detail-remaining',state.position?.remaining??remaining(c)],
    ['#detail-softcap',live?.softCap??c.softCap],['#detail-policy',live?.eligibilityPolicyHash||c.eligibilityPolicyHash]])setText(s,v);
  renderPosition();
}
async function loadCampaigns(reset=true){
  if(!state.service)return;setBusy(true);status('Loading campaigns...');
  try{
    const filters=reset?state.filters:{...state.filters,cursor:state.cursor};
    const p=await state.service.campaigns(filters);
    if(!reset&&p.source.blockHash!==state.catalogHash)throw new Error('Campaign snapshot changed. Refresh your search.');
    state.campaigns=reset?(p.items||[]).map(normalizeCampaign):state.campaigns.concat((p.items||[]).map(normalizeCampaign));
    state.cursor=p.nextCursor;state.total=p.total??state.campaigns.length;state.catalogHash=p.source.blockHash;
    renderCampaigns();status(state.campaigns.length?'Campaigns loaded.':'No campaigns match your filters.');
  }catch(e){if(reset){state.campaigns=[];state.cursor=null;renderCampaigns();}status(e.message||String(e),true);}
  finally{setBusy(false);actionState();}
}
async function refreshPosition(){
  if(!state.wallet||!state.selected)return;
  const p=await state.service.position(state.selected.saleId,state.wallet.account);
  if(p.sale.saleId.toLowerCase()!==state.selected.saleId.toLowerCase()||p.source.chainId.toLowerCase()!==state.wallet.chainId.toLowerCase())
    throw new Error('canonical position identity or chain mismatch');
  state.position=p;renderDetail();
}
async function openCampaign(saleId){
  setBusy(true);status('Loading campaign...');
  try{
    const p=await state.service.campaign(saleId);state.selected=normalizeCampaign(p.campaign);
    state.position=null;state.checkout=null;state.quote=null;state.review=null;renderCheckout();renderQuote();
    if(state.wallet){
      await refreshPosition();
      const key='launchpad.tx.'+state.wallet.chainId+'.'+state.wallet.account.toLowerCase()+'.'+saleId.toLowerCase();
      const previous=localStorage.getItem(key);if(previous&&HASH.test(previous)){state.lastTx={hash:previous};setText('#tx-hash',previous);}
    }
    renderDetail();status('Campaign detail loaded. Check live chain position before signing.');
  }catch(e){status(e.message||String(e),true);}
  finally{setBusy(false);actionState();}
}
async function connect(){
  setBusy(true);
  try{state.wallet=await connectWallet(globalThis.ethereum);renderWallet();if(state.selected)await openCampaign(state.selected.saleId);
    status('Wallet connected. Review every transaction before signing.');}
  catch(e){status(e.message||String(e),true);}
  finally{setBusy(false);actionState();}
}
function showReview(r){
  state.review=r;$('#review').hidden=false;
  for(const [s,v] of [['#review-kind',r.kind],['#review-summary',r.summary],['#review-to',r.transaction.to],
    ['#review-value',r.transaction.value||'0x0'],['#review-data',r.transaction.data]])setText(s,v);
  const gate=executionGate({config:state.config,wallet:state.wallet,review:r});
  setText('#review-gate',gate.ok?'Ready for explicit Wallet approval':gate.reason);
  actionState();$('#review').scrollIntoView({behavior:'auto',block:'nearest'});
}
async function prepare(kind,payload={}){
  if(!state.selected||!state.wallet)return;
  setBusy(true);
  try{showReview(await state.service.prepare(kind,{saleId:state.selected.saleId,account:state.wallet.account,...payload}));
    status('Transaction prepared. Verify exact address, calldata and terms before approving.');}
  catch(e){status(e.message||String(e),true);}
  finally{setBusy(false);actionState();}
}
async function submit(){
  if(!state.review)return;setBusy(true);
  try{
    const tx=await submitReviewedTransaction({ethereum:globalThis.ethereum,config:state.config,wallet:state.wallet,review:state.review});
    if(!HASH.test(tx))throw new Error('Wallet transaction ID could not be validated; check Wallet activity before retrying.');
    state.lastTx={hash:tx,state:'PENDING'};state.review=null;
    const key='launchpad.tx.'+state.wallet.chainId+'.'+state.wallet.account.toLowerCase()+'.'+state.selected.saleId.toLowerCase();
    localStorage.setItem(key,tx);setText('#tx-hash',tx);setText('#tx-state','Submitted, not yet finalized.');
    status('Transaction submitted. Verify canonical receipt and refreshed state before retrying.');
  }catch(e){status(e.message||String(e),true);}
  finally{setBusy(false);actionState();}
}
async function checkTransaction(){
  if(!state.wallet||!state.lastTx)return;setBusy(true);
  try{
    const p=await state.service.transaction(state.lastTx.hash,state.wallet.account);
    if(p.source.chainId.toLowerCase()!==state.wallet.chainId.toLowerCase())throw new Error('transaction chain mismatch');
    state.lastTx={...state.lastTx,...p};setText('#tx-state',p.state);
    if(p.caseId){$('#dispute-case').value=p.caseId;setText('#next-recovery','Dispute case recovered from canonical CaseOpened event. Review linking it to the campaign.');}
    else setText('#next-recovery',['UNKNOWN','PENDING','REORGED'].includes(p.state)?
      'Outcome is not definitive. Check Wallet activity and canonical state before any resubmission.':
      p.state==='REVERTED'?'Transaction reverted. Recheck campaign terms before a new review.':
      'Verify the updated position and payment references before taking another action.');
    if(['CONFIRMED','FINALIZED'].includes(p.state))await refreshPosition();
    status('Canonical transaction: '+p.state);
  }catch(e){status(e.message||String(e),true);}
  finally{setBusy(false);actionState();}
}
async function checkConversion(){
  if(!state.selected||!state.wallet)return;setBusy(true);
  try{const q=await state.service.conversionQuote(state.selected.saleId,state.wallet.account,conversionTerms());
    if(q.source.chainId.toLowerCase()!==state.wallet.chainId.toLowerCase()||q.invoiceId!==state.checkout?.invoiceId||
      q.amount!==state.checkout.amount)throw new Error('420Pay conversion quote changed identity');
    state.quote=q;state.config={...state.config,registry:{...state.config.registry,
      payRouterAddress:q.paymentRouterAddress,approvedInputAsset:q.inputAsset}};
    renderQuote();status('420Pay conversion quote verified. Review exact token allowance, fee, slippage and Wallet gas.');
  }catch(e){state.quote=null;renderQuote();status(e.message||String(e),true);}
  finally{setBusy(false);actionState();}
}
async function checkCheckout(){
  if(!state.selected||!state.wallet)return;setBusy(true);
  try{
    const q=await state.service.checkout(state.selected.saleId,state.wallet.account,$('#contribution-amount').value,$('#intent-nonce').value);
    if(q.source.chainId.toLowerCase()!==state.wallet.chainId.toLowerCase())throw new Error('420Pay checkout chain mismatch');
    state.checkout=q;state.quote=null;renderCheckout();renderQuote();renderRecovery();status('Verified canonical 420Pay invoice and contribution status.');
  }catch(e){state.checkout=null;renderCheckout();status(e.message||String(e),true);}
  finally{setBusy(false);actionState();}
}
function newNonce(){
  if(!globalThis.crypto?.getRandomValues)throw new Error('secure nonce generation unavailable');
  const a=new Uint32Array(2);crypto.getRandomValues(a);const value=(BigInt(a[0])<<32n)|BigInt(a[1]);
  $('#intent-nonce').value=(value||1n).toString();state.checkout=null;state.quote=null;renderCheckout();renderQuote();actionState();
}
const CREATOR=new Set(['setCampaignMode','activate','finalize','cancel']);
async function creator(event){
  event.preventDefault();if(!state.wallet)return status('Connect wallet before creator requests.',true);
  const f=new FormData(event.currentTarget),action=String(f.get('action')||'');
  if(!CREATOR.has(action))return status('Unsupported creator request.',true);
  setBusy(true);
  try{const request=await state.service.creatorRequest({action,account:state.wallet.account,
    projectId:String(f.get('projectId')||''),saleId:String(f.get('saleId')||''),
    metadataHash:String(f.get('metadataHash')||''),mode:String(f.get('mode')||'')});
    setText('#creator-request-state',request.notice);
    status('Creator governance request prepared. No direct mutation authority was granted.');}
  catch(e){status(e.message||String(e),true);}
  finally{setBusy(false);actionState();}
}
async function boot(){
  try{
    const r=await fetch('./runtime-config.json',{cache:'no-store'});
    if(!r.ok)throw new Error('runtime configuration unavailable');
    state.config=validateRuntimeConfig(await r.json());renderRuntime();
    if(!state.config.api.baseUrl)return status('Launchpad runtime is not published yet. Discovery and execution remain fail-closed.');
    state.service=new LaunchpadService({baseUrl:state.config.api.baseUrl,expectedSchema:state.config.api.projectionSchema});
    const rt=await state.service.runtime();
    if(state.config.network.chainId&&rt.chainId.toLowerCase()!==state.config.network.chainId.toLowerCase())throw new Error('Launchpad service chain mismatch');
    state.config={...state.config,network:{...state.config.network,chainId:rt.chainId},
      registry:{...state.config.registry,launchpadRouterAddress:rt.launchpadRouterAddress,
        allocationRegistryAddress:rt.allocationRegistryAddress,crowdfundingIntegrationAddress:rt.crowdfundingIntegrationAddress,
        arbitrationCasesAddress:rt.arbitrationCasesAddress}};
    renderRuntime();await loadCampaigns();
  }catch(e){status(e.message||String(e),true);}
}
$('#connect-wallet')?.addEventListener('click',connect);
$('#refresh')?.addEventListener('click',()=>loadCampaigns(true));
$('#load-more')?.addEventListener('click',()=>loadCampaigns(false));
$('#campaign-filters')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);state.filters={
  search:String(f.get('search')||''),mode:String(f.get('mode')||''),state:String(f.get('state')||'')};loadCampaigns(true);});
$('#refresh-position')?.addEventListener('click',()=>refreshPosition().catch(e=>status(e.message,true)));
$('#new-intent')?.addEventListener('click',()=>{try{newNonce();}catch(e){status(e.message,true);}});
$('#contribution-amount')?.addEventListener('input',()=>{state.checkout=null;state.quote=null;renderCheckout();renderQuote();actionState();});
for(const id of ['#pay-input-asset','#pay-market','#pay-max-input','#pay-min-output'])$(id)?.addEventListener('input',()=>{state.quote=null;renderQuote();actionState();});
$('#get-conversion-quote')?.addEventListener('click',checkConversion);
$('#approve-conversion')?.addEventListener('click',()=>prepare('approve-conversion',conversionTerms()));
$('#pay-conversion')?.addEventListener('click',()=>prepare('pay-conversion',conversionTerms()));
$('#identity-profile')?.addEventListener('input',actionState);
$('#dispute-claim')?.addEventListener('input',actionState);
$('#dispute-remedy')?.addEventListener('input',actionState);
$('#bind-identity')?.addEventListener('click',()=>prepare('bind-identity',{profileId:$('#identity-profile').value.trim()}));
$('#register-intent')?.addEventListener('click',()=>prepare('register-intent',{amount:$('#contribution-amount').value,nonce:$('#intent-nonce').value}));
$('#check-checkout')?.addEventListener('click',checkCheckout);
$('#contribute')?.addEventListener('click',()=>prepare('contribute',{amount:$('#contribution-amount').value,paymentId:state.checkout?.paymentId}));
$('#claim')?.addEventListener('click',()=>prepare('claim',{deliveryCommitment:state.position?.deliveryAttestation}));
$('#refund')?.addEventListener('click',()=>prepare('refund',{}));
$('#record-refund')?.addEventListener('click',()=>prepare('refund',{refundCommitment:state.position?.preparedRefundCommitment}));
$('#open-dispute')?.addEventListener('click',()=>prepare('open-dispute',{claimHash:$('#dispute-claim').value.trim(),requestedRemedyHash:$('#dispute-remedy').value.trim()}));
$('#link-dispute')?.addEventListener('click',()=>prepare('link-dispute',{caseId:$('#dispute-case').value.trim()}));
$('#publish-outcome')?.addEventListener('click',()=>prepare('publish-outcome',{}));
$('#submit-review')?.addEventListener('click',submit);
$('#refresh-tx')?.addEventListener('click',checkTransaction);
$('#close-review')?.addEventListener('click',()=>{$('#review').hidden=true;state.review=null;actionState();});
$('#creator-form')?.addEventListener('submit',creator);
globalThis.ethereum?.on?.('accountsChanged',()=>{state.wallet=null;state.position=null;state.checkout=null;state.review=null;state.lastTx=null;renderWallet();renderDetail();actionState();status('Wallet account changed. Reconnect before signing.',true);});
globalThis.ethereum?.on?.('chainChanged',()=>{state.wallet=null;state.position=null;state.checkout=null;state.review=null;state.lastTx=null;renderWallet();renderDetail();actionState();status('Wallet chain changed. Reconnect before signing.',true);});
boot();
