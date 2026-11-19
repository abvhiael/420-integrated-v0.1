import qrcode from '../../wallet/extension/vendor/qrcode.mjs';
import jsQR from 'jsqr';
import { formatUnits } from './source.js';
import { amountUnits, parsePayLink, paymentLink, previousInvoiceSubmission, reviewPayment, sameReview, sendOnce } from './payment-intent.js';

async function readQr(file) {
  if (file.size > 8_000_000) throw new Error('Choose a smaller QR image.');
  const image = await createImageBitmap(file, {resizeWidth: 768, resizeHeight: 768, resizeQuality: 'pixelated'});
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    context.drawImage(image, 0, 0);
    const decoded = jsQR(context.getImageData(0, 0, image.width, image.height).data, image.width, image.height);
    if (!decoded || decoded.data.length > 1024) throw new Error('No supported payment QR was found.');
    return decoded.data;
  } finally { image.close(); }
}

export function createPaymentPanel() {
  const get = id => document.getElementById(id);
  const base = new URL(location.href);
  base.search = '';
  base.hash = '';
  const recipient = get('recipient');
  const amount = get('send-amount');
  const reviewNode = get('payment-review');
  const confirm = get('confirm-send');
  const checkout = get('hosted-checkout');
  const checkoutTerms = get('checkout-terms');
  const checkoutPay = get('checkout-pay');
  const checkoutStatus = get('checkout-status');
  const checkoutPayment = get('checkout-payment-id');
  const repeat = get('repeat-send');
  const requestKind = get('request-kind');
  const share = get('share-payment');
  const status = get('payment-status');
  let connection = null;
  let fixture = false;
  let revision = 0;
  let busy = false;
  let reviewed = null;
  let checkoutId = null;
  let checkoutQuote = null;
  let separate = false;
  let completed = false;

  function draw() {
    get('send-fields').disabled = !connection || busy;
    get('request-fields').disabled = !connection || busy;
    get('payment-mode').textContent = fixture ? 'Fixture mode previews payment links and QR codes.' :
      connection ? 'Review the destination and amount before continuing in Wallet.' :
        'Connect 420 Wallet to review payments and create requests.';
    confirm.hidden = fixture || !reviewed || reviewed.kind === 'invoice' || completed;
    confirm.disabled = busy;
    checkoutPay.hidden = !checkoutQuote;
    checkoutPay.disabled = busy;
    repeat.disabled = busy;
    get('request-terms').hidden = requestKind.value !== 'request';
    get('invoice-field').hidden = requestKind.value !== 'invoice';
  }

  function clearReview() {
    reviewed = null;
    separate = false;
    completed = false;
    reviewNode.hidden = true;
    checkoutId = null;
    checkoutQuote = null;
    checkout.hidden = true;
    checkoutTerms.textContent = '';
    checkoutStatus.textContent = '';
    checkoutPayment.value = '';
    repeat.hidden = true;
    draw();
  }

  async function run(action) {
    if (!connection || busy) return;
    const active = connection;
    const ticket = revision;
    busy = true;
    const current = () => ticket === revision;
    draw();
    status.textContent = '';
    try { await action(active, current); }
    catch (error) { if (current()) status.textContent = error.message || 'Payment action unavailable.'; }
    finally { if (current()) { busy = false; draw(); } }
  }

  async function getReview(active) {
    const input = recipient.value;
    const value = amount.value.trim();
    const context = await active.source.paymentContext(active.account);
    return reviewPayment({ input, amount: value, base, chainId: active.chainId, context });
  }

  get('send-form').addEventListener('submit', event => {
    event.preventDefault();
    clearReview();
    void run(async (active, current) => {
      const text = recipient.value.trim();
      if (!fixture && /^https?:/i.test(text)) {
        const link = parsePayLink(text, base, active.chainId);
        if (link.kind === 'invoice') {
          checkoutId = link.id;
          checkout.hidden = false;
          checkoutTerms.textContent = 'Existing payments can be checked even if the invoice is closed.';
          const previous = await previousInvoiceSubmission(localStorage, active.chainId, active.account, link.id);
          if (!current()) return;
          if (previous) {
            checkoutPayment.value = previous.paymentId;
            checkoutStatus.textContent = 'Previously submitted ' + previous.submissionHash;
          }
        }
      }
      const next = await getReview(active);
      if (!current()) return;
      reviewed = next;
      const title = {address: 'Direct address payment', request: 'Amount request', invoice: 'Canonical invoice'}[next.kind];
      const value = next.kind === 'invoice' ? next.value + ' ' + next.currency + ' invoice units' :
        formatUnits(next.value, 18) + ' 420';
      const expiry = next.expires ? '\nExpires ' + (next.expires <= 8640000000000n ?
        new Date(Number(next.expires) * 1000).toISOString() : next.expires + ' (Unix seconds)') : '';
      reviewNode.textContent = title + '\nRecipient ' + next.recipient + '\nAmount ' + value +
        '\nNetwork ' + active.chainId + expiry +
        (next.kind === 'invoice' ? '\nInvoice ' + next.id : '');
      reviewNode.hidden = false;
      reviewNode.focus();
      if (next.kind === 'invoice' && !fixture) {
        checkout.hidden = false;
        checkoutTerms.textContent = 'Checking canonical merchant and payout…';
        try {
          const { invoice, recipient } = await active.source.hostedCheckout(active.account, next.id);
          if (!current()) return;
          if (!sameReview(next, { ...next, recipient: invoice.merchant, value: invoice.amount,
            currency: invoice.currency, expires: invoice.expiresAt })) {
            clearReview();
            throw new Error('Invoice terms changed. Review again.');
          }
          checkoutTerms.textContent = 'Verified payout ' + recipient;
          const bytes = crypto.getRandomValues(new Uint8Array(32));
          const nonce = BigInt('0x' + Array.from(bytes, value => value.toString(16).padStart(2, '0')).join(''));
          try {
            const quote = await active.source.nativeInvoiceQuote(active.account, next.id, nonce);
            if (current()) showCheckoutQuote(quote);
          } catch (error) {
            if (current()) checkoutTerms.textContent += '\nNative 420 quote unavailable. ' + error.message;
          }
        } catch (error) {
          if (current()) checkoutTerms.textContent = error.message || 'Canonical checkout terms unavailable.';
        }
      }
    });
  });
  function showCheckoutQuote(quote) {
    checkoutQuote = quote;
    checkoutTerms.textContent = 'Asset: native 420\nAmount: ' + formatUnits(quote.value, 18) +
      ' 420\nPayout: ' + quote.recipient + '\nProtocol and conversion fees: 0 420' +
      '\nNetwork fee: estimated and shown by 420 Wallet' +
      '\nQuote expires: ' + new Date(Number(quote.expiresAt) * 1000).toISOString() +
      '\nAcceptance: ' + quote.acceptance;
  }

  checkoutPay.addEventListener('click', () => {
    const quote = checkoutQuote;
    if (!quote) return;
    void run(async (active, current) => {
      const result = await sendOnce({
        locks: navigator.locks, storage: localStorage, chainId: active.chainId, account: active.account,
        review: { kind: 'invoice', id: quote.invoiceId }, prepare: async () => {
          let fresh;
          try {
            fresh = await active.source.nativeInvoiceQuote(active.account, quote.invoiceId, quote.nonce, quote.quotedAt);
          } catch {}
          if (!current()) throw new Error('Wallet connection changed.');
          if (!fresh || fresh.data !== quote.data || fresh.router !== quote.router || fresh.value !== quote.value ||
              fresh.paymentId !== quote.paymentId || fresh.expiresAt !== quote.expiresAt) {
            checkoutQuote = null;
            checkoutTerms.textContent = 'Refreshing checkout quote…';
            try {
              const replacement = await active.source.nativeInvoiceQuote(active.account, quote.invoiceId, quote.nonce);
              if (current()) showCheckoutQuote(replacement);
            } catch (error) {
              if (current()) checkoutTerms.textContent = 'Native 420 quote unavailable. ' + error.message;
            }
            throw new Error('Checkout terms changed or expired. Review the replacement before continuing.');
          }
          return async () => ({ ...await active.source.submitNativeInvoice(active.account, fresh), paymentId: fresh.paymentId });
        }
      });
      if (!current()) return;
      checkoutQuote = null;
      checkoutPayment.value = result.paymentId;
      checkoutStatus.textContent = (result.duplicate ? 'Previously submitted ' : 'Submitted to network ') +
        result.submissionHash + '. Check canonical payment status for confirmation.';
    });
  });

  checkoutPayment.addEventListener('input', () => { checkoutStatus.textContent = ''; });
  get('checkout-check').addEventListener('click', () => {
    const invoiceId = checkoutId;
    if (!invoiceId || fixture) return;
    checkoutStatus.textContent = '';
    void run(async (active, current) => {
      const paymentId = checkoutPayment.value.trim().toLowerCase();
      if (!/^0x[0-9a-f]{64}$/.test(paymentId) || /^0x0{64}$/.test(paymentId)) {
        throw new Error('Enter a canonical payment ID.');
      }
      const result = await active.source.checkoutConfirmation(active.account, invoiceId, paymentId);
      if (!current() || checkoutId !== invoiceId || checkoutPayment.value.trim().toLowerCase() !== paymentId) return;
      const label = result.status?.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
      checkoutStatus.textContent = (label ?? 'Awaiting canonical payment') +
        ' · Canonical snapshot ' + result.snapshot.blockHash + ' · ' + result.acceptance;
    });
  });
  for (const control of [recipient, amount]) control.addEventListener('input', clearReview);
  repeat.addEventListener('click', () => {
    separate = true;
    completed = false;
    repeat.hidden = true;
    confirm.hidden = false;
    status.textContent = 'A separate payment will require a new Wallet approval.';
    confirm.focus();
  });
  confirm.addEventListener('click', () => {
    const prior = reviewed;
    if (!prior || fixture || prior.kind === 'invoice') return;
    void run(async (active, current) => {
      const next = await getReview(active);
      if (!current()) return;
      if (!sameReview(prior, next)) {
        clearReview();
        throw new Error('Payment details changed. Review again before sending.');
      }
      const result = await sendOnce({
        locks: navigator.locks, storage: localStorage, chainId: active.chainId, account: active.account,
        review: next, resetSubmitted: separate, prepare: async () => {
          if (!current()) throw new Error('Wallet connection changed.');
          const fresh = await getReview(active);
          if (!current() || !sameReview(next, fresh)) {
            throw new Error('Wallet connection or payment details changed.');
          }
          return () => active.source.sendNative(active.account, fresh.recipient, fresh.value);
        }
      });
      if (!current()) return;
      separate = false;
      completed = true;
      status.textContent = (result.duplicate ? 'Already submitted ' : 'Submitted ') + result.submissionHash;
      repeat.hidden = next.kind !== 'address';
      confirm.hidden = true;
    });
  });
  get('qr-file').addEventListener('change', event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    clearReview();
    void run(async (active, current) => {
      const text = await readQr(file);
      if (!current()) return;
      if (/^https?:/i.test(text)) parsePayLink(text, base, active.chainId);
      recipient.value = text;
      amount.value = '';
      status.textContent = 'QR read. Review the payment details.';
    });
  });
  get('request-form').addEventListener('input', () => { share.hidden = true; draw(); });
  get('request-form').addEventListener('submit', event => {
    event.preventDefault();
    share.hidden = true;
    void run(async (active, current) => {
      const kind = requestKind.value;
      const context = await active.source.paymentContext(active.account);
      if (!current()) return;
      let entry = {kind, recipient: active.account};
      if (kind === 'invoice') {
        const id = get('request-invoice').value.trim().toLowerCase();
        if (!/^0x[0-9a-f]{64}$/.test(id)) throw new Error('Enter a canonical invoice ID.');
        const invoice = await context.invoice(id);
        if (invoice.merchant !== active.account) throw new Error('This invoice belongs to another account.');
        entry = { kind, id };
      } else if (kind === 'request') {
        const expiry = Date.parse(get('request-expiry').value);
        if (!Number.isFinite(expiry) || expiry <= 0) throw new Error('Choose a future expiration time.');
        const expires = BigInt(Math.floor(expiry / 1000));
        if (expires <= context.now) throw new Error('The request expiration must be after the current chain time.');
        entry = { ...entry, expires, value: amountUnits(get('request-amount').value.trim()),
          id: '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('') };
      }
      if (!current()) return;
      const link = paymentLink(base, active.chainId, entry);
      const qr = qrcode(0, 'M');
      qr.addData(link);
      qr.make();
      const image = get('payment-qr');
      image.src = qr.createDataURL(5, 20);
      const title = { address: 'Receiving address', request: 'Amount request', invoice: 'Canonical invoice' }[kind];
      image.alt = title + ' QR code';
      get('payment-link').value = link;
      const download = get('download-qr');
      download.href = image.src;
      download.download = (fixture ? 'fixture-' : '') + '420-pay-' + kind + '-qr.gif';
      share.hidden = false;
      status.textContent = (fixture ? 'Fixture ' : '') + title + ' link ready.';
    });
  });
  get('copy-payment').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(get('payment-link').value);
      status.textContent = 'Link copied.';
    } catch {
      get('payment-link').select();
      status.textContent = 'Select and copy the link.';
    }
  });

  function importLocation() {
    if (!connection || busy || !location.hash.startsWith('#pay?')) return;
    clearReview();
    recipient.value = '';
    amount.value = '';
    try {
      parsePayLink(location.href, base, connection.chainId);
      recipient.value = location.href;
      status.textContent = 'Payment link loaded. Review the details before continuing.';
    } catch (error) { status.textContent = error.message; }
  }
  window.addEventListener('hashchange', importLocation);

  return {
    update(active, sample) {
      if (active === connection && sample === fixture) return;
      ++revision;
      connection = active;
      fixture = sample;
      busy = false;
      clearReview();
      recipient.value = '';
      amount.value = '';
      get('request-amount').value = '';
      get('request-expiry').value = '';
      get('request-invoice').value = '';
      share.hidden = true;
      status.textContent = '';
      importLocation();
      draw();
    }
  };
}
