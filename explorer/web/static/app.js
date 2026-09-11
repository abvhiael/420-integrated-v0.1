const app = document.querySelector('#route-content');
const networkPill = document.querySelector('#network-pill');
const searchForm = document.querySelector('#global-search');
const searchInput = document.querySelector('#search-input');

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const mono = (value) => `<span class="mono">${esc(value)}</span>`;
const link = (href, label) => `<a class="link mono" href="${href}">${esc(label)}</a>`;
const fmt = (value) => value === null || value === undefined || value === '' ? '—' : esc(value);
const short = (value, left=10, right=8) => {
  const s = String(value ?? '');
  if (s.length <= left + right + 3) return s;
  return `${s.slice(0,left)}…${s.slice(-right)}`;
};
const unixTime = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const d = new Date(Number(value) * 1000);
  return Number.isNaN(d.valueOf()) ? esc(value) : `${esc(d.toLocaleString())} · ${esc(value)}`;
};
const pct = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`;

async function api(path) {
  const response = await fetch(path, {headers:{'Accept':'application/json'}, cache:'no-store'});
  let body = null;
  try { body = await response.json(); } catch { body = {error:`HTTP ${response.status}`}; }
  if (!response.ok) {
    const err = new Error(body?.issue?.message || body?.error || `HTTP ${response.status}`);
    err.status = response.status;
    err.body = body;
    throw err;
  }
  return body;
}

function panelError(err) {
  const issue = err.body?.issue;
  const action = issue?.action ? `<p class="muted"><strong>Action:</strong> ${esc(issue.action)}</p>` : '';
  const retry = issue?.retryable ? '<p class="muted">This condition may recover automatically.</p>' : '';
  return `<div class="panel error"><strong>${esc(issue?.code || 'UNAVAILABLE')}</strong><p>${esc(err.message)}</p>${action}${retry}</div>`;
}

function setNav(route) {
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === route));
}

function title(name, note='') {
  return `<div class="route-title"><div><p class="eyebrow">420Explorer</p><h2>${esc(name)}</h2></div>${note ? `<span class="muted">${esc(note)}</span>` : ''}</div>`;
}

function stats(items) {
  return `<div class="grid">${items.map(([label,value]) => `<div class="stat"><span class="label">${esc(label)}</span><span class="value">${fmt(value)}</span></div>`).join('')}</div>`;
}

function detailRows(items) {
  return `<dl class="details">${items.map(([label,value,raw=false]) => `<div><dt>${esc(label)}</dt><dd>${raw ? value : fmt(value)}</dd></div>`).join('')}</dl>`;
}

function finalityBadge(value) {
  const state = String(value || 'UNKNOWN').toUpperCase();
  return `<span class="badge badge-${esc(state.toLowerCase())}">${esc(state)}</span>`;
}

function statusBadge(ok, yes='READY', no='ATTENTION') {
  return `<span class="badge ${ok ? 'badge-ready' : 'badge-warn'}">${esc(ok ? yes : no)}</span>`;
}

async function refreshNetworkPill() {
  try {
    const status = await api('/v1/status');
    networkPill.dataset.state = status.ready ? 'ready' : 'warn';
    networkPill.textContent = status.ready ? `chain ${status.chainId} · head ${status.headHeight}` : `chain ${status.chainId} · attention`;
  } catch (err) {
    const status = err.body?.status;
    networkPill.dataset.state = 'bad';
    networkPill.textContent = status?.wrongChain ? 'wrong chain' : status?.stale ? 'indexer stale' : status?.degraded ? 'indexer degraded' : !status?.consistent ? 'indexer inconsistent' : 'network unavailable';
  }
}

async function overview() {
  const [status, consensus, blocks] = await Promise.all([api('/v1/status'), api('/v1/consensus'), api('/v1/blocks?limit=6')]);
  app.innerHTML = title('Network overview', 'qualified read-only state') + stats([
    ['Head', status.headHeight], ['Safe', status.safeHeight], ['Finalized', status.finalizedHeight],
    ['Epoch', consensus.epoch], ['Rotation', consensus.rotation], ['Active validators', consensus.activeValidatorCount]
  ]) + `<div class="panel"><h3>Recent blocks</h3>${blockTable(blocks.blocks || [])}</div>`;
}

function blockTable(blocks) {
  if (!blocks.length) return '<p class="muted">No indexed blocks available.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Block</th><th>Hash</th><th>Finality</th><th>Timestamp</th></tr></thead><tbody>${blocks.map(b => `<tr><td>${link(`#/blocks/${b.number}`, b.number)}</td><td title="${esc(b.hash)}">${mono(short(b.hash))}</td><td>${finalityBadge(b.finality)}</td><td>${unixTime(b.timestamp)}</td></tr>`).join('')}</tbody></table></div>`;
}

