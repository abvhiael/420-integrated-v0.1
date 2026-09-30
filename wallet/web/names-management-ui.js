import {
  classifyNames420Error,
  createNames420ManagementClient,
  randomNames420Salt,
} from './core/names-management.js';
import { InjectedProvider420 } from './core/provider.js';

const ZERO32 = `0x${'0'.repeat(64)}`;
let context = null;
let busy = false;

const $ = (selector) => document.querySelector(selector);

function namesMarkup() {
  return `
    <section id="names-management-panel" class="panel" aria-labelledby="names-management-heading">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Canonical 420Names · owner-authorized writes</p>
          <h2 id="names-management-heading">Manage .420 names</h2>
          <p class="muted">Commit/register, renew, update resolution, set reverse naming, and transfer ownership using the qualified Names420 deployment.</p>
        </div>
        <span id="names-app-state" class="status-pill" data-state="idle">Not connected</span>
      </div>

      <div class="account-card names-context" aria-live="polite">
        <div><p class="label">Connected account</p><strong id="names-account">—</strong></div>
        <div><p class="label">Names420 contract</p><strong id="names-contract">—</strong></div>
        <div><p class="label">Network</p><strong id="names-network">—</strong></div>
        <button id="names-connect" type="button">Connect / verify Names</button>
      </div>

      <div class="split-panel">
        <div class="form-card" aria-labelledby="names-register-heading">
          <p class="eyebrow">Two-transaction registration</p>
          <h3 id="names-register-heading">Register a name</h3>
          <label><span class="label">Name</span><input id="names-register-name" type="text" autocomplete="off" placeholder="alice.420" /></label>
          <label><span class="label">Lease duration (days)</span><input id="names-register-days" type="number" inputmode="numeric" min="30" max="365" value="30" /></label>
          <label><span class="label">Registration salt</span><input id="names-register-salt" type="text" autocomplete="off" spellcheck="false" placeholder="0x…64 hex chars" /></label>
          <div class="button-row">
            <button id="names-generate-salt" type="button">Generate secure salt</button>
            <button id="names-check-commitment" type="button">Check commitment</button>
          </div>
          <dl class="names-state-list">
            <div><dt>Commitment</dt><dd id="names-commitment">—</dd></div>
            <div><dt>Committed at</dt><dd id="names-committed-at">—</dd></div>
            <div><dt>Reveal window</dt><dd id="names-reveal-window">—</dd></div>
          </dl>
          <div class="button-row">
            <button id="names-commit" type="button" class="primary-action">1. Commit</button>
            <button id="names-register" type="button">2. Reveal / register</button>
          </div>
          <p class="muted">Keep the salt until registration confirms. A commitment cannot be revealed before the minimum age and expires after the maximum age.</p>
        </div>

        <div class="form-card" aria-labelledby="names-existing-heading">
          <p class="eyebrow">Existing lease</p>
          <h3 id="names-existing-heading">Manage a name</h3>
          <label><span class="label">Name</span><input id="names-manage-name" type="text" autocomplete="off" placeholder="alice.420" /></label>
          <button id="names-load-record" type="button">Load canonical record</button>
          <dl class="names-state-list" aria-live="polite">
            <div><dt>Owner</dt><dd id="names-record-owner">—</dd></div>
            <div><dt>Pending owner</dt><dd id="names-record-pending">—</dd></div>
            <div><dt>Forward target</dt><dd id="names-record-target">—</dd></div>
            <div><dt>Expires</dt><dd id="names-record-expiry">—</dd></div>
          </dl>

          <label><span class="label">Renewal (days)</span><input id="names-renew-days" type="number" inputmode="numeric" min="30" max="365" value="30" /></label>
          <button id="names-renew" type="button">Renew lease</button>

          <label><span class="label">Forward address</span><input id="names-resolution-address" type="text" autocomplete="off" placeholder="0x…" /></label>
          <label><span class="label">Identity profile ID (optional bytes32)</span><input id="names-profile-id" type="text" autocomplete="off" spellcheck="false" placeholder="0x… or blank" /></label>
          <label><span class="label">Registry service ID (optional bytes32)</span><input id="names-service-id" type="text" autocomplete="off" spellcheck="false" placeholder="0x… or blank" /></label>
          <div class="button-row">
            <button id="names-set-resolution" type="button">Update resolution</button>
            <button id="names-set-reverse" type="button">Set reverse name</button>
          </div>

          <label><span class="label">New owner</span><input id="names-new-owner" type="text" autocomplete="off" placeholder="0x…" /></label>
          <div class="button-row">
            <button id="names-transfer" type="button">Nominate new owner</button>
            <button id="names-accept" type="button">Accept pending transfer</button>
          </div>
        </div>
      </div>

      <div id="names-transaction-state" class="security-check" role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        <p><strong>Ready</strong><small>Transactions are simulated, gas-estimated, and revalidated against chain/account state before wallet approval.</small></p>
      </div>
      <p id="names-error-recovery" class="muted" role="alert" aria-live="assertive"></p>
    </section>
  `;
}

