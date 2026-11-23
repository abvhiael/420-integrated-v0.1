// Wallet-integrated 420Arbitration app. Never create a signer, infer case authority,
// publish private evidence, claim settlement, or render a tx successful before receipt.
import {InjectedProvider420} from './core/provider.js';
import {createArbitrationApplication420} from './core/arbitration-application.js';
import {createArbitrationEvidenceWorkspace420} from './core/arbitration-evidence-workspace.js';
import {ARBITRATION_EVIDENCE_MAX_BYTES_420} from './core/arbitration-evidence.js';

const $=q=>document.querySelector(q);
const full=(x)=>x==null?'—':String(x);
const short=x=>typeof x==='string'&&x.length>24?x.slice(0,12)+'…'+x.slice(-9):full(x);
const safeText=e=>String(e?.message||e||'Unavailable').slice(0,320);
const A=/^0x[0-9a-fA-F]{40}$/;
const H=/^0x[0-9a-fA-F]{64}$/;
const buttons=['openCase','submitEvidence','appeal','submitRuling','finalizeRuling'];
const buttonNames={openCase:'Open case',submitEvidence:'Submit evidence',appeal:'Appeal ruling',
  submitRuling:'Submit ruling',finalizeRuling:'Finalize ruling'};
const formIds={openCase:'arbitration-open-form',submitEvidence:'arbitration-evidence-form',
  submitRuling:'arbitration-ruling-form'};
const e=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=String(text);return node;};
const date=v=>v==null||BigInt(v)===0n?'—':new Date(Number(BigInt(v))*1000).toLocaleString();
const loadKey=(chain,account)=>'420wallet/arbitration/pending/'+chain+'/'+account.toLowerCase();