async function blocks() {
  const page = await api('/v1/blocks?limit=50');
  app.innerHTML = title('Blocks', `snapshot ${page.meta?.snapshotHeight ?? '—'}`) + `<div class="panel">${blockTable(page.blocks || [])}</div>`;
}

async function blockDetail(number) {
  const view = await api(`/v1/blocks/${encodeURIComponent(number)}`);
  const b = view.block || view;
  const logs = view.logs || [];
  const nav = view.navigation || {};
  app.innerHTML = title(`Block ${number}`, b.finality || '') + stats([
    ['Number', b.number], ['Finality', b.finality], ['Logs', view.logCount ?? logs.length], ['Timestamp', unixTime(b.timestamp)]
  ]) + `<div class="panel">${detailRows([
    ['Hash', mono(b.hash), true],
    ['Parent hash', mono(b.parentHash), true],
    ['Chain ID', b.chainId],
    ['Schema', b.schemaVersion]
  ])}</div>` + `<div class="pager">${nav.previous !== null && nav.previous !== undefined ? link(`#/blocks/${nav.previous}`, `← block ${nav.previous}`) : '<span></span>'}${nav.next !== null && nav.next !== undefined ? link(`#/blocks/${nav.next}`, `block ${nav.next} →`) : '<span></span>'}</div>` + `<div class="panel"><h3>Logs</h3>${logTable(logs)}</div>`;
}

function logTable(logs) {
  if (!logs.length) return '<p class="muted">No logs indexed for this resource.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Log</th><th>Address</th><th>Transaction</th><th>Topics</th></tr></thead><tbody>${logs.map(l => `<tr><td>${fmt(l.logIndex)}</td><td>${l.address ? link(`#/addresses/${l.address}`,short(l.address)) : '—'}</td><td>${l.transactionHash ? link(`#/transactions/${l.transactionHash}`,short(l.transactionHash)) : '—'}</td><td>${fmt(l.topics?.length ?? 0)}</td></tr>`).join('')}</tbody></table></div>`;
}

