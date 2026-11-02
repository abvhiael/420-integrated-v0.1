import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {PostgresBudsStore} from '../src/postgres-store.js';
import {MissionService} from '../src/missions-pr811.js';
import {HIGHCOUNTRY_MISSIONS_V1} from '../src/mission-catalog-pr811.js';
const url=process.env.HC_TEST_POSTGRES_URL;
if(!url)throw Error('HC_TEST_POSTGRES_URL required');
test('PR811 mission evidence replay and badge claim survive real PostgreSQL restart',async()=>{
 const pool=new pg.Pool({connectionString:url,max:5,connectionTimeoutMillis:5000});
 const ns='hc_pr811_mission_'+process.pid;
 const empty={schema:1,balances:[],operations:[],claims:[],sourceIssued:[],assets:[],assetSources:[],
  listings:[],transferIntents:[],importedAssets:[],issued:0,burned:0};
 try{
  await pool.query(await readFile(new URL('../migrations/001_buds_state.sql',import.meta.url),'utf8'));
  await pool.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb)',[ns,JSON.stringify(empty)]);
  const store=new PostgresBudsStore(pool,ns);
  const identity={registeredPrincipal:async t=>t==='bob'?'bob':Promise.reject(Error('unregistered'))};
  const verifyEvidence=async({evidence})=>({sourceEvent:evidence});
  const missions=new MissionService({store,identity,catalog:HIGHCOUNTRY_MISSIONS_V1,verifyEvidence,clock:()=>100});
  await missions.activate('bob','mission:activate','journal-first-steps');
  await missions.progress('bob','mission:progress1','journal-first-steps','mission:proof1',1);
  const restarted=new MissionService({store:new PostgresBudsStore(pool,ns),identity,catalog:HIGHCOUNTRY_MISSIONS_V1,
   verifyEvidence,clock:()=>101});
  assert.equal((await restarted.snapshot('bob')).missions[0].progress,1);
  await assert.rejects(restarted.progress('bob','mission:replay','journal-first-steps','mission:proof1',1));
  await restarted.progress('bob','mission:progress2','journal-first-steps','mission:proof2',1);
  const receipt=await restarted.claim('bob','mission:claim','journal-first-steps');
  assert.equal(receipt.reward.units,0);
  const row=(await pool.query('SELECT state FROM highcountry_buds_state WHERE namespace=$1',[ns])).rows[0].state;
  assert.equal(row.issued,0);assert.equal(row.burned,0);
  assert.equal(row.missions.length,1);assert.equal(row.missionProofs.length,2);
 }finally{
  try{await pool.query('DELETE FROM highcountry_buds_state WHERE namespace=$1',[ns]);}catch{}
  await pool.end();
 }
});
