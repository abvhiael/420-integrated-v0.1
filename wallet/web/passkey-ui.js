import { discoverSmartAccount } from './core/accounts.js';
import { createPasskeyCredentialBinding } from './core/passkey-metadata.js';
import { registerP256Passkey } from './core/passkey-p256-browser.js';
import {
  confirmEnrollPasskey,
  confirmReenrollPasskey,
  sendEnrollPasskey,
  sendReenrollPasskey,
} from './core/passkey-management.js';
import {
  preparePasskeyUserOperationTransport,
  sendPreparedPasskeyUserOperation,
} from './core/passkey-entrypoint-transport.js';
import { passkeyRuntimeState } from './core/passkey-runtime.js';
import { InjectedProvider420 } from './core/provider.js';

let binding = null;
let busy = false;

const $ = (selector) => document.querySelector(selector);

function ensurePanel() {
  let panel = $('#passkey-panel');
  if (panel) return panel;
  const anchor = $('#session-panel') || $('#execution-panel');
  if (!anchor) return null;
  panel = document.createElement('section');
  panel.id = 'passkey-panel';
  panel.className = 'panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="section-heading">
      <div><p class="eyebrow">WebAuthn · PK42 · owner nonce lane</p><h2>Passkey security</h2></div>
      <span class="status-pill">No private-key export</span>
    </div>
    <div class="split-panel">
      <div class="form-card">
        <p class="muted">Register a device passkey, bind its public P-256 credential to this SmartAccount420, and use the existing Send / Execute form with PK42 EntryPoint420 transport. Public binding metadata is kept only in memory for this browser session.</p>
        <div class="button-row">
          <button id="passkey-enroll" type="button" disabled>Register + enroll passkey</button>
          <button id="passkey-reenroll" type="button" disabled>Re-enroll stale passkey</button>
          <button id="passkey-execute" class="primary-action" type="button" disabled>Execute prepared call with passkey</button>
        </div>
      </div>
      <aside class="review-card" aria-label="Passkey state">
        <p class="eyebrow">Passkey state</p>
        <dl>
          <div><dt>Credential</dt><dd id="passkey-credential">Not enrolled in this session</dd></div>
          <div><dt>Binding / account epoch</dt><dd id="passkey-epoch">—</dd></div>
          <div><dt>Signing path</dt><dd>WebAuthn ES256 → PK42 → EntryPoint420</dd></div>
          <div><dt>Persistence</dt><dd>Session memory only</dd></div>
        </dl>
      </aside>
    </div>
    <p id="passkey-status" class="muted" role="status">Checking passkey runtime policy…</p>
  `;
  anchor.after(panel);
  const nav = document.querySelector('.sidebar nav');
  if (nav && !nav.querySelector('[data-scroll-target="#passkey-panel"]')) {
    const button = document.createElement('button');
    button.className = 'nav-item';
    button.dataset.scrollTarget = '#passkey-panel';
    button.textContent = 'Passkeys';
    button.addEventListener('click', () => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    nav.append(button);
  }
  return panel;
}

function randomChallenge() {
  if (!globalThis.crypto?.getRandomValues) throw new Error('secure browser randomness is unavailable');
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function addressBytes(address) {
  return Uint8Array.from(address.slice(2).match(/../g), (byte) => Number.parseInt(byte, 16));
}

async function context() {
  if (!globalThis.ethereum) throw new Error('No injected EIP-1193 wallet found');
  const provider = new InjectedProvider420(globalThis.ethereum);
  const accounts = await provider.request('eth_accounts');
  const controller = accounts?.[0]?.toLowerCase();
  if (!controller) throw new Error('Connect the wallet before using passkeys');
  const response = await fetch('./runtime-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`runtime config ${response.status}`);
  const config = await response.json();
  const smartAccount = await discoverSmartAccount(provider, controller, config.smartAccount);
  return { provider, controller, config, smartAccount };
}

function requestFromExecutionForm() {
  const target = $('#execute-target')?.value?.trim();
  const value = $('#execute-value')?.value?.trim() || '0';
  const data = $('#execute-data')?.value?.trim() || '0x';
  if (!target) throw new Error('Enter a transaction target before passkey execution');
  return { target, value, data };
}

function setStatus(text) {
  const node = $('#passkey-status');
  if (node) node.textContent = text;
  const globalStatus = $('#status');
  if (globalStatus && /submitted|enrolled|re-enrolled|error|blocked|stale/i.test(String(text))) globalStatus.textContent = text;
}

async function refresh() {
  const panel = ensurePanel();
  if (!panel) return;
  try {
    const { config, smartAccount } = await context();
    const runtime = passkeyRuntimeState(config, smartAccount, binding, globalThis.navigator);
    panel.hidden = config?.features?.passkeys !== true;
    $('#passkey-enroll').disabled = busy || !runtime.canEnroll;
    $('#passkey-reenroll').disabled = busy || !runtime.canReenroll;
    $('#passkey-execute').disabled = busy || !runtime.canExecute;
    setStatus(runtime.reason);
    $('#passkey-epoch').textContent = binding ? `${binding.authorizationEpoch} / ${smartAccount.authorizationEpoch}` : `— / ${smartAccount.authorizationEpoch}`;
    $('#passkey-credential').textContent = binding ? `${binding.credentialId.slice(0, 12)}…` : 'Not enrolled in this session';
  } catch (error) {
    panel.hidden = false;
    for (const id of ['#passkey-enroll', '#passkey-reenroll', '#passkey-execute']) if ($(id)) $(id).disabled = true;
    setStatus(error.message);
  }
}

async function enroll() {
  if (busy) return;
  busy = true;
  await refresh();
  try {
    const { provider, controller, config, smartAccount } = await context();
    const runtime = passkeyRuntimeState(config, smartAccount, binding, globalThis.navigator);
    if (!runtime.canEnroll) throw new Error(runtime.reason);
    const rpId = globalThis.location.hostname;
    const origin = globalThis.location.origin;
    const registration = await registerP256Passkey(globalThis.navigator, {
      challenge: randomChallenge(),
      rpId,
      userId: addressBytes(controller),
      userName: controller,
    }, { expectedOrigin: origin });
    const candidate = createPasskeyCredentialBinding({ registration, smartAccountState: smartAccount, rpId, origin });
    const submitted = await sendEnrollPasskey(provider, controller, smartAccount, candidate);
    setStatus(`Enrollment submitted: ${submitted.txHash}. Waiting for confirmation…`);
    const confirmed = await confirmEnrollPasskey(provider, submitted.txHash, submitted);
    binding = confirmed.binding;
    setStatus('Passkey enrolled and verified for the current authorization epoch.');
  } catch (error) {
    setStatus(error.message);
  } finally {
    busy = false;
    await refresh();
  }
}

async function reenroll() {
  if (busy || !binding) return;
  busy = true;
  await refresh();
  try {
    const { provider, controller, config, smartAccount } = await context();
    const runtime = passkeyRuntimeState(config, smartAccount, binding, globalThis.navigator);
    if (!runtime.canReenroll) throw new Error(runtime.reason);
    const submitted = await sendReenrollPasskey(provider, controller, smartAccount, binding);
    setStatus(`Re-enrollment submitted: ${submitted.txHash}. Waiting for confirmation…`);
    const confirmed = await confirmReenrollPasskey(provider, submitted.txHash, submitted);
    binding = confirmed.binding;
    setStatus('Passkey explicitly re-enrolled for the current authorization epoch.');
  } catch (error) {
    setStatus(error.message);
  } finally {
    busy = false;
    await refresh();
  }
}

async function executeWithPasskey() {
  if (busy || !binding) return;
  busy = true;
  await refresh();
  try {
    const { provider, controller, config, smartAccount } = await context();
    const runtime = passkeyRuntimeState(config, smartAccount, binding, globalThis.navigator);
    if (!runtime.canExecute) throw new Error(runtime.reason);
    const request = requestFromExecutionForm();
    const prepared = await preparePasskeyUserOperationTransport(provider, globalThis.navigator, smartAccount, binding, request, {
      rpId: binding.rpId,
      origin: binding.origin,
    });
    if (globalThis.confirm && !globalThis.confirm(`Execute through SmartAccount420 with passkey to ${prepared.target}? The PK42 UserOperation has passed simulation.`)) return;
    const submitted = await sendPreparedPasskeyUserOperation(provider, prepared, controller);
    binding = prepared.advancedBinding;
    setStatus(`Passkey UserOperation submitted through EntryPoint420: ${submitted.txHash}`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    busy = false;
    await refresh();
  }
}

export function initPasskeyUi() {
  const panel = ensurePanel();
  if (!panel) return;
  $('#passkey-enroll')?.addEventListener('click', enroll);
  $('#passkey-reenroll')?.addEventListener('click', reenroll);
  $('#passkey-execute')?.addEventListener('click', executeWithPasskey);
  globalThis.ethereum?.on?.('accountsChanged', () => { binding = null; refresh(); });
  globalThis.ethereum?.on?.('chainChanged', () => { binding = null; refresh(); });
  refresh();
}

if (typeof document !== 'undefined') initPasskeyUi();
