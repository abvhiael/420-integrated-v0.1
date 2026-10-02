import {
  classifyStake420Error,
  createStake420ManagementClient,
  format420,
} from './core/stake-management.js';
import { ZERO_BYTES32 } from './core/abi.js';
import { InjectedProvider420 } from './core/provider.js';

let context = null;
let busy = false;
let lifecycleBound = false;
let withdrawReady = false;
const $ = (selector) => document.querySelector(selector);

export function stakeMarkup() {
  return `
    <section id="stake-management-panel" class="panel" aria-labelledby="stake-management-heading">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Canonical 420Stake · validator economics</p>
          <h2 id="stake-management-heading">Validator staking</h2>
          <p class="muted">Register and maintain validator collateral, inspect consensus-derived lifecycle and rewards, and follow exit/withdrawal state without granting the Wallet validator-signing authority.</p>
        </div>
        <span id="stake-app-state" class="status-pill" data-state="idle">Not connected</span>
      </div>

      <div class="account-card stake-context" aria-live="polite">
        <div><p class="label">Connected account</p><strong id="stake-account">—</strong></div>
        <div><p class="label">Stake420</p><strong id="stake-contract">—</strong></div>
        <div><p class="label">ValidatorRegistry</p><strong id="stake-registry">—</strong></div>
        <div><p class="label">Network</p><strong id="stake-network">—</strong></div>
        <button id="stake-connect" type="button">Connect / verify Stake</button>
      </div>

      <div class="split-panel">
        <div class="form-card" aria-labelledby="stake-register-heading">
          <p class="eyebrow">Registration · canonical 42,000 effective bond</p>
          <h3 id="stake-register-heading">Register a validator</h3>
          <label><span class="label">Validator ID (bytes32)</span><input id="stake-register-id" type="text" autocomplete="off" spellcheck="false" placeholder="0x…64 hex chars" /></label>
          <label><span class="label">BLS public key (48 bytes)</span><textarea id="stake-bls-pubkey" rows="3" autocomplete="off" spellcheck="false" placeholder="0x…96 hex chars"></textarea></label>
          <label><span class="label">Withdrawal address</span><input id="stake-withdrawal-address" type="text" autocomplete="off" spellcheck="false" placeholder="0x…" /></label>
          <label><span class="label">Metadata commitment (optional bytes32)</span><input id="stake-metadata" type="text" autocomplete="off" spellcheck="false" placeholder="0x…64 hex chars" /></label>
          <button id="stake-registration-quote" type="button">Check bond requirement</button>
          <dl class="names-state-list" aria-live="polite">
            <div><dt>Protocol credit funded</dt><dd id="stake-registration-credit">—</dd></div>
            <div><dt>Participant-owned bond required</dt><dd id="stake-registration-owned">—</dd></div>
          </dl>
          <button id="stake-register" type="button" class="primary-action">Simulate & register</button>
          <p class="muted">Registration is owner-authorized and simulated before approval. The Wallet does not create validator signing keys or acquire consensus authority.</p>
        </div>

        <div class="form-card" aria-labelledby="stake-state-heading">
          <p class="eyebrow">Direct canonical reads</p>
          <h3 id="stake-state-heading">Validator state</h3>
          <label><span class="label">Validator ID</span><input id="stake-validator-id" type="text" autocomplete="off" spellcheck="false" placeholder="0x…64 hex chars" /></label>
          <button id="stake-load" type="button">Reload canonical state</button>
          <dl class="names-state-list" aria-live="polite">
            <div><dt>Status</dt><dd id="stake-status-value">—</dd></div>
            <div><dt>Owner / withdrawal</dt><dd id="stake-authority-value">—</dd></div>
            <div><dt>Owned / protocol credit</dt><dd id="stake-bond-value">—</dd></div>
            <div><dt>Total slashed</dt><dd id="stake-slashed-value">—</dd></div>
            <div><dt>Reward accrued</dt><dd id="stake-reward-value">—</dd></div>
            <div><dt>Activation readiness</dt><dd id="stake-readiness-value">—</dd></div>
            <div><dt>Rotations</dt><dd id="stake-rotation-value">—</dd></div>
            <div><dt>Withdrawal</dt><dd id="stake-withdraw-value">—</dd></div>
          </dl>
          <p id="stake-exit-guidance" class="muted" role="status" aria-live="polite">Load a validator to see canonical exit and withdrawal guidance.</p>
        </div>
      </div>

      <div class="form-grid account-card" aria-labelledby="stake-bond-actions-heading">
        <div><p class="eyebrow">Owner-authorized collateral</p><h3 id="stake-bond-actions-heading">Maintain bond</h3></div>
        <label><span class="label">Top up owned bond ($420)</span><input id="stake-topup-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="420.0" /></label>
        <button id="stake-topup" type="button">Simulate & top up</button>
        <label><span class="label">Replace protocol credit with owned $420</span><input id="stake-replace-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="420.0" /></label>
        <button id="stake-replace" type="button">Simulate & replace credit</button>
        <button id="stake-withdraw" type="button" class="primary-action">Simulate & withdraw available bond</button>
      </div>

      <div id="stake-transaction-state" class="security-check" role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        <p><strong>Fail closed</strong><small>Actions remain disabled until chain identity, frozen addresses, deployed bytecode and Stake420 bindings are verified.</small></p>
      </div>
      <p id="stake-error-recovery" class="muted" role="alert" aria-live="assertive"></p>
    </section>
  `;
}

