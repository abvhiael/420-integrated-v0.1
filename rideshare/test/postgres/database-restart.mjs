import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDatabasePool,createPostgresTripStore,canonical} from '../../src/postgres-store.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL);
const pool=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
try {
  let ready=false;
  for(let i=0;i<20;i++) {
    try {await pool.query('SELECT 1');ready=true;break;} catch {await new Promise(r=>setTimeout(r,500));}
  }
  assert.ok(ready,'PostgreSQL restart recovery timeout');
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'liftd_qualification');
  const store=createPostgresTripStore(pool);
  const trips=(await pool.query('SELECT trip_id FROM liftd.trips ORDER BY trip_id')).rows;
  const history=[];
  for(const {trip_id} of trips) history.push((await store.history(trip_id)).map(({created_at,...event})=>event));
  const commands=(await pool.query('SELECT actor_id,command_id,request_hash,trip_id,revision,result FROM liftd.commands ORDER BY actor_id,command_id')).rows;
  const locations=(await pool.query('SELECT route_ref,trip_id,expires_at,sealed,tombstoned FROM liftd.private_locations ORDER BY route_ref')).rows;
  const digest=createHash('sha256').update(canonical({history,commands,locations})).digest('hex');
  const report={trips:trips.length,events:history.flat().length,commands:commands.length,digest};
  if(process.argv[2]==='before') {assert.ok(report.events>0);writeFileSync(process.argv[3],JSON.stringify(report));}
  else assert.deepEqual(report,JSON.parse(readFileSync(process.argv[3],'utf8')));
  console.log(`PostgreSQL ${process.argv[2]} restart: ${report.trips} trips, ${report.events} immutable events, ${report.commands} durable commands verified.`);
} finally {await pool.end();}
