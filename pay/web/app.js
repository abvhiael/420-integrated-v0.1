import { createConsumerSource, formatUnits, makeReceipt } from './source.js';
import { createFixtureSource } from './fixture.js';
import { createPaymentPanel } from './payments.js';
import { createBusinessPanel } from './business.js';

const byId = id => document.getElementById(id);
const ui = Object.fromEntries([
  'mode', 'connect', 'fixture', 'banner', 'status', 'account', 'network', 'refresh', 'asset-list',
  'asset-empty', 'coverage', 'filter', 'history', 'history-empty', 'older', 'privacy'
].map(id => [id, byId(id)]));

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

let deployment;
let connected = null;
let data = null;
let fixture = false;
let busy = false;
let scope = 0;
let stopWatching = () => {};
const preferenceKey = '420pay.hideAmounts';
const paymentPanel = createPaymentPanel();
const businessPanel = createBusinessPanel();
try { ui.privacy.checked = localStorage.getItem(preferenceKey) === 'true'; } catch {}

const announce = message => { ui.status.textContent = message; };
const shortened = value => value.slice(0, 10) + '…' + value.slice(-6);
function displayAmount(amount, asset, assets) {
  if (ui.privacy.checked) return 'Amount hidden';
  const entry = assets.find(token => token.address === asset);
  return entry ? formatUnits(amount, entry.decimals) + ' ' + entry.symbol :
    amount.toString() + ' base units · ' + shortened(asset);
}

function draw() {
  paymentPanel.update(connected, fixture);
  businessPanel.update(connected);
  const active = connected !== null;
  ui.banner.hidden = !fixture;
  ui.mode.textContent = fixture ? 'Personal · Fixture' : 'Personal';
  ui.connect.textContent = active && !fixture ? 'Disconnect Wallet' : 'Connect 420 Wallet';
  ui.connect.disabled = busy || fixture || !deployment;
  ui.fixture.hidden = deployment !== null;
  ui.fixture.disabled = busy;
  ui.fixture.textContent = fixture ? 'Exit fixture mode' : 'Open fixture mode';
  ui.refresh.disabled = !active || busy;
  ui.older.disabled = busy;
  ui.older.hidden = data?.history.next == null;
  ui.account.textContent = active ? 'Selected address ' + connected.account : 'Connect 420 Wallet to view your account.';
  ui.network.textContent = active ? (fixture ? 'Fixture chain ' : 'Chain ') + connected.chainId : 'Disconnected';

  const assets = connected?.source.assets ?? [];
  ui['asset-list'].replaceChildren(...(data?.amounts ?? []).map((amount, i) => {
    const row = element('li');
    row.append(element('span', assets[i].symbol), element('span', displayAmount(amount, assets[i].address, assets), 'money'));
    return row;
  }));
  ui['asset-empty'].hidden = !!data;
  ui['asset-empty'].textContent = active ? 'Wallet balances unavailable.' : 'Balances appear when you connect.';
  ui.coverage.textContent = data ? 'Blocks ' + data.history.first + '–' + data.history.last +
    ' · Snapshot ' + shortened(data.snapshot.blockHash) : 'Verified payment records and receipts';

  const filter = ui.filter.value;
  const payments = (data?.history.payments ?? []).filter(payment =>
    filter === 'all' || (filter === 'sent' ? payment.payer : payment.merchant) === connected.account);
  ui.history.replaceChildren(...payments.map(payment => {
    const sent = payment.payer === connected.account;
    const received = payment.merchant === connected.account;
    const row = element('li');
    const summary = element('div');
    const title = sent && received ? 'Self payment' : sent ? 'Sent payment' : 'Received payment';
    summary.append(element('strong', title), element('p', payment.id, 'payment-id'));
    const badge = element('span', payment.status.toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()), 'badge');
    badge.dataset.status = payment.status;
    row.append(summary, element('span', sent ? displayAmount(payment.inputAmount, payment.inputAsset, assets) :
      displayAmount(payment.settlementAmount, payment.settlementAsset, assets), 'money'), badge);
    try {
      makeReceipt(payment, connected.account, fixture);
      const button = element('button', 'Download receipt', 'secondary');
      button.type = 'button';
      button.disabled = busy;
      button.setAttribute('aria-label', 'Download receipt for ' + title.toLowerCase() + ' ' + shortened(payment.id));
      button.addEventListener('click', () => download(payment, button));
      row.append(button);
    } catch {}
    return row;
  }));
  ui['history-empty'].hidden = payments.length > 0;
  ui['history-empty'].textContent = !active ? 'Activity appears when you connect.' : data ?
    'No matching activity in these blocks.' : 'Payment activity unavailable.';
}