async function transactionDetail(hash) {
  const view = await api(`/v1/transactions/${encodeURIComponent(hash)}`);
  const tx = view.transaction || {};
  const receipt = view.receipt || {};
  const logs = view.logs || [];
  const created = receipt.contractAddress;
  app.innerHTML = title('Transaction', receipt.statusLabel || '') + stats([
    ['Block', tx.blockNumber], ['Index', tx.index], ['Status', receipt.statusLabel ?? receipt.status], ['Gas used', receipt.gasUsed], ['Finality', view.finality]
  ]) + `<div class="panel">${detailRows([
    ['Hash', mono(tx.hash || hash), true],
    ['Block hash', mono(tx.blockHash), true],
    ['From', tx.from ? link(`#/addresses/${tx.from}`, tx.from) : '—', true],
    ['To', tx.to ? link(`#/addresses/${tx.to}`, tx.to) : 'contract creation', true],
    ['Value (wei)', mono(tx.valueWei || '0'), true],
    ['Created contract', created ? link(`#/contracts/${created}`, created) : '—', true],
    ['Input', tx.input ? `<div class="codebox mono">${esc(tx.input)}</div>` : '—', true]
  ])}</div>` + `<div class="panel"><h3>Logs</h3>${logTable(logs)}</div>`;
}

async function addressDetail(address) {
  const view = await api(`/v1/addresses/${encodeURIComponent(address)}?limit=50`);
  const txs = view.transactions || [];
  const normalized = view.address || address;
  app.innerHTML = title('Address', `${view.txCount ?? txs.length} indexed transactions`) + `<div class="panel">${detailRows([
    ['Address', mono(normalized), true],
    ['Snapshot height', view.meta?.snapshotHeight],
    ['Safe height', view.meta?.safeHeight],
    ['Finalized height', view.meta?.finalizedHeight]
  ])}</div>` + `<div class="panel"><h3>Transaction history</h3>${addressTxTable(txs, normalized)}</div>`;
}

function addressTxTable(txs, address) {
  if (!txs.length) return '<p class="muted">No indexed transaction history for this address.</p>';
  const addr = String(address).toLowerCase();
  return `<div class="table-wrap"><table><thead><tr><th>Hash</th><th>Block</th><th>Direction</th><th>Counterparty</th><th>Value (wei)</th></tr></thead><tbody>${txs.map(tx => {
    const from = String(tx.from || '').toLowerCase();
    const outgoing = from === addr;
    const counterparty = outgoing ? tx.to : tx.from;
    return `<tr><td>${link(`#/transactions/${tx.hash}`,short(tx.hash))}</td><td>${link(`#/blocks/${tx.blockNumber}`,tx.blockNumber)}</td><td><span class="badge ${outgoing?'badge-out':'badge-in'}">${outgoing?'OUT':'IN'}</span></td><td>${counterparty ? link(`#/addresses/${counterparty}`,short(counterparty)) : 'contract creation'}</td><td>${mono(tx.valueWei || '0')}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

async function contractDetail(address) {
  const view = await api(`/v1/contracts/${encodeURIComponent(address)}`);
  const c = view.contract || {};
  app.innerHTML = title('Contract', view.hasRuntimeCode ? 'runtime code indexed' : 'no runtime code') + stats([
    ['Deployment block',c.deploymentBlockNumber],['Runtime bytes',view.runtimeCodeBytes],['Has runtime code',view.hasRuntimeCode ? 'yes':'no'],['Chain',c.chainId]
  ]) + `<div class="panel">${detailRows([
    ['Address', mono(c.address || address), true],
    ['Deployment transaction', c.deploymentTxHash ? link(`#/transactions/${c.deploymentTxHash}`,c.deploymentTxHash) : '—', true],
    ['Deployment block hash', mono(c.deploymentHash), true],
    ['Code hash', mono(c.codeHash), true],
    ['Schema', c.schemaVersion]
  ])}</div>` + `<div class="panel"><h3>Runtime bytecode</h3>${c.runtimeCode ? `<div class="codebox mono">${esc(c.runtimeCode)}</div>` : '<p class="muted">No runtime bytecode indexed.</p>'}</div>`;
}

function registryTable(services) {
  if (!services.length) return '<p class="muted">No registered services available.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Service</th><th>Latest</th><th>Active</th><th>Implementation</th></tr></thead><tbody>${services.map(s => `<tr><td>${link(`#/registry/${encodeURIComponent(s.serviceId)}`,s.serviceId)}</td><td>v${fmt(s.latestVersion)}</td><td>${s.activeVersion ? `<span class="badge badge-ready">v${esc(s.activeVersion)}</span>` : '<span class="badge badge-warn">none</span>'}</td><td>${s.implementation ? link(`#/contracts/${s.implementation}`,short(s.implementation)) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}

async function registry() {
  const view = await api('/v1/services');
  const services = view.services || [];
  app.innerHTML = title('Protocol registry', `${view.count ?? services.length} services`) + `<div class="panel"><p class="muted">Rebuildable 420Registry history projected through the qualified Indexer boundary.</p>${registryTable(services)}</div>`;
}

async function registryService(serviceId) {
  const view = await api(`/v1/services/${encodeURIComponent(serviceId)}`);
  const versions = view.versions || [];
  app.innerHTML = title(view.serviceId || serviceId, `${versions.length} published version${versions.length===1?'':'s'}`) + stats([
    ['Latest version',view.latestVersion],['Active version',view.activeVersion || 'none'],['Versions',view.versionCount ?? versions.length],['Implementation',view.implementation ? short(view.implementation) : '—']
  ]) + `<div class="panel">${detailRows([
    ['Service ID', mono(view.serviceId || serviceId), true],
    ['Active implementation', view.implementation ? link(`#/contracts/${view.implementation}`,view.implementation) : '—', true]
  ])}</div>` + `<div class="panel"><h3>Version history</h3>${registryVersionsTable(versions)}</div>`;
}

function registryVersionsTable(versions) {
  if (!versions.length) return '<p class="muted">No version history available.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Version</th><th>State</th><th>Implementation</th><th>Activated</th><th>Code hash</th></tr></thead><tbody>${versions.map(v => `<tr><td>${link(`#/registry/${encodeURIComponent(v.serviceId)}/versions/${v.version}`,`v${v.version}`)}</td><td>${statusBadge(v.active,'ACTIVE','HISTORICAL')}</td><td>${v.implementation ? link(`#/contracts/${v.implementation}`,short(v.implementation)) : '—'}</td><td>${v.activatedBlock ? link(`#/blocks/${v.activatedBlock}`,v.activatedBlock) : '—'}</td><td title="${esc(v.codeHash)}">${mono(short(v.codeHash))}</td></tr>`).join('')}</tbody></table></div>`;
}

