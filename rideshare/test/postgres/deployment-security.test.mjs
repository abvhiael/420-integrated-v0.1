import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {assessReadiness} from '../../src/deployment-security.mjs';
import {createAdmittedRuntime} from '../../src/admitted-runtime.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'L03.6 requires isolated real PostgreSQL');
test('migration ownership, positive least privilege, readiness, and fail-closed rollback',async()=>{
 const owner=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
 let appPool,app;
 let migrationChecksumFixture;
 let runtimeRoleCreated=false;
 try{
  const db=await owner.query('SELECT current_database() AS name');
  assert.equal(db.rows[0].name,'liftd_qualification');
  await migrate(owner);
  await owner.query("CREATE ROLE liftd_runtime LOGIN PASSWORD 'liftd_fixture' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION");
  runtimeRoleCreated=true;
  await owner.query('GRANT USAGE ON SCHEMA liftd TO liftd_runtime');
  await owner.query('GRANT SELECT ON liftd.migrations,liftd.trips TO liftd_runtime');
  const url=new URL(process.env.LIFTD_DATABASE_URL);url.username='liftd_runtime';url.password='liftd_fixture';
  appPool=createDatabasePool({connectionString:url.href});
  const state=await assessReadiness(appPool);
  assert.equal(state.ready,true);assert.equal(state.role,'liftd_runtime');
  assert.ok(state.appliedMigrations>=15);
  await assert.rejects(()=>appPool.query('TRUNCATE liftd.trips'));
  await assert.rejects(()=>appPool.query('INSERT INTO liftd.migrations(version,checksum) VALUES($1,$2)',['fake','0'.repeat(64)]));
  const config={environment:'testnet',publicOrigin:'https://rideshare.example.org/',databaseUrl:'postgres://liftd_runtime:secret@postgres.example.org/liftd?sslmode=verify-full',databaseRole:'liftd_runtime',tlsMode:'trusted-terminator',secretProvider:'managed',identityKeyDigest:'a'.repeat(64),sessionKeyDigest:'b'.repeat(64),locationKeyDigest:'c'.repeat(64),releaseSha:'d'.repeat(40),enableDispatch:false,enablePayments:false,enablePassengerTraffic:false,limits:{requestBytes:1024,timeoutMs:3000}};
  app=createAdmittedRuntime({config,pool:appPool,port:0});const addr=await app.start();
  const root='http://127.0.0.1:'+addr.port;
  assert.equal((await fetch(root+'/internal/ready')).status,200);
  assert.equal((await fetch(root+'/v1/rideshare/trips')).status,404);
  await app.stop();app=null;
  await owner.query('REVOKE SELECT ON liftd.trips FROM liftd_runtime');
  await assert.rejects(()=>assessReadiness(appPool),e=>e.code==='DEPLOY_DATABASE_PRIVILEGE_DENIED');
  await owner.query('GRANT SELECT ON liftd.trips TO liftd_runtime');
  assert.equal((await assessReadiness(appPool)).ready,true);
  // This negative test must leave the shared sequential qualification fixture pristine.
  // Save the actual immutable ledger value; never infer or rewrite a migration checksum.
  const priorMigration=(await owner.query('SELECT version,checksum FROM liftd.migrations ORDER BY version LIMIT 1')).rows[0];
  assert.ok(priorMigration?.version && /^[a-f0-9]{64}$/.test(priorMigration.checksum));
  migrationChecksumFixture=priorMigration;
  await owner.query("UPDATE liftd.migrations SET checksum='0' WHERE version=$1",[priorMigration.version]);
  await assert.rejects(()=>assessReadiness(appPool),e=>e.code==='MIGRATION_CHECKSUM_MISMATCH');
  // During the negative test the tampered schema must remain unready; fixture cleanup
  // below is qualification-only and cannot be used for production schema repair.
 }finally{
  try {
   if (migrationChecksumFixture) await owner.query('UPDATE liftd.migrations SET checksum=$1 WHERE version=$2 AND checksum=$3',[
    migrationChecksumFixture.checksum,migrationChecksumFixture.version,'0']);
  } finally {
   await app?.stop();await appPool?.end();
   // This fixture owns the role it created; release it before subsequent
   // PostgreSQL test owners establish their independent runtime grants.
   if (runtimeRoleCreated) {
    await owner.query('DROP OWNED BY liftd_runtime');
    await owner.query('DROP ROLE liftd_runtime');
   }
   await owner.end();
  }
 }
});
