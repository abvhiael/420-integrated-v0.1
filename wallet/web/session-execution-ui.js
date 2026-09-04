import { readDeployedSmartAccountState } from './core/accounts.js';
import { validateRuntimeConfig } from './core/config.js';
import { InjectedProvider420 } from './core/provider.js';
import {
  confirmEntryPointUserOperation,
  prepareSessionUserOperationTransport,
  sendPreparedEntryPointUserOperation,
} from './core/entrypoint-transport.js';

function short(value) {
  return value && value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value || '—';
}

export function buildSessionExecutionReview(prepared) {
  if (!prepared) return {
    state: 'idle',
    stateLabel: 'Not prepared',
    signer: null,
    target: null,
    selector: null,
    spendAmount: null,
    scopeHash: null,
    grantId: null,
    nonce: null,
    nonceKey: null,
    userOpHash: null,
    gas: null,
    broadcastReady: false,
  };
  return {
    state: prepared.broadcastReady ? 'ready' : 'blocked',
    stateLabel: prepared.broadcastReady ? 'Signed + simulated' : 'Blocked',
    signer: prepared.signer,
    target: prepared.target,
    selector: prepared.selector,
    spendAmount: prepared.spendAmount?.toString?.() ?? String(prepared.spendAmount ?? 0),
    scopeHash: prepared.scopeHash,
    grantId: prepared.activeGrantId,
    nonce: prepared.nonce?.toString?.() ?? null,
    nonceKey: prepared.nonceKey?.toString?.() ?? null,
    userOpHash: prepared.userOpHash,
    gas: prepared.entryPointSimulation?.gas || null,
    broadcastReady: prepared.broadcastReady === true && prepared.entryPointSimulation?.simulationPassed === true,
  };
}

function createPanel() {
  const section = document.createElement('section');
  section.id = 'session-execution-panel';
  section.className = 'panel';
  section.hidden = true;
  section.innerHTML = `
    <div class="section-heading">
      <div><p class="eyebrow">Delegated execution · EntryPoint420</p><h2>Session execution</h2></div>
      <span id="session-exec-state" class="status-pill" data-state="idle">Not prepared</span>
    </div>
    <div class="form-grid account-card">
      <label><span class="label">SmartAccount420 address</span><input id="session-exec-account" type="text" autocomplete="off" placeholder="0x…" /></label>
      <label><span class="label">Session signer</span><input id="session-exec-signer" type="text" autocomplete="off" placeholder="0x…" /></label>
      <label><span class="label">Target</span><input id="session-exec-target" type="text" autocomplete="off" placeholder="0x…" /></label>
      <label><span class="label">Native value (wei)</span><input id="session-exec-value" type="text" inputmode="numeric" value="0" /></label>
      <label class="full-width"><span class="label">Calldata</span><textarea id="session-exec-data" rows="4" autocomplete="off">0x</textarea></label>
    </div>
    <div class="split-panel">
      <div class="form-card">
        <p class="eyebrow">Controlled transport</p>
        <p class="muted">Preparation re-checks session epoch, grant, scope, limits and nonce lane; then requests a session-key signature over the canonical EntryPoint420 user-op hash and simulates handleOp before submission becomes available.</p>
        <div class="button-row"><button id="session-exec-prepare" type="button">Prepare + sign + simulate</button><button id="session-exec-submit" class="primary-action" type="button" disabled>Submit to EntryPoint420</button></div>
      </div>
      <aside class="review-card" aria-label="Session execution review">
        <p class="eyebrow">Session review</p>
        <dl>
          <div><dt>Signer</dt><dd id="session-review-signer">—</dd></div>
          <div><dt>Target</dt><dd id="session-review-target">—</dd></div>
          <div><dt>Selector</dt><dd id="session-review-selector">—</dd></div>
          <div><dt>Spend</dt><dd id="session-review-spend">—</dd></div>
          <div><dt>Grant</dt><dd id="session-review-grant">—</dd></div>
          <div><dt>Scope</dt><dd id="session-review-scope">—</dd></div>
          <div><dt>Nonce lane</dt><dd id="session-review-nonce-key">—</dd></div>
          <div><dt>Nonce</dt><dd id="session-review-nonce">—</dd></div>
          <div><dt>User-op hash</dt><dd id="session-review-hash">—</dd></div>
          <div><dt>Estimated gas</dt><dd id="session-review-gas">—</dd></div>
        </dl>
      </aside>
    </div>
    <p id="session-exec-status" class="muted" role="status">Prepare a delegated call. Submission remains unavailable unless the signed EntryPoint420 simulation passes.</p>
  `;
  return section;
}

