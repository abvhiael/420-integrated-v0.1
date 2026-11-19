const ADDRESS = /^0x[0-9a-f]{40}$/i;
const HASH = /^0x[0-9a-f]{64}$/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.420$/;
const UINT256 = 1n << 256n;
const DENOMINATION = 10n ** 18n;
const entryFields = {
  address: ['to'],
  request: ['to', 'value', 'expires', 'id'],
  invoice: ['id']
};

const invalid = () => new Error('Invalid or unsupported 420 Pay link.');
const unsigned = (value, ceiling) => {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,77}$/.test(value) || BigInt(value) >= ceiling) throw invalid();
  return BigInt(value);
};

export function recipientAddress(input) {
  if (typeof input !== 'string' || !ADDRESS.test(input) || /^0x0{40}$/i.test(input)) {
    throw new Error('Enter a nonzero 420 address, a .420 name or a 420 Pay link.');
  }
  return input.toLowerCase();
}

export function amountUnits(input) {
  if (typeof input !== 'string' || !/^(?:0|[1-9][0-9]{0,59})(?:\.[0-9]{1,18})?$/.test(input)) {
    throw new Error('Enter a positive 420 amount with up to 18 decimal places.');
  }
  const [whole, fraction = ''] = input.split('.');
  const amount = BigInt(whole) * DENOMINATION + BigInt(fraction.padEnd(18, '0'));
  if (amount === 0n || amount >= UINT256) throw new Error('420 amount is out of range.');
  return amount;
}

export function parsePayLink(text, base, chainId) {
  if (typeof text !== 'string' || text.length > 1024) throw invalid();
  let url;
  try { url = new URL(text); } catch { throw invalid(); }
  if (url.origin !== base.origin || url.pathname !== base.pathname || url.search ||
      url.username || url.password || !url.hash.startsWith('#pay?')) throw invalid();
  const query = new URLSearchParams(url.hash.slice(5));
  const kind = query.get('kind');
  const fields = Object.hasOwn(entryFields, kind) ? entryFields[kind] : null;
  if (!fields || query.size !== fields.length + 3 || query.get('v') !== '1' ||
      query.get('chain') !== chainId.toString() ||
      ['v', 'chain', 'kind', ...fields].some(field => query.getAll(field).length !== 1)) throw invalid();
  const id = query.get('id');
  if (fields.includes('id') && (!HASH.test(id) || /^0x0{64}$/.test(id))) throw invalid();
  if (kind === 'invoice') return { kind, id };
  const recipient = recipientAddress(query.get('to'));
  if (kind === 'address') return { kind, recipient };
  return { kind, id, recipient, value: unsigned(query.get('value'), UINT256),
    expires: unsigned(query.get('expires'), 1n << 64n) };
}

export function paymentLink(base, chainId, entry) {
  const url = new URL(base);
  const values = new URLSearchParams({v: '1', kind: entry.kind, chain: chainId.toString()});
  if (entry.recipient) values.set('to', entry.recipient);
  if (entry.id) values.set('id', entry.id);
  if (entry.value !== undefined) values.set('value', entry.value.toString());
  if (entry.expires !== undefined) values.set('expires', entry.expires.toString());
  url.hash = 'pay?' + values;
  parsePayLink(url.href, base, chainId);
  return url.href;
}

export async function reviewPayment({ input, amount, base, chainId, context }) {
  const text = input.trim();
  const entry = /^https?:/i.test(text) ? parsePayLink(text, base, chainId) : null;
  if (entry?.kind === 'invoice') {
    const invoice = await context.invoice(entry.id);
    return { kind: 'invoice', id: entry.id, recipient: invoice.merchant, value: invoice.amount,
      currency: invoice.currency, expires: invoice.expiresAt };
  }
  if (entry?.kind === 'request') {
    if (context.now >= entry.expires) throw new Error('This payment request has expired.');
    if (amount && amountUnits(amount) !== entry.value) throw new Error('Clear the amount field or match the payment request.');
    return entry;
  }
  const recipient = LABEL.test(text) ? recipientAddress((await context.resolve(text)).recipient) :
    entry?.recipient ?? recipientAddress(text);
  return { kind: 'address', recipient, value: amountUnits(amount) };
}

export function sameReview(a, b) {
  return ['kind', 'id', 'recipient', 'value', 'currency', 'expires'].every(field => a[field] === b[field]);
}

const safeRefusals = new Set([
  'User rejected the request', 'approval timed out',
  'EOA nonce/fees changed; new approval required', 'DApp UserOperation gas estimate changed; new approval required'
]);

export async function sendOnce({ locks, storage, chainId, account, review, resetSubmitted = false, prepare }) {
  const intent = review.id ?? review.recipient + '/' + review.value;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode([chainId, account, review.kind, intent].join('/'))));
  const key = '420pay.send.' + Array.from(digest, n => n.toString(16).padStart(2, '0')).join('');
  if (!locks?.request) throw new Error('This browser cannot safely coordinate payment submissions.');
  return locks.request(key, { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('This payment is already being reviewed in another tab.');
    const existing = storage.getItem(key);
    if (existing === 'pending') throw new Error('The previous Wallet outcome is unknown. Check Wallet activity before sending again.');
    if (existing !== null) {
      if (!HASH.test(existing)) throw new Error('The previous Wallet outcome cannot be verified.');
      if (!resetSubmitted || review.kind !== 'address') return { submissionHash: existing, duplicate: true };
    }
    const submit = await prepare();
    storage.setItem(key, 'pending');
    try {
      const result = await submit();
      if (!HASH.test(result.submissionHash) || /^0x0{64}$/.test(result.submissionHash)) throw new Error();
      storage.setItem(key, result.submissionHash);
      return result;
    } catch (error) {
      if (error?.code === 4001 && safeRefusals.has(error.message)) {
        if (existing === null) storage.removeItem(key);
        else storage.setItem(key, existing);
        throw new Error('Wallet declined the payment before submission. You can review and retry.');
      }
      throw new Error('Wallet did not confirm the outcome. Check Wallet activity before sending again.');
    }
  });
}
