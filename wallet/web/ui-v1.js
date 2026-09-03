import './apps-page.js';
import { buildSendExecution } from './core/send.js';
import { installFailClosedBrowserLifecycle } from './core/provider-lifecycle.js';

const MAX_ACTIVITY = 12;

export function summarizeExecutionReview(request = {}, simulation = null) {
  const target = typeof request.target === 'string' ? request.target.trim() : '';
  const data = typeof request.data === 'string' && request.data.trim() ? request.data.trim() : '0x';
  const value = request.value === undefined || request.value === null || request.value === '' ? '0' : String(request.value);
  const selector = /^0x[0-9a-fA-F]{8}/.test(data) ? data.slice(0, 10).toLowerCase() : 'none';
  const calldataBytes = /^0x(?:[0-9a-fA-F]{2})*$/.test(data) ? (data.length - 2) / 2 : null;
  return {
    target,
    value,
    selector,
    calldataBytes,
    simulationPassed: simulation?.simulation?.passed === true,
    gas: simulation?.simulation?.gas || null,
  };
}

export function classifyWalletActivity(message = '') {
  const text = String(message).trim();
  if (!text) return null;
  if (/created and owner verified/i.test(text)) return { kind: 'account', state: 'confirmed', label: 'Smart Account created' };
  if (/creation submitted:/i.test(text)) return { kind: 'account', state: 'pending', label: 'Smart Account creation submitted' };
  if (/execution confirmed:/i.test(text)) return { kind: 'execution', state: 'confirmed', label: 'Smart Account execution confirmed' };
  if (/execution submitted:/i.test(text)) return { kind: 'execution', state: 'pending', label: 'Smart Account execution submitted' };
  if (/grant created and verified:/i.test(text)) return { kind: 'permission', state: 'confirmed', label: 'Permission created' };
  if (/grant revoked/i.test(text)) return { kind: 'permission', state: 'confirmed', label: 'Permission revoked' };
  if (/session key .*verified/i.test(text)) return { kind: 'session', state: 'confirmed', label: 'Session key updated' };
  return null;
}

function short(value) {
  return value && value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value || '—';
}

function renderExecutionReview() {
  const target = document.querySelector('#execute-target')?.value || '';
  const value = document.querySelector('#execute-value')?.value || '0';
  const data = document.querySelector('#execute-data')?.value || '0x';
  const simulationText = document.querySelector('#execute-simulation')?.textContent || '';
  const passed = /^Passed/i.test(simulationText);
  const gas = passed ? simulationText.split('gas ')[1] || null : null;
  const review = summarizeExecutionReview({ target, value, data }, passed ? { simulation: { passed: true, gas } } : null);
  const set = (id, text) => { const node = document.querySelector(id); if (node) node.textContent = text; };
  set('#review-target', short(review.target));
  set('#review-value', `${review.value} wei`);
  set('#review-selector', review.selector);
  set('#review-calldata', review.calldataBytes === null ? 'Invalid hex' : `${review.calldataBytes} bytes`);
  set('#review-gas', review.gas || 'Simulate first');
  const badge = document.querySelector('#review-state');
  if (badge) {
    badge.textContent = review.simulationPassed ? 'Simulation passed' : 'Awaiting simulation';
    badge.dataset.state = review.simulationPassed ? 'passed' : 'idle';
  }
}

