import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const up=readFileSync(new URL('../migrations/001_datastore.up.sql',import.meta.url),'utf8');
const down=readFileSync(new URL('../migrations/001_datastore.down.sql',import.meta.url),'utf8');
export const migrationDigest=createHash('sha256').update(up).digest('hex');
export async function bootstrapDatastoreRoles(pool) {
  const c=await pool.connect();
  try {
    const r=(await c.query('SELECT rolsuper,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
    if (!r?.rolsuper && !r?.rolcreaterole) throw Error('role-bootstrap-denied');
    await c.query(`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='gaming_datastore_migrator') THEN
        CREATE ROLE gaming_datastore_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='gaming_datastore_runtime') THEN
        CREATE ROLE gaming_datastore_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END $$`);
    const roles=(await c.query("SELECT rolcanlogin,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls FROM pg_roles WHERE rolname IN ('gaming_datastore_migrator','gaming_datastore_runtime')")).rows;
    if (roles.length!==2 || roles.some(r=>Object.values(r).some(Boolean))) throw Error('unsafe-datastore-role');
    const who=(await c.query('SELECT current_user AS role')).rows[0].role;
    await c.query('GRANT gaming_datastore_migrator TO '+ '"'+who.replaceAll('"','""')+'"');
    const database=(await c.query('SELECT current_database() AS database')).rows[0].database;
    await c.query('GRANT CREATE ON DATABASE "'+database.replaceAll('"','""')+'" TO gaming_datastore_migrator');
  } finally { c.release(); }
}
export async function migrateDatastore(pool, direction='up') {
  if (!['up','down'].includes(direction)) throw Error('invalid-migration-direction');
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    const allowed=(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS allowed")).rows[0].allowed;
    if (!allowed) throw Error('migration-role-denied');
    await c.query('SET LOCAL ROLE gaming_datastore_migrator');
    await c.query('SELECT pg_advisory_xact_lock(420,501)');
    const exists=(await c.query("SELECT to_regclass('gaming_datastore.schema_migrations') AS present")).rows[0].present;
    if (exists) {
      const rows=(await c.query('SELECT version,digest FROM gaming_datastore.schema_migrations ORDER BY version')).rows;
      if (rows.length!==1 || rows[0].version!==1 || rows[0].digest!==migrationDigest) throw Error('migration-history-drift');
    }
    if (direction==='up' && !exists) {
      await c.query(up);
      await c.query('INSERT INTO gaming_datastore.schema_migrations(version,digest) VALUES(1,$1)',[migrationDigest]);
    } else if (direction==='down' && exists) await c.query(down);
    await c.query('COMMIT');
    return {version:direction==='up'?1:0,changed:direction==='up'?!exists:!!exists,digest:migrationDigest};
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch { /* Do not expose credentials or SQL row contents. */ }
    if (e.code==='23514') throw Error('populated-downgrade-denied');
    if (['migration-history-drift','migration-role-denied'].includes(e.message)) throw e;
    throw Error('migration-failed');
  } finally { c.release(); }
}
