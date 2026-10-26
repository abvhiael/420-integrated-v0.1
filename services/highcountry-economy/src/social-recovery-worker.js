// SOC-5D: bounded durable reconciliation; never signs for players or fabricates finality.
import {address} from './finalized-rpc.js';
import {keccak256} from './keccak.js';
import {SettlementError} from './buds-ledger.js';
const deny=x=>{throw new SettlementError(x);};
const validHash=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x);
export class SocialRecoveryWorker {
 constructor({pool,chain,scope,batchSize=25}){
  if(!pool?.connect||!chain?.prepareSigned||!chain?.finalizedReceipt||!chain?.verifyFinality||!chain?.rpc?.request||
    typeof scope!=='string'||!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>100)deny('recovery dependencies required');
  Object.assign(this,{pool,chain,scope,batchSize});
 }
 // Claim locks are held across RPC observations and durable event reconciliation,
 // so two workers cannot double-broadcast or race a finalized transaction.
 async reconcileOne(hash){
  for(let attempt=0;attempt<3;attempt++){
   try{return await this._reconcileOnce(hash);}
   catch(error){if(!['40001','40P01'].includes(error?.code)||attempt===2)throw error;}
  }
 }
 async _reconcileOnce(hash){
  if(!validHash(hash))deny('invalid recovery transaction hash');
  const db=await this.pool.connect();let started=false;
  try{
   await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');started=true;
   const r=await db.query('SELECT tx_hash,principal,wallet,action,raw_transaction,state,block_hash FROM highcountry_social_intents WHERE scope=$1 AND tx_hash=$2 FOR UPDATE',[this.scope,hash]);
   const row=r.rows[0];if(!row){await db.query('ROLLBACK');started=false;return 'absent';}
   const wallet=address(row.wallet);
   const raw=row.raw_transaction;
   if(keccak256(Buffer.from(raw.slice(2),'hex')).toLowerCase()!==hash)deny('recovery journal hash mismatch');
   const proof=await this.chain.prepareSigned({wallet,action:row.action,payload:await this.chain.recoveryPayload({action:row.action,rawTransaction:raw})});
   if(proof?.hash!==hash)deny('recovery signature mismatch');
   const rpc=this.chain.rpc;
   let tx=await rpc.request('eth_getTransactionByHash',[hash]);
   if(!tx&&['prepared','broadcast'].includes(row.state)){
    // A prepared transaction may have been broadcast immediately before a crash.
    // Re-submit only identical, already-signed bytes; no nonce replacement or backend signing.
    try{const returned=await rpc.request('eth_sendRawTransaction',[raw]);if(returned?.toLowerCase()!==hash)deny('recovery broadcast hash mismatch');}
    catch(e){
     // Unknown transaction states remain pending; an unrecognized RPC error is NOT evidence of failure.
     if(!/already known|known transaction|already imported/i.test(String(e.message)))throw e;
    }
    tx=await rpc.request('eth_getTransactionByHash',[hash]);
   }
   let outcome='pending',receipt=null;
   if(tx){
    receipt=await this.chain.finalizedReceipt({hash,wallet,action:row.action});
    if(receipt?.finalized===true&&receipt.hash?.toLowerCase()===hash&&receipt.signer?.toLowerCase()===wallet&&receipt.action===row.action&&await this.chain.verifyFinality(receipt)===true){
     outcome=receipt.success===true&&!receipt.isFundTransfer?'finalized':'reverted';
    }else outcome='broadcast';
   }
   if(row.state==='orphaned')outcome='orphaned';
   if(row.state==='failed')outcome='reverted'; // quarantine is sticky pending explicit operator-reviewed repair
   if(row.state==='finalized'&&outcome!=='finalized'){
    // A finalized receipt which can no longer be proven canonical is quarantined.
    outcome='orphaned';
   }
   if(row.state==='finalized'&&outcome==='finalized'&&row.block_hash?.toLowerCase()!==receipt.blockHash.toLowerCase())outcome='orphaned';
   const state=outcome==='reverted'?'failed':outcome==='pending'?'prepared':outcome;
   const blockHash=outcome==='finalized'?receipt.blockHash.toLowerCase():null;
   await db.query('UPDATE highcountry_social_intents SET state=$3,block_hash=$4,updated_at=now() WHERE scope=$1 AND tx_hash=$2',[this.scope,hash,state,blockHash]);
   if(outcome==='orphaned'){
    await db.query('UPDATE highcountry_social_events SET canonical=false WHERE scope=$1 AND tx_hash=$2',[this.scope,hash]);
    await db.query("UPDATE highcountry_social_operations SET state='orphaned',block_hash=NULL WHERE scope=$1 AND operation_id=$2",[this.scope,hash]);
   }else if(outcome==='finalized'){
    await db.query("INSERT INTO highcountry_social_operations(scope,operation_id,principal,wallet,action,tx_hash,state,block_hash) VALUES($1,$2,$3,$4,$5,$2,'finalized',$6) ON CONFLICT(scope,operation_id) DO UPDATE SET state='finalized',block_hash=$6",[this.scope,hash,row.principal,wallet,row.action,blockHash]);
   }else if(outcome==='broadcast'){
    await db.query("INSERT INTO highcountry_social_operations(scope,operation_id,principal,wallet,action,tx_hash,state) VALUES($1,$2,$3,$4,$5,$2,'submitted') ON CONFLICT DO NOTHING",[this.scope,hash,row.principal,wallet,row.action]);
   }
   await db.query('INSERT INTO highcountry_social_recovery_audit(scope,tx_hash,outcome,observed_block_hash) VALUES($1,$2,$3,$4)',[this.scope,hash,outcome,blockHash]);
   await db.query('COMMIT');started=false;
   if(outcome==='finalized'&&this.chain.indexFinalized){
    await this.chain.indexFinalized({txHash:hash,principal:row.principal,wallet,action:row.action});
   }
   return outcome;
  }catch(e){if(started)try{await db.query('ROLLBACK');}catch{}throw e;}finally{db.release();}
 }
 async runOnce(){
  const q=await this.pool.query("SELECT tx_hash FROM highcountry_social_intents WHERE scope=$1 ORDER BY updated_at ASC,tx_hash ASC LIMIT $2",[this.scope,this.batchSize]);
  const results=[];
  for(const r of q.rows)results.push({txHash:r.tx_hash,outcome:await this.reconcileOne(r.tx_hash)});
  return results;
 }
}
