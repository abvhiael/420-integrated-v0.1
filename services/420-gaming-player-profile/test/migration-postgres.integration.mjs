import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { execFileSync } from 'node:child_process';
import { bootstrapDatastoreRoles,migrateDatastore } from '../src/schema-migrations.js';
import { migrateWalletLinks } from '../src/wallet-link-migrations.js';
import { migrateMigrationRuntime } from '../src/migration-runtime-migrations.js';
import { GamingDatastoreProvisioner420 } from '../src/datastore-provisioning.js';
import { PostgresGamingRepository420,migrationIntentDigest,saveScopeDigest } from '../src/postgres-repository.js';
import { DurableMigrationCoordinator420 } from '../src/migration-coordinator.js';
const uri=process.env.GAMING_MIGRATION_TEST_URL;
if(!uri||!new URL(uri).pathname.endsWith('/r053_ci'))throw Error('isolated r053_ci PostgreSQL is mandatory');
const pools=[],root=new Pool({connectionString:uri});pools.push(root);
const h=x=>'0x'+x.repeat(64),w=x=>'0x'+x.repeat(40);
const G=h('1'),R=h('2'),P=h('3'),W=w('a'),REG=w('b'),STATE=h('8'),EVIDENCE=h('9');
let tick=0;
const nextNonce=()=>h((++tick).toString(16));
const future='18446744073709551615';
test('R05.3 real PostgreSQL durable save/outbox/receipt security',async t=>{
 try{
  await bootstrapDatastoreRoles(root);
  await migrateDatastore(root);await migrateWalletLinks(root);await migrateMigrationRuntime(root);
  assert.equal((await migrateMigrationRuntime(root)).changed,false);
  const provision=new GamingDatastoreProvisioner420(root);
  await provision.provisionAccount({accountId:'alpha',issuerRef:'issuer1',credentialCommitment:h('4')});
  await root.query("CREATE ROLE r053_alpha LOGIN PASSWORD 'r053_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
  await root.query('GRANT gaming_datastore_runtime TO r053_alpha');
  await provision.bindRuntimeScope({roleName:'r053_alpha',accountId:'alpha',gameId:G});
  await provision.registerSaveSchema({gameId:G,schemaLabel:'highcountry-state-v1',schemaNumber:'7'});
  const actorURL=new URL(uri);actorURL.username='r053_alpha';actorURL.password='r053_only';
  const actor=new Pool({connectionString:actorURL.toString()});pools.push(actor);
  const repo=new PostgresGamingRepository420({pool:actor,accountId:'alpha',gameId:G,
    expectedEpoch:'0',expectedIssuerRef:'issuer1'});
  await repo.transaction(tx=>tx.createProfile({profileId:'alpha-profile',rulesetId:R}));
  // An independent R05.2 wallet link is prerequisite to the migration transaction.
  await repo.transaction(async tx=>{
    const issuedAt=String(Math.floor(Date.now()/1000));
    const nonce='e'.repeat(64),expiresAt=String(BigInt(issuedAt)+300n);
    const challenge=await tx.issueWalletChallenge({challengeId:'wallet-challenge',wallet:W,
      chainId:'420',domain:'hc-example',nonce,consentId:'wallet-consent',policyHash:P,
      contextHash:h('5'),issuedAt,expiresAt,recoveryAuthorized:false});
    await tx.completeWalletChallenge('wallet-challenge',h('5'),{wallet:W,domain:'hc-example',
      chainId:'420',nonce,issuedAt:challenge.issued_at,expiresAt:challenge.expires_at});
  });
  const intent={migrationId:'migrate-one',consentId:'migrate-consent',sourceCommitment:h('6'),
    sourceRevision:'12',payloadHash:h('7'),policyHash:P,rulesetId:R,claimSchemaVersion:'7',
    chainId:'420',registry:REG,targetWallet:W,targetGrower:'12'};
  await repo.transaction(async tx=>{
    await tx.recordConsent({consentId:intent.consentId,purpose:'SAVE_MIGRATION',policyHash:P,
      contextHash:migrationIntentDigest('alpha',G,intent),nonceCommitment:nextNonce(),expiresAt:future});
    await tx.recordConsent({consentId:'save-consent',purpose:'CLOUD_SAVE',policyHash:P,
      contextHash:saveScopeDigest('alpha',G,R),nonceCommitment:nextNonce(),expiresAt:future});
    await tx.prepareMigration(intent);
  });
  let proof={accountId:'alpha',gameId:G,migrationId:intent.migrationId,claimId:'77',
    chainId:'420',registry:REG,sourceCommitment:intent.sourceCommitment,
    sourceRevision:intent.sourceRevision,payloadHash:intent.payloadHash,rulesetId:R,
    policyHash:P,targetWallet:W,targetGrower:'12',evidenceDigest:EVIDENCE,
    save:{schemaLabel:'highcountry-state-v1',stateHash:STATE,providerId:'trusted-guest-source',
      objectRef:'verified-opaque-backup',byteLength:'123'},saveConsentId:'save-consent'};
  let receipt={state:'FINALIZED',txHash:h('a'),blockHash:h('b'),receiptDigest:h('c')};
  const workerB=new Pool({connectionString:uri});pools.push(workerB);
  const make=(pool=root)=>new DurableMigrationCoordinator420({operatorPool:pool,
    verifyBoundClaim:async input=>{
      if(input.migrationId!==intent.migrationId||input.claimId!=='77')throw Error('claim-denied');
      return structuredClone(proof);
    },
    verifyReceipt:async ({expected})=>{
      if(expected.claim_id!=='77'||expected.registry!==REG||expected.game_id!==G)throw Error('wrong-claim');
      return structuredClone(receipt);
    }});
  const a=make(),b=make(workerB);
  await t.test('unauthorized direct runtime writes cannot create an application or outbox',async()=>{
    await assert.rejects(()=>actor.query(`INSERT INTO gaming_datastore.migration_outbox
      (account_id,game_id,migration_id) VALUES($1,$2,$3)`,['alpha',G,'forged']),e=>e.code==='42501');
  });
  await t.test('two workers applying the same canonical claim advance save once',async()=>{
    const results=await Promise.allSettled([a.apply({accountId:'alpha',gameId:G,migrationId:'migrate-one',claimId:'77'}),
      b.apply({accountId:'alpha',gameId:G,migrationId:'migrate-one',claimId:'77'})]);
    const fulfilled=results.filter(x=>x.status==='fulfilled');
    assert.ok(fulfilled.length>=1);
    assert.ok(results.every(x=>x.status==='fulfilled'||x.reason.code==='migration-retry'));
    assert.equal((await repo.transaction(tx=>tx.profile())).save_revision,'1');
    assert.equal((await repo.transaction(tx=>tx.saveReference())).state_hash,STATE);
    assert.equal((await root.query('SELECT count(*)::integer AS n FROM gaming_datastore.migration_applications')).rows[0].n,1);
    assert.equal((await root.query('SELECT count(*)::integer AS n FROM gaming_datastore.migration_outbox')).rows[0].n,1);
    const again=await b.apply({accountId:'alpha',gameId:G,migrationId:'migrate-one',claimId:'77'});
    assert.equal(again.duplicate,true);
  });
  await t.test('fresh independent worker leases and finalizes exactly one receipt',async()=>{
    const [one,two]=await Promise.all([a.lease(),b.lease()]);
    assert.equal(one.length+two.length,1);
    const leased=(one[0]??two[0]);
    assert.equal((await b.lease()).length,0);
    const done=await a.reconcile({accountId:'alpha',gameId:G,migrationId:'migrate-one',leaseToken:leased.lease_token});
    assert.equal(done.status,'RECONCILED');
    assert.equal((await b.lease()).length,0);
    await assert.rejects(()=>a.reconcile({accountId:'alpha',gameId:G,migrationId:'migrate-one',
      leaseToken:leased.lease_token}),/migration-lease-invalid/);
    assert.equal((await root.query('SELECT count(*)::integer AS n FROM gaming_datastore.migration_receipt_history')).rows[0].n,1);
  });
  await t.test('finality reorganization quarantines canonical effects without reapplying save',async()=>{
    const second={...intent,migrationId:'migrate-two',consentId:'migrate-consent-two',
      sourceCommitment:h('d'),sourceRevision:'13',payloadHash:h('e')};
    await repo.transaction(async tx=>{
      await tx.recordConsent({consentId:second.consentId,purpose:'SAVE_MIGRATION',policyHash:P,
        contextHash:migrationIntentDigest('alpha',G,second),
        nonceCommitment:nextNonce(),expiresAt:future});
      await tx.prepareMigration(second);
    });
    proof={...proof,migrationId:'migrate-two',claimId:'78',sourceCommitment:second.sourceCommitment,
      sourceRevision:second.sourceRevision,payloadHash:second.payloadHash,evidenceDigest:h('f')};
    // The canonical verifier fixture changes scope in lockstep with the second intent.
    const reorg=new DurableMigrationCoordinator420({operatorPool:workerB,
      verifyBoundClaim:async input=>{
        if(input.migrationId!=='migrate-two'||input.claimId!=='78')throw Error('claim-denied');
        return structuredClone(proof);
      },
      verifyReceipt:async ({expected})=>{
        if(expected.claim_id!=='78'||expected.migration_id!=='migrate-two')throw Error('wrong-claim');
        return {state:'REORG',txHash:h('a'),blockHash:h('b'),receiptDigest:h('c')};
      }});
    const outcome=await reorg.apply({accountId:'alpha',gameId:G,migrationId:'migrate-two',claimId:'78'});
    assert.equal(outcome.revision,'2');
    const [lease]=await reorg.lease();
    assert.equal(lease.migration_id,'migrate-two');
    const reconciled=await reorg.reconcile({accountId:'alpha',gameId:G,
      migrationId:'migrate-two',leaseToken:lease.lease_token});
    assert.equal(reconciled.status,'QUARANTINED');
    assert.equal((await reorg.lease()).length,0);
    assert.equal((await repo.transaction(tx=>tx.profile())).save_revision,'2');
    assert.equal((await repo.transaction(tx=>tx.saveReference('1'))).state_hash,STATE);
    assert.equal((await root.query(`SELECT count(*)::integer AS n FROM gaming_datastore.migration_applications
      WHERE migration_id='migrate-two'`)).rows[0].n,1);
  });
  await t.test('independent worker process crash and expired lease recovery do not duplicate saves',async()=>{
    const third={...intent,migrationId:'migrate-three',consentId:'migrate-consent-three',
      sourceCommitment:h('a'),sourceRevision:'14',payloadHash:h('b')};
    await repo.transaction(async tx=>{
      await tx.recordConsent({consentId:third.consentId,purpose:'SAVE_MIGRATION',policyHash:P,
        contextHash:migrationIntentDigest('alpha',G,third),nonceCommitment:nextNonce(),expiresAt:future});
      await tx.prepareMigration(third);
    });
    const nextProof={...proof,migrationId:'migrate-three',claimId:'79',
      sourceCommitment:third.sourceCommitment,sourceRevision:third.sourceRevision,
      payloadHash:third.payloadHash,evidenceDigest:h('c')};
    const recovered=new DurableMigrationCoordinator420({
      operatorPool:workerB,
      verifyBoundClaim:async()=>structuredClone(nextProof),
      verifyReceipt:async({expected})=>{
        if(expected.claim_id!=='79')throw Error('wrong-claim');
        return {state:'FINALIZED',txHash:h('d'),blockHash:h('e'),receiptDigest:h('f')};
      }});
    await recovered.apply({accountId:'alpha',gameId:G,migrationId:'migrate-three',claimId:'79'});
    const child=JSON.parse(execFileSync(process.execPath,
      ['test/migration-worker-child.mjs'],{cwd:new URL('../',import.meta.url),
        env:process.env,encoding:'utf8',timeout:15000}));
    assert.equal(child.migration_id,'migrate-three');
    assert.equal((await a.lease()).length,0);
    await root.query(`UPDATE gaming_datastore.migration_outbox
      SET lease_until=gaming_datastore.now_seconds()-1
      WHERE migration_id='migrate-three'`);
    const [retry]=await recovered.lease();
    assert.equal(retry.migration_id,'migrate-three');
    assert.notEqual(retry.lease_token,child.lease_token);
    await assert.rejects(()=>recovered.reconcile({accountId:'alpha',gameId:G,
      migrationId:'migrate-three',leaseToken:child.lease_token}),/migration-lease-invalid/);
    assert.equal((await recovered.reconcile({accountId:'alpha',gameId:G,
      migrationId:'migrate-three',leaseToken:retry.lease_token})).status,'RECONCILED');
    assert.equal((await repo.transaction(tx=>tx.profile())).save_revision,'3');
    assert.equal((await root.query(`SELECT count(*)::integer AS n FROM gaming_datastore.migration_applications
      WHERE migration_id='migrate-three'`)).rows[0].n,1);
  });
  await t.test('cancelled operation and forged verified claim cannot be applied',async()=>{
    await assert.rejects(()=>a.apply({accountId:'alpha',gameId:G,migrationId:'migrate-one',claimId:'78'}),
      /migration-binding-unavailable/);
    assert.equal((await repo.transaction(tx=>tx.profile())).save_revision,'3');
  });
 }finally{for(const pool of pools.reverse())await pool.end();}
});
