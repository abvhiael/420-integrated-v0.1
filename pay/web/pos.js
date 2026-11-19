import qrcode from '../../wallet/extension/vendor/qrcode.mjs';
import { paymentLink } from './payment-intent.js';
import { formatUnits } from './source.js';

const max = 1n << 256n;
const text = value => formatUnits(value, 18) + ' 420';

function units(input, optional = false) {
  if (optional && !input) return 0n;
  if (!/^(?:0|[1-9][0-9]{0,77})(?:\.[0-9]{1,18})?$/.test(input)) throw new Error('Enter valid 420 amounts.');
  const [integer, fraction = ''] = input.split('.');
  return BigInt(integer) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
}

export function posTotal({ quick, items, tax, tip }) {
  const lines = items.trim() ? items.trim().split('\n') : [];
  if (quick && lines.length) throw new Error('Enter a quick amount or cart items.');
  let subtotal = quick ? units(quick) : 0n;
  for (const line of lines) {
    const [label, quantity, price, extra] = line.split('|').map(part => part.trim());
    if (!label || !/^[1-9][0-9]{0,17}$/.test(quantity ?? '') || !price || extra !== undefined)
      throw new Error('Enter cart items as name | quantity | unit price.');
    subtotal += BigInt(quantity) * units(price);
  }
  const taxAmount = units(tax, true);
  const tipAmount = units(tip, true);
  if (subtotal <= 0n || subtotal + taxAmount + tipAmount >= max) throw new Error('POS total is out of range.');
  return { subtotal, tax: taxAmount, tip: tipAmount };
}

export function createPos(run) {
  const get = id => document.getElementById(id);
  const section = get('pos');
  const form = get('pos-cart');
  const display = get('pos-display');
  const status = get('pos-status');
  const share = get('pos-share');
  const qr = get('pos-qr');
  let session;
  let invoiceId;
  let submitted = false;

  function clear() {
    session = invoiceId = undefined;
    submitted = false;
    section.hidden = true;
    form.reset();
    share.hidden = true;
    qr.removeAttribute('src');
    get('pos-link').removeAttribute('href');
    get('pos-customer-terms').textContent = get('pos-customer-status').textContent = status.textContent = '';
    display.close();
  }

  const fields = () => Object.fromEntries(new FormData(form));
  const totals = entry => {
    get('pos-customer-terms').textContent = 'Subtotal ' + text(entry.subtotal) + ' · Tax ' + text(entry.tax) +
      ' · Tip ' + text(entry.tip) + ' · Total ' + text(entry.subtotal + entry.tax + entry.tip);
  };
  const storageKey = () => '420pay.pos.' + session.join('/');
  const createId = () => '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)),
    byte => byte.toString(16).padStart(2, '0')).join('');

  form.addEventListener('input', () => {
    if (submitted) return;
    status.textContent = '';
    try { totals(posTotal(fields())); } catch { get('pos-customer-terms').textContent = ''; }
  });
  get('pos-save').addEventListener('click', () => {
    if (!session || submitted) return;
    try {
      localStorage.setItem(storageKey(), JSON.stringify(fields()));
      status.textContent = 'Cart saved as a local draft.';
    } catch { status.textContent = 'Draft storage is unavailable.'; }
  });
  get('pos-new').addEventListener('click', () => {
    if (!session) return;
    invoiceId = undefined;
    submitted = false;
    form.reset();
    share.hidden = true;
    qr.removeAttribute('src');
    display.close();
    get('pos-customer-terms').textContent = get('pos-customer-status').textContent = status.textContent = '';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!session || submitted) return;
    if (!navigator.onLine) {
      status.textContent = 'Offline. Save your cart as a draft.';
      return;
    }
    const [, , id, locationId] = session;
    const values = fields();
    void run(async ({ source, account }, current) => {
      const terms = posTotal(values);
      const expiry = Date.parse(values.expiry);
      const refund = Date.parse(values.refund);
      if (!Number.isFinite(expiry) || !Number.isFinite(refund) || refund < expiry) throw new Error('Check both invoice dates.');
      const pendingId = invoiceId ?? createId();
      invoiceId = pendingId;
      // Once approval starts, keep the same invoice identity even if the transport outcome is ambiguous.
      const result = await source.submitMerchant(account, { kind: 'pos', id, locationId, invoiceId: pendingId, ...terms,
        expiresAt: BigInt(expiry / 1000), refundUntil: BigInt(refund / 1000) });
      if (!current()) return;
      submitted = true;
      status.textContent = 'Invoice submitted ' + result.submissionHash + '. Check finalized checkout before sharing.';
    });
  });
  get('pos-show').addEventListener('click', () => {
    if (!invoiceId) return;
    display.showModal();
    get('pos-refresh').click();
  });
  get('pos-close').addEventListener('click', () => display.close());
  window.addEventListener('offline', () => {
    if (!session || !invoiceId) return;
    share.hidden = true;
    get('pos-customer-status').textContent = 'Offline. Reconnect to check this sale.';
  });
  get('pos-refresh').addEventListener('click', () => {
    if (!session || !invoiceId) return;
    const id = invoiceId;
    const [, , merchantId, locationId] = session;
    share.hidden = true;
    if (!navigator.onLine) {
      get('pos-customer-status').textContent = 'Offline. Reconnect to check this sale.';
      return;
    }
    get('pos-customer-status').textContent = 'Checking finalized checkout…';
    void run(async ({ source, account, chainId }, current) => {
      const result = await source.posInvoice(account, merchantId, locationId, id);
      if (!current() || id !== invoiceId || !navigator.onLine) return;
      if (!result) {
        get('pos-customer-status').textContent = 'Waiting for finalized invoice.';
        return;
      }
      totals({ subtotal: result.invoice.amount - result.tax, tax: result.tax, tip: result.tip });
      get('pos-customer-status').textContent = result.settled ? 'Payment settled' :
        result.payable ? 'Scan to pay' : 'Payment has not been verified. This invoice is unavailable for checkout.';
      if (!result.payable || result.settled) return;
      const base = new URL(location.origin);
      const link = paymentLink(base, chainId, { kind: 'invoice', id });
      const image = qrcode(0, 'M');
      image.addData(link);
      image.make();
      qr.src = image.createDataURL(6, 24);
      get('pos-link').href = link;
      share.hidden = false;
    });
  });
  return {
    clear,
    open(chainId, account, merchantId, locationId) {
      session = [chainId, account, merchantId, locationId];
      section.hidden = false;
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey()) ?? '{}');
        for (const field of form.elements)
          if (typeof saved[field.name] === 'string') field.value = saved[field.name];
      } catch {}
    }
  };
}
