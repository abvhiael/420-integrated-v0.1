import assert from 'node:assert/strict';
import test from 'node:test';
import { amountUnits, parsePayLink, paymentLink, reviewPayment, sameReview, sendOnce } from '../payment-intent.js';

const base = new URL('https://pay.420integrated.org/');
const chainId = 420n;
const account = '0x' + '1'.repeat(40);
const recipient = '0x' + '2'.repeat(40);
const id = '0x' + '3'.repeat(64);
const input = { kind: 'request', recipient, id, value: 42n, expires: 100n };

test('links distinguish address, amount request and canonical invoice and reject substitutions', () => {
  for (const item of [{kind:'address', recipient}, input, {kind:'invoice', id}]) {
    assert.deepEqual(parsePayLink(paymentLink(base, chainId, item), base, chainId), item);
  }
  const link = paymentLink(base, chainId, input);
  for (const value of [link.replace('chain=420','chain=1'), link + '&id=' + id,
    link + '&amount=3', link.replace('420integrated.org','420integrated.org.invalid'),
    link.replace('/#','/unexpected#'), link.replace('/#','/?amount=42#'),
    link.replace('kind=request','kind=invoice'), link.replace('https:', 'http:')]) {
    assert.throws(() => parsePayLink(value, base, chainId), /link/);
  }
});

test('review resolves names and rejects expiry, amount or destination changes', async () => {
  const context = { now: 99n, resolve: async () => ({recipient}), invoice: async () =>
    ({merchant: recipient, currency: 'CAD', amount: 123n, expiresAt: 100n}) };
  const review = options => reviewPayment({ base, chainId, context, amount: '', ...options });
  assert.deepEqual(await review({input: 'test.420', amount: '1.000000000000000001'}),
    {kind:'address', recipient, value:1000000000000000001n});
  const link = paymentLink(base, chainId, input);
  assert.deepEqual(await review({input: link}), input);
  await assert.rejects(review({input:link, amount:'1'}), /match the payment request/);
  await assert.rejects(review({input:link, context:{...context, now:100n}}), /expired/);
  await assert.rejects(review({input:'0x' + '0'.repeat(40), amount:'1'}), /nonzero/);
  assert.equal((await review({input:paymentLink(base, chainId, {kind:'invoice', id})})).currency, 'CAD');
  assert.equal(sameReview(input, {...input, recipient:account}), false);
  for (const amount of ['0','-1','1e3','1.0000000000000000001']) assert.throws(() => amountUnits(amount));
});

function coordination() {
  const values = new Map();
  const held = new Set();
  return {
    locks: {async request(key, options, callback) {
      assert.equal(options.ifAvailable, true);
      if (held.has(key)) return callback(null);
      held.add(key);
      try { return await callback({}); } finally { held.delete(key); }
    }},
    storage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key)
    },
    chainId, account, review:input
  };
}

test('concurrent and repeated request submissions are serialized across browser contexts', async () => {
  const session = coordination();
  const submitted = {submissionHash:'0x' + 'a'.repeat(64)};
  let release;
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const first = sendOnce({...session, prepare:async () => async () => {
    started(); await blocked; return submitted;
  }});
  await entered;
  await assert.rejects(sendOnce({...session, prepare:assert.fail}), /already being reviewed/);
  release();
  assert.deepEqual(await first, submitted);
  assert.deepEqual(await sendOnce({...session, resetSubmitted:true, prepare:assert.fail}), {...submitted, duplicate:true});
});

test('only verified pre-submission refusals permit a retry and ambiguous outcomes remain blocked', async () => {
  const session = coordination();
  await assert.rejects(sendOnce({...session, prepare:async () => { throw Error('review changed'); }}), /review changed/);
  await assert.rejects(sendOnce({...session, prepare:async () => async () => {
    throw Object.assign(new Error('User rejected the request'), {code:4001});
  }}), /review and retry/);
  await assert.rejects(sendOnce({...session, prepare:async () => async () => {
    throw Object.assign(new Error('local wallet authority timed out'), {code:4001});
  }}), /did not confirm/);
  await assert.rejects(sendOnce({...session, prepare:assert.fail}), /outcome is unknown/);
});
