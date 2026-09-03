import { CORE_SERVICES, validateRuntimeConfig } from './core/config.js';
import { InjectedProvider420 } from './core/provider.js';
import { discoverSmartAccount } from './core/accounts.js';
import { inspectCapabilityGrant } from './core/capabilities.js';
import { confirmSmartAccountCreation, sendSmartAccountCreation } from './core/deployment.js';
import { confirmSmartAccountExecution, prepareSmartAccountExecution, sendSmartAccountExecution } from './core/execution.js';
import { formatUnits, readNetwork, readPortfolio } from './core/portfolio.js';
import { resolveServices } from './core/services.js';

const state = {
  provider: null,
  controller: null,
  smartAccount: null,
  network: null,
  portfolio: { native: [], tokens: [] },
  services: CORE_SERVICES.map((service) => ({ ...service, available: false, url: null })),
  config: null,
  creatingAccount: false,
  executing: false,
  lastSimulation: null,
  capabilityInspection: null,
};

const $ = (selector) => document.querySelector(selector);
const shortAddress = (address) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—';
const shortBytes32 = (value) => value ? `${value.slice(0, 10)}…${value.slice(-8)}` : '—';

function executionRequest() {
  return {
    target: $('#execute-target').value.trim(),
    value: $('#execute-value').value.trim() || '0',
    data: $('#execute-data').value.trim() || '0x',
  };
}

function invalidateSimulation() {
  state.lastSimulation = null;
  $('#execute-simulation').textContent = 'Not simulated';
  render();
}

function renderPortfolio() {
  const list = $('#portfolio');
  list.replaceChildren();
  for (const balance of [...state.portfolio.native, ...state.portfolio.tokens]) {
    const item = document.createElement('div');
    item.className = 'service-card';
    item.textContent = `${balance.symbol}: ${formatUnits(balance.raw, balance.decimals)} · ${shortAddress(balance.address || balance.account)}`;
    list.append(item);
  }
  if (!list.children.length) list.textContent = 'Connect a wallet to load read-only balances.';
}

function renderCapabilityInspection() {
  const inspection = state.capabilityInspection;
  $('#capability-registry').textContent = state.smartAccount?.capabilityRegistry ? shortAddress(state.smartAccount.capabilityRegistry) : '—';
  if (!inspection) {
    $('#capability-state').textContent = 'Not inspected';
    $('#capability-principal').textContent = '—';
    $('#capability-id').textContent = '—';
    $('#capability-scope').textContent = '—';
    $('#capability-limits').textContent = '—';
    return;
  }
  $('#capability-state').textContent = inspection.exists
    ? `${inspection.belongsToAccount ? 'Account grant' : 'Foreign grant'} · ${inspection.grant.revoked ? 'revoked' : 'not revoked'}`
    : 'Unknown grant';
  $('#capability-principal').textContent = inspection.exists ? shortAddress(inspection.grant.principal) : '—';
  $('#capability-id').textContent = inspection.exists ? shortBytes32(inspection.grant.capabilityId) : '—';
  $('#capability-scope').textContent = inspection.exists ? shortBytes32(inspection.grant.scopeHash) : '—';
  $('#capability-limits').textContent = inspection.exists
    ? `call ${inspection.grant.perCallLimit} · period ${inspection.grant.periodLimit}/${inspection.grant.periodSeconds}s · used ${inspection.usage.used}`
    : '—';
}

