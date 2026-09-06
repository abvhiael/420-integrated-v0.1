import { discoverSmartAccount } from './core/accounts.js';
import { validateRuntimeConfig } from './core/config.js';
import { InjectedProvider420 } from './core/provider.js';
import {
  MAX_BATCH_CALLS,
  MAX_BATCH_CALLDATA_BYTES,
  confirmSmartAccountBatch,
  prepareSmartAccountBatch,
  sendPreparedSmartAccountBatch,
} from './core/batch-execution.js';

function short(value) {
  return value && value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value || '—';
}

function selectorFor(data = '0x') {
  return /^0x[0-9a-fA-F]{8}/.test(data) ? data.slice(0, 10).toLowerCase() : '0x';
}

export function escapeBatchHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function duplicateCount(prepared) {
  return Array.isArray(prepared?.duplicateCallIndexes) ? prepared.duplicateCallIndexes.length : 0;
}

export function buildBatchExecutionReview(prepared, calls = []) {
  if (!prepared) {
    const totalValue = calls.reduce((sum, call) => {
      try { return sum + BigInt(call?.value || 0); } catch { return sum; }
    }, 0n);
    const totalCalldataBytes = calls.reduce((sum, call) => {
      const data = typeof call?.data === 'string' && /^0x(?:[0-9a-fA-F]{2})*$/.test(call.data) ? call.data : '0x';
      return sum + (data.length - 2) / 2;
    }, 0);
    return {
      state: 'idle', stateLabel: 'Not simulated', callCount: calls.length,
      totalValue: totalValue.toString(), totalCalldataBytes, duplicateCalls: 0,
      gas: null, transactionTarget: null, ready: false,
    };
  }
  return {
    state: prepared.simulation?.passed ? 'ready' : 'blocked',
    stateLabel: prepared.simulation?.passed ? 'Simulation passed' : 'Blocked',
    callCount: prepared.calls.length,
    totalValue: prepared.totalValue.toString(),
    totalCalldataBytes: prepared.totalCalldataBytes,
    duplicateCalls: duplicateCount(prepared),
    gas: prepared.simulation?.gas || null,
    transactionTarget: prepared.smartAccount,
    ready: prepared.simulation?.passed === true,
  };
}

export function moveBatchCall(calls, fromIndex, toIndex) {
  if (!Array.isArray(calls)) throw new TypeError('calls array required');
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 || fromIndex >= calls.length || toIndex >= calls.length) {
    throw new Error('batch call reorder index out of range');
  }
  if (fromIndex === toIndex) return calls.slice();
  const next = calls.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function createPanel() {
  const section = document.createElement('section');
  section.id = 'batch-execution-panel';
  section.className = 'panel';
  section.hidden = true;
  section.innerHTML = `
    <div class="section-heading">
      <div><p class="eyebrow">Owner execution · SmartAccount420</p><h2>Batch transaction</h2></div>
      <span id="batch-state" class="status-pill" data-state="idle">Not simulated</span>
    </div>
    <div class="form-card">
      <div class="section-heading"><div><p class="eyebrow">Compose calls</p><p class="muted">Up to ${MAX_BATCH_CALLS} calls. Every call is atomic: if one target call reverts, the entire SmartAccount420 batch reverts.</p></div><button id="batch-add" type="button">Add call</button></div>
      <div id="batch-call-list" class="activity-list" aria-live="polite"></div>
    </div>
    <div class="split-panel">
      <div class="form-card">
        <p class="eyebrow">Guarded execution</p>
        <p class="muted">The wallet blocks authority-contract targets, enforces per-call and aggregate calldata limits, simulates the complete executeBatch call, estimates gas and revalidates owner + authorization epoch before any transaction approval. The exact simulated batch snapshot is what gets submitted.</p>
        <div class="button-row"><button id="batch-prepare" type="button">Review + simulate batch</button><button id="batch-submit" class="primary-action" type="button" disabled>Submit batch</button></div>
      </div>
      <aside class="review-card" aria-label="Batch transaction review">
        <p class="eyebrow">Batch review</p>
        <dl>
          <div><dt>Calls</dt><dd id="batch-review-count">0 / ${MAX_BATCH_CALLS}</dd></div>
          <div><dt>Total native value</dt><dd id="batch-review-value">0 wei</dd></div>
          <div><dt>Total calldata</dt><dd id="batch-review-bytes">0 / ${MAX_BATCH_CALLDATA_BYTES} bytes</dd></div>
          <div><dt>Identical repeats</dt><dd id="batch-review-duplicates">0</dd></div>
          <div><dt>Estimated gas</dt><dd id="batch-review-gas">—</dd></div>
          <div><dt>SmartAccount</dt><dd id="batch-review-account">—</dd></div>
        </dl>
        <p class="muted">Call order is meaningful. Repeated identical calls are highlighted for review but are not automatically rejected because some contracts intentionally support repeated actions.</p>
      </aside>
    </div>
    <p id="batch-status" class="muted" role="status">Compose one or more calls, then simulate the complete atomic batch.</p>
  `;
  return section;
}

