import {
  createGovernance420Client,
  createGovernanceIndexer420,
  classifyGovernance420Error,
  GOVERNANCE420_HOUSES,
  GOVERNANCE420_SUPPORT,
} from './core/governance-management.js';
import { InjectedProvider420 } from './core/provider.js';

let context=null;
let selected=null;
let busy=false;
let lifecycleBound=false;
const $=(selector)=>document.querySelector(selector);
const fmt=(value)=>value==null?'—':String(value);
const pct=(bps)=>`${(Number(bps)/100).toFixed(2)}%`;

export function governanceMarkup(){
  return `
  <section id="governance-management-panel" class="panel" aria-labelledby="governance-management-heading">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Canonical 420 Civic · chain-authoritative voting</p>
        <h2 id="governance-management-heading">420 Governance</h2>
        <p class="muted">Inspect frozen proposal state and submit a ballot without trusting Wallet or Indexer as governance authority.</p>
      </div>
      <span id="governance-app-state" class="status-pill" data-state="idle">Not connected</span>
    </div>

    <div class="account-card governance-context" aria-live="polite">
      <div><p class="label">Connected account</p><strong id="governance-account">—</strong></div>
      <div><p class="label">Civic Governor</p><strong id="governance-governor">—</strong></div>
      <div><p class="label">Network</p><strong id="governance-network">—</strong></div>
      <button id="governance-connect" type="button">Connect / verify Governance</button>
    </div>

    <div class="governance-grid">
      <div class="form-card">
        <div class="section-heading">
          <div><p class="eyebrow">Indexer discovery · chain verified</p><h3>Proposals</h3></div>
          <button id="governance-refresh" type="button" disabled>Refresh</button>
        </div>
        <div id="governance-proposal-list" class="governance-proposal-list" aria-live="polite">
          <p class="muted">Connect to load proposals.</p>
        </div>
      </div>

      <div class="form-card">
        <p class="eyebrow">Canonical chain state</p>
        <h3>Proposal detail</h3>
        <dl class="governance-detail-list" aria-live="polite">
          <div><dt>Proposal ID</dt><dd id="governance-proposal-id">—</dd></div>
          <div><dt>Class / revision</dt><dd id="governance-class-revision">—</dd></div>
          <div><dt>State</dt><dd id="governance-state">—</dd></div>
          <div><dt>Voting window</dt><dd id="governance-window">—</dd></div>
          <div><dt>Actions hash</dt><dd id="governance-actions-hash">—</dd></div>
          <div><dt>Required houses</dt><dd id="governance-required-houses">—</dd></div>
          <div><dt>Community electorate</dt><dd id="governance-community-electorate">—</dd></div>
          <div><dt>Validator electorate</dt><dd id="governance-validator-electorate">—</dd></div>
          <div><dt>Community thresholds</dt><dd id="governance-community-thresholds">—</dd></div>
          <div><dt>Validator thresholds</dt><dd id="governance-validator-thresholds">—</dd></div>
          <div><dt>Community tally</dt><dd id="governance-community-tally">—</dd></div>
          <div><dt>Validator tally</dt><dd id="governance-validator-tally">—</dd></div>
        </dl>
        <p class="muted">Tallies are live convenience projections. Proposal state, frozen rules, electorates and submitted ballots are read directly from Civic contracts.</p>
      </div>
    </div>

    <div class="split-panel">
      <div class="form-card">
        <p class="eyebrow">Commitment review</p>
        <h3>Review action batch</h3>
        <label><span class="label">Candidate actions JSON</span><textarea id="governance-actions-json" rows="7" spellcheck="false" placeholder='[{"target":"0x…","value":"0","data":"0x…"}]'></textarea></label>
        <button id="governance-review-actions" type="button" disabled>Verify against committed hash</button>
        <div id="governance-action-review" class="governance-action-review" aria-live="polite"><p class="muted">No action batch loaded. Wallet will not infer missing actions from the commitment hash.</p></div>
      </div>

      <div class="form-card">
        <p class="eyebrow">Connected-account ballot</p>
        <h3>Vote</h3>
        <label><span class="label">House</span><select id="governance-house"><option value="0">Community</option><option value="1">Validator</option></select></label>
        <label><span class="label">Electorate proof data (hex)</span><textarea id="governance-proof" rows="3" spellcheck="false">0x</textarea></label>
        <button id="governance-check-eligibility" type="button" disabled>Check eligibility / weight</button>
        <div id="governance-eligibility" class="security-check" role="status" aria-live="polite"><span aria-hidden="true">•</span><p><strong>Not checked</strong><small>Eligibility is resolved against the frozen electorate source.</small></p></div>
        <div class="button-row governance-vote-buttons" role="group" aria-label="Governance vote choice">
          <button data-governance-support="1" type="button" class="primary-action" disabled>FOR</button>
          <button data-governance-support="0" type="button" disabled>AGAINST</button>
          <button data-governance-support="2" type="button" disabled>ABSTAIN</button>
        </div>
      </div>
    </div>

    <div id="governance-transaction-state" class="security-check" role="status" aria-live="polite">
      <span aria-hidden="true">✓</span><p><strong>Ready</strong><small>Votes are simulated, gas-estimated and revalidated before wallet approval. Failed or uncertain submissions are never auto-resubmitted.</small></p>
    </div>
    <p id="governance-error-recovery" class="muted" role="alert" aria-live="assertive"></p>
  </section>`;
}