function render() {
  $('#account').textContent = shortAddress(state.controller);
  $('#smart-account').textContent = state.smartAccount ? `${shortAddress(state.smartAccount.smartAccount)} (${state.smartAccount.deployed ? 'deployed' : 'counterfactual'})` : '—';
  $('#owner').textContent = state.smartAccount?.owner ? shortAddress(state.smartAccount.owner) : '—';
  $('#network').textContent = state.network?.chainId || state.config?.network?.name || '420 Integrated';
  $('#block').textContent = state.network ? state.network.blockNumber.toString() : '—';
  $('#rpc-status').textContent = state.network?.chainMismatch ? 'Wrong network' : state.network?.healthy ? 'Healthy' : 'Not checked';
  $('#connect').textContent = state.controller ? 'Connected' : 'Connect wallet';
  $('#connect').disabled = Boolean(state.controller);

  const creationEnabled = state.config?.features?.smartAccountCreation === true;
  const canCreate = creationEnabled && state.controller && state.smartAccount && !state.smartAccount.deployed && !state.creatingAccount;
  $('#create-account').hidden = !creationEnabled || state.smartAccount?.deployed === true;
  $('#create-account').disabled = !canCreate;
  $('#create-account').textContent = state.creatingAccount ? 'Creating…' : 'Create Smart Account';

  const executionEnabled = state.config?.features?.smartAccountExecution === true;
  const canUseExecution = executionEnabled && state.smartAccount?.deployed && state.smartAccount?.controllerIsOwner && !state.executing;
  $('#execution-panel').hidden = !executionEnabled;
  $('#simulate-execution').disabled = !canUseExecution;
  $('#send-execution').disabled = !canUseExecution || !state.lastSimulation;
  $('#send-execution').textContent = state.executing ? 'Executing…' : 'Execute';
  $('#execution-authority').textContent = canUseExecution ? 'Verified on-chain owner' : 'Unavailable';

  const capabilityEnabled = state.config?.features?.capabilityInspection === true;
  const canInspect = capabilityEnabled && state.smartAccount?.deployed;
  $('#capability-panel').hidden = !capabilityEnabled;
  $('#inspect-capability').disabled = !canInspect;
  renderCapabilityInspection();
  renderPortfolio();

  const list = $('#services');
  list.replaceChildren();
  for (const service of state.services) {
    const item = document.createElement('a');
    item.className = `service-card${service.available ? '' : ' unavailable'}`;
    item.textContent = service.name;
    item.href = service.available ? service.url : '#';
    item.target = service.available ? '_blank' : '_self';
    item.rel = 'noopener noreferrer';
    item.ariaDisabled = service.available ? 'false' : 'true';
    if (!service.available) item.addEventListener('click', (event) => event.preventDefault());
    list.append(item);
  }
}

