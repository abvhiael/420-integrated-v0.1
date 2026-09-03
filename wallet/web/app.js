import { CORE_SERVICES, validateRuntimeConfig } from './core/config.js';
import { InjectedProvider420 } from './core/provider.js';
import { discoverSmartAccount } from './core/accounts.js';
import { confirmSmartAccountCreation, sendSmartAccountCreation } from './core/deployment.js';
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
};

const $ = (selector) => document.querySelector(selector);
const shortAddress = (address) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—';

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
      ? 'Canonical Smart Account loaded. General Smart Account execution remains disabled.'
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
    const confirmed = await confirmSmartAccountCreation(state.provider, submitted.txHash, state.controller, state.config.smartAccount);
    state.smartAccount = confirmed.smartAccount;
    await refreshConnectedState();
    $('#status').textContent = `SmartAccount420 created and owner verified: ${state.smartAccount.smartAccount}`;
  } catch (error) {
    $('#status').textContent = error.message;
  } finally {
    state.creatingAccount = false;
    render();
  }
});

loadConfig().catch((error) => { $('#status').textContent = `Configuration warning: ${error.message}`; }).finally(render);