function initNavigation() {
  for (const button of document.querySelectorAll('[data-scroll-target]')) {
    button.addEventListener('click', () => {
      const target = document.querySelector(button.dataset.scrollTarget);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

function initActivityFeed() {
  const status = document.querySelector('#status');
  const list = document.querySelector('#activity-list');
  if (!status || !list || typeof MutationObserver === 'undefined') return;
  const activities = [];
  const render = () => {
    list.replaceChildren();
    if (!activities.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Confirmed wallet actions will appear here for this session.';
      list.append(empty);
      return;
    }
    for (const item of activities) {
      const row = document.createElement('div');
      row.className = 'activity-row';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = item.label;
      const detail = document.createElement('span');
      detail.textContent = item.message;
      copy.append(title, detail);
      const badge = document.createElement('span');
      badge.className = `status-pill ${item.state}`;
      badge.textContent = item.state;
      row.append(copy, badge);
      list.append(row);
    }
  };
  render();
  new MutationObserver(() => {
    const message = status.textContent.trim();
    const classified = classifyWalletActivity(message);
    if (!classified || activities[0]?.message === message) return;
    activities.unshift({ ...classified, message });
    activities.splice(MAX_ACTIVITY);
    render();
  }).observe(status, { childList: true, subtree: true, characterData: true });
}

function initExecutionReview() {
  for (const selector of ['#execute-target', '#execute-value', '#execute-data']) {
    document.querySelector(selector)?.addEventListener('input', renderExecutionReview);
  }
  const simulation = document.querySelector('#execute-simulation');
  if (simulation && typeof MutationObserver !== 'undefined') {
    new MutationObserver(renderExecutionReview).observe(simulation, { childList: true, subtree: true, characterData: true });
  }
  renderExecutionReview();
}

async function initGuidedSend() {
  const assetSelect = document.querySelector('#send-asset');
  const recipient = document.querySelector('#send-recipient');
  const amount = document.querySelector('#send-amount');
  const prepare = document.querySelector('#prepare-send');
  const preview = document.querySelector('#send-preview');
  if (!assetSelect || !recipient || !amount || !prepare) return;

  let assets = [{ kind: 'native', symbol: '420', decimals: 18 }];
  try {
    const response = await fetch('./runtime-config.json', { cache: 'no-store' });
    if (response.ok) {
      const config = await response.json();
      assets = assets.concat((config.trackedAssets || []).map((asset) => ({
        kind: 'erc20',
        address: asset.address,
        symbol: asset.symbol || 'TOKEN',
        decimals: Number(asset.decimals ?? 18),
      })));
    }
  } catch {
    // Native 420 send remains available even if optional token metadata cannot be loaded.
  }

  assetSelect.replaceChildren();
  assets.forEach((asset, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = asset.kind === 'native' ? `${asset.symbol} · native` : `${asset.symbol} · ERC-20`;
    assetSelect.append(option);
  });

  const resetPreview = () => {
    if (preview) preview.textContent = 'Enter a recipient and amount, then prepare the guarded transaction.';
  };
  recipient.addEventListener('input', resetPreview);
  amount.addEventListener('input', resetPreview);
  assetSelect.addEventListener('change', resetPreview);

  prepare.addEventListener('click', () => {
    try {
      const asset = assets[Number(assetSelect.value) || 0];
      const built = buildSendExecution({ recipient: recipient.value, amount: amount.value, asset });
      const target = document.querySelector('#execute-target');
      const value = document.querySelector('#execute-value');
      const data = document.querySelector('#execute-data');
      target.value = built.request.target;
      value.value = built.request.value;
      data.value = built.request.data;
      for (const input of [target, value, data]) input.dispatchEvent(new Event('input', { bubbles: true }));
      if (preview) preview.textContent = `${built.summary.amount} ${built.summary.symbol} → ${short(built.summary.recipient)}. Simulation is required before execution.`;
      document.querySelector('#simulate-execution')?.focus();
    } catch (error) {
      if (preview) preview.textContent = error.message;
    }
  });
}

function initProviderLifecycle() {
  installFailClosedBrowserLifecycle(globalThis.ethereum, globalThis.location);
}

function initCopyButtons() {
  for (const button of document.querySelectorAll('[data-copy-source]')) {
    button.addEventListener('click', async () => {
      const source = document.querySelector(button.dataset.copySource);
      const value = source?.textContent?.trim();
      if (!value || value === '—' || !navigator.clipboard) return;
      await navigator.clipboard.writeText(value.replace(/\s*\([^)]*\)$/, ''));
      const previous = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = previous; }, 1200);
    });
  }
}

export function initWalletUiV1() {
  initNavigation();
  initActivityFeed();
  initExecutionReview();
  initGuidedSend();
  initProviderLifecycle();
  initCopyButtons();
}

if (typeof document !== 'undefined') initWalletUiV1();
