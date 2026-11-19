import { recipientAddress } from './payment-intent.js';

const zero = '0x' + '0'.repeat(64);
const roles = ['No assigned role', 'Reporter', 'Location manager', 'Cashier'];

function identifier(value) {
  const id = String(value).trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(id) || id === zero) throw new Error('Enter a nonzero 32-byte identifier.');
  return id;
}

export function createBusinessPanel() {
  const byId = id => document.getElementById(id);
  const open = byId('business-open');
  const status = byId('business-status');
  const credential = byId('business-credential');
  const register = byId('business-register');
  const management = byId('business-management');
  const reports = byId('business-reports');
  const records = byId('business-records');
  const range = byId('business-report-range');
  const older = byId('business-older');
  let connected = null;
  let merchantId = null;
  let revision = 0;
  let busy = false;
  let next = null;

  function clear() {
    merchantId = null;
    next = null;
    register.hidden = management.hidden = reports.hidden = older.hidden = true;
    records.replaceChildren();
    range.textContent = credential.textContent = '';
  }

  async function run(operation) {
    if (!connected?.source.business || busy) return;
    const active = connected;
    const ticket = revision;
    const current = () => revision === ticket;
    busy = true;
    const controls = [...document.querySelectorAll('#business button, #business input, #business select')];
    const previous = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    status.textContent = '';
    try { await operation(active, current); }
    catch (error) { if (current()) status.textContent = error.message; }
    finally {
      if (current()) {
        busy = false;
        controls.forEach((control, i) => { control.disabled = previous[i]; });
      }
    }
  }

  open.addEventListener('input', () => { clear(); status.textContent = ''; });
  byId('business-new').addEventListener('click', () => {
    clear();
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    open.elements.merchantId.value = '0x' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    status.textContent = 'Merchant ID created. Open it to begin registration.';
  });
  open.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(open);
    clear();
    void run(async ({ source, account }, current) => {
      const id = identifier(form.get('merchantId'));
      const location = form.get('locationId') ? identifier(form.get('locationId')) : undefined;
      const detail = await source.business(account, id, location);
      if (!current()) return;
      merchantId = id;
      register.hidden = detail !== null;
      management.hidden = !detail?.controller || !detail.active;
      reports.hidden = !detail?.reports;
      credential.textContent = detail ? detail.status + ' · ' + (detail.active ? 'Active' : 'Inactive') +
        ' · ' + (detail.controller ? 'Controller' : roles[detail.role]) +
        (location ? ' · Location ' + (detail.locationActive ? 'active' : 'inactive') : '') : '';
      if (!detail) status.textContent = 'This merchant ID is available for registration.';
    });
  });

  function handle(form, action) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      void run(async ({ source, account }, current) => {
        const result = await source.submitMerchant(account, { id: merchantId, ...action(data) });
        if (current()) status.textContent = 'Submitted to Wallet network ' + result.submissionHash +
          '. Refresh the merchant after confirmation.';
      });
    });
  }

  handle(register, data => ({ kind: 'register', payout: recipientAddress(data.get('payout')) }));
  handle(byId('business-location'), data => ({ kind: 'location', locationId: identifier(data.get('locationId')),
    active: data.get('active') === 'on' }));
  handle(byId('business-role'), data => ({ kind: 'role',
    locationId: data.get('locationId') ? identifier(data.get('locationId')) : zero,
    account: recipientAddress(data.get('account')), role: Number(data.get('role')) }));

  function report(through) {
    records.replaceChildren();
    range.textContent = '';
    older.hidden = true;
    void run(async ({ source, account }, current) => {
      const page = await source.merchantReport(account, merchantId, through);
      if (!current()) return;
      range.textContent = 'Finalized blocks ' + page.first + '–' + page.last;
      for (const payment of page.payments) {
        const item = document.createElement('li');
        item.textContent = payment.id + ' · ' + payment.status + ' · ' +
          payment.settlementAmount + ' base units · asset ' + payment.settlementAsset;
        records.append(item);
      }
      if (!page.payments.length) status.textContent = 'No payments in this report interval.';
      next = page.next;
      older.hidden = next === null;
    });
  }

  byId('business-report').addEventListener('click', () => report(undefined));
  older.addEventListener('click', () => { if (next !== null) report(next); });
  return {
    update(nextAccount) {
      if (connected === nextAccount) return;
      connected = nextAccount;
      ++revision;
      busy = false;
      clear();
      document.querySelectorAll('#business button, #business input, #business select')
        .forEach(control => { control.disabled = false; });
      for (const form of document.querySelectorAll('#business form')) form.reset();
      byId('business-selector').disabled = !connected?.source.business;
      status.textContent = '';
      byId('business-hint').textContent = connected?.source.business
        ? 'Enter your merchant or location ID to view Registry permissions.'
        : 'Connect 420 Wallet to manage a merchant account.';
    }
  };
}
