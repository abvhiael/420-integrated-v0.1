import {randomUUID} from 'node:crypto';
import {decodeGamingEvent420,gamingEventContract420} from './gaming-event-abi.js';
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
    !contracts||!['games','identity','entitlements','crossGame','claims','bridge','migration'].every(k=>addr(contracts[k]))||
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
  const inBlockOwners=new Map();
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
   if(decoded.payload.sourceGameId && decoded.payload.sourceGameId!==this.#game)continue;
   let scope=await this.#resolve(Object.freeze({chainId:this.#chain,contract,blockHash:block.hash,
    txHash:log.transactionHash,kind:decoded.kind,payload:decoded.payload}));
   // ISSUE and CONSUME can occur within one block before the ISSUE index row commits.
   // Only inherit a scope already independently verified from an earlier log in
   // this exact authenticated block; never accept a user-provided owner claim.
   const p=decoded.payload;
   const ownerKeys=[p.claimId&&'claim:'+p.claimId,p.profileId&&'profile:'+p.profileId,
    p.entitlementId&&'entitlement:'+p.entitlementId,p.attestationId&&'attestation:'+p.attestationId,
    p.growerId&&'grower:'+p.growerId].filter(Boolean);
   const inherited=ownerKeys.map(k=>inBlockOwners.get(k)).filter(Boolean);
   for(const prior of inherited){
    if(scope&&(scope.accountId!==prior.accountId||scope.gameId!==prior.gameId))
     fail('events-claim-owner-conflict');
    if(!scope)scope=prior;
   }
   // A missing verified account/game binding cannot appear in any user's event feed.
   if(scope!==null&&(!scope||typeof scope.accountId!=='string'||
    !/^[A-Za-z0-9:_-]{1,128}$/.test(scope.accountId)||scope.gameId!==this.#game))
    fail('events-invalid-account-scope');
   if(scope)for(const key of ownerKeys)inBlockOwners.set(key,scope);
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
   const stored=(await c.query(`INSERT INTO gaming_datastore.event_blocks
     (chain_id,contract,block_number,block_hash,parent_hash)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(chain_id,contract,block_hash) DO UPDATE SET status='PENDING'
     WHERE event_blocks.status='ORPHANED'
       AND event_blocks.block_number=EXCLUDED.block_number
       AND event_blocks.parent_hash=EXCLUDED.parent_hash
     RETURNING block_hash`,
     [this.#chain,contract,startBlock,block.hash,block.parentHash])).rows[0];
   if(!stored)fail('events-block-replay-or-conflict');
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
     ON CONFLICT(chain_id,contract,block_hash,log_index) DO UPDATE SET status='PENDING'
     WHERE event_logs.status='ORPHANED'
       AND event_logs.tx_hash=EXCLUDED.tx_hash
       AND event_logs.tx_index=EXCLUDED.tx_index
       AND event_logs.topic0=EXCLUDED.topic0
       AND event_logs.event_kind=EXCLUDED.event_kind
       AND event_logs.payload=EXCLUDED.payload
       AND event_logs.parent_hash=EXCLUDED.parent_hash
     RETURNING block_hash,log_index`,vals)).rows[0];
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
   const known=(await c.query(`SELECT 1 FROM gaming_datastore.event_blocks
     WHERE chain_id=$1 AND contract=$2 AND block_number=$3 AND block_hash=$4
       AND status IN ('PENDING','FINALIZED') LIMIT 1`,
     [this.#chain,contract,ancestorNumber,ancestorHash])).rows;
   if(!known.length)fail('events-ancestor-not-retained');
   const finalized=(await c.query(`SELECT 1 FROM gaming_datastore.event_blocks
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
   await c.query(`UPDATE gaming_datastore.event_blocks SET status='ORPHANED'
    WHERE chain_id=$1 AND contract=$2 AND block_number>$3 AND status='PENDING'`,
    [this.#chain,contract,ancestorNumber]);
   await c.query(`INSERT INTO gaming_datastore.event_reorg_history
     (chain_id,contract,recovery_id,old_next_block,previous_anchor,ancestor_number,ancestor_hash)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
     [this.#chain,contract,randomUUID(),cursor.next_block,cursor.anchor_hash,ancestorNumber,ancestorHash]);
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
   const blocks=(await c.query(`SELECT block_hash FROM gaming_datastore.event_blocks
     WHERE chain_id=$1 AND contract=$2 AND block_number=$3 AND status='PENDING'`,
     [this.#chain,contract,blockNumber])).rows;
   if(blocks.length!==1||blocks[0].block_hash!==blockHash)fail('events-finality-conflict');
   await c.query(`UPDATE gaming_datastore.event_blocks SET status='FINALIZED'
     WHERE chain_id=$1 AND contract=$2 AND block_number=$3 AND block_hash=$4 AND status='PENDING'`,
     [this.#chain,contract,blockNumber,blockHash]);
   const count=await c.query(`UPDATE gaming_datastore.event_logs SET status='FINALIZED'
    WHERE chain_id=$1 AND contract=$2 AND block_number=$3 AND block_hash=$4 AND status='PENDING'`,
    [this.#chain,contract,blockNumber,blockHash]);
   return {finalized:count.rowCount};
  });
 }
 async cursor(contract){
  if(!Object.values(this.#contracts).includes(contract))fail('events-invalid-cursor');
  return this.#tx(async c=>{
   const row=(await c.query(`SELECT next_block,anchor_hash FROM gaming_datastore.event_cursors
     WHERE chain_id=$1 AND contract=$2`,[this.#chain,contract])).rows[0];
   return row?Object.freeze({nextBlock:String(row.next_block),anchorHash:row.anchor_hash}):null;
  });
 }
 async recover({contract,maxDepth=64}={}){
  if(!Object.values(this.#contracts).includes(contract)||!Number.isInteger(maxDepth)||
   maxDepth<1||maxDepth>128)fail('events-invalid-recovery');
  const candidates=await this.#tx(async c=>(await c.query(`SELECT block_number,block_hash
     FROM gaming_datastore.event_blocks
     WHERE chain_id=$1 AND contract=$2 AND status IN ('PENDING','FINALIZED')
     ORDER BY block_number DESC LIMIT $3`,[this.#chain,contract,maxDepth])).rows);
  if(candidates.length===0)fail('events-recovery-needs-bootstrap');
  // Compare the stored chain to the currently pinned RPC. Never infer canonicality
  // from a log's "removed" or "finalized" flag supplied by an indexer.
  for(const candidate of candidates){
   let observed;
   try{observed=await this.#source(Object.freeze({chainId:this.#chain,contract,
     number:String(candidate.block_number)}));}
   catch{fail('events-recovery-rpc-unavailable');}
   if(observed.hash===candidate.block_hash){
    const verified=await this.#verify(Object.freeze({chainId:this.#chain,contract,
     blockNumber:String(candidate.block_number),blockHash:candidate.block_hash}));
    if(verified!==true)fail('events-recovery-unverified');
    return this.rollback({contract,ancestorNumber:String(candidate.block_number),
     ancestorHash:candidate.block_hash});
   }
  }
  fail('events-reorg-depth-exceeded');
 }
 async syncNext({contract,initialBlock,maxRecoveryDepth=64}={}){
  if(!Object.values(this.#contracts).includes(contract)||!u(initialBlock))
   fail('events-invalid-sync');
  const state=await this.cursor(contract);
  const next=state?.nextBlock??initialBlock;
  try{return await this.ingest({contract,startBlock:next});}
  catch(e){
   if(e?.code!=='events-parent-reorg')throw e;
   const recovered=await this.recover({contract,maxDepth:maxRecoveryDepth});
   return Object.freeze({recovered:true,nextBlock:recovered.nextBlock});
  }
 }
 async query({accountId,gameId,authority,limit=50,before=null}){
  if(typeof accountId!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(accountId)||
    gameId!==this.#game||!Number.isInteger(limit)||limit<1||limit>100)
    fail('events-query-invalid');
  if(before!==null&&(!before||typeof before!=='object'||Array.isArray(before)||
    Object.keys(before).length!==4||!u(before.blockNumber)||!u(before.txIndex,32)||
    !u(before.logIndex,32)||!Object.values(this.#contracts).includes(before.contract)))
    fail('events-query-cursor-invalid');
  if(await this.#authorize(Object.freeze({accountId,gameId,authority,purpose:'GAMING_EVENT_READ'}))!==true)
   fail('events-query-denied');
  return this.#tx(async c=>{
   // Recheck account status in this transaction; never trust owner fields in a log.
   const account=(await c.query('SELECT status FROM gaming_datastore.accounts WHERE account_id=$1 FOR SHARE',
    [accountId])).rows[0];
   if(account?.status!=='ACTIVE')fail('events-account-revoked');
   const rows=(await c.query(`SELECT e.event_kind,e.block_number,e.block_hash,e.tx_hash,
       e.tx_index,e.log_index,e.contract,e.status,e.payload FROM gaming_datastore.event_logs e
     JOIN gaming_datastore.event_scopes s ON s.chain_id=e.chain_id AND s.contract=e.contract
      AND s.block_hash=e.block_hash AND s.log_index=e.log_index
     WHERE s.account_id=$1 AND s.game_id=$2 AND e.status='FINALIZED'
       AND ($4::numeric IS NULL OR (e.block_number,e.tx_index,e.log_index,e.contract) <
         ($4::numeric,$5::numeric,$6::numeric,$7::text))
     ORDER BY e.block_number DESC,e.tx_index DESC,e.log_index DESC,e.contract DESC
     LIMIT $3`,[accountId,gameId,limit,
      before?.blockNumber??null,before?.txIndex??null,
      before?.logIndex??null,before?.contract??null])).rows;
   // Session may be revoked/expire while rows are being retrieved.
   // Repeat the independent R05.2 authority check before returning any feed.
   if(await this.#authorize(Object.freeze({accountId,gameId,authority,purpose:'GAMING_EVENT_READ'}))!==true)
    fail('events-query-revoked');
   return rows.map(x=>Object.freeze(x));
  });
 }
}
