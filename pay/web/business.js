import { paymentLink, recipientAddress } from './payment-intent.js';

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
  const invoicePanel = byId('business-invoices');
  const draft = byId('invoice-draft');
  const saved = byId('invoice-saved');
  const invoiceSummary = byId('invoice-summary');
  const invoiceShare = byId('invoice-share');
  const invoiceClose = byId('invoice-close');
  const invoiceLink = byId('invoice-link');
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
    register.hidden = management.hidden = reports.hidden = older.hidden = invoicePanel.hidden = true;
    resetInvoiceView();
    draft.reset();
    saved.replaceChildren(new Option('Choose draft', ''));
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
      invoicePanel.hidden = !detail?.controller || !detail.active;
      if (!invoicePanel.hidden) restoreDraft();
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

  function draftKey() {
    return '420pay.invoice-draft.' + [connected.chainId, connected.account, merchantId].join('/');
  }

  function resetInvoiceView() {
    invoiceShare.hidden = invoiceClose.hidden = true;
    invoiceSummary.textContent = invoiceLink.value = '';
  }

  function storedDrafts() {
    return JSON.parse(localStorage.getItem(draftKey()) ?? '{"last":"","drafts":{}}');
  }

  function restoreDraft(id) {
    try {
      const storage = storedDrafts();
      saved.replaceChildren(new Option('Choose draft', ''));
      for (const key of Object.keys(storage.drafts)) saved.add(new Option(key, key));
      saved.value = id ?? storage.last;
      const stored = storage.drafts[saved.value];
      for (const field of draft.elements) {
        if (field.name && typeof stored?.[field.name] === 'string') field.value = stored[field.name];
      }
    } catch {}
  }
  saved.addEventListener('change', () => {
    const id = saved.value;
    draft.reset();
    resetInvoiceView();
    restoreDraft(id);
  });

  draft.addEventListener('input', resetInvoiceView);
  byId('invoice-new').addEventListener('click', () => {
    if (!merchantId || invoicePanel.hidden) return;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    draft.reset();
    saved.value = '';
    draft.elements.invoiceId.value = '0x' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    resetInvoiceView();
  });
  byId('invoice-save').addEventListener('click', () => {
    if (!merchantId || invoicePanel.hidden) return;
    try {
      const fields = Object.fromEntries(new FormData(draft));
      const id = identifier(fields.invoiceId);
      const storage = storedDrafts();
      storage.drafts[id] = fields;
      storage.last = id;
      localStorage.setItem(draftKey(), JSON.stringify(storage));
      restoreDraft(id);
      invoiceSummary.textContent = 'Draft saved on this browser.';
    } catch (error) { invoiceSummary.textContent = error.message; }
  });

  handle(draft, data => {
    const expiry = Date.parse(data.get('expiresAt'));
    const refund = Date.parse(data.get('refundUntil'));
    const amount = data.get('amount');
    if (!/^[1-9][0-9]{0,77}$/.test(amount) || !Number.isFinite(expiry) || !Number.isFinite(refund)) {
      throw new Error('Enter a positive base-unit amount and both invoice dates.');
    }
    return { kind: 'invoice', invoiceId: identifier(data.get('invoiceId')), currency: data.get('currency'),
      amount: BigInt(amount), expiresAt: BigInt(Math.floor(expiry / 1000)), refundUntil: BigInt(Math.floor(refund / 1000)),
      mode: Number(data.get('mode')), acceptance: Number(data.get('acceptance')),
      acceptedAssetsHash: data.get('assets') ? identifier(data.get('assets')) : undefined,
      tipPolicyHash: data.get('tip') ? identifier(data.get('tip')) : undefined };
  });

  byId('invoice-inspect').addEventListener('click', () => {
    resetInvoiceView();
    void run(async ({ source, account, chainId }, current) => {
      const invoiceId = identifier(draft.elements.invoiceId.value);
      const result = await source.merchantInvoice(account, merchantId, invoiceId);
      if (!current()) return;
      if (!result) {
        invoiceSummary.textContent = 'Invoice is absent from finalized state.';
        return;
      }
      const { status: lifecycle, invoice, credited, outstanding } = result;
      invoiceSummary.textContent = lifecycle + ' · ' + invoice.mode + ' · ' + invoice.acceptance +
        ' · Credited ' + credited + ' · Outstanding ' + outstanding + ' ' + invoice.currency + ' base units';
      if (lifecycle !== 'OPEN' && lifecycle !== 'PARTIALLY_PAID') return;
      const base = new URL(location.href);
      base.hash = base.search = '';
      invoiceLink.value = paymentLink(base, chainId, { kind: 'invoice', id: invoiceId });
      invoiceShare.hidden = invoiceClose.hidden = false;
    });
  });
  invoiceClose.addEventListener('click', () => {
    void run(async ({ source, account }, current) => {
      const invoiceId = identifier(draft.elements.invoiceId.value);
      const result = await source.submitMerchant(account, { kind: 'closeInvoice', id: merchantId, invoiceId });
      if (current()) {
        resetInvoiceView();
        invoiceSummary.textContent = 'Closure submitted ' + result.submissionHash + '. Check finalized invoice.';
      }
    });
  });
  byId('invoice-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(invoiceLink.value); }
    catch { invoiceLink.select(); }
  });

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