function clearConnection(message) {
  ++scope;
  stopWatching();
  stopWatching = () => {};
  connected = null;
  data = null;
  busy = false;
  announce(message);
  draw();
}

async function load() {
  const ticket = scope;
  const { source, account } = connected;
  busy = true;
  data = null;
  announce('Loading account data…');
  draw();
  try {
    const next = await source.load(account);
    if (ticket !== scope) return;
    data = next;
    announce('Account data updated.');
  } catch {
    if (ticket !== scope) return;
    announce('Account data unavailable. Check your Wallet selection or refresh.');
  } finally {
    if (ticket === scope) {
      busy = false;
      draw();
    }
  }
}

function findWallet() {
  let candidate = window.ethereum?.is420Wallet === true ? window.ethereum : null;
  function capture(event) {
    if (event.detail?.info?.rdns === 'integrated.420.wallet' && event.detail.provider?.is420Wallet === true) {
      candidate = event.detail.provider;
    }
  }
  window.addEventListener('eip6963:announceProvider', capture);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  window.removeEventListener('eip6963:announceProvider', capture);
  return candidate;
}

ui.connect.addEventListener('click', async () => {
  if (connected) {
    const previous = connected;
    clearConnection('Disconnecting Wallet…');
    const ticket = scope;
    busy = true;
    draw();
    try {
      await previous.source.disconnect();
      if (ticket === scope) announce('Wallet disconnected.');
    } catch {
      if (ticket === scope) announce('Dashboard cleared. Revoke this site in 420 Wallet to remove its grant.');
    } finally {
      if (ticket === scope) { busy = false; draw(); }
    }
    return;
  }

  const provider = findWallet();
  if (!provider) { announce('420 Wallet was not found in this browser.'); return; }
  const ticket = ++scope;
  busy = true;
  draw();
  try {
    const source = createConsumerSource(deployment, provider);
    const selection = await source.connect();
    if (ticket !== scope) return;
    connected = { ...selection, source };
    const invalidate = () => clearConnection('Wallet account or network changed. Connect again.');
    const events = ['accountsChanged', 'chainChanged', 'disconnect'];
    events.forEach(event => provider.on?.(event, invalidate));
    stopWatching = () => events.forEach(event => provider.removeListener?.(event, invalidate));
    await load();
  } catch {
    if (ticket === scope) clearConnection('Could not connect. Check your account, network and approval in 420 Wallet.');
  }
});

ui.fixture.addEventListener('click', async () => {
  if (deployment !== null || busy) return;
  fixture = !fixture;
  clearConnection(fixture ? 'Fixture mode opened.' : 'Fixture mode closed.');
  if (!fixture) return;
  const source = createFixtureSource();
  connected = { ...await source.connect(), source };
  await load();
});

ui.refresh.addEventListener('click', load);
ui.privacy.addEventListener('change', () => {
  try { localStorage.setItem(preferenceKey, String(ui.privacy.checked)); } catch {}
  draw();
});
ui.filter.addEventListener('change', draw);

ui.older.addEventListener('click', async () => {
  const ticket = scope;
  const before = data;
  const {source, account} = connected;
  busy = true;
  draw();
  try {
    const page = await source.older(account, before.snapshot, before.history.next);
    if (ticket !== scope) return;
    const ids = new Set(before.history.payments.map(payment => payment.id));
    data = { ...before, history: {
      ...page, last: before.history.last,
      payments: [...before.history.payments, ...page.payments.filter(payment => !ids.has(payment.id))]
    } };
    announce('Earlier blocks checked.');
  } catch {
    if (ticket !== scope) return;
    data = null;
    announce('The history snapshot could not be verified. Refresh to load a new snapshot.');
  } finally {
    if (ticket === scope) {
      busy = false;
      draw();
      (ui.older.hidden ? ui.filter : ui.older).focus();
    }
  }
});

async function download(payment, button) {
  const ticket = scope;
  const {source, account} = connected;
  button.disabled = true;
  try {
    const receipt = await source.receipt(account, payment);
    if (ticket !== scope || !button.isConnected) return;
    const link = element('a');
    const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2) + '\n'], { type: 'application/json' }));
    link.href = url;
    link.download = (fixture ? 'fixture-' : '') + '420pay-receipt-' + payment.id + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Receipt downloaded.');
  } catch {
    if (ticket === scope) announce('Receipt evidence is unavailable. Refresh to check the current payment.');
  } finally {
    if (ticket === scope && button.isConnected) { button.disabled = false; button.focus(); }
  }
}

draw();
try {
  const response = await fetch('./deployment.json', { credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
  if (!response.ok) throw new Error();
  deployment = await response.json();
  if (deployment === null) announce('Live deployment unavailable. Open fixture mode to explore sample data.');
} catch {
  announce('The approved Pay deployment configuration could not be loaded.');
}
draw();
