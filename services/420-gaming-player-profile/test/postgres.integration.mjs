import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { generateKeyPairSync,sign } from 'node:crypto';
import { bootstrapDatastoreRoles,migrateDatastore,migrationDigest } from '../src/schema-migrations.js';
import { GamingDatastoreProvisioner420 } from '../src/datastore-provisioning.js';
import { PostgresGamingRepository420,DatastoreError,saveScopeDigest,migrationIntentDigest,
  createPostgresGamingPlayerProfileService420 } from '../src/postgres-repository.js';
import { RuntimeAuthority } from '../../highcountry-economy/src/runtime-integration.js';
import { PostgresBudsStore } from '../../highcountry-economy/src/postgres-store.js';
const uri=process.env.GAMING_DATASTORE_TEST_URL;
if(!uri || !new URL(uri).pathname.endsWith('/r051_ci'))throw Error('An actual isolated r051_ci PostgreSQL database is required; tests cannot skip.');
const admin=new Pool({connectionString:uri}),pools=[admin];
const h=n=>'0x'+String(n).repeat(64),w=n=>'0x'+String(n).repeat(40);
const G=h(1),H=h(2),R=h(3),P=h(4),A='account-a',B='account-b';
const repo=(pool,accountId=A,gameId=G)=>new PostgresGamingRepository420({pool,accountId,gameId,expectedEpoch:'0',expectedIssuerRef:'issuer1'});
let a,b,other,ra,rb,rh,provision;
const expires=async()=>String(BigInt((await admin.query('SELECT floor(extract(epoch FROM clock_timestamp()))::text AS n')).rows[0].n)+600n);
// Each consent needs an independent nonce even when request IDs have the same length.
let nonce=10n;
async function allow(r,id,purpose,context){return r.transaction(t=>t.recordConsent({consentId:id,purpose,
  policyHash:P,contextHash:context,nonceCommitment:'0x'+(++nonce).toString(16).padStart(64,'0'),expiresAt:'18446744073709551615'}));}
const save=(expectedRevision,consentId='save-consent')=>({expectedRevision,schemaLabel:'highcountry-state-v1',
  rulesetId:R,stateHash:h(5),providerId:'reviewed-provider',objectRef:'opaque-object',byteLength:'100',consentId});
const intent={migrationId:'migration-1',consentId:'migration-consent',sourceCommitment:h(6),
  sourceRevision:'18446744073709551615',payloadHash:h(7),policyHash:P,rulesetId:R,claimSchemaVersion:'7',
  chainId:'420',registry:w(1),targetWallet:w(2),targetGrower:'18446744073709551615'};
