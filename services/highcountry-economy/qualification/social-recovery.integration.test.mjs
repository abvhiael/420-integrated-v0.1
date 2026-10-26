import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {privateKeyToAccount} from 'viem/accounts';
import {keccak256} from '../src/keccak.js';
import {SocialRecoveryWorker} from '../src/social-recovery-worker.js';
const url=process.env.HC_SOC5D_TEST_DATABASE_URL;if(!url)throw Error('real PostgreSQL required');
const pool=new pg.Pool({connectionString:url,max:4}),scope='hc5d';
const wallet=privateKeyToAccount('0x'+'11'.repeat(32)),to='0x'+'2'.repeat(40);
const raw=await wallet.signTransaction({to,chainId:420,nonce:0,gas:120000n,maxFeePerGas:2000000000n,maxPriorityFeePerGas:1000000000n,data:'0x1234',value:0n,type:'eip1559'});
const txHash=keccak256(Buffer.from(raw.slice(2),'hex'));const block='0x'+'f'.repeat(64);
let tx=null,receipt=null,headBlock=block,sendCount=0;
const chain={
 rpc:{request:async(method,arg)=>{
  if(method==='eth_getTransactionByHash')return tx;
  if(method==='eth_sendRawTransaction'){sendCount++;if(arg[0]!==raw)throw Error('different signature');tx={hash:txHash,from:wallet.address.toLowerCase()};return txHash;}
  throw Error('unexpected method: '+method);
 }},
 recoveryPayload:async()=>({signedRawTransaction:raw}),
 prepareSigned:async({wallet:owner,payload})=>{
  assert.equal(owner,wallet.address.toLowerCase());assert.equal(payload.signedRawTransaction,raw);
  return {hash:txHash};
 },
 finalizedReceipt:async()=>receipt,
 verifyFinality:async(r)=>r?.blockHash===headBlock,
 indexFinalized:async()=>{}
};
const worker=()=>new SocialRecoveryWorker({pool,chain,scope});
test('Postgres crash/restart, replay, finality and reorganization Level 2',async()=>{
 await pool.query("INSERT INTO highcountry_social_intents(scope,tx_hash,principal,wallet,action,raw_transaction,state) VALUES($1,$2,'alice',$3,'organization.join',$4,'prepared')",[scope,txHash,wallet.address.toLowerCase(),raw]);
 const concurrent=await Promise.all([worker().reconcileOne(txHash),worker().reconcileOne(txHash)]);
 assert.deepEqual(concurrent,['broadcast','broadcast']);assert.equal(sendCount,1,'concurrent workers must not double-broadcast');
 // process restart: recover from DB, no second broadcast.
 assert.equal(await worker().reconcileOne(txHash),'broadcast');assert.equal(sendCount,1);
 let r=await pool.query('SELECT state FROM highcountry_social_intents WHERE scope=$1 AND tx_hash=$2',[scope,txHash]);assert.equal(r.rows[0].state,'broadcast');
 receipt={hash:txHash,signer:wallet.address.toLowerCase(),action:'organization.join',blockHash:block,finalized:true,success:true,isFundTransfer:false};
 assert.equal(await worker().reconcileOne(txHash),'finalized');
 r=await pool.query('SELECT state,block_hash FROM highcountry_social_operations WHERE scope=$1 AND operation_id=$2',[scope,txHash]);assert.equal(r.rows[0].state,'finalized');
 const eid='0x'+'c'.repeat(64);
 await pool.query("INSERT INTO highcountry_social_events(scope,tx_hash,log_index,block_number,block_hash,contract_address,topic0,kind,entity_id,principal,wallet,event_json) VALUES($1,$2,0,12,$3,$4,$5,'organization',$6,'alice',$7,'{}')",[scope,txHash,block,to,'0x'+'a'.repeat(64),eid,wallet.address.toLowerCase()]);
 headBlock='0x'+'b'.repeat(64);
 assert.equal(await worker().reconcileOne(txHash),'orphaned');
 r=await pool.query('SELECT state FROM highcountry_social_intents WHERE scope=$1 AND tx_hash=$2',[scope,txHash]);assert.equal(r.rows[0].state,'orphaned');
 r=await pool.query('SELECT canonical FROM highcountry_social_events WHERE scope=$1 AND tx_hash=$2',[scope,txHash]);assert.equal(r.rows[0].canonical,false);
 assert.equal(sendCount,1);
 const audit=await pool.query('SELECT outcome FROM highcountry_social_recovery_audit WHERE scope=$1 AND tx_hash=$2 ORDER BY attempt',[scope,txHash]);
 assert.deepEqual(audit.rows.map(x=>x.outcome),['broadcast','broadcast','broadcast','finalized','orphaned']);
});
test('recovery rejects forged journal bytes before broadcasting',async()=>{
 const badHash='0x'+'a'.repeat(64);
 await pool.query("INSERT INTO highcountry_social_intents(scope,tx_hash,principal,wallet,action,raw_transaction,state) VALUES($1,$2,'alice',$3,'organization.join',$4,'prepared')",[scope,badHash,wallet.address.toLowerCase(),raw]);
 const n=sendCount;
 await assert.rejects(worker().reconcileOne(badHash),/journal hash mismatch/);
 assert.equal(sendCount,n);
});
test.after(async()=>pool.end());