function installNavigation(panel) {
  const nav = document.querySelector('.sidebar nav');
  if (!nav || nav.querySelector('[data-scroll-target="#session-execution-panel"]')) return;
  const button = document.createElement('button');
  button.className = 'nav-item';
  button.dataset.scrollTarget = '#session-execution-panel';
  button.textContent = 'Session Execute';
  button.addEventListener('click', () => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const sessionButton = nav.querySelector('[data-scroll-target="#session-panel"]');
  sessionButton?.after(button);
}

export async function initSessionExecutionUi() {
  const sessionPanel = document.querySelector('#session-panel');
  if (!sessionPanel || document.querySelector('#session-execution-panel')) return;
  const panel = createPanel();
  sessionPanel.after(panel);
  installNavigation(panel);

  const local = { provider: null, config: null, account: null, prepared: null, busy: false };
  const $ = (selector) => panel.querySelector(selector);
  const globalStatus = document.querySelector('#status');
  const setStatus = (message) => {
    $('#session-exec-status').textContent = message;
    if (globalStatus) globalStatus.textContent = message;
  };

  const render = () => {
    panel.hidden = local.config?.features?.sessionExecutionUi !== true;
    const review = buildSessionExecutionReview(local.prepared);
    $('#session-exec-state').textContent = review.stateLabel;
    $('#session-exec-state').dataset.state = review.broadcastReady ? 'passed' : review.state;
    $('#session-review-signer').textContent = short(review.signer);
    $('#session-review-target').textContent = short(review.target);
    $('#session-review-selector').textContent = review.selector || '—';
    $('#session-review-spend').textContent = review.spendAmount ?? '—';
    $('#session-review-grant').textContent = short(review.grantId);
    $('#session-review-scope').textContent = short(review.scopeHash);
    $('#session-review-nonce-key').textContent = review.nonceKey ?? '—';
    $('#session-review-nonce').textContent = review.nonce ?? '—';
    $('#session-review-hash').textContent = short(review.userOpHash);
    $('#session-review-gas').textContent = review.gas || '—';
    $('#session-exec-prepare').disabled = local.busy;
    $('#session-exec-submit').disabled = local.busy || !review.broadcastReady || local.config?.features?.sessionExecution !== true || local.config?.features?.entryPointUserOpSubmission !== true;
  };

  const invalidate = () => { local.prepared = null; render(); };
  for (const selector of ['#session-exec-account', '#session-exec-signer', '#session-exec-target', '#session-exec-value', '#session-exec-data']) {
    $(selector).addEventListener('input', invalidate);
  }

  $('#session-exec-prepare').addEventListener('click', async () => {
    if (local.busy) return;
    local.busy = true; render();
    try {
      if (!globalThis.ethereum) throw new Error('No injected EIP-1193 wallet found');
      local.provider ||= new InjectedProvider420(globalThis.ethereum);
      const smartAccount = $('#session-exec-account').value.trim();
      const signer = $('#session-exec-signer').value.trim();
      if (!smartAccount || !signer) throw new Error('SmartAccount420 address and session signer are required');
      local.account = await readDeployedSmartAccountState(local.provider, smartAccount);
      setStatus('Checking session grant, nonce lane and authorization; then requesting the session signature…');
      local.prepared = await prepareSessionUserOperationTransport(local.provider, local.account, signer, {
        target: $('#session-exec-target').value.trim(),
        value: $('#session-exec-value').value.trim() || '0',
        data: $('#session-exec-data').value.trim() || '0x',
      });
      setStatus(`Session user operation signed and simulated successfully. Hash ${local.prepared.userOpHash}.`);
    } catch (error) {
      local.prepared = null;
      setStatus(error.message);
    } finally {
      local.busy = false; render();
    }
  });

  $('#session-exec-submit').addEventListener('click', async () => {
    if (local.busy || !local.prepared) return;
    if (globalThis.confirm && !globalThis.confirm(`Submit this signed session operation to EntryPoint420? Nonce ${local.prepared.nonce}.`)) return;
    local.busy = true; render();
    try {
      setStatus('Rechecking the session nonce, re-simulating EntryPoint420.handleOp and requesting transaction approval…');
      const submitted = await sendPreparedEntryPointUserOperation(local.provider, local.prepared);
      setStatus(`Session operation submitted: ${submitted.txHash}. Waiting for EntryPoint420 confirmation…`);
      const confirmed = await confirmEntryPointUserOperation(local.provider, submitted);
      setStatus(`Session execution confirmed. EntryPoint420 consumed nonce ${local.prepared.nonce} exactly once.`);
      local.prepared = null;
    } catch (error) {
      local.prepared = null;
      setStatus(error.message);
    } finally {
      local.busy = false; render();
    }
  });

  try {
    const response = await fetch('./runtime-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime config ${response.status}`);
    local.config = await response.json();
    validateRuntimeConfig(local.config);
    render();
    if (local.config.features?.sessionExecution !== true || local.config.features?.entryPointUserOpSubmission !== true) {
      setStatus('Session execution review is available. Broadcast remains disabled until final recovery/session hardening qualifies the transport.');
    }
  } catch (error) {
    setStatus(`Session execution UI blocked: ${error.message}`);
  }
}

if (typeof document !== 'undefined') initSessionExecutionUi();
