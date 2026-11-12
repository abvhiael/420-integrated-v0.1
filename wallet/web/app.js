import { CORE_SERVICES, validateRuntimeConfig } from './core/config.js';
import { InjectedProvider420 } from './core/provider.js';
import { discoverSmartAccount } from './core/accounts.js';
import { inspectCapabilityGrant } from './core/capabilities.js';
import {
  confirmCapabilityManagementTransaction,
  sendCapabilityGrantRevocation,
  sendGasSponsorGrantCreation,
} from './core/capability-management.js';
import {
  confirmSessionManagementTransaction,
  sendSessionGrantCreation,
  sendSessionKeyEnablement,
  sendSessionKeyRevocation,
} from './core/session-management.js';
import { confirmSmartAccountCreation, sendSmartAccountCreation } from './core/deployment.js';
import { confirmSmartAccountExecution, prepareSmartAccountExecution, sendSmartAccountExecution } from './core/execution.js';
import { formatUnits, readNetwork, readPortfolio } from './core/portfolio.js';
import { selectNativeAccountBalance420 } from './core/dashboard.js';
import { getCanonicalReceiveAddress420 } from './core/receive.js';
import { resolveServices } from './core/services.js';
function publishWalletVerificationState420(phase='idle',error=null) {
  document.dispatchEvent(new CustomEvent('wallet:verification-state',{detail:{
    config:state.config, network:state.network, controller:state.controller,
    smartAccount:state.smartAccount, phase, error
  }}));
}


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
  managingCapability: false,
  managingSession: false,
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
    expectedChainId: state.config?.network?.chainId,
  };
}
function gasSponsorRequest() {
  return {
    sponsor: $('#sponsor-address').value.trim(),
    operation: $('#sponsor-operation').value.trim(),
    perCallLimit: $('#sponsor-per-call').value.trim() || '0',
    periodLimit: $('#sponsor-period-limit').value.trim() || '0',
    periodSeconds: $('#sponsor-period-seconds').value.trim() || '0',
    validFrom: $('#sponsor-valid-from').value.trim() || '0',
    validUntil: $('#sponsor-valid-until').value.trim() || '0',
  };
}
function sessionGrantRequest() {
  return {
    key: $('#session-key').value.trim(),
    target: $('#session-target').value.trim(),
    selector: $('#session-selector').value.trim(),
    perCallLimit: $('#session-per-call').value.trim() || '0',
    periodLimit: $('#session-period-limit').value.trim() || '0',
    periodSeconds: $('#session-period-seconds').value.trim() || '0',
    validFrom: $('#session-valid-from').value.trim() || '0',
    validUntil: $('#session-valid-until').value.trim() || '0',
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
  const smartAddress = state.smartAccount?.smartAccount || null;
  const nativeSmart = selectNativeAccountBalance420(state.portfolio, smartAddress);
  const nativeController = selectNativeAccountBalance420(state.portfolio, state.controller);
  $('#dashboard-native-balance').textContent = nativeSmart ? `${formatUnits(nativeSmart.raw, nativeSmart.decimals)} 420` : 'Unavailable';
  $('#dashboard-controller-balance').textContent = nativeController ? `${formatUnits(nativeController.raw, nativeController.decimals)} 420` : 'Unavailable';
  $('#dashboard-balance-context').textContent = nativeSmart
    ? 'Read-only native balance for this Smart Account. Token balances are listed separately below.'
    : 'Connect a controller and verify your Smart Account to read its balance.';

  const balances = [...state.portfolio.native.map(balance => ({ ...balance, kind: 'native', holder: balance.address })),
    ...state.portfolio.tokens.map(balance => ({ ...balance, kind: 'token', holder: balance.account }))];
  const groups = [
    { address: smartAddress, label: 'Smart Account assets' },
    { address: state.controller?.toLowerCase() === smartAddress?.toLowerCase() ? null : state.controller, label: 'Controller assets' },
  ];
  for (const group of groups) {
    if (!group.address) continue;
    const matching = balances.filter(balance => balance.holder?.toLowerCase() === group.address.toLowerCase());
    if (!matching.length) continue;
    const section = document.createElement('section');
    section.className = 'wallet-asset-group';
    const heading = document.createElement('h3');
    heading.textContent = group.label;
    const caption = document.createElement('p');
    caption.className = 'wallet-field-help wallet-address-break';
    caption.textContent = group.address;
    const cards = document.createElement('div');
    cards.className = 'wallet-asset-cards';
    for (const balance of matching) {
      const item = document.createElement('div');
      item.className = 'service-card wallet-asset-row';
      const symbol = document.createElement('strong');
      symbol.textContent = balance.symbol;
      const amount = document.createElement('span');
      amount.textContent = `${formatUnits(balance.raw, balance.decimals)} ${balance.symbol}`;
      const detail = document.createElement('small');
      detail.className = 'wallet-address-break';
      detail.textContent = balance.kind === 'native' ? 'Native 420 · network asset'
        : `ERC-20 · ${balance.address}`;
      item.append(symbol, amount, detail);
      cards.append(item);
    }
    section.append(heading, caption, cards);
    list.append(section);
  }
  if (!list.children.length) list.textContent = state.controller
    ? 'No supported balances available for the connected accounts.'
    : 'Connect a wallet to load read-only balances.';
}

function renderReceive() {
  const address = getCanonicalReceiveAddress420({
    smartAccount: state.smartAccount,
    network: state.network,
    expectedChainId: state.config?.network?.chainId,
  });
  $('#receive-address').textContent = address || 'Unavailable';
  $('#copy-receive-address').disabled = !address;
  const copyFromOverview = document.querySelector('.wallet-identity-card [data-copy-source="#receive-address"]');
  if (copyFromOverview) copyFromOverview.disabled = !address;
  $('#receive-status').textContent = address
    ? 'Deployed Smart Account found on the configured network. Confirm the destination with the sender.'
    : state.smartAccount && !state.smartAccount.deployed
      ? 'Account is counterfactual and has not been deployed. Receive address sharing is blocked until deployment.'
      : 'A deployed Smart Account and the expected network are required before receiving.';
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

function runtimeAuthorityReady420() {
  const c = state.config;
  return Boolean(c?.network?.chainId && c?.smartAccount?.factoryAddress
    && c?.deployment?.entryPointAddress && c?.deployment?.capabilityRegistryAddress
    && state.network && !state.network.chainMismatch);
}
function render() {
  $('#account').textContent = shortAddress(state.controller);
  $('#smart-account').textContent = state.smartAccount ? `${shortAddress(state.smartAccount.smartAccount)} (${state.smartAccount.deployed ? 'deployed' : 'counterfactual'})` : '—';
  $('#owner').textContent = state.smartAccount?.owner ? shortAddress(state.smartAccount.owner) : '—';
  $('#network').textContent = state.network?.chainId || state.config?.network?.name || '420 Integrated';
  $('#block').textContent = state.network ? state.network.blockNumber.toString() : '—';
  $('#rpc-status').textContent = state.network?.chainMismatch ? 'Wrong network' : state.network?.healthy ? 'RPC reachable · contract verification separate' : 'Not checked';
  const dashboardState = $('#dashboard-account-state');
  dashboardState.textContent = state.smartAccount?.deployed
    ? 'Deployed Smart Account'
    : state.smartAccount ? 'Counterfactual Smart Account'
      : state.controller ? 'Account authority unavailable' : 'Not connected';
  dashboardState.dataset.state = state.smartAccount?.deployed ? 'passed' : 'idle';
  $('#connect').textContent = state.controller ? 'Connected' : 'Connect wallet';
  $('#connect').disabled = Boolean(state.controller);

  const creationEnabled = runtimeAuthorityReady420() && state.config?.features?.smartAccountCreation === true;
  const canCreate = creationEnabled && state.controller && state.smartAccount && !state.smartAccount.deployed && !state.creatingAccount;
  $('#create-account').hidden = !creationEnabled || state.smartAccount?.deployed === true;
  $('#create-account').disabled = !canCreate;
  $('#create-account').textContent = state.creatingAccount ? 'Creating…' : 'Create Smart Account';

  const executionEnabled = runtimeAuthorityReady420() && state.config?.features?.smartAccountExecution === true;
  const canUseExecution = executionEnabled && state.smartAccount?.deployed && state.smartAccount?.controllerIsOwner && !state.executing;
  $('#execution-panel').hidden = !executionEnabled;
  $('#simulate-execution').disabled = !canUseExecution;
  $('#send-execution').disabled = !canUseExecution || !state.lastSimulation;
  $('#send-execution').textContent = state.executing ? 'Executing…' : 'Execute';
  $('#execution-authority').textContent = canUseExecution ? 'Verified on-chain owner' : 'Unavailable';

  const capabilityEnabled = runtimeAuthorityReady420() && state.config?.features?.capabilityInspection === true;
  const mutationEnabled = runtimeAuthorityReady420() && state.config?.features?.capabilityMutation === true;
  const sponsorEnabled = state.config?.features?.gasSponsorGrantManagement === true;
  const canInspect = capabilityEnabled && state.smartAccount?.deployed;
  const canManage = mutationEnabled && sponsorEnabled && state.smartAccount?.deployed && state.smartAccount?.controllerIsOwner && !state.managingCapability;
  $('#capability-panel').hidden = !capabilityEnabled;
  $('#inspect-capability').disabled = !canInspect;
  $('#revoke-capability').disabled = !canManage || !state.capabilityInspection?.exists || !state.capabilityInspection?.belongsToAccount || state.capabilityInspection?.grant.revoked;
  $('#gas-sponsor-panel').hidden = !(mutationEnabled && sponsorEnabled);
  $('#create-sponsor-grant').disabled = !canManage;
  $('#create-sponsor-grant').textContent = state.managingCapability ? 'Managing…' : 'Create gas sponsor grant';

  const sessionAdminEnabled = state.config?.features?.sessionKeyAdministration === true;
  const sessionGrantEnabled = state.config?.features?.sessionGrantManagement === true;
  const canManageSession = sessionAdminEnabled && state.smartAccount?.deployed && state.smartAccount?.controllerIsOwner && !state.managingSession;
  $('#session-panel').hidden = !sessionAdminEnabled;
  $('#enable-session-key').disabled = !canManageSession;
  $('#revoke-session-key').disabled = !canManageSession;
  $('#create-session-grant').disabled = !(canManageSession && sessionGrantEnabled);

  renderCapabilityInspection();
  renderPortfolio();
  renderReceive();
  publishWalletVerificationState420();

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
  state.network = null;
  state.smartAccount = null;
  state.portfolio = { native: [], tokens: [] };
  renderReceive();
  state.network = await readNetwork(state.provider, state.config.network.chainId);
  if (state.network.chainMismatch) throw new Error(`Wrong network: expected ${state.network.expectedChainId}, received ${state.network.chainId}`);
  if (state.config.network.chainId && state.config.smartAccount.factoryAddress
      && state.config.deployment?.entryPointAddress && state.config.deployment?.capabilityRegistryAddress) {
    const config = { ...state.config.smartAccount,
      verifiedEntryPoint: state.config.deployment.entryPointAddress,
      verifiedCapabilityRegistry: state.config.deployment.capabilityRegistryAddress };
    state.smartAccount = await discoverSmartAccount(state.provider, state.controller, config);
    state.smartAccount.expectedChainId = state.config.network.chainId;
    state.smartAccount.verifiedCapabilityRegistry = config.verifiedCapabilityRegistry;
    state.smartAccount.verifiedEntryPoint = config.verifiedEntryPoint;
  } else state.smartAccount = null;
  state.portfolio = await readPortfolio(state.provider,
    [state.controller, state.smartAccount?.smartAccount], state.config.trackedAssets);
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
  publishWalletVerificationState420('connecting');
  try {
    await connectInjectedWallet();
    $('#status').textContent = !state.smartAccount
      ? 'Wallet connected read-only. Verified network, EntryPoint, Factory and CapabilityRegistry are not configured.'
      : state.smartAccount.deployed
        ? 'Canonical Smart Account loaded. Guarded owner execution, capability management, and session-key administration are available.'
        : 'Counterfactual Smart Account discovered. Creation is available with explicit wallet approval.';
  } catch (error) {
    state.smartAccount = null;
    state.portfolio = { native: [], tokens: [] };
    $('#status').textContent = error.message;
    render();
    publishWalletVerificationState420('failure',error.message);
  }
});

$('#create-account').addEventListener('click', async () => {
  if (!state.provider || !state.controller || state.smartAccount?.deployed) return;
  if (!globalThis.confirm?.(`Create SmartAccount420 at ${state.smartAccount.smartAccount}? Your connected wallet must approve the factory transaction.`)) return;
  state.creatingAccount = true; render();
  $('#status').textContent = 'Requesting explicit approval for SmartAccountFactory420 creation…';
  try {
    const submitted = await sendSmartAccountCreation(state.provider, state.controller, { ...state.config.smartAccount, expectedChainId: state.config.network.chainId });
    if (!submitted.submitted) { await refreshConnectedState(); $('#status').textContent = 'Smart Account was already deployed; canonical state refreshed.'; return; }
    $('#status').textContent = `Creation submitted: ${submitted.txHash}. Waiting for confirmation…`;
    await confirmSmartAccountCreation(state.provider, submitted.txHash, state.controller, state.config.smartAccount, { canonical: true, expectedChainId: state.config.network.chainId,
      onStatus: ({ status, confirmations }) => {
        $('#status').textContent = `Creation ${status}: waiting for canonical receipt (${confirmations} confirmations).`;
      } });
    await refreshConnectedState();
    $('#status').textContent = `SmartAccount420 created and owner verified: ${state.smartAccount.smartAccount}`;
  } catch (error) { $('#status').textContent = error.message; }
  finally { state.creatingAccount = false; render(); }
});

for (const selector of ['#execute-target', '#execute-value', '#execute-data']) $(selector).addEventListener('input', invalidateSimulation);

$('#simulate-execution').addEventListener('click', async () => {
  if (!state.provider || !state.smartAccount?.deployed) return;
  $('#status').textContent = 'Simulating SmartAccount420 owner execution…';
  try {
    state.lastSimulation = await prepareSmartAccountExecution(state.provider, state.controller, state.smartAccount, executionRequest());
    $('#execute-simulation').textContent = `Passed · gas ${state.lastSimulation.simulation.gas}`;
    $('#status').textContent = 'Owner-authorized simulation passed. Execution may now be explicitly approved.';
  } catch (error) { state.lastSimulation = null; $('#execute-simulation').textContent = 'Failed'; $('#status').textContent = error.message; }
  render();
});

$('#send-execution').addEventListener('click', async () => {
  if (!state.provider || !state.lastSimulation || state.executing) return;
  const request = executionRequest();
  if (!globalThis.confirm?.(`Execute through SmartAccount420 to ${request.target}, value ${request.value} wei, calldata ${request.data}? The call will be re-simulated before your wallet is asked to approve it.`)) return;
  state.executing = true; render();
  $('#status').textContent = 'Re-simulating and requesting explicit owner approval…';
  try {
    const submitted = await sendSmartAccountExecution(state.provider, state.controller, state.smartAccount, request);
    $('#status').textContent = `Execution submitted: ${submitted.txHash}. Waiting for confirmation…`;
    await confirmSmartAccountExecution(state.provider, submitted.txHash, state.controller, state.config.smartAccount, { canonical: true, expectedChainId: state.config.network.chainId,
      onStatus: ({ status, confirmations }) => {
        $('#status').textContent = `Execution ${status}: waiting for canonical receipt (${confirmations} confirmations).`;
      } });
    await refreshConnectedState();
    $('#execute-simulation').textContent = 'Not simulated';
    $('#status').textContent = `SmartAccount420 execution confirmed: ${submitted.txHash}`;
  } catch (error) { state.lastSimulation = null; $('#execute-simulation').textContent = 'Failed'; $('#status').textContent = error.message; }
  finally { state.executing = false; render(); }
});

$('#inspect-capability').addEventListener('click', async () => {
  if (!state.provider || !state.smartAccount?.deployed) return;
  $('#status').textContent = 'Reading canonical capability grant…';
  try {
    state.capabilityInspection = await inspectCapabilityGrant(state.provider, state.smartAccount, $('#capability-grant-id').value.trim());
    $('#status').textContent = state.capabilityInspection.exists ? 'Capability grant loaded from canonical CapabilityRegistry420.' : 'No capability grant exists for that grant ID.';
  } catch (error) { state.capabilityInspection = null; $('#status').textContent = error.message; }
  render();
});

$('#create-sponsor-grant').addEventListener('click', async () => {
  if (!state.provider || !state.smartAccount?.controllerIsOwner || state.managingCapability) return;
  const request = gasSponsorRequest();
  if (globalThis.confirm && !globalThis.confirm(`Create a gas-sponsor capability for ${request.sponsor}? The Smart Account call will be simulated before wallet approval.`)) return;
  state.managingCapability = true; render();
  $('#status').textContent = 'Simulating gas sponsor grant creation…';
  try {
    const submitted = await sendGasSponsorGrantCreation(state.provider, state.controller, state.smartAccount, request);
    $('#status').textContent = `Grant creation submitted: ${submitted.txHash}. Waiting for confirmation…`;
    const confirmed = await confirmCapabilityManagementTransaction(state.provider, submitted.txHash, state.smartAccount, { createdGrantId: submitted.expectedGrantId, principal: submitted.sponsor });
    state.capabilityInspection = confirmed.inspection;
    $('#capability-grant-id').value = submitted.expectedGrantId;
    $('#status').textContent = `Gas sponsor grant created and verified: ${submitted.expectedGrantId}`;
  } catch (error) { $('#status').textContent = error.message; }
  finally { state.managingCapability = false; render(); }
});

$('#revoke-capability').addEventListener('click', async () => {
  const inspection = state.capabilityInspection;
  if (!state.provider || !inspection?.exists || !inspection.belongsToAccount || inspection.grant.revoked || state.managingCapability) return;
  if (globalThis.confirm && !globalThis.confirm(`Revoke capability grant ${inspection.grantId}? This action is irreversible for that grant ID.`)) return;
  state.managingCapability = true; render();
  $('#status').textContent = 'Simulating capability revocation…';
  try {
    const submitted = await sendCapabilityGrantRevocation(state.provider, state.controller, state.smartAccount, inspection.grantId);
    $('#status').textContent = `Revocation submitted: ${submitted.txHash}. Waiting for confirmation…`;
    const confirmed = await confirmCapabilityManagementTransaction(state.provider, submitted.txHash, state.smartAccount, { revokedGrantId: inspection.grantId });
    state.capabilityInspection = confirmed.inspection;
    $('#status').textContent = `Capability grant revoked and verified: ${inspection.grantId}`;
  } catch (error) { $('#status').textContent = error.message; }
  finally { state.managingCapability = false; render(); }
});

$('#enable-session-key').addEventListener('click', async () => {
  if (!state.provider || !state.smartAccount?.controllerIsOwner || state.managingSession) return;
  const key = $('#session-key').value.trim();
  if (globalThis.confirm && !globalThis.confirm(`Enable ${key} as a session key for the current authorization epoch?`)) return;
  state.managingSession = true; render();
  $('#status').textContent = 'Simulating session key enablement…';
  try {
    const submitted = await sendSessionKeyEnablement(state.provider, state.controller, state.smartAccount, key);
    $('#status').textContent = `Session key enablement submitted: ${submitted.txHash}. Waiting for confirmation…`;
    const confirmed = await confirmSessionManagementTransaction(state.provider, submitted.txHash, state.smartAccount, { enabledKey: submitted.sessionKey });
    $('#status').textContent = `Session key enabled for authorization epoch ${confirmed.epoch}.`;
  } catch (error) { $('#status').textContent = error.message; }
  finally { state.managingSession = false; render(); }
});

$('#revoke-session-key').addEventListener('click', async () => {
  if (!state.provider || !state.smartAccount?.controllerIsOwner || state.managingSession) return;
  const key = $('#session-key').value.trim();
  if (globalThis.confirm && !globalThis.confirm(`Revoke session key ${key}? Existing grants remain recorded but can no longer authorize this key.`)) return;
  state.managingSession = true; render();
  $('#status').textContent = 'Simulating session key revocation…';
  try {
    const submitted = await sendSessionKeyRevocation(state.provider, state.controller, state.smartAccount, key);
    $('#status').textContent = `Session key revocation submitted: ${submitted.txHash}. Waiting for confirmation…`;
    await confirmSessionManagementTransaction(state.provider, submitted.txHash, state.smartAccount, { revokedKey: submitted.sessionKey });
    $('#status').textContent = `Session key revoked and verified: ${submitted.sessionKey}`;
  } catch (error) { $('#status').textContent = error.message; }
  finally { state.managingSession = false; render(); }
});

$('#create-session-grant').addEventListener('click', async () => {
  if (!state.provider || !state.smartAccount?.controllerIsOwner || state.managingSession) return;
  const request = sessionGrantRequest();
  if (globalThis.confirm && !globalThis.confirm(`Create a session grant for ${request.key} scoped to ${request.target} ${request.selector}? Session execution remains disabled in this stage.`)) return;
  state.managingSession = true; render();
  $('#status').textContent = 'Simulating scoped session grant creation…';
  try {
    const submitted = await sendSessionGrantCreation(state.provider, state.controller, state.smartAccount, request);
    $('#status').textContent = `Session grant creation submitted: ${submitted.txHash}. Waiting for confirmation…`;
    const confirmed = await confirmSessionManagementTransaction(state.provider, submitted.txHash, state.smartAccount, { createdGrantId: submitted.expectedGrantId, key: submitted.key, scopeHash: submitted.expectedScope });
    state.capabilityInspection = confirmed.inspection;
    $('#capability-grant-id').value = submitted.expectedGrantId;
    $('#status').textContent = `Session grant created and verified: ${submitted.expectedGrantId}`;
  } catch (error) { $('#status').textContent = error.message; }
  finally { state.managingSession = false; render(); }
});

loadConfig().catch((error) => {
  $('#status').textContent = `Configuration warning: ${error.message}`;
  render();
  publishWalletVerificationState420('failure',error.message);
}).then(() => { render(); });