async function registryVersion(serviceId, version) {
  const v = await api(`/v1/services/${encodeURIComponent(serviceId)}/versions/${encodeURIComponent(version)}`);
  app.innerHTML = title(`${v.serviceId} · v${v.version}`, v.active ? 'active' : 'historical') + stats([
    ['Version',v.version],['Active',v.active ? 'yes':'no'],['Activated block',v.activatedBlock],['Deprecated block',v.deprecatedBlock || '—']
  ]) + `<div class="panel">${detailRows([
    ['Implementation', v.implementation ? link(`#/contracts/${v.implementation}`,v.implementation) : '—', true],
    ['Code hash', mono(v.codeHash), true],
    ['Metadata hash', mono(v.metadataHash), true],
    ['Manifest hash', mono(v.manifestHash), true],
    ['Dependency root', mono(v.dependencyRoot), true],
    ['Interface hash', mono(v.interfaceHash), true],
    ['Activated block hash', mono(v.activatedHash), true],
    ['Component type', v.componentType]
  ])}</div>`;
}

async function assets() {
  const params = new URLSearchParams();
  params.set('limit','50');
  const view = await api(`/v1/assets/activity?${params.toString()}`);
  const transfers = view.transfers || [];
  app.innerHTML = title('Asset activity', `${view.transferCount ?? transfers.length} recent transfers`) + stats([
    ['Snapshot',view.meta?.snapshotHeight],['Safe',view.meta?.safeHeight],['Finalized',view.meta?.finalizedHeight],['Transfers',view.transferCount ?? transfers.length]
  ]) + `<div class="panel"><p class="muted">Native and token movement projected from qualified indexed transactions and logs.</p>${assetTable(transfers)}</div>`;
}

function assetTable(transfers) {
  if (!transfers.length) return '<p class="muted">No indexed asset transfers available.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Block</th><th>Asset</th><th>Kind</th><th>Token ID</th><th>Amount</th><th>From</th><th>To</th><th>Tx</th></tr></thead><tbody>${transfers.map(t => `<tr><td>${link(`#/blocks/${t.blockNumber}`,t.blockNumber)}</td><td title="${esc(t.assetKey)}">${mono(short(t.assetKey,14,8))}</td><td><span class="badge">${esc(String(t.assetKind || '').toUpperCase())}</span></td><td>${t.tokenId ? mono(t.tokenId) : '—'}</td><td>${mono(t.amount)}</td><td>${t.from ? link(`#/addresses/${t.from}`,short(t.from)) : '—'}</td><td>${t.to ? link(`#/addresses/${t.to}`,short(t.to)) : '—'}</td><td>${link(`#/transactions/${t.transactionHash}`,short(t.transactionHash))}</td></tr>`).join('')}</tbody></table></div>`;
}

async function consensus() {
  const c = await api('/v1/consensus');
  const proposer = c.scheduledProposer || {};
  const qc = c.latestQc || {};
  const seats = c.activeSeats || [];
  app.innerHTML = title('Consensus', 'consensus-owned projection') + stats([
    ['Current slot',c.currentSlot],['Next slot',c.nextSlot],['Epoch',c.epoch],['Rotation',c.rotation],['Active validators',c.activeValidatorCount],['QC participation',pct(c.quorumParticipationPercent)]
  ]) + `<div class="panel"><h3>Epoch & rotation</h3>${detailRows([
    ['Slot in epoch',`${c.slotInEpoch} / ${c.slotsPerEpoch}`],
    ['Slots until epoch boundary',c.slotsUntilEpochBoundary],
    ['Slot in rotation',`${c.slotInRotation} / ${c.slotsPerRotation}`],
    ['Epochs per rotation',c.epochsPerRotation],
    ['Slots until rotation boundary',c.slotsUntilRotationBoundary]
  ])}</div>` + `<div class="panel"><h3>Scheduled proposer · slot ${fmt(proposer.slot)}</h3>${detailRows([
    ['Primary seat',mono(proposer.primary),true],['Fallback 1',mono(proposer.fallback1),true],['Fallback 2',mono(proposer.fallback2),true]
  ])}</div>` + `<div class="panel"><h3>Latest quorum certificate</h3>${detailRows([
    ['Certified',statusBadge(Boolean(qc.certified),'CERTIFIED','NOT CERTIFIED'),true],
    ['Slot',qc.slot],['Signers',qc.signers],['Quorum threshold',qc.quorum],['Block root',mono(qc.blockRoot),true],['Parent root',mono(qc.parentRoot),true]
  ])}</div>` + `<div class="panel"><h3>Finality checkpoints</h3>${checkpointTable(c)}</div>` + `<div class="panel"><h3>Active seats</h3><div class="seat-list">${seats.map(seat => `<span class="seat">${esc(seat)}</span>`).join('') || '<span class="muted">No active seats reported.</span>'}</div></div>`;
}

