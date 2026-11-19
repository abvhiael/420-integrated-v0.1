import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createPayDeveloperService, verifyPayWebhook } from './service.mjs';
import { forwardPayIndexerEvent } from './indexer.mjs';
import { createPayDeveloperClient } from '../../packages/420-pay-sdk/dist/index.js';
import { parsePayLink } from '../web/payment-intent.js';

const id = c => '0x' + c.repeat(64);
const token = c => 'pay_' + c.repeat(64);
const digest = value => createHash('sha256').update(value).digest('hex');
const origin = 'https://pay.example';
const tenant = id('a'), controller = '0x' + 'b'.repeat(40);
const event = { chainId: '420', merchantId: tenant, invoiceId: id('b'), paymentId: id('c'),
  txHash: id('d'), blockHash: id('e'), logIndex: '0', blockNumber: '42', status: 5 };
const secret = 'a'.repeat(64);
const now = 1_760_000_000_000;
const credential = { tokenHash: digest(token('a')), merchantId: tenant, controller, expiresAt: now + 60_000,
  scopes: ['invoices:read'] };
const endpoint = { id: 'merchant', merchantId: tenant, secret, url: 'https://hooks.example/pay' };
const options = {
  file: ':memory:', origin, chainId: 420n, credentials: [credential],
  ingestTokenHash: digest(token('b')), endpoints: [endpoint], now: () => now,
  readInvoice: async () => ({ invoice: { id: event.invoiceId, currency: '420', amount: 42n, merchant: controller,
    merchantId: tenant, metadataHash: id('f') }, status: 'OPEN', credited: 0n, outstanding: 42n }),
  readEvent: async () => event, canonicalBlock: async () => ({ hash: event.blockHash, finalized: false })
};
const invoicePath = '/v1/invoices/' + event.invoiceId;
function call(service, path, key, body, method = 'GET') {
  return service.handle(new Request(origin + path, {
    method, headers: { authorization: 'Bearer ' + key }, body: body && JSON.stringify(body)
  }));
}

test('v1 is read-only, tenant-scoped, expiring and emits canonical checkout links', async t => {
  const service = createPayDeveloperService(options);
  t.after(service.close);
  assert.equal((await call(service, invoicePath, token('c'))).status, 401);
  assert.equal((await call(service, invoicePath, token('a'), {}, 'POST')).status, 404);
  assert.equal((await call(service, '/internal/v1/events', token('a'), event, 'POST')).status, 401);
  const api = createPayDeveloperClient(origin, token('a'), (url, init) => service.handle(new Request(url, init)));
  const invoice = await api.invoice(event.invoiceId);
  assert.equal(invoice.amount, '42');
  assert.equal(invoice.metadataHash, undefined);
  assert.deepEqual(parsePayLink(invoice.checkout.hosted, new URL(origin), 420n), { kind: 'invoice', id: event.invoiceId });
  assert.match(invoice.checkout.embedded, /checkout-embed\.html/);
  const foreign = createPayDeveloperService({ ...options, credentials: [{ ...credential, merchantId: id('3') }] });
  t.after(foreign.close);
  assert.equal((await call(foreign, invoicePath, token('a'))).status, 404);
  const wrongScope = createPayDeveloperService({ ...options, credentials: [{ ...credential, scopes: [] }] });
  t.after(wrongScope.close);
  assert.equal((await call(wrongScope, invoicePath, token('a'))).status, 403);
  const expired = createPayDeveloperService({ ...options, now: () => credential.expiresAt });
  t.after(expired.close);
  assert.equal((await call(expired, invoicePath, token('a'))).status, 401);
});

test('webhooks authenticate raw bytes, retry with a stable ID and compensate after a restart', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'pay-webhooks-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const seen = [];
  let time = now;
  let block = event.blockHash;
  const config = { ...options, file: join(dir, 'outbox.db'), now: () => time,
    canonicalBlock: async () => ({ hash: block, finalized: false }),
    async request(url, init) {
      assert.equal(url, endpoint.url);
      assert.equal(init.redirect, 'error');
      const headers = new Headers(init.headers);
      const delivery = verifyPayWebhook(secret, headers, init.body, time);
      assert.throws(() => verifyPayWebhook(secret, headers, init.body + ' ', time), /signature/);
      assert.throws(() => verifyPayWebhook(secret, headers, init.body, time + 301_000), /signature/);
      seen.push({ delivery, message: JSON.parse(init.body) });
      return new Response(null, { status: seen.length === 1 ? 503 : 204 });
    }
  };
  let service = createPayDeveloperService(config);
  const send = () => forwardPayIndexerEvent({ streamVersion: 'v1', protocol: '420Pay', eventName: 'PaymentSet',
    provenance: { ...event, transactionHash: event.txHash } }, origin, token('b'),
    (url, init) => service.handle(new Request(url, init)));
  await send();
  await send();
  await service.deliver();
  assert.equal(seen.length, 1);
  service.close();
  service = createPayDeveloperService(config);
  t.after(service.close);
  time += 1000;
  await service.deliver();
  assert.equal(seen.length, 2);
  assert.equal(seen[0].delivery, seen[1].delivery);
  assert.equal(seen[1].message.type, 'payment.changed');
  block = id('1');
  await service.reconcile();
  await service.reconcile();
  await service.deliver();
  await service.deliver();
  assert.equal(seen.length, 3);
  assert.equal(seen[2].message.type, 'payment.retracted');
  assert.equal(seen[2].message.eventId, seen[1].message.eventId);
  assert.notEqual(seen[2].delivery, seen[1].delivery);
});