export function arbitrationMarkup420(){
  return `
  <section id="arbitration-management-panel" class="panel arbitration-app" aria-labelledby="arbitration-heading">
    <div class="section-heading"><div>
      <p class="eyebrow">Canonical Registry · Wallet-integrated Genesis app</p>
      <h2 id="arbitration-heading">420 Arbitration</h2>
      <p class="muted">Track disputes, submit commitments, inspect rulings and complete appeals. Arbitrators cannot transfer funds or enforce remedies through Arbitration.</p>
    </div><span id="arbitration-runtime-state" class="status-pill" data-state="idle">Not connected</span></div>
    <div class="arbitration-toolbar" role="group" aria-label="Arbitration navigation">
      <button type="button" class="ghost-button" data-arbitration-view="dashboard">Dashboard</button>
      <button type="button" class="ghost-button" data-arbitration-view="open">Open case</button>
      <button type="button" class="ghost-button" data-arbitration-view="details">Case details</button>
      <button type="button" class="ghost-button" data-arbitration-view="resolver">Resolver workspace</button>
      <button type="button" class="ghost-button" data-arbitration-view="history">Case history</button>
    </div>
    <div class="arbitration-connected">
      <div><span class="label">Wallet account</span><strong id="arbitration-account" class="arbitration-break">Not connected</strong></div>
      <div><span class="label">Network</span><strong id="arbitration-chain">—</strong></div>
      <div><span class="label">Verified Router</span><strong id="arbitration-router" class="arbitration-break">—</strong></div>
      <button type="button" id="arbitration-connect" class="primary-action">Verify Arbitration</button>
    </div>
    <p id="arbitration-message" role="status" aria-live="polite">Wallet connection and approved Arbitration release are required.</p>
    <section id="arbitration-view-dashboard" class="arbitration-view" aria-labelledby="arbitration-dashboard-heading">
      <div class="section-heading"><h3 id="arbitration-dashboard-heading">Dispute dashboard</h3>
        <div class="button-row"><button type="button" id="arbitration-refresh" disabled>Refresh cases</button>
          <button type="button" id="arbitration-more" disabled>Load earlier cases</button></div>
      </div>
      <div class="arbitration-stats" role="status" aria-live="polite">
        <div>Active disputes<strong id="arbitration-active-count">0</strong></div>
        <div>Completed disputes<strong id="arbitration-completed-count">0</strong></div>
        <div>Assigned to resolver<strong id="arbitration-assigned-count">0</strong></div>
      </div>
      <p class="muted">Case records are checked on-chain against canonical CaseOpened logs. Older blocks can be loaded in pages; no Indexer is treated as authority.</p>
      <div id="arbitration-case-list" class="arbitration-list" aria-live="polite">No verified cases loaded.</div>
    </section>
    <section id="arbitration-view-open" class="arbitration-view" hidden aria-labelledby="arbitration-open-heading">
      <h3 id="arbitration-open-heading">Open a case</h3>
      <p class="muted">Only active, governance-configured domains can be used. Input commitments are hashes, never public evidence documents. Contract charges no separate arbitration fee; Wallet gas applies.</p>
      <form id="arbitration-open-form" class="arbitration-form">
        <label>Dispute domain<select name="domainId" id="arbitration-domain" required></select></label>
        <label>Respondent address<input name="respondent" autocomplete="off" required spellcheck="false" placeholder="0x…"/></label>
        <label>Originating protocol/component ID (bytes32)<input name="originComponentId" required spellcheck="false" placeholder="0x…"/></label>
        <label>Originating transaction/object ID (bytes32)<input name="originObjectId" required spellcheck="false" placeholder="0x…"/></label>
        <label>Claim evidence commitment (bytes32)<input name="claimHash" required spellcheck="false" placeholder="0x…"/></label>
        <label>Requested remedy commitment (bytes32)<input name="requestedRemedyHash" required spellcheck="false" placeholder="0x…"/></label>
        <button type="submit" class="primary-action" disabled>Simulate and review opening case</button>
      </form>
    </section>
    <section id="arbitration-view-details" class="arbitration-view" hidden aria-labelledby="arbitration-details-heading">
      <h3 id="arbitration-details-heading">Case details and permissions</h3>
      <form id="arbitration-lookup-form" class="arbitration-search">
        <label>Case identifier (bytes32)<input id="arbitration-case-lookup" name="caseId" required placeholder="0x…" spellcheck="false"/></label>
        <button type="submit" class="ghost-button" disabled>Read case on-chain</button>
      </form>
      <dl id="arbitration-case-details" class="arbitration-detail-grid" aria-live="polite"><div><dt>No case selected</dt><dd>Choose an existing dispute or enter its ID.</dd></div></dl>
      <div class="button-row" id="arbitration-action-buttons" role="group" aria-label="Case actions"></div>
      <div id="arbitration-evidence" class="arbitration-workform" hidden>
        <h4>Submit evidence commitment</h4><p class="muted">Evidence payloads stay off-chain. Only the 32-byte hash is committed. Only case parties may submit within the round window.</p>
        <div class="arbitration-private-evidence">
          <p class="eyebrow">Private file · local encryption only</p>
          <p class="muted">Choose a file (maximum 8 MiB) to create a random-salted, case/round-bound evidence commitment. The contents never enter chain calldata. Keep the encrypted capsule and recovery key separately; losing either prevents decryption.</p>
          <label>Private evidence file<input id="arbitration-private-file" type="file" autocomplete="off"/></label>
          <button id="arbitration-seal-file" type="button">Encrypt file and generate commitment</button>
          <p id="arbitration-seal-status" role="status" aria-live="polite">No private file prepared.</p>
          <button type="button" id="arbitration-export-sealed" disabled>Download encrypted evidence capsule</button>
          <button type="button" id="arbitration-show-secret" disabled>Reveal private recovery key</button>
          <label id="arbitration-recovery-label" hidden>Private recovery key — copy and store securely, never share publicly
            <input id="arbitration-private-recovery" type="text" readonly autocomplete="off" spellcheck="false"/>
          </label>
        </div>
        <form id="arbitration-evidence-form"><label>Public evidence commitment (bytes32)<input name="evidenceHash" required spellcheck="false" placeholder="0x…"/></label>
          <button type="submit" class="primary-action">Simulate and review evidence</button></form>
      </div>
      <div id="arbitration-ruling" class="arbitration-workform" hidden>
        <h4>Authorized resolver — submit ruling</h4>
        <form id="arbitration-ruling-form">
          <label>Outcome code (positive integer)<input name="outcomeCode" type="number" min="1" max="4294967295" step="1" required/></label>
          <label>Ruling / reasoning commitment (bytes32)<input name="rulingHash" required spellcheck="false" placeholder="0x…"/></label>
          <label>Remedy commitment (bytes32)<input name="remedyCommitment" required spellcheck="false" placeholder="0x…"/></label>
          <label>Optional panel commitment (bytes32)<input name="panelCommitment" spellcheck="false" placeholder="0x… (optional)"/></label>
          <button type="submit" class="primary-action">Simulate and review ruling</button>
        </form>
      </div>
      <section class="arbitration-private-evidence" aria-labelledby="arbitration-inspect-heading">
        <h4 id="arbitration-inspect-heading">Verify private evidence against this case</h4>
        <p class="muted">The capsule stays local. Inspection requires the exact on-chain evidence commitment, case, round and original submitter. Private contents are never displayed or fetched automatically.</p>
        <form id="arbitration-inspection-form">
          <label>Committed evidence hash (bytes32)<input name="commitment" required spellcheck="false"/></label>
          <label>Original evidence submitter (address)<input name="submitter" required spellcheck="false"/></label>
          <label>Evidence round<input name="round" type="number" min="0" max="3" required/></label>
          <label>Encrypted evidence capsule (JSON)<input name="capsule" type="file" accept=".json,application/json" required/></label>
          <label>Private recovery key<input name="recoveryKey" type="password" autocomplete="off" required spellcheck="false"/></label>
          <button type="submit" class="primary-action">Verify case binding and decrypt locally</button>
        </form>
        <p id="arbitration-inspection-status" role="status" aria-live="polite">No private evidence opened.</p>
        <button type="button" id="arbitration-export-verified" disabled>Download verified private evidence</button>
      </section>
      <section aria-label="Rulings and appeals"><h4>Rulings and appeal eligibility</h4>
        <div id="arbitration-rulings" class="arbitration-list">No case selected.</div></section>
    </section>
    <section id="arbitration-view-resolver" class="arbitration-view" hidden aria-labelledby="arbitration-resolver-heading">
      <h3 id="arbitration-resolver-heading">Resolver workspace</h3>
      <p class="muted">Assigned cases are determined from the current on-chain resolver snapshot, not from a claimed role or an Indexer permission.</p>
      <div id="arbitration-resolver-list" class="arbitration-list" aria-live="polite">Connect to inspect assigned cases.</div>
    </section>
    <section id="arbitration-view-history" class="arbitration-view" hidden aria-labelledby="arbitration-history-heading">
      <h3 id="arbitration-history-heading">Canonical case history</h3>
      <p class="muted">Events are checked against canonical block hashes. Only on-chain commitments are shown; no private evidence is fetched or uploaded.</p>
      <ol id="arbitration-timeline" class="arbitration-timeline" aria-live="polite"><li>Select a case to load its history.</li></ol>
    </section>
    <section id="arbitration-review-panel" class="arbitration-review" hidden aria-labelledby="arbitration-review-heading">
      <h3 id="arbitration-review-heading">Review Wallet transaction</h3>
      <dl id="arbitration-review-details" class="arbitration-detail-grid"></dl>
      <p class="muted">Simulation and gas are estimates, not execution. Check the exact target, account, contract call and fee. The connected Wallet must explicitly approve the transaction.</p>
      <div class="button-row">
        <button type="button" id="arbitration-authorize" class="primary-action">Confirm review and request Wallet approval</button>
        <button type="button" id="arbitration-cancel" class="ghost-button">Cancel</button>
      </div>
    </section>
    <section class="arbitration-recovery" aria-labelledby="arbitration-recovery-heading">
      <h3 id="arbitration-recovery-heading">Transaction and recovery</h3>
      <p id="arbitration-tx-status" role="status" aria-live="polite">No transaction submitted.</p>
      <div class="button-row"><button id="arbitration-check-receipt" type="button" disabled>Check canonical receipt</button>
        <button id="arbitration-reconnect" type="button">Reverify Wallet / resume</button></div>
      <p id="arbitration-error" role="alert" aria-live="assertive"></p>
    </section>
  </section>`;
}

