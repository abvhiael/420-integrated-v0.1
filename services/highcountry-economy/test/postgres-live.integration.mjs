// Repository-local production-equivalent PostgreSQL integration.
// Intentionally separate from npm test: requires disposable PG service and credentials.
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {PostgresBudsStore} from '../src/postgres-store.js';
import {BudsLedger} from '../src/buds-ledger.js';
import {generateKeyPairSync,sign} from 'node:crypto';
import {RuntimeAuthority} from '../src/runtime-integration.js';
import {HighCountryMarket} from '../src/market.js';
import {createOrdinaryRuntime} from '../src/runtime-service.js';
import {SkillResearchService} from '../src/skill-research.js';
import {HIGHCOUNTRY_SKILL_RESEARCH_V1} from '../src/skill-catalog-v1.js';
const url=process.env.HC_TEST_POSTGRES_URL;
if(!url)throw new Error('HC_TEST_POSTGRES_URL required (dedicated test database only)');
const pool=new pg.Pool({connectionString:url,max:8,connectionTimeoutMillis:5000});
const ns='hc_ci_'+process.pid;
try {
 await pool.query(await readFile(new URL('../migrations/001_buds_state.sql',import.meta.url),'utf8'));
 const empty={schema:1,balances:[],operations:[],claims:[],sourceIssued:[],
  assets:[],assetSources:[],listings:[],transferIntents:[],importedAssets:[],issued:0,burned:0};
 await pool.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb)',[ns,JSON.stringify(empty)]);
 const store=new PostgresBudsStore(pool,ns);
 const ledger=new BudsLedger(store,{authorize:()=>true,sourceLimit:()=>1000,authorizeSink:()=>true});
 await ledger.earn('award','bob','approved','proof',100);
 const concurrent=await Promise.allSettled([
  ledger.reserve('reserve:a','bob',70),
  ledger.reserve('reserve:b','bob',70)
 ]);
 assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1,'oversubscription');
 assert.equal(concurrent.filter(x=>x.status==='rejected').length,1,'one loser required');
 const restarted=new PostgresBudsStore(pool,ns);
 const other=new BudsLedger(restarted,{authorize:()=>true,sourceLimit:()=>1000,authorizeSink:()=>true});
 await assert.rejects(other.earn('award','bob','approved','proof',100),'cross-instance replay');
 const authority={
  registeredPrincipal:async s=>s==='alice'?'alice':s==='bob'?'bob':Promise.reject(Error('guest')),
  requireAssetIssuer:async s=>{if(s!=='inventory')throw Error('issuer');},
  verifyAssetReceipt:async r=>r.receiptId==='verified:1'
 };
 const market=new HighCountryMarket(restarted,authority,()=>100);
 await market.importAsset('inventory','asset:import',{
  receiptId:'verified:1',owner:'alice',asset:'lot:1',quantity:3});
 await market.list('alice','asset:list','listing:1','lot:1',2,20,1000);
 const purchase=await market.buy('bob','asset:buy','listing:1');
 assert.equal(purchase.quantity,2);
 await assert.rejects(market.buy('bob','asset:buy2','listing:1'),'single winner');
 const row=(await pool.query('SELECT state FROM highcountry_buds_state WHERE namespace=$1',[ns])).rows[0].state;
 const bob=row.balances.find(([id])=>id==='bob')?.[1];
 assert.equal(bob.available,10,'available after reserved funds and purchase');
 assert.equal(bob.reserved,70,'existing hold persists');
 assert.equal(row.issued,100);assert.equal(row.burned,0);
 assert.equal(row.listings.find(([id])=>id==='listing:1')?.[1].status,'sold');
 // Actual PostgreSQL race: the remaining item and zero-fee credits can transfer once only.
 await ledger.earn('award:charlie','charlie','approved','proof-charlie',20);
 authority.registeredPrincipal=async token=>token==='alice'?'alice':token==='bob'?'bob':
  token==='charlie'?'charlie':Promise.reject(Error('guest'));
 await market.list('alice','asset:list-race','listing:race','lot:1',1,10,1000);
 const competingMarket=new HighCountryMarket(new PostgresBudsStore(pool,ns),authority,()=>100);
 const race=await Promise.allSettled([
  market.buy('bob','asset:race-bob','listing:race'),
  competingMarket.buy('charlie','asset:race-charlie','listing:race')
 ]);
 assert.equal(race.filter(x=>x.status==='fulfilled').length,1,'single successful competing buyer');
 const afterRace=(await pool.query('SELECT state FROM highcountry_buds_state WHERE namespace=$1',[ns])).rows[0].state;
 assert.equal(afterRace.listings.find(([key])=>key==='listing:race')[1].status,'sold');
 assert.equal(afterRace.issued,120,'no issued credit duplication');
 assert.equal(afterRace.burned,0,'approved ordinary zero-fee policy');
 const credits=afterRace.balances.reduce((n,[,b])=>n+b.available+b.reserved,0);
 assert.equal(credits,120,'BUDS conserved with two independent buyers');
 const sellerAssets=afterRace.assets.find(([key])=>key===JSON.stringify(['alice','lot:1']))[1];
 assert.equal(sellerAssets.available,0);assert.equal(sellerAssets.reserved,0);
 const bobAssets=afterRace.assets.find(([key])=>key===JSON.stringify(['bob','lot:1']))?.[1].available||0;
 const charlieAssets=afterRace.assets.find(([key])=>key===JSON.stringify(['charlie','lot:1']))?.[1].available||0;
 assert.equal(bobAssets+charlieAssets,3,'all imported goods accounted for');
 console.log('Postgres competing buyers, one ordinary fill, zero-fee credits and asset conservation: PASS');