function setAppState(label, state = 'idle') {
  const pill = $('#stake-app-state');
  if (!pill) return;
  pill.textContent = label;
  pill.dataset.state = state;
}
function setTxState(title, detail, state = 'idle') {
  const root = $('#stake-transaction-state');
  if (!root) return;
  root.querySelector('strong').textContent = title;
  root.querySelector('small').textContent = detail;
  root.dataset.state = state;
}
function setBusy(value) {
  busy = value;
  document.querySelectorAll('#stake-management-panel button').forEach((button) => {
    if (button.id === 'stake-connect') return;
    if (button.id === 'stake-withdraw') button.disabled = value || !context || !withdrawReady;
    else button.disabled = value || !context;
  });
  if ($('#stake-connect')) $('#stake-connect').disabled = value;
}
function clearState() {
  withdrawReady = false;
  for (const id of ['#stake-status-value','#stake-authority-value','#stake-bond-value','#stake-slashed-value','#stake-reward-value','#stake-readiness-value','#stake-rotation-value','#stake-withdraw-value']) {
    if ($(id)) $(id).textContent = '—';
  }
}
async function loadRuntimeConfig() {
  const response = await fetch('./runtime-config.json', { cache:'no-store' });
  if (!response.ok) throw new Error(`runtime config ${response.status}`);
  const config = await response.json();
  const deployment = config?.deployment;
  if (!config?.network?.chainId || !deployment?.stakeAddress || !deployment?.validatorRegistryAddress || !deployment?.rewardControllerAddress) {
    throw new Error('420 Stake requires a qualified chain-specific canonical Stake deployment');
  }
  return config;
}
function invalidateStake(reason) {
  context = null;
  clearState();
  setAppState('Reload required', 'idle');
  setTxState('Wallet state changed', reason, 'idle');
  $('#stake-error-recovery').textContent = 'Recovery: reconnect and reload canonical Stake state before continuing.';
  setBusy(false);
}
function selectedValidatorId() {
  const value = $('#stake-validator-id').value.trim();
  if (!value) throw new Error('Enter or discover a validator ID first');
  return value;
}
async function connectStake() {
  if (!globalThis.ethereum) throw new Error('No injected EIP-1193 wallet found');
  const config = await loadRuntimeConfig();
  const provider = new InjectedProvider420(globalThis.ethereum);
  let accounts = await provider.request('eth_accounts');
  if (!Array.isArray(accounts) || !accounts.length) accounts = await provider.requestAccounts();
  if (!Array.isArray(accounts) || !accounts.length) throw new Error('No account authorized for 420 Stake');
  const account = accounts[0].toLowerCase();
  const client = createStake420ManagementClient({
    provider,
    chainId:config.network.chainId,
    account,
    stakeAddress:config.deployment.stakeAddress,
    validatorRegistryAddress:config.deployment.validatorRegistryAddress,
    rewardControllerAddress:config.deployment.rewardControllerAddress,
  });
  await client.verifySession();
  context = Object.freeze({ config, provider, account, client });
  if (!lifecycleBound) {
    provider.on('accountsChanged', () => invalidateStake('The connected wallet account changed.'));
    provider.on('chainChanged', () => invalidateStake('The connected wallet network changed.'));
    lifecycleBound = true;
  }
  $('#stake-account').textContent = account;
  $('#stake-contract').textContent = client.stakeAddress;
  $('#stake-registry').textContent = client.validatorRegistryAddress;
  $('#stake-network').textContent = config.network.name || config.network.chainId;
  $('#stake-withdrawal-address').value ||= account;
  const ownedId = await client.validatorIdForAccount();
  if (!/^0x0{64}$/.test(ownedId)) {
    $('#stake-validator-id').value = ownedId;
    await loadValidator();
  }
  setAppState('Verified', 'passed');
  setTxState('Canonical Stake verified', 'Chain, frozen addresses, runtime bytecode and Stake420 bindings passed preflight.', 'passed');
}
async function withRecovery(button, action) {
  if (busy) return;
  setBusy(true);
  $('#stake-error-recovery').textContent = '';
  try { await action(); }
  catch (error) {
    const classified = classifyStake420Error(error);
    setAppState('Action blocked', 'idle');
    setTxState('Action blocked', classified.message, 'idle');
    $('#stake-error-recovery').textContent = `Recovery: ${classified.message}`;
    button?.focus();
  } finally { setBusy(false); }
}
async function registrationQuote() {
  const quote = await context.client.registrationQuote($('#stake-register-id').value.trim());
  $('#stake-registration-credit').textContent = `${format420(quote.pendingProtocolCredit)} $420`;
  $('#stake-registration-owned').textContent = `${format420(quote.ownedRequired)} $420`;
  return quote;
}
async function loadValidator() {
  const summary = await context.client.summary(selectedValidatorId());
  $('#stake-status-value').textContent = summary.statusLabel;
  $('#stake-authority-value').textContent = `${summary.owner} / ${summary.withdrawal}`;
  $('#stake-bond-value').textContent = `${format420(summary.ownedBond)} / ${format420(summary.protocolCredit)} $420 · effective ${format420(summary.effectiveBond)}`;
  $('#stake-slashed-value').textContent = `${format420(summary.totalSlashed)} $420`;
  $('#stake-reward-value').textContent = `${format420(summary.rewardAccrued)} $420`;
  $('#stake-readiness-value').textContent = summary.activationBlocksRemaining === 0n
    ? (summary.bondReady ? 'Activation delay satisfied · full effective bond' : 'Activation delay satisfied · bond requires maintenance')
    : `${summary.activationBlocksRemaining} blocks remain in activation delay`;
  $('#stake-rotation-value').textContent = `activation ${summary.activationRotation} · scheduled exit ${summary.scheduledExitRotation} · cooldown until ${summary.cooldownUntilRotation}`;
  $('#stake-withdraw-value').textContent = summary.withdrawableBlock === 0n ? 'Not scheduled' : `block ${summary.withdrawableBlock} · ${summary.canWithdraw ? 'available to this account' : 'not available to this account'}`;
  $('#stake-exit-guidance').textContent = summary.exitGuidance;
  withdrawReady = summary.canWithdraw;
  $('#stake-withdraw').disabled = busy || !withdrawReady;
  return summary;
}
async function confirmSubmission(submitted, successText) {
  setAppState('Submitted', 'pending');
  setTxState('Transaction submitted', `${submitted.txHash} · waiting for canonical receipt`, 'pending');
  await context.client.confirm(submitted.txHash);
  setAppState('Confirmed', 'passed');
  setTxState('Confirmed', `${successText} · ${submitted.txHash}`, 'passed');
}

