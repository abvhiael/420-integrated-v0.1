import { hash, requireThat, bytes32, wallet, integer, Fault } from './security.mjs';

const topics = {
  ListingPublished: 'ListingRegistry420', ListingCancelled: 'ListingRegistry420',
  OrderCreated: 'OrderRegistry420', PaymentRecorded: 'OrderRegistry420', FulfillmentRecorded: 'OrderRegistry420', OrderCompleted: 'OrderRegistry420', OrderCancelled: 'OrderRegistry420', OrderDisputed: 'OrderRegistry420', RefundRecorded: 'OrderRegistry420',
};
const states = { PaymentRecorded: 'PAID', FulfillmentRecorded: 'FULFILLED', OrderCompleted: 'COMPLETED', OrderCancelled: 'CANCELLED', OrderDisputed: 'DISPUTED', RefundRecorded: 'REFUNDED' };
export class Projection {
  constructor(db, authority, { chainId, contracts, startHeight, startParentHash, now = Date.now }) {
    this.db = db; this.authority = authority; this.chainId = chainId; this.contracts = contracts; this.now = now;
    this.startHeight = startHeight; this.startParentHash = startParentHash;
    integer(startHeight, 0, Number.MAX_SAFE_INTEGER); bytes32(startParentHash);
    this.db.run('INSERT OR IGNORE INTO projection_checkpoints VALUES(?,\'v1\',NULL,?,?,?,1,?,0)', chainId, startParentHash, startHeight - 1, startHeight - 1, 0);
  }
  health() {
    const row = this.db.get('SELECT * FROM projection_checkpoints WHERE chain_id=?', this.chainId);
    return { authoritative: false, chainId: this.chainId, blockHash: row.canonical_block_hash, height: row.height, finalizedHeight: row.finalized_height, updatedAt: row.updated_at, state: row.halted ? 'halted' : this.now() - row.updated_at > 120000 ? 'stale' : 'ready' };
  }
  halt(code) {
    this.db.run('UPDATE projection_checkpoints SET halted=1 WHERE chain_id=?', this.chainId);
    this.db.audit('projection', null, code, this.chainId, this.now());
    throw new Fault(code, 503);
  }
  // Headers come from the canonical RPC authority, never an untrusted event field.
  // This consumes shared IndexerEventBatch420 envelopes, not eth_getLogs.
  async ingest(batch, headers) {
    requireThat(batch?.streamVersion === 'v1' && batch.authoritative === false && Array.isArray(batch.events) && batch.events.length <= 1000 && Array.isArray(headers) && headers.length > 0 && headers.length <= 256 && (batch.nextCursor === null || typeof batch.nextCursor === 'string' && batch.nextCursor.length <= 4096), 'invalid_batch');
    const verified = await this.authority.verifyBlocks(headers);
    if(verified !== true)return this.halt('unverified_blocks');
    if (this.health().state === 'halted') throw new Fault('projection_halted', 503);
    const cp = this.db.get('SELECT * FROM projection_checkpoints WHERE chain_id=?', this.chainId);
    let previous;
    for (const header of headers) {
      integer(header.height, 0, Number.MAX_SAFE_INTEGER); bytes32(header.hash); bytes32(header.parentHash); requireThat(typeof header.finalized === 'boolean', 'invalid_finality');
      if (previous && (header.height !== previous.height + 1 || header.parentHash !== previous.hash)) return this.halt('unknown_ancestry');
      const old = this.db.get('SELECT * FROM projection_blocks WHERE height=?', header.height);
      if (old && old.hash !== header.hash && (old.finalized || header.height <= cp.finalized_height)) return this.halt('finalized_mismatch');
      previous = header;
    }
    const first = headers[0], parent = this.db.get('SELECT * FROM projection_blocks WHERE height=?', first.height - 1);
    const expectedParent = first.height === this.startHeight ? this.startParentHash : first.height - 1 === cp.height ? cp.canonical_block_hash : parent?.hash;
    // Initial seeded checkpoint is also a valid ancestor; unknown ancestor halts.
    if (first.parentHash !== expectedParent || first.height > cp.height + 1) return this.halt('unknown_ancestry');
    const byHeight = new Map(headers.map(h => [h.height, h]));
    for (const event of batch.events) this.validateEvent(event, byHeight);
    this.db.transaction(() => {
      const conflict = headers.find(h => { const old = this.db.get('SELECT hash FROM projection_blocks WHERE height=?', h.height); return old && old.hash !== h.hash; });
      if (conflict) {
        this.db.run("UPDATE projection_meta SET value=value+1 WHERE key='generation'");
        const generation=this.db.get("SELECT value FROM projection_meta WHERE key='generation'").value;
        const delivered=this.db.all('SELECT o.* FROM projection_outbox o JOIN event_inbox e ON e.event_id=o.event_id WHERE e.canonical=1 AND e.block_number>=? AND o.attempts>0 AND o.invalidated=0 AND o.operation=\'projection_changed\'',conflict.height);
        for(const row of delivered)this.db.run('INSERT OR IGNORE INTO projection_outbox(id,event_id,operation,payload_ref) VALUES(?,?,\'projection_retracted\',?)',hash(`retract:${generation}:${row.id}`),row.event_id,row.payload_ref);
        this.db.run('UPDATE event_inbox SET canonical=0 WHERE block_number>=? AND canonical=1', conflict.height);
        this.db.run('UPDATE projection_outbox SET invalidated=1 WHERE operation=\'projection_changed\' AND event_id IN (SELECT event_id FROM event_inbox WHERE canonical=0)');
        this.db.run('DELETE FROM projection_blocks WHERE height>=?', conflict.height);
      }
      for (const h of headers) this.db.run('INSERT INTO projection_blocks VALUES(?,?,?,?) ON CONFLICT(height) DO UPDATE SET finalized=MAX(finalized,excluded.finalized)', h.height, h.hash, h.parentHash, +h.finalized);
      for (const event of batch.events) {
        const p = event.provenance, payload = JSON.stringify(event), digest = hash(payload), old = this.db.get('SELECT payload_hash FROM event_inbox WHERE event_id=?', event.id);
        requireThat(!old || old.payload_hash === digest, 'event_payload_conflict', 409);
        const h = byHeight.get(Number(p.blockNumber));
        this.db.run('INSERT OR IGNORE INTO event_inbox VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1)', event.id, p.chainId, Number(p.blockNumber), p.blockHash, p.transactionHash, p.transactionIndex, p.logIndex, wallet(p.contractAddress), event.topic, digest, payload, h.finalized ? 'finalized' : 'included', this.now());
        this.db.run('UPDATE event_inbox SET canonical=1,finality=? WHERE event_id=?', h.finalized ? 'finalized' : 'included', event.id);
        const generation=this.db.get("SELECT value FROM projection_meta WHERE key='generation'").value;
        this.db.run('INSERT OR IGNORE INTO projection_outbox(id,event_id,operation,payload_ref) VALUES(?,?,?,?)', hash(`${generation}:${event.id}`), event.id, 'projection_changed', event.objectKey ?? event.id);
      }
      this.db.run("UPDATE event_inbox SET finality='finalized' WHERE canonical=1 AND block_hash IN (SELECT hash FROM projection_blocks WHERE finalized=1)");
      this.rebuildRows();
      const last = headers.at(-1), finalized = this.db.get('SELECT MAX(height) AS n FROM projection_blocks WHERE finalized=1').n ?? cp.finalized_height;
      const head = this.db.get('SELECT height,hash FROM projection_blocks ORDER BY height DESC LIMIT 1');
      this.db.run('UPDATE projection_checkpoints SET cursor=?,canonical_block_hash=?,height=?,finalized_height=?,updated_at=? WHERE chain_id=?', batch.nextCursor, head.hash, head.height, finalized, batch.caughtUp===false?0:this.now(), this.chainId);
      requireThat(last.height <= head.height, 'checkpoint_failure');
    });
    return this.health();
  }
  validateEvent(event, headers) {
    requireThat(event.streamVersion === 'v1' && event.authoritative === false && event.source === 'protocol' && typeof event.protocol === 'string' && event.topic === `${event.protocol}.${event.eventName}` && Object.hasOwn(topics, event.eventName), 'invalid_event');
    const p = event.provenance; requireThat(p?.chainId === this.chainId && /^[0-9]+$/.test(p.blockNumber), 'event_chain');
    bytes32(p.blockHash); bytes32(p.transactionHash); integer(p.transactionIndex,0,100000); integer(p.logIndex,0,100000);
    const h = headers.get(Number(p.blockNumber)); requireThat(h?.hash === p.blockHash, 'event_block');
    requireThat(wallet(p.contractAddress) === wallet(this.contracts[topics[event.eventName]].address), 'unknown_emitter');
    requireThat(event.id === ['420evt','v1',this.chainId.toLowerCase(),p.blockHash.toLowerCase(),p.transactionHash.toLowerCase(),String(p.logIndex)].join(':'), 'event_identity');
    requireThat(event.fields && typeof event.fields === 'object' && JSON.stringify(event.fields).length <= 16000, 'event_fields');
    const keyField = event.eventName.startsWith('Listing') ? 'listingId' : 'orderId';
    const key = event.fields[keyField]; bytes32(key);
    requireThat(event.objectKey === `${keyField}:${key}`, 'event_object');
    if (event.eventName === 'ListingPublished') {
      requireThat(wallet(event.fields.seller) && /^[1-9][0-9]*$/.test(String(event.fields.revision)), 'listing_fields');
      for (const field of ['unitPrice','quantity','expiresAt']) requireThat(/^[0-9]+$/.test(String(event.fields[field])), 'listing_fields');
      requireThat(/^0x[0-9a-f]{64}$/.test(event.fields.metadataHash), 'listing_fields'); wallet(event.fields.quoteAsset); requireThat(typeof event.fields.active === 'boolean', 'listing_fields');
    }
    if (event.eventName === 'OrderCreated') { wallet(event.fields.buyer); wallet(event.fields.seller); }
  }
  rebuildRows() {
    this.db.run('DELETE FROM catalogue_projection'); this.db.run('DELETE FROM order_projection');
    for (const row of this.db.all('SELECT * FROM event_inbox WHERE canonical=1 ORDER BY block_number,tx_index,log_index')) {
      requireThat(hash(row.payload)===row.payload_hash, 'inbox_integrity', 503);
      const e = JSON.parse(row.payload), f = e.fields, name = e.eventName;
      if (name === 'ListingPublished') this.db.run('INSERT INTO catalogue_projection VALUES(?,?,?,?,?) ON CONFLICT(listing_id) DO UPDATE SET payload=excluded.payload,block_hash=excluded.block_hash,block_number=excluded.block_number,finalized=excluded.finalized', f.listingId, JSON.stringify(f), row.block_hash, row.block_number, +(row.finality === 'finalized'));
      else if (name === 'ListingCancelled') {
        const current = this.db.get('SELECT payload FROM catalogue_projection WHERE listing_id=?', f.listingId);
        if (current) this.db.run('UPDATE catalogue_projection SET payload=?,block_hash=?,block_number=?,finalized=? WHERE listing_id=?', JSON.stringify({ ...JSON.parse(current.payload), active:false }), row.block_hash,row.block_number,+(row.finality === 'finalized'),f.listingId);
      } else {
        const current = this.db.get('SELECT payload FROM order_projection WHERE order_id=?', f.orderId);
        const payload = name === 'OrderCreated' ? { ...f, status:'CREATED' } : current ? { ...JSON.parse(current.payload), ...f, status:states[name] } : null;
        requireThat(payload, 'order_history_incomplete', 503);
        this.db.run('INSERT INTO order_projection VALUES(?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET payload=excluded.payload,block_hash=excluded.block_hash,block_number=excluded.block_number,finalized=excluded.finalized', f.orderId, JSON.stringify(payload),row.block_hash,row.block_number,+(row.finality === 'finalized'));
      }
    }
  }
  async rebuild() {
    const headers = this.db.all('SELECT height,hash,parent_hash AS parentHash,finalized FROM projection_blocks').map(h => ({...h,finalized:!!h.finalized}));
    requireThat(await this.authority.verifyBlocks(headers), 'rebuild_authority', 503);
    this.db.transaction(() => { this.rebuildRows(); this.db.run('UPDATE projection_checkpoints SET halted=0,updated_at=? WHERE chain_id=?',this.now(),this.chainId); });
    return this.health();
  }
  async deliverOutbox(sink) {
    requireThat(this.health().state === 'ready','projection_unavailable',503);
    for (const row of this.db.all('SELECT * FROM projection_outbox WHERE delivered_at IS NULL AND invalidated=0 ORDER BY rowid LIMIT 100')) {
      if(this.db.run('UPDATE projection_outbox SET attempts=attempts+1 WHERE id=? AND invalidated=0',row.id).changes!==1)continue;
      // Sink must deduplicate the stable key. A crash after send before commit is replayable.
      await sink({ idempotencyKey:row.id,eventId:row.event_id,operation:row.operation,objectId:row.payload_ref,authoritative:false });
      this.db.run('UPDATE projection_outbox SET delivered_at=? WHERE id=? AND invalidated=0',this.now(),row.id);
    }
  }
}