// HC-NEXT-5.1 real PostgreSQL durability, distinct instance restart, proof replay and burn conservation.
 await ledger.earn('skill:award','bob','approved','skill:fund-proof',20);
 const skills=new SkillResearchService({store:new PostgresBudsStore(pool,ns),
  identity:{registeredPrincipal:async token=>token==='bob'?'bob':Promise.reject(Error('unregistered'))},
  catalog:HIGHCOUNTRY_SKILL_RESEARCH_V1,
  verifyEvidence:async({evidence})=>({sourceEvent:evidence}),
  getPlayerLevel:async()=>1,clock:()=>100});
 await skills.progress('bob','skill:step1','archive-index-I','skill:proof1',1);
 await skills.progress('bob','skill:step2','archive-index-I','skill:proof2',1);
 const rebooted=new SkillResearchService({store:new PostgresBudsStore(pool,ns),identity:skills.identity,
  catalog:HIGHCOUNTRY_SKILL_RESEARCH_V1,verifyEvidence:skills.verifyEvidence,
  getPlayerLevel:skills.getPlayerLevel,clock:()=>101});
 assert.equal((await rebooted.snapshot('bob')).records[0].points,2,'points survive new process adapter');
 await assert.rejects(rebooted.progress('bob','skill:replay','workbench-notes-I','skill:proof1',1),
  'source proof is globally single-use even across research tracks');
 const bought=await rebooted.unlock('bob','skill:unlock','archive-index-I');
 assert.equal(bought.spent,10);
 const afterSkill=(await pool.query('SELECT state FROM highcountry_buds_state WHERE namespace=$1',[ns])).rows[0].state;
 assert.equal(afterSkill.burned,10,'real PostgreSQL records BUDS skill sink');
 const outstanding=afterSkill.balances.reduce((n,[,b])=>n+b.available+b.reserved,0);
 assert.equal(outstanding,afterSkill.issued-afterSkill.burned,'BUDS conserved after skill research purchase');
 assert.equal(afterSkill.skillResearch.find(([key])=>key===JSON.stringify(['bob','archive-index-I',
  'HC-SKILL-RESEARCH-V1']))?.[1].unlocked,true,'skill entitlement persists across instance restart');
 assert.equal(afterSkill.assets.length,afterRace.assets.length,'skill grants no canonical or ordinary inventory');
 console.log('Postgres skill versioned points/restart/proof replay, exact BUDS burn and asset non-mint: PASS');

 const role='hc_runtime_'+process.pid;
 await pool.query(await readFile(new URL('../migrations/002_runtime_namespace_rls.sql',import.meta.url),'utf8'));
 await pool.query('CREATE ROLE '+role+" LOGIN PASSWORD 'hc_ci_runtime_only'");
 await pool.query('GRANT USAGE ON SCHEMA public TO '+role);
 await pool.query('GRANT SELECT, UPDATE ON highcountry_buds_state TO '+role);
 await pool.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb)',[role,JSON.stringify(empty)]);
 const runtimeUrl=new URL(url);runtimeUrl.username=role;runtimeUrl.password='hc_ci_runtime_only';
 const runtimePool=new pg.Pool({connectionString:runtimeUrl.toString(),max:4});
 try {
  const liveStore=new PostgresBudsStore(runtimePool,role),keys=generateKeyPairSync('ed25519'),game='0x'+'11'.repeat(32);
  const payload=Buffer.from(JSON.stringify({iss:'idp',sub:'alice',sid:'ci',aud:'hc',game,nbf:0,exp:100000,epoch:0})).toString('base64url');
  const token=payload+'.'+sign(null,Buffer.from(payload),keys.privateKey).toString('base64url');
  const authority=new RuntimeAuthority({store:liveStore,issuers:{idp:{publicKey:keys.publicKey}},audience:'hc',gameId:game,
   chainId:420,origin:'https://hc.example',rpc:{verifyWallet:async()=>true,playerProfile:async()=>game},clock:()=>1000});
  await authority.register(token);
  const challenge=await authority.linkChallenge(token,'0x'+'22'.repeat(20));
  await authority.linkWallet(token,challenge.nonce,'signed-fixture');
  const afterRestart=new RuntimeAuthority({...authority,store:new PostgresBudsStore(runtimePool,role)});
  assert.equal(await afterRestart.walletOf(token),'0x'+'22'.repeat(20));
  await assert.rejects(afterRestart.linkWallet(token,challenge.nonce,'signed-fixture'));
  assert.equal((await runtimePool.query('SELECT * FROM highcountry_buds_state WHERE namespace=$1',[ns])).rows.length,0,'namespace isolation');
  await assert.rejects(runtimePool.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb)',[role+'other',JSON.stringify(empty)]));
  await assert.rejects(runtimePool.query('ALTER TABLE highcountry_buds_state ADD COLUMN unsafe text'));
  const ordinary=await createOrdinaryRuntime({
   pool:runtimePool,namespace:role,
   authority:{issuers:{idp:{publicKey:keys.publicKey,operators:{alice:{sources:['inventory']}}}},
    audience:'hc',gameId:game,chainId:420,origin:'https://hc.example'},
   rpc:{url:'http://127.0.0.1:8545',chainId:420,contracts:{}},sources:{},
   inventoryAuthority:{requireMarketOpen:async()=>{},
    verifyAssetReceipt:async r=>r.receiptId==='verified-inventory-ci'},clock:()=>1000
  });
  await ordinary.market.importAsset(token,'ordinary:import',
   {receiptId:'verified-inventory-ci',owner:'alice',asset:'ci:lot',quantity:2});
  await ordinary.market.list(token,'ordinary:list','ci:listing','ci:lot',1,1,2000);
  const admitted=await ordinary.store.transact(s=>s.listings.get('ci:listing'));
  assert.equal(admitted.seller,'alice');
  assert.equal(admitted.sourceReceiptId,'verified-inventory-ci');
  await assert.rejects(ordinary.market.list('forged-token','ordinary:forged','ci:other','ci:lot',1,1,2000));
  console.log('Least-privilege PostgreSQL ordinary runtime construction, authenticated listing and source admission: PASS');
  console.log('Postgres runtime session/wallet nonce restart persistence and least-privilege/RLS denial: PASS');
 } finally {
  await runtimePool.end();
  await pool.query('DELETE FROM highcountry_buds_state WHERE namespace=$1',[role]);
  await pool.query('DROP OWNED BY '+role);await pool.query('DROP ROLE '+role);
 }
 console.log('Postgres SERIALIZABLE reservation, replay, market settlement and persistence: PASS');
} finally {
 try {await pool.query('DELETE FROM highcountry_buds_state WHERE namespace=$1',[ns]);}catch{}
 await pool.end();
}