async function actor(role){
  await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'r051_ci_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
  await admin.query(`GRANT gaming_datastore_runtime TO ${role}`);
  const u=new URL(uri);u.username=role;u.password='r051_ci_only';
  const pool=new Pool({connectionString:u.toString(),max:4});pools.push(pool);return pool;
}
test('R05.1 actual PostgreSQL datastore adversarial acceptance',async t=>{
  try {
    await bootstrapDatastoreRoles(admin);
    await t.test('advisory-locked migration applies once, reverses empty schema and detects checksum drift',async()=>{
      const outcomes=await Promise.all([migrateDatastore(admin),migrateDatastore(admin)]);
      assert.equal(outcomes.filter(x=>x.changed).length,1);
      assert.equal((await migrateDatastore(admin,'down')).version,0);
      await migrateDatastore(admin);
      await admin.query("UPDATE gaming_datastore.schema_migrations SET digest=repeat('a',64)");
      await assert.rejects(()=>migrateDatastore(admin),/migration-history-drift/);
      await admin.query('UPDATE gaming_datastore.schema_migrations SET digest=$1',[migrationDigest]);
    });
    provision=new GamingDatastoreProvisioner420(admin);
    await provision.provisionAccount({accountId:A,issuerRef:'issuer1',credentialCommitment:h(8)});
    await provision.provisionAccount({accountId:B,issuerRef:'issuer1',credentialCommitment:h(9)});
    a=await actor('r051_a_g');b=await actor('r051_b_g');other=await actor('r051_a_h');
    for(const [role,accountId,gameId] of [['r051_a_g',A,G],['r051_b_g',B,G],['r051_a_h',A,H]])
      await provision.bindRuntimeScope({roleName:role,accountId,gameId});
    await provision.registerSaveSchema({gameId:G,schemaLabel:'highcountry-state-v1',schemaNumber:'7'});
    await provision.registerSaveSchema({gameId:H,schemaLabel:'highcountry-state-v1',schemaNumber:'8'});
    ra=repo(a);rb=repo(b,B);rh=repo(other,A,H);
    await t.test('registered profiles are durable and wallet-free, with separate account and game identities',async()=>{
      for(const [r,id] of [[ra,'profile-a'],[rb,'profile-b'],[rh,'profile-h']])await r.transaction(t=>t.createProfile({profileId:id,rulesetId:R}));
      assert.equal((await ra.transaction(t=>t.profile())).authority_domain,'REGISTERED_GAME_STATE');
      assert.equal((await rb.transaction(t=>t.profile())).profile_id,'profile-b');
      assert.equal((await rh.transaction(t=>t.profile())).profile_id,'profile-h');
      const account=await ra.transaction(t=>t.account());assert.ok(!('credential_commitment' in account));
    });
    await t.test('RLS denies cross-account/game access, scope forgery, SET variables and role escalation',async()=>{
      assert.deepEqual((await a.query('SELECT profile_id FROM gaming_datastore.game_profiles')).rows,[{profile_id:'profile-a'}]);
      assert.equal((await a.query('SELECT * FROM gaming_datastore.runtime_scopes')).rowCount,1);
      await assert.rejects(()=>repo(a,B).transaction(t=>t.profile()),/scope-denied/);
      await assert.rejects(()=>repo(a,A,H).transaction(t=>t.profile()),/scope-denied/);
      await assert.rejects(()=>repo(admin).transaction(t=>t.profile()),/scope-denied/);
      const c=await a.connect();try{
        await c.query("SET app.account_id='account-b'; SET app.game_id='forged'");
        assert.equal((await c.query('SELECT * FROM gaming_datastore.game_profiles')).rowCount,1);
        await assert.rejects(()=>c.query('SET ROLE gaming_datastore_migrator'),e=>e.code==='42501');
        await c.query('SET ROLE gaming_datastore_runtime');
        assert.equal((await c.query('SELECT * FROM gaming_datastore.game_profiles')).rowCount,0);
        await c.query('RESET ROLE');
      }finally{c.release();}
      await assert.rejects(()=>a.query(`INSERT INTO gaming_datastore.game_profiles(account_id,game_id,profile_id,ruleset_id)
        VALUES($1,$2,'stolen',$3)`,[B,G,R]),e=>e.code==='42501');
      await assert.rejects(()=>a.query('ALTER TABLE gaming_datastore.accounts ADD COLUMN unsafe text'),e=>e.code==='42501');
      await assert.rejects(()=>migrateDatastore(a),/migration-role-denied/);
      await assert.rejects(()=>new GamingDatastoreProvisioner420(a).disableAccount(B),/provisioning-denied/);
    });
    await allow(ra,'save-consent','CLOUD_SAVE',saveScopeDigest(A,G,R));
    await t.test('save reference and head commit atomically with exact schema, scope and revision',async()=>{
      const row=await ra.transaction(t=>t.publishSaveReference(save('0')));assert.equal(row.revision,'1');
      assert.equal((await ra.transaction(t=>t.profile())).save_revision,'1');
      await assert.rejects(()=>ra.transaction(t=>t.publishSaveReference({...save('1'),schemaLabel:'unknown'})),/conflict-or-invalid-record/);
      assert.equal((await ra.transaction(t=>t.profile())).save_revision,'1');
      assert.equal((await ra.transaction(t=>t.saveReference('2'))),null);
      await assert.rejects(()=>ra.transaction(t=>t.publishSaveReference({...save('1'),email:'private'})),/invalid-input/);
      await assert.rejects(()=>ra.transaction(t=>t.publishSaveReference({...save('1'),objectRef:'https://storage/private?secret=x'})),/invalid-input/);
      assert.equal(await rb.transaction(t=>t.saveReference()),null);
      await ra.transaction(t=>t.publishSaveReference(save('1')));
    });
    await t.test('fresh process/pool reads the same persisted profile and original save reference',async()=>{
      const u=new URL(uri);u.username='r051_a_g';u.password='r051_ci_only';
      const fresh=new Pool({connectionString:u.toString()});pools.push(fresh);
      assert.equal((await repo(fresh).transaction(t=>t.saveReference())).revision,'2');
      assert.equal((await repo(fresh).transaction(t=>t.saveReference('1'))).state_hash,h(5));
    });
    await t.test('concurrent writers cannot overwrite or double-advance a revision',async()=>{
      const result=await Promise.allSettled([ra.transaction(t=>t.publishSaveReference(save('2'))),ra.transaction(t=>t.publishSaveReference(save('2')))]);
      assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
      assert.match(result.find(x=>x.status==='rejected').reason.message,/retry-required|revision-conflict/);
      assert.equal((await ra.transaction(t=>t.profile())).save_revision,'3');
      assert.equal((await a.query('SELECT * FROM gaming_datastore.save_references WHERE revision=3')).rowCount,1);
    });
    await t.test('transaction failure rolls back all prior writes and escaped transaction handles close',async()=>{
      let escaped;
      await assert.rejects(()=>ra.transaction(async t=>{escaped=t;await t.revokeConsent('save-consent');throw new DatastoreError('injected-failure');}),/injected-failure/);
      assert.equal((await ra.transaction(t=>t.consent('save-consent'))).revoked_at,null);
      await assert.rejects(()=>escaped.profile(),/transaction-closed/);
    });
    await t.test('wrong-purpose, expired and revoked consents deny new writes while old saves remain readable',async()=>{
      await allow(ra,'wrong-purpose','WALLET_LINK',saveScopeDigest(A,G,R));
      await assert.rejects(()=>ra.transaction(t=>t.publishSaveReference(save('3','wrong-purpose'))),/consent-denied/);
      await ra.transaction(t=>t.revokeConsent('save-consent'));
      await assert.rejects(()=>ra.transaction(t=>t.publishSaveReference(save('3'))),/consent-denied/);
      assert.equal((await ra.transaction(t=>t.saveReference())).revision,'3');
      await assert.rejects(()=>a.query(`UPDATE gaming_datastore.consents SET revoked_at=NULL WHERE consent_id='save-consent'`),e=>e.code==='23514');
      const boundary=String(BigInt(await expires())-598n);
      await ra.transaction(t=>t.recordConsent({consentId:'short',purpose:'CLOUD_SAVE',policyHash:P,contextHash:saveScopeDigest(A,G,R),
        nonceCommitment:h(9),expiresAt:boundary}));
      await new Promise(r=>setTimeout(r,2200));
      await assert.rejects(()=>ra.transaction(t=>t.publishSaveReference(save('3','short'))),/consent-denied/);
    });
    await t.test('database constraints reject fractional, overflowing, negative and cross-scope records',async()=>{
      for(const value of ['-1','1.5','18446744073709551616'])
        await assert.rejects(()=>admin.query('SELECT $1::gaming_datastore.uint64',[value]),e=>e.code==='23514');
      await assert.rejects(()=>admin.query('SELECT $1::gaming_datastore.uint32',['4294967296']),e=>e.code==='23514');
      await assert.rejects(()=>a.query(`INSERT INTO gaming_datastore.save_references
        (account_id,game_id,revision,schema_label,ruleset_id,state_hash,provider_id,object_ref,byte_length,consent_id)
        VALUES($1,$2,4,'highcountry-state-v1',$3,$4,'provider','ref',1,'save-consent')`,[A,G,R,h(5)]),e=>e.code==='23514');
      await assert.rejects(()=>a.query('DELETE FROM gaming_datastore.consents'),e=>e.code==='42501');
    });
    await allow(ra,intent.consentId,'SAVE_MIGRATION',migrationIntentDigest(A,G,intent));
    await t.test('migration records persist exact uint64 intent and retry without alternate source effects',async()=>{
      const first=await ra.transaction(t=>t.prepareMigration(intent));
      const retry=await ra.transaction(t=>t.prepareMigration({...intent,migrationId:'retry-id'}));
      assert.equal(retry.migration_id,first.migration_id);assert.equal(retry.target_grower,intent.targetGrower);
      assert.equal(retry.status,'PREPARED');assert.ok(!('rawGuestSave' in retry));assert.ok(!('claim_id' in retry));
      await assert.rejects(()=>ra.transaction(t=>t.prepareMigration({...intent,payloadHash:h(8)})),/migration-conflict/);
      assert.equal(await rb.transaction(t=>t.migration(intent.migrationId)),null);
      assert.equal(await rh.transaction(t=>t.migration(intent.migrationId)),null);
    });
    await t.test('cancelled migration and revoked consent history cannot reactivate or claim completion',async()=>{
      await ra.transaction(t=>t.cancelMigration(intent.migrationId));
      assert.equal((await ra.transaction(t=>t.cancelMigration(intent.migrationId))).status,'CANCELLED');
      await ra.transaction(t=>t.revokeConsent(intent.consentId));
      assert.equal((await ra.transaction(t=>t.prepareMigration(intent))).status,'CANCELLED');
      await assert.rejects(()=>a.query("UPDATE gaming_datastore.migration_records SET status='PREPARED',cancelled_at=NULL"),e=>e.code==='23514');
      await assert.rejects(()=>a.query("UPDATE gaming_datastore.migration_records SET status='COMPLETE'"),e=>e.code==='23514');
      await assert.rejects(()=>a.query('DELETE FROM gaming_datastore.migration_records'),e=>e.code==='42501');
    });
    await t.test('actual retained signed RuntimeAuthority resolves only authenticated DB scopes and revalidates expiry',async()=>{
      await admin.query(await readFile(new URL('../../highcountry-economy/migrations/001_buds_state.sql',import.meta.url),'utf8'));
      await admin.query(await readFile(new URL('../../highcountry-economy/migrations/002_runtime_namespace_rls.sql',import.meta.url),'utf8'));
      await admin.query("CREATE ROLE r051_auth LOGIN PASSWORD 'r051_ci_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
      await admin.query('GRANT SELECT,UPDATE ON highcountry_buds_state TO r051_auth');
      await admin.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb)', ['r051_auth',JSON.stringify({schema:1,
        runtimeAccounts:[[A,{issuer:'issuer1',game:G}]],runtimeEpochs:[],balances:[],operations:[],claims:[],sourceIssued:[],
        assets:[],assetSources:[],listings:[],transferIntents:[],settlementJobs:[],importedAssets:[],issued:0,burned:0})]);
      const u=new URL(uri);u.username='r051_auth';u.password='r051_ci_only';const authPool=new Pool({connectionString:u.toString()});pools.push(authPool);
      const keys=generateKeyPairSync('ed25519');let now=1000;
      const authority=new RuntimeAuthority({store:new PostgresBudsStore(authPool,'r051_auth'),issuers:{issuer1:{publicKey:keys.publicKey}},
        audience:'profile-service',gameId:G,chainId:420,origin:'https://configured.example',rpc:{},clock:()=>now});
      const payload=Buffer.from(JSON.stringify({iss:'issuer1',aud:'profile-service',game:G,sub:A,sid:'session-1',epoch:0,nbf:0,exp:5000})).toString('base64url');
      const token=payload+'.'+sign(null,Buffer.from(payload),keys.privateKey).toString('base64url');
      const service=await createPostgresGamingPlayerProfileService420({authority,token,poolForPrincipal:async s=>{assert.equal(s.accountId,A);return a;}});
      assert.equal((await service.transaction(t=>t.profile())).profile_id,'profile-a');
      await assert.rejects(()=>createPostgresGamingPlayerProfileService420({authority,token:token+'bad',poolForPrincipal:async()=>a}));
      const mismatched=await createPostgresGamingPlayerProfileService420({authority,token,poolForPrincipal:async()=>b});
      await assert.rejects(()=>mismatched.transaction(t=>t.profile()),/scope-denied/);
      await assert.rejects(()=>service.transaction(async t=>{await t.revokeConsent('wrong-purpose');now=6000;}));
      now=1000;assert.equal((await ra.transaction(t=>t.consent('wrong-purpose'))).revoked_at,null);
      now=6000;await assert.rejects(()=>service.transaction(t=>t.profile()));
    });
    await t.test('populated downgrade and schema drift fail closed without deleting privacy/replay history',async()=>{
      const before=(await admin.query('SELECT count(*)::text AS n FROM gaming_datastore.migration_records')).rows[0].n;
      await assert.rejects(()=>migrateDatastore(admin,'down'),/populated-downgrade-denied/);
      assert.equal((await admin.query('SELECT count(*)::text AS n FROM gaming_datastore.migration_records')).rows[0].n,before);
      await admin.query("UPDATE gaming_datastore.schema_migrations SET digest=repeat('b',64)");
      await assert.rejects(()=>ra.transaction(t=>t.profile()),/schema-mismatch/);
      await admin.query('UPDATE gaming_datastore.schema_migrations SET digest=$1',[migrationDigest]);
    });
    await t.test('account disable/epoch revocation denies existing pools across games without affecting other accounts',async()=>{
      await provision.disableAccount(A);
      await assert.rejects(()=>ra.transaction(t=>t.profile()),/account-revoked/);
      await assert.rejects(()=>rh.transaction(t=>t.profile()),/account-revoked/);
      assert.equal((await rb.transaction(t=>t.profile())).profile_id,'profile-b');
    });
  }finally{await Promise.all(pools.map(p=>p.end()));}
});
