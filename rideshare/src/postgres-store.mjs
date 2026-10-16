import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import pg from 'pg';
import {AuthError} from './auth.mjs';
import {checkSchema} from './schema.mjs';
import {publicView} from './trip.mjs';
const {Pool} = pg;
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const fail = (code, status = 409) => {throw new AuthError(code, status);};
import {canonical} from './canonical.mjs';
export {canonical} from './canonical.mjs';
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const emptyHash = '0'.repeat(64);
const eventHash = event => hash({tripId: event.trip_id, revision: Number(event.revision), actorId: event.actor_id,
  commandId: event.command_id, action: event.action, snapshot: event.snapshot, previousHash: event.previous_hash});
export function createDatabasePool(config) {
  const pool = new Pool({...config, connectionTimeoutMillis: 3000, max: 8, idleTimeoutMillis: 10000});
  // Idle connection failures must not crash the process or log credentials/queries.
  pool.on('error', () => {});
  return pool;
}
export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('liftd:migrations',0))");
    await client.query('CREATE SCHEMA IF NOT EXISTS liftd');
    await client.query('REVOKE ALL ON SCHEMA liftd FROM PUBLIC');
    await client.query('CREATE TABLE IF NOT EXISTS liftd.migrations(version text PRIMARY KEY, checksum text NOT NULL)');
    const folder = new URL('../migrations/', import.meta.url);
    for (const filename of readdirSync(folder).filter(name => /^\d{3}_.+\.sql$/.test(name)).sort()) {
      const sql = readFileSync(new URL(filename, folder), 'utf8'), checksum = hash(sql);
      const prior = await client.query('SELECT checksum FROM liftd.migrations WHERE version=$1', [filename]);
      if (prior.rows.length) {if (prior.rows[0].checksum !== checksum) fail('MIGRATION_CHECKSUM_MISMATCH', 503);}
      else {await client.query(sql); await client.query('INSERT INTO liftd.migrations VALUES($1,$2)', [filename, checksum]);}
    }
    await checkSchema(client);
    await client.query('COMMIT');
  } catch (error) {await client.query('ROLLBACK'); throw error;}
  finally {client.release();}
}
export function createPostgresTripStore(pool) {
  if (!pool || typeof pool.connect !== 'function') fail('DATABASE_UNAVAILABLE', 503);
  async function get(tripId) {
    if (!id(tripId)) fail('INVALID_REQUEST', 400);
    try {
      await checkSchema(pool);
      const result = await pool.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1', [tripId]);
      if (!result.rows.length) return undefined;
      const snapshot = result.rows[0].snapshot; publicView(snapshot); return Object.freeze(snapshot);
    } catch (error) {if (error instanceof AuthError) throw error; fail('DATABASE_UNAVAILABLE', 503);}
  }
  async function execute({actorId, commandId, tripId, action, request, guard, afterWrite, beforeLock}, produce) {
    if (![actorId, commandId, tripId].every(id) || !['create','assign','arrive','start','complete','cancel','expire','safety_resolve','offer_reject'].includes(action) ||
      typeof produce !== 'function' || typeof guard !== 'function') fail('INVALID_REQUEST', 400);
    const requestHash = hash({tripId, action, request});
    let client, committed = false;
    try {
      client = await pool.connect(); await client.query('BEGIN');
      await checkSchema(client);
      await client.query("SET LOCAL idle_in_transaction_session_timeout='15s'");
      await client.query("SET LOCAL lock_timeout='3s'");
      await client.query("SET LOCAL statement_timeout='10s'");
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`liftd:command:${actorId}:${commandId}`]);
      await guard(); // Reauthenticate after lock waiting; applies to exact retries too.
      const prior = await client.query('SELECT request_hash,result FROM liftd.commands WHERE actor_id=$1 AND command_id=$2', [actorId, commandId]);
      if (prior.rows.length) {
        if (prior.rows[0].request_hash !== requestHash) fail('IDEMPOTENCY_CONFLICT');
        await client.query('COMMIT'); committed = true;
        return Object.freeze(prior.rows[0].result);
      }
      if(beforeLock) await beforeLock(client,tripId);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`liftd:trip:${tripId}`]);
      const current = await client.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1 FOR UPDATE', [tripId]);
      const old = current.rows[0]?.snapshot;
      if (action === 'create' && old) fail('TRIP_ALREADY_EXISTS');
      if (action !== 'create' && !old) fail('TRIP_UNAVAILABLE', 404);
      await guard();
      const next = await produce(old,client); publicView(next);
      if (next.id !== tripId || (old ? next.revision !== old.revision + 1 : next.revision !== 0 || next.state !== 'REQUESTED')) fail('INVALID_STORE_TRANSITION');
      await guard(); // Fresh auth/admission checks immediately before transactional mutation.
      if (old) {
        const updated = await client.query('UPDATE liftd.trips SET snapshot=$1,revision=$2 WHERE trip_id=$3 AND revision=$4', [next, next.revision, tripId, old.revision]);
        if (updated.rowCount !== 1) fail('STALE_REVISION');
      } else await client.query('INSERT INTO liftd.trips(trip_id,revision,snapshot) VALUES($1,$2,$3)', [tripId, 0, next]);
      if (afterWrite) await afterWrite(client, next);
      const previous = await client.query('SELECT event_hash FROM liftd.events WHERE trip_id=$1 ORDER BY revision DESC LIMIT 1', [tripId]);
      const event = {trip_id: tripId, revision: next.revision, actor_id: actorId, command_id: commandId,
        action, snapshot: next, previous_hash: previous.rows[0]?.event_hash ?? emptyHash};
      await client.query('INSERT INTO liftd.events(trip_id,revision,actor_id,command_id,action,snapshot,previous_hash,event_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [tripId, next.revision, actorId, commandId, action, next, event.previous_hash, eventHash(event)]);
      await client.query('INSERT INTO liftd.commands(actor_id,command_id,request_hash,trip_id,revision,result) VALUES($1,$2,$3,$4,$5,$6)',
        [actorId, commandId, requestHash, tripId, next.revision, next]);
      await client.query('COMMIT'); committed = true; return Object.freeze(next);
    } catch (error) {
      if (client && !committed) {try {await client.query('ROLLBACK');} catch {}}
      if (error instanceof AuthError || error?.name === 'TripError') throw error;
      if (error.code === '23505') fail('UNIQUENESS_CONFLICT');
      if (error.code === '23514') fail('INVALID_STORE_TRANSITION');
      fail('DATABASE_UNAVAILABLE', 503);
    } finally {client?.release();}
  }
  async function history(tripId) {
    if (!id(tripId)) fail('INVALID_REQUEST', 400);
    let client;
    try {
      client = await pool.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await checkSchema(client);
      const events = await client.query('SELECT * FROM liftd.events WHERE trip_id=$1 ORDER BY revision', [tripId]);
      const latest = await client.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1', [tripId]);
      let previous = emptyHash;
      for (const [revision, event] of events.rows.entries()) {
        if (Number(event.revision) !== revision || event.previous_hash !== previous || eventHash(event) !== event.event_hash) fail('EVENT_HISTORY_CORRUPT', 503);
        previous = event.event_hash;
      }
      if (latest.rows.length && (!events.rows.length || canonical(latest.rows[0].snapshot) !== canonical(events.rows.at(-1).snapshot))) fail('EVENT_HISTORY_CORRUPT', 503);
      await client.query('COMMIT');
      return events.rows.map(event => Object.freeze({...event, revision: Number(event.revision)}));
    } catch (error) {if (client) {try {await client.query('ROLLBACK');} catch {}} if (error instanceof AuthError) throw error; fail('DATABASE_UNAVAILABLE', 503);}
    finally {client?.release();}
  }
  return Object.freeze({get, execute, history});
}
