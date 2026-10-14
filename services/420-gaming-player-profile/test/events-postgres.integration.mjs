import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {bootstrapDatastoreRoles,migrateDatastore} from '../src/schema-migrations.js';
import {migrateWalletLinks} from '../src/wallet-link-migrations.js';
import {migrateMigrationRuntime} from '../src/migration-runtime-migrations.js';
import {PostgresGamingRepository420} from '../src/postgres-repository.js';
import {createGamingEventScopeResolver420} from '../src/gaming-event-scope-resolver.js';
import {migrateEventIngestion,eventIngestionDigest} from '../src/event-ingestion-migrations.js';
import {GamingDatastoreProvisioner420} from '../src/datastore-provisioning.js';
import {DurableGamingEventIndexer420} from '../src/durable-gaming-event-indexer.js';
import {GAMING_EVENT_TOPICS420} from '../src/gaming-event-abi.js';
const uri=process.env.GAMING_EVENTS_TEST_URL;
if(!uri||!new URL(uri).pathname.endsWith('/r056_ci'))throw Error('R05.6 isolated PostgreSQL r056_ci required');
const root=new Pool({connectionString:uri});
const h=x=>'0x'+x.repeat(64),wallet='0x'+'a'.repeat(40),contract='0x'+'b'.repeat(40);
const G=h('1'),C={claims:contract,bridge:'0x'+'c'.repeat(40),migration:'0x'+'d'.repeat(40)};
const block1=h('2'),block2=h('3'),alternate=h('4'),tx=h('5'),parent=h('6'),profile=h('7');
const logs=(blockHash)=>[{address:contract,blockHash,transactionHash:tx,
 transactionIndex:'0',logIndex:'0',
 topics:[GAMING_EVENT_TOPICS420.MigrationClaimConsumed,h('8'),profile],data:'0x'}];