function setAppState(label, state = 'idle') {
  const pill = $('#names-app-state');
  if (!pill) return;
  pill.textContent = label;
  pill.dataset.state = state;
}

function setTransactionState(title, detail, state = 'idle') {
  const root = $('#names-transaction-state');
  if (!root) return;
  root.querySelector('strong').textContent = title;
  root.querySelector('small').textContent = detail;
  root.dataset.state = state;
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll('#names-management-panel button').forEach((button) => {
    if (button.id !== 'names-connect') button.disabled = value || !context;
  });
  if ($('#names-connect')) $('#names-connect').disabled = value;
}

function durationSeconds(selector) {
  const days = Number($(selector).value);
  if (!Number.isInteger(days) || days < 30 || days > 365) throw new Error('lease duration must be an integer from 30 through 365 days');
  return BigInt(days) * 86400n;
}

async function loadRuntimeConfig() {
  const response = await fetch('./runtime-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`runtime config ${response.status}`);
  const config = await response.json();
  if (!config?.network?.chainId || !config?.deployment?.namesAddress) {
    throw new Error('420 Names management requires a qualified chain-specific deployment');
  }
  return config;
}

async function connectNames() {
  if (!globalThis.ethereum) throw new Error('No injected EIP-1193 wallet found');
  const config = await loadRuntimeConfig();
  const provider = new InjectedProvider420(globalThis.ethereum);
  let accounts = await provider.request('eth_accounts');
  if (!Array.isArray(accounts) || !accounts.length) accounts = await provider.requestAccounts();
  if (!Array.isArray(accounts) || !accounts.length) throw new Error('No account authorized for 420 Names');
  const account = accounts[0].toLowerCase();
  const client = createNames420ManagementClient({
    provider,
    namesAddress: config.deployment.namesAddress,
    chainId: config.network.chainId,
    account,
  });
  await client.verifySession();
  context = Object.freeze({ config, provider, account, client });
  $('#names-account').textContent = account;
  $('#names-contract').textContent = client.namesAddress;
  $('#names-network').textContent = config.network.name || config.network.chainId;
  setAppState('Verified', 'passed');
  setTransactionState('Names420 verified', 'Connected account, chain, bytecode identity, and protocol version passed preflight.', 'passed');
}

async function withRecovery(button, action) {
  if (busy) return;
  setBusy(true);
  $('#names-error-recovery').textContent = '';
  try {
    await action();
  } catch (error) {
    const classified = classifyNames420Error(error);
    setAppState('Action blocked', 'idle');
    setTransactionState('Action blocked', classified.message, 'idle');
    $('#names-error-recovery').textContent = `Recovery: ${classified.retryable ? 'correct the state shown above and retry. ' : ''}${classified.message}`;
    button?.focus();
  } finally {
    setBusy(false);
  }
}

async function confirmSubmission(submitted, successText) {
  setAppState('Submitted', 'pending');
  setTransactionState('Transaction submitted', `${submitted.txHash} · waiting for chain confirmation`, 'pending');
  const confirmed = await context.client.confirm(submitted.txHash);
  setAppState('Confirmed', 'passed');
  setTransactionState('Confirmed', `${successText} · ${confirmed.txHash}`, 'passed');
  return confirmed;
}

function registrationInput() {
  return {
    name: $('#names-register-name').value.trim(),
    durationSeconds: durationSeconds('#names-register-days'),
    salt: $('#names-register-salt').value.trim(),
  };
}

async function showCommitmentState() {
  const state = await context.client.commitmentState(registrationInput());
  $('#names-commitment').textContent = state.commitment;
  $('#names-committed-at').textContent = state.committedAt === 0n ? 'Not committed' : state.committedAt.toString();
  $('#names-reveal-window').textContent = state.committedAt === 0n
    ? 'Commit first'
    : `${state.revealAfter} – ${state.revealBefore} · ${state.ready ? 'ready now' : state.expired ? 'expired' : 'waiting'}`;
  return state;
}

async function loadRecord() {
  const name = $('#names-manage-name').value.trim();
  const resolved = await context.client.reader.lookup(name);
  const record = resolved.record;
  $('#names-record-owner').textContent = record.owner;
  $('#names-record-pending').textContent = record.pendingOwner;
  $('#names-record-target').textContent = record.resolvedAddress;
  $('#names-record-expiry').textContent = record.expiresAt.toString();
  $('#names-resolution-address').value = record.resolvedAddress;
  $('#names-profile-id').value = record.profileId === ZERO32 ? '' : record.profileId;
  $('#names-service-id').value = record.serviceId === ZERO32 ? '' : record.serviceId;
  return record;
}

function confirmAction(message) {
  return !globalThis.confirm || globalThis.confirm(message);
}

export function installNames420ManagementUi() {
  if ($('#names-management-panel')) return;
  const main = document.querySelector('main.shell') || document.querySelector('main');
  if (!main) return;
  const anchor = $('#services-section') || $('#status');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = namesMarkup();
  const panel = wrapper.firstElementChild;
  if (anchor) main.insertBefore(panel, anchor);
  else main.append(panel);

  $('#names-connect').addEventListener('click', (event) => withRecovery(event.currentTarget, connectNames));
  $('#names-generate-salt').addEventListener('click', () => {
    try {
      $('#names-register-salt').value = randomNames420Salt();
      $('#names-error-recovery').textContent = 'Store this salt until registration confirms. Losing it requires a new commitment.';
    } catch (error) {
      $('#names-error-recovery').textContent = classifyNames420Error(error).message;
    }
  });
  $('#names-check-commitment').addEventListener('click', (event) => withRecovery(event.currentTarget, showCommitmentState));

  $('#names-commit').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    if (!confirmAction('Submit the 420Names commitment transaction? Keep your salt private until reveal.')) return;
    setTransactionState('Preflighting commitment', 'Checking availability, simulating, estimating gas, and revalidating account/network.', 'pending');
    const submitted = await context.client.sendCommit(registrationInput());
    await confirmSubmission(submitted, 'Commitment confirmed');
    await showCommitmentState();
  }));

  $('#names-register').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    const state = await showCommitmentState();
    if (!state.ready) throw new Error(state.expired ? 'registration commitment expired' : `registration commitment is not ready until chain time ${state.revealAfter}`);
    if (!confirmAction(`Reveal and register ${state.name} to ${context.account}? The registration salt becomes public in this transaction.`)) return;
    setTransactionState('Preflighting registration', 'Rechecking commitment age and availability before wallet approval.', 'pending');
    const submitted = await context.client.sendRegister(registrationInput());
    await confirmSubmission(submitted, `${state.name} registered`);
    $('#names-manage-name').value = state.name;
    await loadRecord();
  }));

  $('#names-load-record').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    await loadRecord();
    setTransactionState('Canonical record loaded', 'Owner, pending owner, forward target, and expiry were read directly from Names420.', 'passed');
  }));

  $('#names-renew').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    const name = $('#names-manage-name').value.trim();
    if (!confirmAction(`Renew ${name} by ${$('#names-renew-days').value} days?`)) return;
    const submitted = await context.client.sendRenew({ name, durationSeconds: durationSeconds('#names-renew-days') });
    await confirmSubmission(submitted, `${name} renewed`);
    await loadRecord();
  }));

  $('#names-set-resolution').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    const name = $('#names-manage-name').value.trim();
    const resolvedAddress = $('#names-resolution-address').value.trim();
    if (!confirmAction(`Update ${name} forward resolution to ${resolvedAddress}? Existing reverse resolution may become invalid.`)) return;
    const submitted = await context.client.sendResolution({
      name,
      resolvedAddress,
      profileId: $('#names-profile-id').value.trim(),
      serviceId: $('#names-service-id').value.trim(),
    });
    await confirmSubmission(submitted, `${name} resolution updated`);
    await loadRecord();
  }));

  $('#names-set-reverse').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    const name = $('#names-manage-name').value.trim();
    if (!confirmAction(`Set ${name} as the reverse name for the connected account? Forward resolution must currently point to this account.`)) return;
    const submitted = await context.client.sendReverse({ name });
    await confirmSubmission(submitted, `${name} reverse name set`);
  }));

  $('#names-transfer').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    const name = $('#names-manage-name').value.trim();
    const newOwner = $('#names-new-owner').value.trim();
    if (!confirmAction(`Nominate ${newOwner} as the new owner of ${name}? Ownership changes only after that address accepts.`)) return;
    const submitted = await context.client.sendTransfer({ name, newOwner });
    await confirmSubmission(submitted, `${name} transfer nomination confirmed`);
    await loadRecord();
  }));

  $('#names-accept').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    const name = $('#names-manage-name').value.trim();
    if (!confirmAction(`Accept ownership of ${name}? Forward resolution resets to your address and previous profile/service links are cleared.`)) return;
    const submitted = await context.client.sendAccept({ name });
    await confirmSubmission(submitted, `${name} ownership accepted`);
    await loadRecord();
  }));

  setBusy(false);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installNames420ManagementUi, { once: true });
  else installNames420ManagementUi();
}