export function installStake420ManagementUi() {
  if ($('#stake-management-panel')) return;
  const main = document.querySelector('main.shell') || document.querySelector('main');
  if (!main) return;
  const anchor = $('#services-section') || $('#status');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = stakeMarkup();
  const panel = wrapper.firstElementChild;
  if (anchor) main.insertBefore(panel, anchor); else main.append(panel);

  $('#stake-connect').addEventListener('click', (event) => withRecovery(event.currentTarget, connectStake));
  $('#stake-registration-quote').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    await registrationQuote();
    setTxState('Bond requirement verified', 'Pending protocol credit and participant-owned bond were read from ValidatorRegistry.', 'passed');
  }));
  $('#stake-register').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    const quote = await registrationQuote();
    if (globalThis.confirm && !globalThis.confirm(`Register this validator with ${format420(quote.ownedRequired)} owned $420? The transaction will be simulated before approval.`)) return;
    setTxState('Preflighting registration', 'Revalidating canonical deployment, bond composition, simulation and gas estimate.', 'pending');
    const submitted = await context.client.sendRegistration({
      validatorId:$('#stake-register-id').value.trim(),
      blsPubkey:$('#stake-bls-pubkey').value.trim(),
      withdrawal:$('#stake-withdrawal-address').value.trim(),
      metadataCommitment:$('#stake-metadata').value.trim() || ZERO_BYTES32,
    });
    await confirmSubmission(submitted, 'Validator registration confirmed');
    $('#stake-validator-id').value = submitted.validatorId;
    await loadValidator();
  }));
  $('#stake-load').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    await loadValidator();
    setTxState('Canonical validator state loaded', 'Lifecycle, collateral and reward state were read directly from Stake420 and ValidatorRegistry.', 'passed');
  }));
  $('#stake-topup').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    if (globalThis.confirm && !globalThis.confirm('Top up participant-owned validator collateral?')) return;
    const submitted = await context.client.sendTopUp({ validatorId:selectedValidatorId(), amount420:$('#stake-topup-amount').value });
    await confirmSubmission(submitted, 'Owned bond top-up confirmed');
    await loadValidator();
  }));
  $('#stake-replace').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    if (globalThis.confirm && !globalThis.confirm('Replace protocol-owned validator credit with participant-owned $420?')) return;
    const submitted = await context.client.sendReplaceCredit({ validatorId:selectedValidatorId(), amount420:$('#stake-replace-amount').value });
    await confirmSubmission(submitted, 'Protocol credit replacement confirmed');
    await loadValidator();
  }));
  $('#stake-withdraw').addEventListener('click', (event) => withRecovery(event.currentTarget, async () => {
    const current = await loadValidator();
    if (!current.canWithdraw) throw new Error(current.exitGuidance);
    if (globalThis.confirm && !globalThis.confirm('Withdraw the canonical available validator bond to this withdrawal account?')) return;
    const submitted = await context.client.sendWithdraw({ validatorId:selectedValidatorId() });
    await confirmSubmission(submitted, 'Validator bond withdrawal confirmed');
    await loadValidator();
  }));

  setBusy(false);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installStake420ManagementUi, { once:true });
  else installStake420ManagementUi();
}
