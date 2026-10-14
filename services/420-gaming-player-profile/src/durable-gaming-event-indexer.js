import {decodeGamingEvent420,gamingEventContract420,GAMING_EVENT_TOPICS420} from './gaming-event-abi.js';
import {eventIngestionDigest} from './event-ingestion-migrations.js';
const fail=x=>{throw Object.assign(new Error(x),{code:x});};
const h=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&x!=='0x'+'0'.repeat(64);
const addr=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/.test(x)&&x!=='0x'+'0'.repeat(40);
const u=(x,bits=64)=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<2n**BigInt(bits);
const strict=(x,keys)=>{
 if(!x||typeof x!=='object'||Array.isArray(x)||
  Object.keys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k)))fail('event-shape-invalid');
};
export class DurableGamingEventIndexer420 {
 #pool;#source;#resolve;#verify;#contracts;#chain;#game;#authorize;
 constructor({operatorPool,fetchBlock,resolveEventScope,verifyCanonicalBlock,authorizeQuery,chainId,gameId,contracts}={}){
  if(typeof operatorPool?.connect!=='function'||typeof fetchBlock!=='function'||
    typeof resolveEventScope!=='function'||typeof verifyCanonicalBlock!=='function'||
    typeof authorizeQuery!=='function'||!u(chainId)||chainId==='0'||!h(gameId)||
    !contracts||!['claims','bridge','migration'].every(k=>addr(contracts[k]))||
    new Set(Object.values(contracts)).size!==3)fail('events-configuration');
  this.#pool=operatorPool;this.#source=fetchBlock;this.#resolve=resolveEventScope;
  this.#verify=verifyCanonicalBlock;this.#authorize=authorizeQuery;
  this.#contracts=Object.freeze({...contracts});this.#chain=chainId;this.#game=gameId;
 }
 async #tx(fn){
  const c=await this.#pool.connect();
  try{
   await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
   await c.query("SET LOCAL statement_timeout='10s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const ok=(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS allowed")).rows[0]?.allowed;
   if(!ok)fail('events-operator-denied');
   await c.query('SET LOCAL ROLE gaming_datastore_migrator');
   const schema=(await c.query('SELECT version,digest FROM gaming_datastore.event_ingestion_schema')).rows;
   if(schema.length!==1||schema[0].version!==6||schema[0].digest!==eventIngestionDigest)
    fail('events-schema-drift');
   const value=await fn(c);
   await c.query('COMMIT');return value;
  }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
 }
 async ingest({contract,startBlock}){
  if(!Object.values(this.#contracts).includes(contract)||!u(startBlock))fail('events-invalid-cursor');
  // External RPC data are never allowed to set finality or account ownership.
  const block=await this.#source(Object.freeze({chainId:this.#chain,contract,number:startBlock}));
  if(!block||block.number!==startBlock||!h(block.hash)||!h(block.parentHash)||
   !Array.isArray(block.logs)||block.logs.length>2000)fail('events-block-invalid');
  const normalized=[];
  let last=-1;
  for(const log of block.logs){
   strict(log,['address','blockHash','transactionHash','transactionIndex','logIndex','topics','data']);
   if(log.address!==contract||log.blockHash!==block.hash||!h(log.transactionHash)||
    !u(log.transactionIndex,32)||!u(log.logIndex,32)||Number(log.logIndex)<=last)
    fail('events-log-invalid');
   last=Number(log.logIndex);
   const decoded=decodeGamingEvent420(log);
   if(this.#contracts[gamingEventContract420(decoded.kind)]!==contract)fail('events-emitter-mismatch');
   if(decoded.payload.gameId && decoded.payload.gameId!==this.#game)continue;
   const scope=await this.#resolve(Object.freeze({chainId:this.#chain,contract,blockHash:block.hash,
    txHash:log.transactionHash,kind:decoded.kind,payload:decoded.payload}));
   // A missing verified account/game binding cannot appear in any user's event feed.
   if(scope!==null&&(!scope||typeof scope.accountId!=='string'||
    !/^[A-Za-z0-9:_-]{1,128}$/.test(scope.accountId)||scope.gameId!==this.#game))
    fail('events-invalid-account-scope');
   normalized.push({log,decoded,scope});
  }
  return this.#tx(async c=>{
   await c.query('INSERT INTO gaming_datastore.event_cursors(chain_id,contract,next_block) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
    [this.#chain,contract,startBlock]);
   const cursor=(await c.query('SELECT * FROM gaming_datastore.event_cursors WHERE chain_id=$1 AND contract=$2 FOR UPDATE',
    [this.#chain,contract])).rows[0];
   if(cursor.next_block!==startBlock)fail('events-cursor-conflict');
   if(cursor.anchor_hash!==null&&cursor.anchor_hash!==block.parentHash){
    // Previously FINALIZED projections cannot be rolled back implicitly.
    // Operator must explicitly investigate and reanchor at a trusted ancestor.
    fail('events-parent-reorg');
   }
   for(const {log,decoded,scope} of normalized){
    const p=decoded.payload;
    const vals=[this.#chain,contract,startBlock,block.hash,block.parentHash,log.transactionHash,
     log.transactionIndex,log.logIndex,decoded.topic0,decoded.kind,
     p.claimId??null,p.gameId??this.#game,p.growerId??null,p.profileId??null,p.targetAccount??p.account??null,
     JSON.stringify(p)];
    const row=(await c.query(`INSERT INTO gaming_datastore.event_logs
     (chain_id,contract,block_number,block_hash,parent_hash,tx_hash,tx_index,log_index,topic0,event_kind,
      claim_id,game_id,grower_id,game_profile_id,target_wallet,payload)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
     ON CONFLICT DO NOTHING RETURNING block_hash,log_index`,vals)).rows[0];
    if(!row)fail('events-replay-or-conflict');
    if(scope)await c.query(`INSERT INTO gaming_datastore.event_scopes
      (chain_id,contract,block_hash,log_index,account_id,game_id)
      VALUES($1,$2,$3,$4,$5,$6)`,
      [this.#chain,contract,block.hash,log.logIndex,scope.accountId,scope.gameId]);
   }
   await c.query(`UPDATE gaming_datastore.event_cursors
     SET next_block=$3,anchor_hash=$4,updated_at=gaming_datastore.now_seconds()
     WHERE chain_id=$1 AND contract=$2`,[this.#chain,contract,String(BigInt(startBlock)+1n),block.hash]);
   return Object.freeze({block:startBlock,ingested:normalized.length,nextBlock:String(BigInt(startBlock)+1n)});
  });
 }
 async rollback({contract,ancestorNumber,ancestorHash}){
  if(!Object.values(this.#contracts).includes(contract)||!u(ancestorNumber)||!h(ancestorHash))
   fail('events-invalid-rollback');
  const ok=await this.#verify(Object.freeze({chainId:this.#chain,contract,blockNumber:ancestorNumber,blockHash:ancestorHash}));
  if(ok!==true)fail('events-unverified-ancestor');
  return this.#tx(async c=>{
   const cursor=(await c.query(`SELECT * FROM gaming_datastore.event_cursors
     WHERE chain_id=$1 AND contract=$2 FOR UPDATE`,[this.#chain,contract])).rows[0];
   if(!cursor||BigInt(ancestorNumber)>=BigInt(cursor.next_block))fail('events-ancestor-outside-cursor');
   const finalized=(await c.query(`SELECT 1 FROM gaming_datastore.event_logs
     WHERE chain_id=$1 AND contract=$2 AND block_number>$3 AND status='FINALIZED' LIMIT 1`,
     [this.#chain,contract,ancestorNumber])).rows;
   if(finalized.length)fail('events-finalized-reorg-alert');
   await c.query(`DELETE FROM gaming_datastore.event_scopes s USING gaming_datastore.event_logs e
    WHERE s.chain_id=e.chain_id AND s.contract=e.contract AND s.block_hash=e.block_hash
    AND s.log_index=e.log_index AND e.chain_id=$1 AND e.contract=$2 AND e.block_number>$3`,
    [this.#chain,contract,ancestorNumber]);
   await c.query(`UPDATE gaming_datastore.event_logs SET status='ORPHANED'
      WHERE chain_id=$1 AND contract=$2 AND block_number>$3 AND status='PENDING'`,
      [this.#chain,contract,ancestorNumber]);
   await c.query(`UPDATE gaming_datastore.event_cursors SET next_block=$3,anchor_hash=$4,
      updated_at=gaming_datastore.now_seconds() WHERE chain_id=$1 AND contract=$2`,
      [this.#chain,contract,String(BigInt(ancestorNumber)+1n),ancestorHash]);
   return Object.freeze({nextBlock:String(BigInt(ancestorNumber)+1n),reorg:true});
  });
 }
 async finalize({contract,blockNumber,blockHash}){
  if(!Object.values(this.#contracts).includes(contract)||!u(blockNumber)||!h(blockHash))
   fail('events-invalid-finalization');
  if(await this.#verify(Object.freeze({chainId:this.#chain,contract,blockNumber,blockHash}))!==true)
   fail('events-not-canonically-finalized');
  return this.#tx(async c=>{
   const rows=(await c.query(`SELECT DISTINCT block_hash FROM gaming_datastore.event_logs
     WHERE chain_id=$1 AND contract=$2 AND block_number=$3 AND status='PENDING'`,
     [this.#chain,contract,blockNumber])).rows;
   if(rows.some(r=>r.block_hash!==blockHash))fail('events-finality-conflict');
   const count=await c.query(`UPDATE gaming_datastore.event_logs SET status='FINALIZED'
    WHERE chain_id=$1 AND contract=$2 AND block_number=$3 AND block_hash=$4 AND status='PENDING'`,
    [this.#chain,contract,blockNumber,blockHash]);
   return {finalized:count.rowCount};
  });
 }
 async query({accountId,gameId,authority,limit=50}){
  if(typeof accountId!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(accountId)||
    gameId!==this.#game||!Number.isInteger(limit)||limit<1||limit>100)
    fail('events-query-invalid');
  if(await this.#authorize(Object.freeze({accountId,gameId,authority,purpose:'GAMING_EVENT_READ'}))!==true)
   fail('events-query-denied');
  return this.#tx(async c=>{
   // Recheck account status in this transaction; never trust owner fields in a log.
   const account=(await c.query('SELECT status FROM gaming_datastore.accounts WHERE account_id=$1 FOR SHARE',
    [accountId])).rows[0];
   if(account?.status!=='ACTIVE')fail('events-account-revoked');
   const rows=(await c.query(`SELECT e.event_kind,e.block_number,e.block_hash,e.tx_hash,e.log_index,e.status,
       e.payload FROM gaming_datastore.event_logs e
     JOIN gaming_datastore.event_scopes s ON s.chain_id=e.chain_id AND s.contract=e.contract
      AND s.block_hash=e.block_hash AND s.log_index=e.log_index
     WHERE s.account_id=$1 AND s.game_id=$2 AND e.status='FINALIZED'
     ORDER BY e.block_number DESC,e.log_index DESC LIMIT $3`,[accountId,gameId,limit])).rows;
   return rows.map(x=>Object.freeze(x));
  });
 }
}
