import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sql=readFileSync(new URL('../migrations/002_wallet_links.up.sql',import.meta.url),'utf8');
export const walletSchemaDigest=createHash('sha256').update(sql).digest('hex');
export async function migrateWalletLinks(pool) {
  if(typeof pool?.connect!=='function')throw Error('wallet-migration-configuration');
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    const granted=(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS allowed")).rows[0]?.allowed;
    if(!granted)throw Error('wallet-migration-denied');
    await c.query('SET LOCAL ROLE gaming_datastore_migrator');
    await c.query('SELECT pg_advisory_xact_lock(420,502)');
    const prior=(await c.query("SELECT to_regclass('gaming_datastore.wallet_link_schema') AS present")).rows[0].present;
    if(!prior) {
      const base=(await c.query("SELECT version FROM gaming_datastore.schema_migrations")).rows;
      if(base.length!==1||base[0].version!==1)throw Error('wallet-migration-baseline-invalid');
      await c.query(sql);
      await c.query('INSERT INTO gaming_datastore.wallet_link_schema(version,digest) VALUES(2,$1)',[walletSchemaDigest]);
    } else {
      const versions=(await c.query('SELECT version,digest FROM gaming_datastore.wallet_link_schema')).rows;
      if(versions.length!==1||versions[0].version!==2||versions[0].digest!==walletSchemaDigest)
        throw Error('wallet-migration-drift');
    }
    await c.query('COMMIT');
    return {version:2,changed:!prior,digest:walletSchemaDigest};
  } catch(e) {
    try{await c.query('ROLLBACK');}catch{}
    if(['wallet-migration-denied','wallet-migration-drift','wallet-migration-baseline-invalid'].includes(e.message))throw e;
    throw Error('wallet-migration-failed');
  } finally {c.release();}
}
