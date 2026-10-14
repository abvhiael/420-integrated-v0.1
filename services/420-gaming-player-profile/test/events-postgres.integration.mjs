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
const G=h('1'),C={games:'0x'+'1'.repeat(40),identity:'0x'+'2'.repeat(40),
 entitlements:'0x'+'3'.repeat(40),crossGame:'0x'+'4'.repeat(40),
 claims:contract,bridge:'0x'+'c'.repeat(40),migration:'0x'+'d'.repeat(40)};
const block1=h('2'),block2=h('3'),alternate=h('4'),tx=h('5'),parent=h('6'),profile=h('7');
const logs=(blockHash)=>[{address:contract,blockHash,transactionHash:tx,
 transactionIndex:'0',logIndex:'0',
 topics:[GAMING_EVENT_TOPICS420.MigrationClaimConsumed,h('8'),profile],data:'0x'}];
const chain={number:'1',hash:block1,parentHash:parent,logs:logs(block1)};
let canonical=new Set([block1]),permission=true,callCount=0,onlyIssueScope=false,revokeOnSecond=false,authChecks=0;
const canonicalByHeight=new Map([['1',{...chain}]]);
const indexer=()=>new DurableGamingEventIndexer420({operatorPool:root,
 chainId:'420',gameId:G,contracts:C,
 fetchBlock:async ({number})=>{assert.ok(['1','2','3','4'].includes(number));callCount++;return {...(canonicalByHeight.get(number)??chain),number};},
 resolveEventScope:async ({kind})=>{
  if(!['MigrationClaimConsumed','MigrationClaimIssued'].includes(kind))throw Error('unexpected event');
  return onlyIssueScope&&kind==='MigrationClaimConsumed'?null:{accountId:'alice',gameId:G};
 },
 verifyCanonicalBlock:async ({blockHash})=>canonical.has(blockHash),
 authorizeQuery:async ({accountId,gameId,authority})=>{
  authChecks++;
  return permission&&(!revokeOnSecond||authChecks===1)&&accountId==='alice'&&gameId===G&&authority==='signed-session';
 }
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
   const resolver=createGamingEventScopeResolver420({pool:root,chainId:'420',gameId:G,contracts:C});
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
   authChecks=0;revokeOnSecond=true;
   await assert.rejects(()=>indexer().query({accountId:'alice',gameId:G,authority:'signed-session'}),
    /events-query-revoked/);
   revokeOnSecond=false;
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
  await t.test('same-block claim issue and consume inherit only prior trusted owner scope',async()=>{
   onlyIssueScope=true;
   const newHash=h('e');chain.parentHash=h('d');chain.hash=newHash;
   const claim=h('8'),accountTopic='0x'+wallet.slice(2).padStart(64,'0');
   const issue={address:contract,blockHash:newHash,transactionHash:h('c'),
    transactionIndex:'0',logIndex:'0',
    topics:[GAMING_EVENT_TOPICS420.MigrationClaimIssued,claim,G,accountTopic],
    data:'0x'+h('9').slice(2)+h('a').slice(2)+BigInt(3600).toString(16).padStart(64,'0')};
   const consume={...logs(newHash)[0],transactionHash:h('c'),logIndex:'1'};
   chain.logs=[issue,consume];canonicalByHeight.set('4',{...chain});canonical.add(newHash);
   const done=await indexer().ingest({contract,startBlock:'4'});
   assert.equal(done.ingested,2);
   const count=(await root.query(`SELECT count(*)::integer AS n FROM gaming_datastore.event_scopes
    WHERE block_hash=$1`,[newHash])).rows[0].n;
   assert.equal(count,2,'consumed claim inherits previously verified same-block issuer owner');
   assert.equal((await indexer().finalize({contract,blockNumber:'4',blockHash:newHash})).finalized,2);
   onlyIssueScope=false;
  });
  await t.test('real wallet authority scopes Identity, Entitlement issue/revoke and CrossGame attestations',async()=>{
   const resolver=createGamingEventScopeResolver420({pool:root,chainId:'420',gameId:G,contracts:C});
   const word=x=>x.slice(2).padStart(64,'0');
   const profileId=h('7'),entitlementId=h('9'),attestationId=h('b');
   const identityBlock={number:'1',hash:h('b'),parentHash:h('c'),logs:[{
    address:C.identity,blockHash:h('b'),transactionHash:h('d'),transactionIndex:'0',logIndex:'0',
    topics:[GAMING_EVENT_TOPICS420.GameProfileCreated,profileId,G,'0x'+word(wallet)],
    data:'0x'+'0'.repeat(64)}]};
   let current=identityBlock;
   const cross=new DurableGamingEventIndexer420({operatorPool:root,chainId:'420',gameId:G,contracts:C,
    fetchBlock:async({number})=>({...current,number}),
    resolveEventScope:resolver,verifyCanonicalBlock:async({blockHash})=>true,
    authorizeQuery:async({accountId,gameId,authority})=>accountId==='alice'&&gameId===G&&authority==='signed-session'});
   assert.equal((await cross.ingest({contract:C.identity,startBlock:'1'})).ingested,1);
   await cross.finalize({contract:C.identity,blockNumber:'1',blockHash:h('b')});
   current={number:'1',hash:h('c'),parentHash:h('d'),logs:[{
    address:C.entitlements,blockHash:h('c'),transactionHash:h('e'),transactionIndex:'0',logIndex:'0',
    topics:[GAMING_EVENT_TOPICS420.EntitlementIssued,entitlementId,profileId,G],
    data:'0x'+word(h('4'))+word(h('5'))}]};
   await cross.ingest({contract:C.entitlements,startBlock:'1'});
   await cross.finalize({contract:C.entitlements,blockNumber:'1',blockHash:h('c')});
   current={number:'2',hash:h('d'),parentHash:h('c'),logs:[{
    address:C.entitlements,blockHash:h('d'),transactionHash:h('f'),transactionIndex:'0',logIndex:'0',
    topics:[GAMING_EVENT_TOPICS420.EntitlementRevoked,entitlementId],data:'0x'}]};
   await cross.ingest({contract:C.entitlements,startBlock:'2'});
   await cross.finalize({contract:C.entitlements,blockNumber:'2',blockHash:h('d')});
   current={number:'1',hash:h('e'),parentHash:h('f'),logs:[{
    address:C.crossGame,blockHash:h('e'),transactionHash:h('a'),transactionIndex:'0',logIndex:'0',
    topics:[GAMING_EVENT_TOPICS420.AttestationIssued,attestationId,G,profileId],
    data:'0x'+word(h('4'))+word(h('5'))+word(h('6'))+BigInt(100).toString(16).padStart(64,'0')}]};
   await cross.ingest({contract:C.crossGame,startBlock:'1'});
   await cross.finalize({contract:C.crossGame,blockNumber:'1',blockHash:h('e')});
   const result=await cross.query({accountId:'alice',gameId:G,authority:'signed-session'});
   for(const type of ['GameProfileCreated','EntitlementIssued','EntitlementRevoked','AttestationIssued'])
    assert.ok(result.some(e=>e.event_kind===type),'unscoped shared Gaming event '+type);
   const first=await cross.query({accountId:'alice',gameId:G,authority:'signed-session',limit:1});
   assert.equal(first.length,1);
   const last=first[0],before={blockNumber:String(last.block_number),txIndex:String(last.tx_index),
    logIndex:String(last.log_index),contract:last.contract};
   const next=await cross.query({accountId:'alice',gameId:G,authority:'signed-session',limit:1,before});
   assert.equal(next.length,1);
   assert.notEqual(next[0].tx_hash+next[0].contract,first[0].tx_hash+first[0].contract);
   await assert.rejects(()=>cross.query({accountId:'alice',gameId:G,authority:'signed-session',
    before:{...before,contract:'0x'+'f'.repeat(40)}}),/events-query-cursor-invalid/);
   await assert.rejects(()=>cross.query({accountId:'bob',gameId:G,authority:'signed-session'}),/events-query-denied/);
  });
  await t.test('digest drift fails closed',async()=>{
   await root.query("UPDATE gaming_datastore.event_ingestion_schema SET digest=repeat('f',64)");
   await assert.rejects(()=>indexer().query({accountId:'alice',gameId:G,authority:'signed-session'}),/events-schema-drift/);
   await root.query('UPDATE gaming_datastore.event_ingestion_schema SET digest=$1',[eventIngestionDigest]);
  });
 }finally{await root.end();}
});