let context=null,current=null,cases=new Map(),cursor=null,quote=null,pending=null,busy=false,serial=0,view='dashboard';
let evidenceWorkspace=null,sealedEvidence=null,inspectedEvidence=null;
let connectedIdentity=null;
const one=q=>$(q);
const setText=(selector,text)=>{const node=one(selector);if(node)node.textContent=String(text);};
const setStatus=(message,isError=false)=>{
  setText('#arbitration-message',message);
  const state=one('#arbitration-runtime-state');
  if(state){state.textContent=isError?'Verification failed':context?'Verified':'Not connected';state.dataset.state=isError?'blocked':context?'passed':'idle';}
  setText('#arbitration-error',isError?message:'');
};
const detailField=(name,value)=>{
  const row=e('div'),key=e('dt',null,name),val=e('dd','arbitration-break',value);
  row.append(key,val);return row;
};
function show(next){
  view=next;
  for(const v of ['dashboard','open','details','resolver','history'])
    one('#arbitration-view-'+v).hidden=v!==next;
  for(const button of document.querySelectorAll('[data-arbitration-view]'))
    button.setAttribute('aria-pressed',String(button.dataset.arbitrationView===next));
  one('#arbitration-view-'+next).scrollIntoView?.({block:'nearest'});
}
function clearQuote(){
  quote=null;
  one('#arbitration-review-panel').hidden=true;
}
function reset(reason){
  ++serial;
  if(context){context.dispose();context=null;}
  evidenceWorkspace=null;sealedEvidence=null;
  if(inspectedEvidence){inspectedEvidence.fill(0);inspectedEvidence=null;}
  one('#arbitration-private-recovery').value='';
  one('#arbitration-recovery-label').hidden=true;
  one('#arbitration-private-file').value='';
  one('#arbitration-inspection-form').reset();
  one('#arbitration-export-sealed').disabled=true;
  one('#arbitration-show-secret').disabled=true;
  one('#arbitration-export-verified').disabled=true;
  setText('#arbitration-seal-status','No private file prepared.');
  setText('#arbitration-inspection-status','No private evidence opened.');
  current=null;cases.clear();cursor=null;clearQuote();busy=false;connectedIdentity=null;
  setText('#arbitration-account','Not connected');setText('#arbitration-router','—');
  setText('#arbitration-chain','—');setText('#arbitration-case-list','No verified cases loaded.');
  setText('#arbitration-resolver-list','Connect to inspect assigned cases.');
  setText('#arbitration-tx-status','No transaction submitted.');
  setText('#arbitration-active-count',0);setText('#arbitration-completed-count',0);setText('#arbitration-assigned-count',0);
  setText('#arbitration-case-details','No case selected.');
  setText('#arbitration-rulings','No case selected.');
  setText('#arbitration-timeline','');
  one('#arbitration-action-buttons').replaceChildren();
  one('#arbitration-evidence').hidden=true;one('#arbitration-ruling').hidden=true;
  one('#arbitration-domain').replaceChildren();
  pending=null;
  updateButtons();setStatus(reason||'Connect Wallet and verify the Arbitration release.');
}
function updateButtons(){
  for(const button of one('#arbitration-management-panel').querySelectorAll('button')){
    if(button.id==='arbitration-connect'||button.id==='arbitration-reconnect'||button.dataset.arbitrationView)button.disabled=busy;
  }
  one('#arbitration-refresh').disabled=busy||!context;
  one('#arbitration-more').disabled=busy||!context||cursor===null;
  one('#arbitration-check-receipt').disabled=busy||!context||!pending;
  one('#arbitration-open-form button[type=submit]').disabled=busy||!context||!one('#arbitration-domain').options.length;
  one('#arbitration-lookup-form button[type=submit]').disabled=busy||!context;
  one('#arbitration-evidence-form button[type=submit]').disabled=busy||!context||!current?.permissions.evidence;
  one('#arbitration-ruling-form button[type=submit]').disabled=busy||!context||!current?.permissions.rule;
  one('#arbitration-inspection-form button[type=submit]').disabled=busy||!context||!current;
  one('#arbitration-seal-file').disabled=busy||!evidenceWorkspace||!current?.permissions.evidence;
  one('#arbitration-export-sealed').disabled=busy||!sealedEvidence;
  one('#arbitration-show-secret').disabled=busy||!sealedEvidence;
  one('#arbitration-export-verified').disabled=busy||!inspectedEvidence;
  one('#arbitration-authorize').disabled=busy||!quote;
  for(const button of one('#arbitration-action-buttons').querySelectorAll('button'))button.disabled=busy;
}
async function operation(fn){
  if(busy)return;
  busy=true;const stamp=serial;updateButtons();
  try{await fn();}catch(error){if(serial===stamp){
    const text=safeText(error);
    if(/rejected|denied|cancel/i.test(text))setText('#arbitration-tx-status','Wallet request rejected or cancelled. No success has been recorded.');
    setStatus(text,true);
  }}finally{if(serial===stamp){busy=false;updateButtons();}}
}
function renderList(){
  const list=one('#arbitration-case-list'),resolver=one('#arbitration-resolver-list');
  list.replaceChildren();resolver.replaceChildren();
  const entries=[...cases.values()].sort((a,b)=>a.openedAt===b.openedAt?0:a.openedAt>b.openedAt?-1:1);
  const active=entries.filter(x=>x.state!=='FINALIZED');
  setText('#arbitration-active-count',active.length);
  setText('#arbitration-completed-count',entries.length-active.length);
  setText('#arbitration-assigned-count',entries.filter(x=>x.permissions.rule).length);
  for(const record of entries){
    const row=e('button','arbitration-case-row'),heading=e('strong',null,short(record.id)),
      description=e('span',null,`${record.role} · ${record.state} · round ${record.round} · ${record.state==='OPEN'?'Evidence deadline '+date(record.evidenceDeadline):record.state==='RULED'?'Appeal deadline '+date(record.appealDeadline):'Finalized'}`);
    row.type='button';row.append(heading,description);row.addEventListener('click',()=>operation(()=>selectCase(record.id)));
    list.append(row);
    if(record.permissions.rule){
      const resolverRow=row.cloneNode(true);resolverRow.addEventListener('click',()=>operation(()=>selectCase(record.id)));
      resolver.append(resolverRow);
    }
  }
  if(!entries.length)list.append(e('p','muted','No disputes for this account in the loaded on-chain event range.'));
  if(!resolver.children.length)resolver.append(e('p','muted','No currently assigned cases in the loaded event range.'));
}
async function refresh(older=false){
  if(!context)throw Error('Verify Wallet first');
  const page=await context.dashboard({before:older?cursor:null});
  if(!older)cases.clear();
  for(const record of page.cases)cases.set(record.id,record);
  cursor=page.nextBefore;renderList();updateButtons();
  setStatus('Read verified Arbitration cases at block '+page.block+'. '+(cursor===null?'All preceding blocks included.':'Load earlier cases for older disputes.'));
}
function renderDetails(data){
  const root=one('#arbitration-case-details');root.replaceChildren();
  for(const [k,v] of [
    ['Case ID',data.id],['Status',data.state],['Role',data.role],['Claimant',data.claimant],
    ['Respondent',data.respondent],['Domain',data.domainId],['Origin component',data.originComponentId],
    ['Origin object',data.originObjectId],['Claim commitment',data.claimHash],
    ['Requested remedy',data.requestedRemedyHash],['Resolver',data.resolver],
    ['Appeal resolver',data.appealResolver],['Current round',data.round],
    ['Max appeals',data.maxAppeals],['Remaining appeals',Math.max(0,data.maxAppeals-data.round)],
    ['Evidence window (seconds)',data.evidenceWindow],['Appeal window (seconds)',data.appealWindow],
    ['Opened',date(data.openedAt)],['Evidence deadline',date(data.evidenceDeadline)],
    ['Appeal deadline',date(data.appealDeadline)],
    ['Appeal eligibility',data.permissions.appeal?'Eligible until deadline':'Not eligible'],
    ['Finalization',data.permissions.finalize?'Eligible now':'Not yet eligible']
  ])root.append(detailField(k,v));
  const ruling=one('#arbitration-rulings');ruling.replaceChildren();
  if(!data.rulings.length)ruling.append(e('p','muted','No ruling recorded on-chain.'));
  for(const r of data.rulings){
    const article=e('article','arbitration-ruling-item');article.append(e('strong',null,`Round ${r.round} · outcome ${r.outcomeCode}`),
      e('p',null,'Resolver: '+r.resolver),e('p',null,'Ruling hash: '+r.rulingHash),
      e('p',null,'Remedy commitment: '+r.remedyCommitment),
      e('p',null,'Panel commitment: '+r.panelCommitment),e('p',null,'Ruled at: '+date(r.ruledAt)));
    ruling.append(article);
  }
  const timeline=one('#arbitration-timeline');timeline.replaceChildren();
  if(!data.history.length)timeline.append(e('li',null,'No canonical events found.'));
  for(const item of data.history){
    const row=e('li','arbitration-timeline-item');
    row.append(e('strong',null,item.kind+' · round '+item.round),
      e('span',null,'Transaction '+item.transactionHash+' · block '+item.blockNumber),
      e('span',null,item.actor?'Actor '+item.actor:'Contract event'));
    for(const [key,value] of Object.entries(item.details))row.append(e('span',null,key+': '+value));
    timeline.append(row);
  }
  const actions=one('#arbitration-action-buttons');actions.replaceChildren();
  const available=[
    ['submitEvidence',data.permissions.evidence],['submitRuling',data.permissions.rule],
    ['appeal',data.permissions.appeal],['finalizeRuling',data.permissions.finalize]];
  for(const [action,allowed] of available)if(allowed){
    const button=e('button','ghost-button',buttonNames[action]);button.type='button';
    button.addEventListener('click',()=>setAction(action));actions.append(button);
  }
  one('#arbitration-evidence').hidden=true;one('#arbitration-ruling').hidden=true;
  if(inspectedEvidence){inspectedEvidence.fill(0);inspectedEvidence=null;}
  one('#arbitration-export-verified').disabled=true;
  one('#arbitration-inspection-form').reset();
  setText('#arbitration-inspection-status','No private evidence opened.');
  sealedEvidence=null;
  one('#arbitration-recovery-label').hidden=true;
  one('#arbitration-private-recovery').value='';
  one('#arbitration-export-sealed').disabled=true;
  one('#arbitration-show-secret').disabled=true;
}
function setAction(action){
  clearQuote();
  one('#arbitration-evidence').hidden=action!=='submitEvidence';
  one('#arbitration-ruling').hidden=action!=='submitRuling';
  if(action==='appeal'||action==='finalizeRuling')
    void operation(()=>prepare(action,{caseId:current.id}));
  else if(action==='submitEvidence')one('#arbitration-evidence-form input').focus();
  else if(action==='submitRuling')one('#arbitration-ruling-form input').focus();
}
async function selectCase(id){
  if(!context)throw Error('Verify Wallet first');
  current=await context.detail(id);
  one('#arbitration-case-lookup').value=current.id;
  renderDetails(current);show('details');
  setStatus('Read case '+short(current.id)+' from verified on-chain state.');
}
function formRecord(form){
  return Object.fromEntries(new FormData(form).entries());
}
function exportLocalEvidence(value,name,type='application/json'){
  const blob=new Blob([value],{type});
  const url=URL.createObjectURL(blob);
  try{
    const anchor=e('a');anchor.href=url;anchor.download=name;
    anchor.style.display='none';document.body.append(anchor);anchor.click();anchor.remove();
  }finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
async function sealPrivateFile(){
  if(!current||!evidenceWorkspace)throw Error('Select a verified case first');
  if(!current.permissions.evidence)throw Error('Evidence window or party authorization unavailable');
  const file=one('#arbitration-private-file').files?.[0];
  if(!file||file.size<1||file.size>ARBITRATION_EVIDENCE_MAX_BYTES_420)
    throw Error('Select a private evidence file no larger than 8 MiB');
  const expectedContext=context,caseId=current.id,epoch=serial;
  const raw=new Uint8Array(await file.arrayBuffer());
  let prepared;
  try{prepared=await evidenceWorkspace.prepare({caseId,data:raw});}
  finally{raw.fill(0);}
  if(context!==expectedContext||current?.id!==caseId||serial!==epoch)
    throw Error('Wallet or evidence case changed; prepare the private file again');
  sealedEvidence=prepared;
  one('#arbitration-evidence-form [name="evidenceHash"]').value=sealedEvidence.commitment;
  one('#arbitration-export-sealed').disabled=false;
  one('#arbitration-show-secret').disabled=false;
  one('#arbitration-recovery-label').hidden=true;
  one('#arbitration-private-recovery').value='';
  setText('#arbitration-seal-status','Encrypted privately. Public commitment: '+sealedEvidence.commitment+
    '. Download the private capsule and separately save the recovery key before submitting the Wallet transaction.');
}
function exportSealedEvidence(){
  if(!sealedEvidence||!current)throw Error('No private evidence prepared');
  exportLocalEvidence(JSON.stringify(sealedEvidence.encrypted),
    'arbitration-private-'+current.id.slice(2,14)+'-r'+current.round+'.json');
}
function revealRecoveryKey(){
  if(!sealedEvidence)throw Error('No private evidence prepared');
  one('#arbitration-private-recovery').value=sealedEvidence.recoveryKey;
  one('#arbitration-recovery-label').hidden=false;
  one('#arbitration-private-recovery').focus();
}
async function inspectEvidenceFile(form){
  if(!current||!evidenceWorkspace)throw Error('Select a verified case first');
  const fields=formRecord(form),file=form.querySelector('[name="capsule"]').files?.[0];
  if(!file||file.size<1||file.size>ARBITRATION_EVIDENCE_MAX_BYTES_420+1024)
    throw Error('Select a bounded encrypted evidence capsule');
  if(inspectedEvidence){inspectedEvidence.fill(0);inspectedEvidence=null;}
  one('#arbitration-export-verified').disabled=true;
  const key=fields.recoveryKey;
  form.querySelector('[name="recoveryKey"]').value='';
  let envelope;
  try{envelope=JSON.parse(await file.text());}catch{throw Error('Private evidence unavailable or failed integrity verification');}
  const expectedContext=context,caseId=current.id,epoch=serial;
  const verified=await evidenceWorkspace.inspectLocal({caseId,
    round:Number(fields.round),submitter:fields.submitter,commitment:fields.commitment,
    encrypted:envelope,recoveryKey:key});
  if(context!==expectedContext||current?.id!==caseId||serial!==epoch){
    verified.bytes.fill(0);
    throw Error('Wallet or evidence case changed; private evidence inspection cancelled');
  }
  inspectedEvidence=verified.bytes;
  one('#arbitration-export-verified').disabled=false;
  setText('#arbitration-inspection-status','Private bytes verified against canonical evidence for case '+
    current.id+' at round '+fields.round+'. No content was published or displayed.');
}
function exportVerifiedEvidence(){
  if(!inspectedEvidence||!current)throw Error('No verified private evidence available');
  exportLocalEvidence(inspectedEvidence,'arbitration-verified-'+current.id.slice(2,14)+'.bin',
    'application/octet-stream');
  inspectedEvidence.fill(0);inspectedEvidence=null;
  one('#arbitration-export-verified').disabled=true;
  setText('#arbitration-inspection-status','Verified evidence downloaded; working bytes cleared.');
}

async function prepare(action,fields){
  if(!context)throw Error('Connect and verify Wallet first');
  clearQuote();
  const prepared=await context.review(action,fields);
  quote=prepared;
  const root=one('#arbitration-review-details');root.replaceChildren();
  const s=prepared.summary;
  for(const [k,v] of [
    ['Action',buttonNames[action]],['Account',s.from],['Contract target',s.to],
    ['Chain ID',s.chainId],['Case',s.caseId||'New case'],['Round',s.round??'New case'],
    ['Value (wei)',s.value],['Protocol fee (wei)',s.protocolFeeWei],
    ['Estimated gas units',s.gas],['Gas price (wei)',s.gasPrice],
    ['Estimated network cost (wei)',s.estimatedGasCostWei],['Exact calldata',s.data]
  ])root.append(detailField(k,v));
  one('#arbitration-review-panel').hidden=false;
  one('#arbitration-review-panel').scrollIntoView({block:'nearest'});
  one('#arbitration-authorize').focus();updateButtons();
  setStatus('Simulation completed. Review exact Wallet operation; no signature has been requested.');
}
async function authorize(){
  if(!quote||!context)throw Error('Fresh transaction review required');
  const copy=quote;clearQuote();
  const result=await context.submit(copy,summary=>{
    return typeof window.confirm==='function'&&window.confirm(
      'Request Wallet approval for '+buttonNames[summary.action]+'?\nContract '+summary.to+
      '\nChain '+summary.chainId+' · estimated gas '+summary.gas+
      '\nEstimated gas cost '+summary.estimatedGasCostWei+' wei.\nThe Wallet will ask for approval; no outcome is final until a canonical receipt.');
  });
  pending=result;
  try{localStorage.setItem(loadKey(result.chainId,result.from),JSON.stringify({
    txHash:result.txHash,to:result.to,from:result.from,chainId:result.chainId}));}
  catch{/* Browser storage is optional; never authoritative */ }
  setText('#arbitration-tx-status','Submitted '+result.txHash+'. Pending canonical confirmation; do not resubmit.');
  updateButtons();
  setStatus('Transaction submitted to Wallet. It is not yet confirmed.');
}
async function checkReceipt(){
  if(!context||!pending)throw Error('No pending Arbitration transaction');
  const result=await context.status(pending);
  const message=result.state==='confirmed'?'Canonically confirmed: '+result.txHash:
    result.state==='reverted'?'Reverted on-chain: '+result.txHash:
    result.state==='reorganized'?'Receipt reorganized; awaiting canonical state: '+result.txHash:
    'Still '+result.state+': '+result.txHash;
  setText('#arbitration-tx-status',message);
  if(result.state==='confirmed'||result.state==='reverted'){
    try{localStorage.removeItem(loadKey(pending.chainId,pending.from));}catch{}
    pending=null;await refresh();
    if(current){try{await selectCase(current.id);}catch{current=null;}}
  }
  setStatus(message,result.state==='reverted');
}
async function connect(){
  const config=latestWallet?.config;
  if(!config?.arbitration||!latestWallet.controller||!globalThis.ethereum)
    throw Error('Connect Wallet and configure the trusted Arbitration release for this network.');
  const identity=String(config.network?.chainId)+'/'+latestWallet.controller.toLowerCase();
  if(context&&identity===connectedIdentity){await refresh();return;}
  reset('Verifying the canonical Arbitration deployment…');
  const provider=new InjectedProvider420(globalThis.ethereum);
  const c=createArbitrationApplication420({provider,release:config.arbitration,
    account:latestWallet.controller,domains:config.arbitration.domains||[]});
  const info=await c.policies();
  const state=await c.dashboard();
  context=c;connectedIdentity=identity;
  evidenceWorkspace=createArbitrationEvidenceWorkspace420({app:c});
  for(const d of info.domains){const option=e('option',null,d.name);option.value=d.id;one('#arbitration-domain').append(option);}
  const verified=await c.verify();
  setText('#arbitration-account',c.account);setText('#arbitration-chain',config.network.chainId);
  // The authoritative Router is returned by verified discovery, not by a caller field.
  setText('#arbitration-router',verified.binding.router);
  for(const item of state.cases)cases.set(item.id,item);
  cursor=state.nextBefore;renderList();updateButtons();
  setStatus('Arbitration verified. '+info.domains.length+' active domains available.');
  try{
    const raw=localStorage.getItem(loadKey(config.arbitration.chainId,c.account));
    if(raw){const restored=await c.restore(JSON.parse(raw));pending=restored;
      setText('#arbitration-tx-status','Recovered on-chain transaction '+restored.txHash+'. Check canonical receipt before retrying.');}
  }catch{setText('#arbitration-tx-status','Unverified saved transaction ignored. Review Wallet activity manually.');}
}
let latestWallet={config:null,controller:null};
function onWalletState(event){
  const next=event.detail||{};
  latestWallet={config:next.config,controller:next.controller};
  const nextKey=next.controller&&next.config?.network?.chainId?
    String(next.config.network.chainId)+'/'+next.controller.toLowerCase():null;
  if(context&&(!nextKey||nextKey!==connectedIdentity||next.network?.chainMismatch||next.phase==='failure'))
    reset('Wallet session changed. Reverify Arbitration before further transactions.');
}
function install(){
  if(one('#arbitration-management-panel'))return;
  const main=one('main.shell')||one('main');
  if(!main)return;
  const holder=e('div');holder.innerHTML=arbitrationMarkup420();
  const panel=holder.firstElementChild;
  const anchor=one('#services-section')||one('#status');
  if(anchor)main.insertBefore(panel,anchor);else main.append(panel);
  document.addEventListener('wallet:verification-state',onWalletState);
  one('#arbitration-connect').addEventListener('click',()=>operation(connect));
  one('#arbitration-reconnect').addEventListener('click',()=>operation(connect));
  one('#arbitration-refresh').addEventListener('click',()=>operation(()=>refresh()));
  one('#arbitration-more').addEventListener('click',()=>operation(()=>refresh(true)));
  one('#arbitration-check-receipt').addEventListener('click',()=>operation(checkReceipt));
  for(const button of panel.querySelectorAll('[data-arbitration-view]'))
    button.addEventListener('click',()=>show(button.dataset.arbitrationView));
  one('#arbitration-open-form').addEventListener('submit',event=>{event.preventDefault();
    void operation(()=>prepare('openCase',formRecord(event.currentTarget)));});
  one('#arbitration-lookup-form').addEventListener('submit',event=>{event.preventDefault();
    void operation(()=>selectCase(one('#arbitration-case-lookup').value.trim()));});
  one('#arbitration-seal-file').addEventListener('click',()=>operation(sealPrivateFile));
  one('#arbitration-export-sealed').addEventListener('click',()=>operation(exportSealedEvidence));
  one('#arbitration-show-secret').addEventListener('click',()=>operation(revealRecoveryKey));
  one('#arbitration-inspection-form').addEventListener('submit',event=>{event.preventDefault();
    void operation(()=>inspectEvidenceFile(event.currentTarget));});
  one('#arbitration-export-verified').addEventListener('click',()=>operation(exportVerifiedEvidence));
  one('#arbitration-evidence-form').addEventListener('submit',event=>{event.preventDefault();
    void operation(()=>prepare('submitEvidence',{caseId:current?.id,...formRecord(event.currentTarget)}));});
  one('#arbitration-ruling-form').addEventListener('submit',event=>{event.preventDefault();
    const fields=formRecord(event.currentTarget);fields.outcomeCode=Number(fields.outcomeCode);
    void operation(()=>prepare('submitRuling',{caseId:current?.id,...fields}));});
  one('#arbitration-cancel').addEventListener('click',()=>{clearQuote();setStatus('Review cancelled. No transaction submitted.');});
  one('#arbitration-authorize').addEventListener('click',()=>operation(authorize));
  updateButtons();
}
if(typeof document!=='undefined')install();
