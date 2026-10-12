// Production adapter for registered High Country BUDS state.
// Supply a genuine authenticated TLS Postgres pool from deployment wiring.
// One SERIALIZABLE, row-locked transaction protects all accounts/claims/operations.
import { SettlementError } from './buds-ledger.js';
const mapEntries = value => {
  if (!Array.isArray(value)) throw new SettlementError('invalid durable state');
  return new Map(value);
};
function decode(raw) {
  if (!raw || raw.schema !== 1) throw new SettlementError('unknown economy schema');
  const balances=mapEntries(raw.balances);
  const operations=new Set(raw.operations);
  const claims=new Set(raw.claims);
  const sourceIssued=mapEntries(raw.sourceIssued);
  const assets=mapEntries(raw.assets ?? []);
  const assetSources=mapEntries(raw.assetSources ?? []);
  const listings=mapEntries(raw.listings ?? []);
  const transferIntents=mapEntries(raw.transferIntents ?? []);
  const importedAssets=new Set(raw.importedAssets ?? []);
  const safe=x=>Number.isSafeInteger(x)&&x>=0;
  if(!safe(raw.issued)||!safe(raw.burned)||raw.burned>raw.issued)throw new SettlementError('corrupt totals');
  for(const b of balances.values())if(!safe(b.available)||!safe(b.reserved))throw new SettlementError('corrupt balance');
  for(const v of sourceIssued.values())if(!safe(v))throw new SettlementError('corrupt issuance');
  for(const b of assets.values())if(!safe(b.available)||!safe(b.reserved))throw new SettlementError('corrupt asset');
  return {balances,operations,claims,sourceIssued,assets,assetSources,listings,transferIntents,importedAssets,issued:raw.issued,burned:raw.burned};
}
const encode = s => JSON.stringify({schema:1,balances:[...s.balances],operations:[...s.operations],
  claims:[...s.claims],sourceIssued:[...s.sourceIssued],assets:[...s.assets],assetSources:[...s.assetSources],listings:[...s.listings],transferIntents:[...s.transferIntents],importedAssets:[...s.importedAssets],issued:s.issued,burned:s.burned});
export class PostgresBudsStore {
  constructor(pool, namespace) {
    if(typeof pool?.connect!=='function'||typeof namespace!=='string'
       || !/^[a-zA-Z0-9:_-]{1,128}$/.test(namespace))throw new SettlementError('invalid db configuration');
    this.pool=pool;this.namespace=namespace;
  }
  async transact(callback) {
    const client=await this.pool.connect();
    let began=false;
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');began=true;
      // Namespace must be provisioned by authenticated operator migration, not a guest request.
      const r=await client.query('SELECT state FROM highcountry_buds_state WHERE namespace = $1 FOR UPDATE',[this.namespace]);
      if(r.rows.length!==1)throw new SettlementError('unprovisioned economy namespace');
      const state=decode(r.rows[0].state);
      const result=callback(state);
      if(result && typeof result.then==='function')throw new SettlementError('async callback forbidden in lock');
      await client.query('UPDATE highcountry_buds_state SET state = $2::jsonb WHERE namespace = $1',[this.namespace,encode(state)]);
      await client.query('COMMIT');return result;
    } catch(e) {
      if(began) { try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ } }
      throw e;
    } finally {client.release();}
  }
}
