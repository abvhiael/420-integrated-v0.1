import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { developerCheckout } from '../../packages/420-pay-sdk/dist/index.js';

const identifier = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/.test(value) && !/^0x0{64}$/.test(value);
const digest = value => createHash('sha256').update(value).digest('hex');
const sign = (secret, timestamp, id, body) =>
  createHmac('sha256', Buffer.from(secret, 'hex')).update(timestamp + '.' + id + '.').update(body).digest('hex');
const equals = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const json = (status, data) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });

export function verifyPayWebhook(secret, headers, body, now = Date.now()) {
  const timestamp = headers.get('pay-timestamp') ?? '';
  const id = headers.get('pay-delivery-id') ?? '';
  const signature = headers.get('pay-signature') ?? '';
  if (!/^[0-9a-f]{64}$/.test(secret) || !/^\d{10,13}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(id) ||
      !/^v1=[0-9a-f]{64}$/.test(signature) || Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300 ||
      !equals(signature.slice(3), sign(secret, timestamp, id, body))) throw new Error('Invalid Pay webhook signature');
  return id;
}

export function createPayDeveloperService({ file, origin, chainId, credentials, ingestTokenHash, endpoints,
  readInvoice, readEvent, canonicalBlock, request = fetch, now = Date.now }) {
  developerCheckout(origin, chainId, '0x' + '1'.repeat(64));
  if (!/^[0-9a-f]{64}$/.test(ingestTokenHash)) throw new Error('Invalid Indexer credential hash');
  const credentialHashes = new Set([ingestTokenHash]);
  for (const entry of credentials) {
    if (!identifier(entry.merchantId) || !/^[0-9a-f]{64}$/.test(entry.tokenHash) || credentialHashes.has(entry.tokenHash) ||
        !/^0x[0-9a-f]{40}$/.test(entry.controller) || !Number.isSafeInteger(entry.expiresAt) ||
        !Array.isArray(entry.scopes) || entry.scopes.some(scope => scope !== 'invoices:read'))
      throw new Error('Invalid Pay credential policy');
    credentialHashes.add(entry.tokenHash);
  }
  const destinations = new Map();
  for (const entry of endpoints) {
    const url = new URL(entry.url);
    if (!identifier(entry.merchantId) || !/^[A-Za-z0-9_-]{1,64}$/.test(entry.id) ||
        destinations.has(entry.id) || url.protocol !== 'https:' || url.username || url.password || url.hash ||
        !/^[0-9a-f]{64}$/.test(entry.secret)) throw new Error('Invalid approved webhook endpoint');
    destinations.set(entry.id, { ...entry, url: url.href });
  }

  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, body TEXT NOT NULL, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deliveries (
      seq INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, endpoint TEXT NOT NULL, body TEXT NOT NULL,
      due INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0
    );`);
  function transaction(action) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function enqueue(eventId, event, type, affected) {
    const body = JSON.stringify({ version: 'v1', type, eventId, ...event });
    for (const endpoint of affected) {
      const id = digest(JSON.stringify([endpoint.id, endpoint.merchantId, endpoint.url, eventId, type]));
      db.prepare('INSERT OR IGNORE INTO deliveries (id, endpoint, body, due) VALUES (?, ?, ?, ?)')
        .run(id, endpoint.id, body, now());
    }
  }

  async function observe(input) {
    if (!identifier(input?.blockHash) || !identifier(input?.txHash) ||
        typeof input.blockNumber !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(input.blockNumber) ||
        typeof input.logIndex !== 'string' || !/^(0|[1-9][0-9]{0,5})$/.test(input.logIndex)) return false;
    const block = await canonicalBlock(input.blockNumber);
    if (block && identifier(block.hash) && block.hash !== input.blockHash) return true;
    const event = await readEvent(input);
    if (event.chainId !== chainId.toString() || event.blockHash !== input.blockHash ||
        event.blockNumber !== input.blockNumber || event.txHash !== input.txHash || event.logIndex !== input.logIndex || !identifier(event.merchantId)) return false;
    const approved = [...destinations.values()].filter(endpoint => endpoint.merchantId === event.merchantId);
    if (approved.length === 0) return true;
    const id = digest(JSON.stringify([event.chainId, event.blockHash, event.txHash, event.logIndex]));
    transaction(() => {
      const result = db.prepare("INSERT OR IGNORE INTO events VALUES (?, ?, 'observed')").run(id, JSON.stringify(event));
      if (result.changes) enqueue(id, event, 'payment.changed', approved);
    });
    return true;
  }

  async function reconcile() {
    for (const stored of db.prepare("SELECT * FROM events WHERE state='observed'").all()) {
      const event = JSON.parse(stored.body);
      const block = await canonicalBlock(event.blockNumber);
      if (!block || !identifier(block.hash)) continue;
      transaction(() => {
        if (block.hash !== event.blockHash) {
          const updated = db.prepare("UPDATE events SET state='retracted' WHERE id=? AND state='observed'").run(stored.id);
          if (!updated.changes) return;
          const original = [...destinations.values()].filter(endpoint => {
            if (endpoint.merchantId !== event.merchantId) return false;
            const id = digest(JSON.stringify([endpoint.id, endpoint.merchantId, endpoint.url, stored.id, 'payment.changed']));
            const delivery = db.prepare('SELECT attempts FROM deliveries WHERE id=?').get(id);
            if (!delivery) return false;
            db.prepare('UPDATE deliveries SET done=3 WHERE id=? AND done=0').run(id);
            return delivery.attempts > 0;
          });
          enqueue(stored.id, event, 'payment.retracted', original);
        } else if (block.finalized) {
          db.prepare("UPDATE events SET state='finalized' WHERE id=? AND state='observed'").run(stored.id);
        }
      });
    }
  }

  async function deliver() {
    for (const endpoint of destinations.values()) {
      const delivery = transaction(() => {
        const row = db.prepare('SELECT * FROM deliveries WHERE endpoint=? AND done=0 ORDER BY seq LIMIT 1').get(endpoint.id);
        if (!row || row.due > now()) return null;
        db.prepare('UPDATE deliveries SET attempts=attempts+1, due=? WHERE seq=?').run(now() + 60_000, row.seq);
        return row;
      });
      if (!delivery) continue;
      const event = JSON.parse(delivery.body);
      const expected = digest(JSON.stringify([endpoint.id, endpoint.merchantId, endpoint.url, event.eventId, event.type]));
      if (expected !== delivery.id) {
        db.prepare('UPDATE deliveries SET done=1 WHERE seq=?').run(delivery.seq);
        continue;
      }
      const timestamp = String(Math.floor(now() / 1000));
      let accepted = false;
      try {
        const response = await request(endpoint.url, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), body: delivery.body,
          headers: { 'content-type': 'application/json', 'pay-delivery-id': delivery.id, 'pay-timestamp': timestamp,
            'pay-signature': 'v1=' + sign(endpoint.secret, timestamp, delivery.id, delivery.body) }
        });
        accepted = response.ok;
        await response.body?.cancel();
      } catch {}
      if (accepted || delivery.attempts >= 11) {
        db.prepare('UPDATE deliveries SET done=? WHERE seq=? AND done=0').run(accepted ? 1 : 2, delivery.seq);
      } else {
        db.prepare('UPDATE deliveries SET due=? WHERE seq=? AND done=0').run(now() + Math.min(60_000, 1000 * 2 ** delivery.attempts), delivery.seq);
      }
    }
  }

  return {
    close: () => db.close(), reconcile, deliver,
    async handle(req) {
      const token = /^Bearer (pay_[0-9a-f]{64})$/.exec(req.headers.get('authorization') ?? '')?.[1];
      if (!token) return json(401, { error: 'unauthorized' });
      const path = new URL(req.url).pathname;
      if (path === '/internal/v1/events' && req.method === 'POST') {
        if (!equals(digest(token), ingestTokenHash)) return json(401, { error: 'unauthorized' });
        try { return await observe(await req.json()) ? json(202, { accepted: true }) : json(400, { error: 'invalid_event' }); }
        catch { return json(503, { error: 'event_evidence_unavailable' }); }
      }
      const match = /^\/v1\/invoices\/(0x[0-9a-f]{64})$/.exec(path);
      if (!match || req.method !== 'GET' || !identifier(match[1])) return json(404, { error: 'not_found' });
      const tokenHash = digest(token);
      const credential = credentials.find(entry => equals(tokenHash, entry.tokenHash));
      if (!credential || credential.expiresAt <= now()) return json(401, { error: 'unauthorized' });
      if (!credential.scopes.includes('invoices:read')) return json(403, { error: 'insufficient_scope' });
      try {
        const result = await readInvoice(credential, match[1]);
        if (credential.expiresAt <= now()) return json(401, { error: 'unauthorized' });
        if (!result || result.invoice.id !== match[1] || result.invoice.merchantId !== credential.merchantId ||
            result.invoice.merchant !== credential.controller) return json(404, { error: 'not_found' });
        const { invoice } = result;
        return json(200, { version: 'v1', invoiceId: invoice.id, currency: invoice.currency,
          amount: invoice.amount.toString(), status: result.status, credited: result.credited.toString(),
          checkout: result.outstanding > 0n ? developerCheckout(origin, chainId, invoice.id) : null });
      } catch { return json(503, { error: 'canonical_state_unavailable' }); }
    }
  };
}