const chain={number:'1',hash:block1,parentHash:parent,logs:logs(block1)};
let canonical=new Set([block1]),permission=true,callCount=0;
const canonicalByHeight=new Map([['1',{...chain}]]);
const indexer=()=>new DurableGamingEventIndexer420({operatorPool:root,
 chainId:'420',gameId:G,contracts:C,
 fetchBlock:async ({number})=>{assert.ok(['1','2','3'].includes(number));callCount++;return {...(canonicalByHeight.get(number)??chain),number};},
 resolveEventScope:async ({kind})=>{assert.equal(kind,'MigrationClaimConsumed');return {accountId:'alice',gameId:G};},
 verifyCanonicalBlock:async ({blockHash})=>canonical.has(blockHash),
 authorizeQuery:async ({accountId,gameId,authority})=>permission&&accountId==='alice'&&gameId===G&&authority==='signed-session'
});
test('R05.6 real durable PostgreSQL cursor/dedupe/reorg/finality and scoped queries',async t=>{
 try{
  await bootstrapDatastoreRoles(root);await migrateDatastore(root);
  await migrateWalletLinks(root);await migrateMigrationRuntime(root);
  assert.equal((await migrateEventIngestion(root)).changed,true);
  assert.equal((await migrateEventIngestion(root)).changed,false);
  const provisioning=new GamingDatastoreProvisioner420(root);
  await provisioning.provisionAccount({accountId:'alice',issuerRef:'issuer1',credentialCommitment:h('9')});
  await provisioning.provisionAccount({accountId:'bob',issuerRef:'issuer1',credentialCommitment:h('a')});
  await root.query("CREATE ROLE r056_owner LOGIN PASSWORD 'r056_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
  await root.query('GRANT gaming_datastore_runtime TO r056_owner');
  await provisioning.bindRuntimeScope({roleName:'r056_owner',accountId:'alice',gameId:G});
  const ownerURL=new URL(uri);ownerURL.username='r056_owner';ownerURL.password='r056_only';
  const ownerPool=new Pool({connectionString:ownerURL.toString()});
  try{
   const repo=new PostgresGamingRepository420({pool:ownerPool,accountId:'alice',gameId:G,
    expectedEpoch:'0',expectedIssuerRef:'issuer1'});
   await repo.transaction(t=>t.createProfile({profileId:'alice-game',rulesetId:h('e')}));
   const issuedAt=String(Math.floor(Date.now()/1000)),expiresAt=String(BigInt(issuedAt)+300n);
   await repo.transaction(async t=>{
    const challenge=await t.issueWalletChallenge({challengeId:'event-link',wallet,chainId:'420',
     domain:'event-example',nonce:'f'.repeat(64),consentId:'link-consent',policyHash:h('b'),
     contextHash:h('c'),issuedAt,expiresAt,recoveryAuthorized:false});
    await t.completeWalletChallenge('event-link',h('c'),{wallet,chainId:'420',domain:'event-example',
     nonce:'f'.repeat(64),issuedAt:challenge.issued_at,expiresAt:challenge.expires_at});
   });
  }finally{await ownerPool.end();}
  await t.test('durable wallet authority resolves only active source account scope',async()=>{
   const resolver=createGamingEventScopeResolver420({pool:root,chainId:'420',gameId:G});
   assert.deepEqual(await resolver({chainId:'420',kind:'MigrationClaimIssued',
    payload:{targetAccount:wallet}}),{accountId:'alice',gameId:G});
   assert.equal(await resolver({chainId:'420',kind:'MigrationClaimIssued',
    payload:{targetAccount:'0x'+'f'.repeat(40)}}),null);
   await assert.rejects(()=>resolver({chainId:'421',kind:'MigrationClaimIssued',
    payload:{targetAccount:wallet}}),/event-scope-request-invalid/);
  });
  const worker=indexer();
  await t.test('unauthenticated or wrong account cannot see event results',async()=>{
   await assert.rejects(()=>worker.query({accountId:'bob',gameId:G,authority:'signed-session'}),/events-query-denied/);
   await assert.rejects(()=>worker.query({accountId:'alice',gameId:G,authority:'stolen'}),/events-query-denied/);
   await assert.rejects(()=>worker.query({accountId:'alice',gameId:G,authority:'signed-session',limit:101}),/events-query-invalid/);
  });
  await t.test('ingestion transaction persists exact cursor, log and independent account scope',async()=>{
   const done=await worker.ingest({contract,startBlock:'1'});assert.equal(done.nextBlock,'2');
   const fresh=indexer();
   assert.equal((await fresh.query({accountId:'alice',gameId:G,authority:'signed-session'})).length,0,
    'pending events never appear as finalized');
   await assert.rejects(()=>fresh.ingest({contract,startBlock:'1'}),/events-cursor-conflict/);
   assert.equal((await root.query('SELECT count(*)::integer AS n FROM gaming_datastore.event_logs')).rows[0].n,1);
   assert.equal((await root.query('SELECT next_block FROM gaming_datastore.event_cursors')).rows[0].next_block,'2');
  });
  await t.test('malicious finalized flag does not bypass independent canonical verifier',async()=>{
   await assert.rejects(()=>worker.finalize({contract,blockNumber:'1',blockHash:h('f')}),/events-not-canonically-finalized/);
   assert.equal((await worker.finalize({contract,blockNumber:'1',blockHash:block1})).finalized,1);
   const events=await indexer().query({accountId:'alice',gameId:G,authority:'signed-session'});
   assert.equal(events.length,1);assert.equal(events[0].event_kind,'MigrationClaimConsumed');
   permission=false;
   await assert.rejects(()=>indexer().query({accountId:'alice',gameId:G,authority:'signed-session'}),/events-query-denied/);
   permission=true;
  });
  await t.test('new tentative block is quarantined and reorg rollback repairs durable cursor',async()=>{
   chain.number='2';chain.parentHash=block1;chain.hash=block2;chain.logs=logs(block2);
   canonicalByHeight.set('2',{...chain});
   await worker.ingest({contract,startBlock:'2'});
   await assert.rejects(()=>worker.rollback({contract,ancestorNumber:'1',ancestorHash:h('f')}),/events-unverified-ancestor/);
   canonicalByHeight.set('2',{...chain,hash:alternate,logs:logs(alternate)});
   const recovered=await indexer().recover({contract,maxDepth:2});
   assert.equal(recovered.nextBlock,'2');
   assert.equal((await root.query("SELECT count(*)::integer AS n FROM gaming_datastore.event_logs WHERE status='ORPHANED'")).rows[0].n,1);
   assert.equal((await root.query("SELECT count(*)::integer AS n FROM gaming_datastore.event_scopes")).rows[0].n,1);
   chain.hash=alternate;chain.logs=logs(alternate);canonical.add(alternate);
   await indexer().ingest({contract,startBlock:'2'});
   assert.equal((await root.query("SELECT count(*)::integer AS n FROM gaming_datastore.event_logs")).rows[0].n,3);
   // Alternate fork disappears and a previously orphaned original block becomes
   // canonical again. It must be reactivated only with the identical trusted payload.
   await indexer().rollback({contract,ancestorNumber:'1',ancestorHash:block1});
   canonicalByHeight.set('2',{...chain,hash:block2,logs:logs(block2)});
   await indexer().ingest({contract,startBlock:'2'});
   assert.equal((await root.query(`SELECT count(*)::integer AS n FROM gaming_datastore.event_logs
     WHERE block_hash=$1 AND status='PENDING'`,[block2])).rows[0].n,1);
   await indexer().rollback({contract,ancestorNumber:'1',ancestorHash:block1});
   canonicalByHeight.set('2',{...chain,hash:alternate,logs:logs(alternate)});
   await indexer().ingest({contract,startBlock:'2'});
   assert.equal((await root.query(`SELECT count(*)::integer AS n FROM gaming_datastore.event_reorg_history`)).rows[0].n,3);
   await assert.rejects(()=>root.query('UPDATE gaming_datastore.event_reorg_history SET ancestor_number=0'),
     e=>e.code==='23514');
   await indexer().finalize({contract,blockNumber:'2',blockHash:alternate});
   await assert.rejects(()=>worker.rollback({contract,ancestorNumber:'1',ancestorHash:block1}),/events-finalized-reorg-alert/);
  });
  await t.test('empty block has durable header, can finalize and cannot be silently rolled back',async()=>{
   chain.hash=h('d');chain.parentHash=alternate;chain.logs=[];
   canonicalByHeight.set('3',{...chain});
   canonical.add(chain.hash);
   const x=await indexer().ingest({contract,startBlock:'3'});
   assert.equal(x.ingested,0);
   assert.equal((await root.query("SELECT count(*)::integer AS n FROM gaming_datastore.event_blocks")).rows[0].n,4);
   const finalized=await indexer().finalize({contract,blockNumber:'3',blockHash:h('d')});
   assert.equal(finalized.finalized,0);
   await assert.rejects(()=>indexer().rollback({contract,ancestorNumber:'2',ancestorHash:alternate}),
    /events-finalized-reorg-alert/);
  });
  await t.test('non-operator runtime cannot insert or access chain-wide event tables',async()=>{
   await root.query("CREATE ROLE r056_reader LOGIN PASSWORD 'r056_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
   await root.query('GRANT gaming_datastore_runtime TO r056_reader');
   await provisioning.bindRuntimeScope({roleName:'r056_reader',accountId:'alice',gameId:G});
   const u=new URL(uri);u.username='r056_reader';u.password='r056_only';
   const pool=new Pool({connectionString:u.toString()});
   try{
    await assert.rejects(()=>pool.query('SELECT * FROM gaming_datastore.event_logs'),e=>e.code==='42501');
    await assert.rejects(()=>pool.query('INSERT INTO gaming_datastore.event_cursors(chain_id,contract,next_block) VALUES(420,$1,1)',[contract]),e=>e.code==='42501');
    assert.equal((await pool.query('SELECT * FROM gaming_datastore.event_scopes')).rowCount,2);
   }finally{await pool.end();}
  });
  await t.test('digest drift fails closed',async()=>{
   await root.query("UPDATE gaming_datastore.event_ingestion_schema SET digest=repeat('f',64)");
   await assert.rejects(()=>indexer().query({accountId:'alice',gameId:G,authority:'signed-session'}),/events-schema-drift/);
   await root.query('UPDATE gaming_datastore.event_ingestion_schema SET digest=$1',[eventIngestionDigest]);
  });
 }finally{await root.end();}
});