function installNavigation(panel) {
  const nav = document.querySelector('.sidebar nav');
  if (!nav || nav.querySelector('[data-scroll-target="#batch-execution-panel"]')) return;
  const button = document.createElement('button');
  button.className = 'nav-item';
  button.dataset.scrollTarget = '#batch-execution-panel';
  button.textContent = 'Batch Execute';
  button.addEventListener('click', () => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const sessionExec = nav.querySelector('[data-scroll-target="#session-execution-panel"]');
  sessionExec?.after(button);
}

function blankCall() { return { target: '', value: '0', data: '0x' }; }

export async function initBatchExecutionUi() {
  const anchor = document.querySelector('#session-execution-panel') || document.querySelector('#session-panel');
  if (!anchor || document.querySelector('#batch-execution-panel')) return;
  const panel = createPanel();
  anchor.after(panel);
  installNavigation(panel);

  const local = { provider: null, config: null, account: null, calls: [blankCall()], prepared: null, busy: false };
  const $ = (selector) => panel.querySelector(selector);
  const globalStatus = document.querySelector('#status');
  const setStatus = (message) => {
    $('#batch-status').textContent = message;
    if (globalStatus) globalStatus.textContent = message;
  };
  const invalidate = () => { local.prepared = null; };

  const renderCalls = () => {
    const list = $('#batch-call-list');
    list.innerHTML = '';
    local.calls.forEach((call, index) => {
      const card = document.createElement('div');
      card.className = 'account-card';
      card.dataset.batchIndex = String(index);
      card.innerHTML = `
        <div class="section-heading"><div><p class="eyebrow">Call ${index + 1}</p><p class="muted">Selector <span data-role="selector">${selectorFor(call.data)}</span></p></div>
          <div class="button-row"><button type="button" data-action="up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-action="down" ${index === local.calls.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-action="remove" ${local.calls.length === 1 ? 'disabled' : ''}>Remove</button></div>
        </div>
        <div class="form-grid">
          <label><span class="label">Target</span><input data-field="target" type="text" autocomplete="off" placeholder="0x…" value="${escapeBatchHtml(call.target)}" /></label>
          <label><span class="label">Native value (wei)</span><input data-field="value" type="text" inputmode="numeric" value="${escapeBatchHtml(call.value)}" /></label>
          <label class="full-width"><span class="label">Calldata</span><textarea data-field="data" rows="3" autocomplete="off">${escapeBatchHtml(call.data)}</textarea></label>
        </div>`;
      for (const field of ['target', 'value', 'data']) {
        card.querySelector(`[data-field="${field}"]`).addEventListener('input', (event) => {
          local.calls[index] = { ...local.calls[index], [field]: event.target.value };
          invalidate(); renderReview();
          if (field === 'data') card.querySelector('[data-role="selector"]').textContent = selectorFor(event.target.value);
        });
      }
      card.querySelector('[data-action="up"]').addEventListener('click', () => {
        local.calls = moveBatchCall(local.calls, index, index - 1); invalidate(); renderCalls(); renderReview();
      });
      card.querySelector('[data-action="down"]').addEventListener('click', () => {
        local.calls = moveBatchCall(local.calls, index, index + 1); invalidate(); renderCalls(); renderReview();
      });
      card.querySelector('[data-action="remove"]').addEventListener('click', () => {
        if (local.calls.length <= 1) return;
        local.calls.splice(index, 1); invalidate(); renderCalls(); renderReview();
      });
      list.append(card);
    });
    $('#batch-add').disabled = local.busy || local.calls.length >= MAX_BATCH_CALLS;
  };

  const renderReview = () => {
    panel.hidden = local.config?.features?.batchExecutionUi !== true;
    const review = buildBatchExecutionReview(local.prepared, local.calls);
    $('#batch-state').textContent = review.stateLabel;
    $('#batch-state').dataset.state = review.ready ? 'passed' : review.state;
    $('#batch-review-count').textContent = `${review.callCount} / ${MAX_BATCH_CALLS}`;
    $('#batch-review-value').textContent = `${review.totalValue} wei`;
    $('#batch-review-bytes').textContent = `${review.totalCalldataBytes} / ${MAX_BATCH_CALLDATA_BYTES} bytes`;
    $('#batch-review-duplicates').textContent = String(review.duplicateCalls);
    $('#batch-review-gas').textContent = review.gas || '—';
    $('#batch-review-account').textContent = short(review.transactionTarget);
    $('#batch-prepare').disabled = local.busy;
    $('#batch-submit').disabled = local.busy || !review.ready || local.config?.features?.batchExecution !== true;
    $('#batch-add').disabled = local.busy || local.calls.length >= MAX_BATCH_CALLS;
  };

  $('#batch-add').addEventListener('click', () => {
    if (local.busy || local.calls.length >= MAX_BATCH_CALLS) return;
    local.calls.push(blankCall()); invalidate(); renderCalls(); renderReview();
  });

  $('#batch-prepare').addEventListener('click', async () => {
    if (local.busy) return;
    local.busy = true; renderReview();
    try {
      if (!globalThis.ethereum) throw new Error('No injected EIP-1193 wallet found');
      local.provider ||= new InjectedProvider420(globalThis.ethereum);
      const exposed = await local.provider.request('eth_accounts', []);
      if (!Array.isArray(exposed) || exposed.length === 0) throw new Error('Connect the owner wallet before batch execution');
      const controller = exposed[0];
      local.account = await discoverSmartAccount(local.provider, controller, local.config.smartAccount);
      if (!local.account.deployed || !local.account.controllerIsOwner) throw new Error('Connected wallet does not control a deployed canonical SmartAccount420');
      setStatus('Validating calls and simulating the complete atomic SmartAccount420 batch…');
      local.prepared = await prepareSmartAccountBatch(local.provider, controller, local.account, local.calls);
      const repeats = duplicateCount(local.prepared);
      setStatus(`Batch simulation passed for ${local.prepared.calls.length} calls. Estimated gas ${local.prepared.simulation.gas}.${repeats ? ` Review ${repeats} repeated identical call pair${repeats === 1 ? '' : 's'} before submission.` : ''}`);
    } catch (error) {
      local.prepared = null; setStatus(error.message);
    } finally {
      local.busy = false; renderReview();
    }
  });

  $('#batch-submit').addEventListener('click', async () => {
    if (local.busy || !local.prepared || local.config?.features?.batchExecution !== true) return;
    if (globalThis.confirm && !globalThis.confirm(`Submit the exact simulated snapshot: ${local.prepared.calls.length} atomic calls with total native value ${local.prepared.totalValue} wei?`)) return;
    local.busy = true; renderReview();
    try {
      const controller = local.prepared.controller;
      setStatus('Revalidating owner and authorization epoch, re-simulating the exact prepared batch snapshot, then requesting transaction approval…');
      const submitted = await sendPreparedSmartAccountBatch(local.provider, local.prepared, local.account);
      setStatus(`Batch submitted: ${submitted.txHash}. Waiting for confirmation…`);
      await confirmSmartAccountBatch(local.provider, submitted.txHash, controller, local.config.smartAccount);
      setStatus(`Batch confirmed atomically with ${submitted.calls.length} calls.`);
      local.prepared = null;
    } catch (error) {
      local.prepared = null; setStatus(error.message);
    } finally {
      local.busy = false; renderReview();
    }
  });

  renderCalls();
  try {
    const response = await fetch('./runtime-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime config ${response.status}`);
    local.config = await response.json();
    validateRuntimeConfig(local.config);
    renderReview();
    if (local.config.features?.batchExecution !== true) setStatus('Batch review and simulation are available. Submission remains disabled until batch hardening qualifies the execution path.');
  } catch (error) {
    setStatus(`Batch execution UI blocked: ${error.message}`);
  }
}

if (typeof document !== 'undefined') initBatchExecutionUi();
