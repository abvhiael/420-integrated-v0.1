import { CORE_SERVICES, validateRuntimeConfig } from './core/config.js';
import { InjectedProvider420 } from './core/provider.js';
import { resolveServices } from './core/services.js';

const state = {
  account: null,
  chainId: null,
  services: CORE_SERVICES.map((service) => ({ ...service, available: false, url: null })),
  config: null,
};

const $ = (selector) => document.querySelector(selector);

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected';
}

function render() {
  $('#account').textContent = shortAddress(state.account);
  $('#network').textContent = state.chainId || state.config?.network?.name || '420 Integrated';
  $('#connect').textContent = state.account ? 'Connected' : 'Connect wallet';
  $('#connect').disabled = Boolean(state.account);

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
    const manifest = await manifestResponse.json();
    state.services = resolveServices(manifest, CORE_SERVICES);
  }
}

async function connectInjectedWallet() {
  if (!globalThis.ethereum) throw new Error('No injected EIP-1193 wallet found');
  const provider = new InjectedProvider420(globalThis.ethereum);
  const accounts = await provider.requestAccounts();
  state.account = accounts?.[0] || null;
  state.chainId = await provider.chainId();
  render();
}

$('#connect').addEventListener('click', async () => {
  $('#status').textContent = 'Requesting wallet authorization…';
  try {
    await connectInjectedWallet();
    $('#status').textContent = 'Wallet connected. No server-side signing key was created or stored.';
  } catch (error) {
    $('#status').textContent = error.message;
  }
});

loadConfig()
  .catch((error) => { $('#status').textContent = `Configuration warning: ${error.message}`; })
  .finally(render);
