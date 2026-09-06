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
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;

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
}

async function refresh() {
  const panel = $('#passkey-panel');
  if (!panel) return;
  try {
    const { config, smartAccount } = await context();
    const runtime = passkeyRuntimeState(config, smartAccount, binding, globalThis.navigator);
    panel.hidden = config?.features?.passkeys !== true;
    $('#passkey-enroll').disabled = busy || !runtime.canEnroll;
    $('#passkey-reenroll').disabled = busy || !runtime.canReenroll;
    $('#passkey-execute').disabled = busy || !runtime.canExecute;
    setStatus(runtime.reason);
    const epoch = $('#passkey-epoch');
    if (epoch) epoch.textContent = binding ? `${binding.authorizationEpoch} / ${smartAccount.authorizationEpoch}` : `— / ${smartAccount.authorizationEpoch}`;
    const credential = $('#passkey-credential');
    if (credential) credential.textContent = binding ? `${binding.credentialId.slice(0, 12)}…` : 'Not enrolled in this session';
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
  $('#passkey-enroll')?.addEventListener('click', enroll);
  $('#passkey-reenroll')?.addEventListener('click', reenroll);
  $('#passkey-execute')?.addEventListener('click', executeWithPasskey);
  globalThis.ethereum?.on?.('accountsChanged', () => { binding = null; refresh(); });
  globalThis.ethereum?.on?.('chainChanged', () => { binding = null; refresh(); });
  refresh();
}

if (typeof document !== 'undefined') initPasskeyUi();