function setAppState(label,state='idle'){const el=$('#governance-app-state');if(el){el.textContent=label;el.dataset.state=state;}}
function setTx(title,detail,state='idle'){const el=$('#governance-transaction-state');if(!el)return;el.querySelector('strong').textContent=title;el.querySelector('small').textContent=detail;el.dataset.state=state;}
function setBusy(value){
  busy=value;
  document.querySelectorAll('#governance-management-panel button').forEach((button)=>{
    if(button.id==='governance-connect')button.disabled=value;
    else button.disabled=value||!context||(!selected&&button.id!=='governance-refresh');
  });
}
function clearDetail(){
  selected=null;
  for(const id of ['#governance-proposal-id','#governance-class-revision','#governance-state','#governance-window','#governance-actions-hash','#governance-required-houses','#governance-community-electorate','#governance-validator-electorate','#governance-community-thresholds','#governance-validator-thresholds','#governance-community-tally','#governance-validator-tally'])$(id).textContent='—';
}
function invalidate(reason){
  context=null;clearDetail();setAppState('Reload required');setTx('Wallet state changed',reason);
  $('#governance-error-recovery').textContent='Recovery: reconnect and reload canonical Governance state before continuing.';
  setBusy(false);
}
async function loadRuntime(){
  const response=await fetch('./runtime-config.json',{cache:'no-store'});
  if(!response.ok)throw new Error(`runtime config ${response.status}`);
  const config=await response.json();
  if(!config?.network?.chainId)throw new Error('Governance requires a qualified chain-specific runtime');
  if(config?.governance?.discovery?.source!=='protocol-registry')throw new Error('Governance requires canonical ProtocolRegistry discovery');
  if(!config?.governance?.indexerUrl)throw new Error('Governance requires a qualified Indexer endpoint for proposal discovery');
  return config;
}
function renderTally(tally){
  if(!tally)return'Not required';
  return `FOR ${tally.forVotes} · AGAINST ${tally.againstVotes} · ABSTAIN ${tally.abstainVotes} · quorum ${tally.quorumMet?'met':'not met'} · approval ${tally.approvalMet?'met':'not met'}`;
}
function renderDetail(detail){
  selected=detail;
  $('#governance-proposal-id').textContent=detail.proposalId;
  $('#governance-class-revision').textContent=`${detail.className} · constitution r${detail.frozenRule.constitutionRevision}`;
  $('#governance-state').textContent=detail.state;
  $('#governance-window').textContent=`blocks ${detail.voteStart} – ${detail.voteEnd} · snapshot ${detail.snapshotBlock}`;
  $('#governance-actions-hash').textContent=detail.actionsHash;
  $('#governance-required-houses').textContent=detail.electorate.dualHouseRequired?'Community + Validator':'Community';
  $('#governance-community-electorate').textContent=`${detail.electorate.community.totalWeight} weight · source rev ${detail.electorate.community.sourceRevision} · root ${detail.electorate.community.electorateRoot}`;
  $('#governance-validator-electorate').textContent=detail.electorate.dualHouseRequired?`${detail.electorate.validator.totalWeight} weight · source rev ${detail.electorate.validator.sourceRevision} · root ${detail.electorate.validator.electorateRoot}`:'Not required';
  $('#governance-community-thresholds').textContent=`quorum ${pct(detail.frozenRule.communityQuorumBps)} · approval ${pct(detail.frozenRule.communityApprovalBps)}`;
  $('#governance-validator-thresholds').textContent=detail.electorate.dualHouseRequired?`quorum ${pct(detail.frozenRule.validatorQuorumBps)} · approval ${pct(detail.frozenRule.validatorApprovalBps)}`:'Not required';
  $('#governance-community-tally').textContent=renderTally(detail.tallies.community);
  $('#governance-validator-tally').textContent=renderTally(detail.tallies.validator);
  setBusy(false);
}
async function refreshList(){
  const root=$('#governance-proposal-list');root.innerHTML='<p class="muted">Loading canonical proposal state…</p>';
  const proposals=await context.client.listProposals(100);
  root.replaceChildren();
  if(!proposals.length){root.innerHTML='<p class="muted">No canonical Civic proposals were returned by the Indexer.</p>';return;}
  for(const proposal of proposals){
    const button=document.createElement('button');button.type='button';button.className='governance-proposal-row';
    button.innerHTML=`<strong>${proposal.className} · ${proposal.state}</strong><span>${proposal.proposalId}</span><small>vote blocks ${proposal.voteStart}–${proposal.voteEnd}</small>`;
    button.addEventListener('click',async()=>withRecovery(button,async()=>renderDetail(await context.client.proposal(proposal.proposalId))));
    root.append(button);
  }
}
async function connect(){
  if(!globalThis.ethereum)throw new Error('No injected EIP-1193 wallet found');
  const config=await loadRuntime();
  const provider=new InjectedProvider420(globalThis.ethereum);
  let accounts=await provider.request('eth_accounts');
  if(!Array.isArray(accounts)||!accounts.length)accounts=await provider.requestAccounts();
  if(!Array.isArray(accounts)||!accounts.length)throw new Error('No account authorized for 420 Governance');
  const account=accounts[0].toLowerCase();
  const indexer=createGovernanceIndexer420({baseUrl:config.governance.indexerUrl});
  const client=createGovernance420Client({provider,chainId:config.network.chainId,account,discovery:config.governance.discovery,indexer});
  await client.verifySession();
  context=Object.freeze({config,provider,account,client});
  if(!lifecycleBound){
    provider.on('accountsChanged',()=>invalidate('The connected wallet account changed.'));
    provider.on('chainChanged',()=>invalidate('The connected wallet network changed.'));
    lifecycleBound=true;
  }
  $('#governance-account').textContent=account;
  $('#governance-governor').textContent=client.modules.governor;
  $('#governance-network').textContent=config.network.name||config.network.chainId;
  setAppState('Verified','passed');setTx('Civic graph verified','Chain, code, identity, version and module bindings passed preflight.','passed');
  await refreshList();
  setBusy(false);
}
async function withRecovery(button,action){
  if(busy)return;setBusy(true);$('#governance-error-recovery').textContent='';
  try{await action();}
  catch(error){
    const classified=classifyGovernance420Error(error);setAppState('Action blocked');setTx('Action blocked',classified.message);
    $('#governance-error-recovery').textContent=`Recovery: ${classified.retryable?'reload current account/network/proposal state and retry. ':''}${classified.message}`;
    button?.focus();
  }finally{setBusy(false);}
}
async function checkEligibility(){
  if(!selected)throw new Error('Select a Governance proposal first');
  const house=Number($('#governance-house').value),proofData=$('#governance-proof').value.trim()||'0x';
  const result=await context.client.eligibility(selected.proposalId,house,proofData);
  const root=$('#governance-eligibility');
  root.querySelector('strong').textContent=result.eligible?`Eligible · weight ${result.weight}`:'Not eligible';
  root.querySelector('small').textContent=result.eligible?`${GOVERNANCE420_HOUSES[house]} house · frozen snapshot weight`:fmt(result.reason);
  root.dataset.state=result.eligible?'passed':'idle';
  document.querySelectorAll('[data-governance-support]').forEach((button)=>button.disabled=busy||!result.eligible);
  return result;
}
async function submitVote(button){
  if(!selected)throw new Error('Select a Governance proposal first');
  const support=Number(button.dataset.governanceSupport),house=Number($('#governance-house').value),proofData=$('#governance-proof').value.trim()||'0x';
  const eligibility=await checkEligibility();if(!eligibility.eligible)throw new Error('connected account is not eligible to vote');
  const label=GOVERNANCE420_SUPPORT[support];
  if(globalThis.confirm&&!globalThis.confirm(`Submit ${label} vote in the ${GOVERNANCE420_HOUSES[house]} house with weight ${eligibility.weight}? Wallet will revalidate before approval.`))return;
  setAppState('Submitting','pending');setTx('Preflighting vote','Simulating, estimating gas, and revalidating account/network/weight.','pending');
  const submitted=await context.client.sendVote({proposalId:selected.proposalId,house,support,proofData});
  setAppState('Submitted','pending');setTx('Vote submitted',`${submitted.txHash} · waiting for confirmation`,'pending');
  const outcome=await context.client.confirmVote(submitted);
  if(outcome.state==='confirmed'){
    setAppState('Confirmed','passed');setTx('Vote confirmed',outcome.txHash,'passed');
    renderDetail(await context.client.proposal(selected.proposalId));await checkEligibility();
  }else if(outcome.state==='failed'){
    setAppState('Failed');setTx('Vote failed','Transaction reverted. Nothing will be automatically resubmitted.');
  }else if(outcome.state==='replaced'){
    setAppState('Replaced','pending');setTx('Vote transaction replaced',`Replacement: ${outcome.replacementHash}. Reload chain state before retrying.`,'pending');
  }else{
    setAppState('Pending','pending');setTx('Confirmation uncertain',`${outcome.txHash} is still pending. Do not resubmit until chain state is reloaded.`,'pending');
  }
}
function reviewActions(){
  if(!selected)throw new Error('Select a Governance proposal first');
  let actions;try{actions=JSON.parse($('#governance-actions-json').value);}catch{throw new Error('Action batch must be valid JSON');}
  return context.client.reviewActionBatch(selected.proposalId,actions,context.config.governance.abiMetadata||{}).then((review)=>{
    const root=$('#governance-action-review');root.replaceChildren();
    const summary=document.createElement('p');summary.className='muted';summary.textContent=review.fullyDecoded?'Commitment matched and all actions decoded with qualified ABI metadata.':'Commitment matched, but one or more actions lack ABI metadata. Review remains read-only and explicitly undecoded.';
    root.append(summary);
    for(const action of review.actions){
      const item=document.createElement('div');item.className='governance-action-row';
      item.textContent=action.decoded?`#${action.index} ${action.target} · ${action.decoded.signature||action.selector} · value ${action.value}`:`#${action.index} ${action.target} · ${action.selector} · WARNING: ${action.warning}`;
      root.append(item);
    }
  });
}
export function installGovernance420Ui(){
  if($('#governance-management-panel'))return;
  const main=document.querySelector('main.shell')||document.querySelector('main');if(!main)return;
  const anchor=$('#services-section')||$('#status');const wrapper=document.createElement('div');wrapper.innerHTML=governanceMarkup();
  const panel=wrapper.firstElementChild;if(anchor)main.insertBefore(panel,anchor);else main.append(panel);
  $('#governance-connect').addEventListener('click',(e)=>withRecovery(e.currentTarget,connect));
  $('#governance-refresh').addEventListener('click',(e)=>withRecovery(e.currentTarget,refreshList));
  $('#governance-check-eligibility').addEventListener('click',(e)=>withRecovery(e.currentTarget,checkEligibility));
  $('#governance-review-actions').addEventListener('click',(e)=>withRecovery(e.currentTarget,reviewActions));
  $('#governance-house').addEventListener('change',()=>{$('#governance-eligibility').querySelector('strong').textContent='Not checked';document.querySelectorAll('[data-governance-support]').forEach((button)=>button.disabled=true);});
  $('#governance-proof').addEventListener('input',()=>{document.querySelectorAll('[data-governance-support]').forEach((button)=>button.disabled=true);});
  document.querySelectorAll('[data-governance-support]').forEach((button)=>button.addEventListener('click',(e)=>withRecovery(e.currentTarget,()=>submitVote(e.currentTarget))));
}
if(typeof document!=='undefined')installGovernance420Ui();