function checkpointTable(c) {
  return `<div class="table-wrap"><table><thead><tr><th>Checkpoint</th><th>Slot</th><th>Root</th></tr></thead><tbody>${[['Head',c.head],['Safe',c.safe],['Finalized',c.finalized]].map(([name,cp]) => `<tr><td>${esc(name)}</td><td>${fmt(cp?.slot)}</td><td title="${esc(cp?.root)}">${mono(short(cp?.root))}</td></tr>`).join('')}</tbody></table></div>`;
}

function statusDetails(s) {
  return stats([
    ['State',s.indexerState],['Chain',s.chainId],['Head',s.headHeight],['Safe',s.safeHeight],['Finalized',s.finalizedHeight],['Ingest age',s.ingestAgeSeconds != null ? `${s.ingestAgeSeconds}s` : '—'],['Safe lag',s.safeLag],['Finalized lag',s.finalizedLag]
  ]) + `<div class="panel">${detailRows([
    ['Ready',statusBadge(Boolean(s.ready),'READY','NOT READY'),true],
    ['Chain check',statusBadge(!s.wrongChain,'MATCH','WRONG CHAIN'),true],
    ['Freshness',statusBadge(!s.stale,'FRESH','STALE'),true],
    ['Indexer health',statusBadge(!s.degraded,'HEALTHY','DEGRADED'),true],
    ['Finality ordering',statusBadge(Boolean(s.consistent),'CONSISTENT','INCONSISTENT'),true],
    ['Schema version',s.schemaVersion],['Decoder set',s.decoderSet],['Last ingest',s.lastIngestAt]
  ])}</div>`;
}

async function statusPage() {
  try {
    const s = await api('/v1/status');
    app.innerHTML = title('Explorer status', 'qualified availability & freshness') + statusDetails(s);
  } catch (err) {
    const s = err.body?.status || {};
    app.innerHTML = title('Explorer status', 'fail-closed') + panelError(err) + statusDetails(s);
  }
}

function transactionsLanding() {
  app.innerHTML = title('Transactions') + '<div class="panel"><p>Paste a transaction hash into global search to open its qualified receipt, logs & finality view.</p></div>';
}

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const root = parts[0] || 'overview';
  setNav(root === 'block' ? 'blocks' : root);
  app.innerHTML = document.querySelector('#loading-template').innerHTML;
  try {
    if (root === 'overview') return await overview();
    if (root === 'blocks' && parts[1]) return await blockDetail(parts[1]);
    if (root === 'blocks') return await blocks();
    if (root === 'transactions' && parts[1]) return await transactionDetail(parts.slice(1).join('/'));
    if (root === 'transactions') return transactionsLanding();
    if (root === 'addresses' && parts[1]) return await addressDetail(parts[1]);
    if (root === 'contracts' && parts[1]) return await contractDetail(parts[1]);
    if (root === 'registry' && parts[1] && parts[2] === 'versions' && parts[3]) return await registryVersion(decodeURIComponent(parts[1]),parts[3]);
    if (root === 'registry' && parts[1]) return await registryService(decodeURIComponent(parts[1]));
    if (root === 'registry') return await registry();
    if (root === 'assets') return await assets();
    if (root === 'consensus') return await consensus();
    if (root === 'status') return await statusPage();
    app.innerHTML = title('Not found') + '<div class="panel"><p class="muted">Unknown Explorer route.</p></div>';
  } catch (err) {
    app.innerHTML = title('Explorer unavailable') + panelError(err);
  }
}

searchForm.addEventListener('submit', event => {
  event.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;
  if (/^\d+$/.test(q)) location.hash = `#/blocks/${q}`;
  else if (/^0x[0-9a-fA-F]{40}$/.test(q)) location.hash = `#/addresses/${q}`;
  else if (/^0x[0-9a-fA-F]{64}$/.test(q)) location.hash = `#/transactions/${q}`;
  else {
    app.innerHTML = title('Search') + '<div class="panel error"><strong>UNRECOGNIZED_QUERY</strong><p>Search accepts a decimal block number, 32-byte transaction hash, or 20-byte address.</p></div>';
  }
});

window.addEventListener('hashchange', route);
refreshNetworkPill();
route();