async function loadConfig() {
  const response = await fetch('./runtime-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`runtime config ${response.status}`);
  const config = await response.json();
  validateRuntimeConfig(config);
  state.config = config;
  if (config.manifest?.url) {
    const manifestResponse = await fetch(config.manifest.url, { cache: 'no-store' });
    if (!manifestResponse.ok) throw new Error(`ecosystem manifest ${manifestResponse.status}`);
    state.services = resolveServices(await manifestResponse.json(), CORE_SERVICES);
  }
}

async function refreshConnectedState() {
  state.network = await readNetwork(state.provider, state.config.network.chainId);
  if (state.network.chainMismatch) throw new Error(`Wrong network: expected ${state.network.expectedChainId}, received ${state.network.chainId}`);
  state.smartAccount = await discoverSmartAccount(state.provider, state.controller, state.config.smartAccount);
  state.portfolio = await readPortfolio(state.provider, [state.controller, state.smartAccount.smartAccount], state.config.trackedAssets);
  state.lastSimulation = null;
  state.capabilityInspection = null;
  render();
}

async function connectInjectedWallet() {
  if (!globalThis.ethereum) throw new Error('No injected EIP-1193 wallet found');
  state.provider = new InjectedProvider420(globalThis.ethereum);
  const accounts = await state.provider.requestAccounts();
  state.controller = accounts?.[0]?.toLowerCase() || null;
  if (!state.controller) throw new Error('No account authorized');
  await refreshConnectedState();
}

$('#connect').addEventListener('click', async () => {
  $('#status').textContent = 'Authorizing wallet access…';
  try {
    await connectInjectedWallet();
    $('#status').textContent = state.smartAccount.deployed
      ? 'Canonical Smart Account loaded. Owner execution and read-only capability inspection are available.'
      : 'Counterfactual Smart Account discovered. Creation is available with explicit wallet approval.';
  } catch (error) {
    $('#status').textContent = error.message;
  }
});

$('#create-account').addEventListener('click', async () => {
  if (!state.provider || !state.controller || state.smartAccount?.deployed) return;
  if (globalThis.confirm && !globalThis.confirm(`Create SmartAccount420 at ${state.smartAccount.smartAccount}? Your connected wallet must approve the factory transaction.`)) return;
  state.creatingAccount = true;
  render();
  $('#status').textContent = 'Requesting explicit approval for SmartAccountFactory420 creation…';
  try {
    const submitted = await sendSmartAccountCreation(state.provider, state.controller, state.config.smartAccount);
    if (!submitted.submitted) {
      await refreshConnectedState();
      $('#status').textContent = 'Smart Account was already deployed; canonical state refreshed.';
      return;
    }
    $('#status').textContent = `Creation submitted: ${submitted.txHash}. Waiting for confirmation…`;
    await confirmSmartAccountCreation(state.provider, submitted.txHash, state.controller, state.config.smartAccount);
    await refreshConnectedState();
    $('#status').textContent = `SmartAccount420 created and owner verified: ${state.smartAccount.smartAccount}`;
  } catch (error) {
    $('#status').textContent = error.message;
  } finally {
    state.creatingAccount = false;
    render();
  }
});

for (const selector of ['#execute-target', '#execute-value', '#execute-data']) {
  $(selector).addEventListener('input', invalidateSimulation);
}

$('#simulate-execution').addEventListener('click', async () => {
  if (!state.provider || !state.smartAccount?.deployed) return;
  $('#status').textContent = 'Simulating SmartAccount420 owner execution…';
  try {
    state.lastSimulation = await prepareSmartAccountExecution(state.provider, state.controller, state.smartAccount, executionRequest());
    $('#execute-simulation').textContent = `Passed · gas ${state.lastSimulation.simulation.gas}`;
    $('#status').textContent = 'Owner-authorized simulation passed. Execution may now be explicitly approved.';
  } catch (error) {
    state.lastSimulation = null;
    $('#execute-simulation').textContent = 'Failed';
    $('#status').textContent = error.message;
  }
  render();
});

$('#send-execution').addEventListener('click', async () => {
  if (!state.provider || !state.lastSimulation || state.executing) return;
  const request = executionRequest();
  if (globalThis.confirm && !globalThis.confirm(`Execute through SmartAccount420 to ${request.target}? The call will be re-simulated before your wallet is asked to approve it.`)) return;
  state.executing = true;
  render();
  $('#status').textContent = 'Re-simulating and requesting explicit owner approval…';
  try {
    const submitted = await sendSmartAccountExecution(state.provider, state.controller, state.smartAccount, request);
    $('#status').textContent = `Execution submitted: ${submitted.txHash}. Waiting for confirmation…`;
    await confirmSmartAccountExecution(state.provider, submitted.txHash, state.controller, state.config.smartAccount);
    await refreshConnectedState();
    $('#execute-simulation').textContent = 'Not simulated';
    $('#status').textContent = `SmartAccount420 execution confirmed: ${submitted.txHash}`;
  } catch (error) {
    state.lastSimulation = null;
    $('#execute-simulation').textContent = 'Failed';
    $('#status').textContent = error.message;
  } finally {
    state.executing = false;
    render();
  }
});

$('#inspect-capability').addEventListener('click', async () => {
  if (!state.provider || !state.smartAccount?.deployed) return;
  $('#status').textContent = 'Reading canonical capability grant…';
  try {
    state.capabilityInspection = await inspectCapabilityGrant(
      state.provider,
      state.smartAccount,
      $('#capability-grant-id').value.trim(),
    );
    $('#status').textContent = state.capabilityInspection.exists
      ? 'Capability grant loaded from canonical CapabilityRegistry420.'
      : 'No capability grant exists for that grant ID.';
  } catch (error) {
    state.capabilityInspection = null;
    $('#status').textContent = error.message;
  }
  render();
});

loadConfig().catch((error) => { $('#status').textContent = `Configuration warning: ${error.message}`; }).finally(render);
