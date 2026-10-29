// Durable, nonfinancial Cup achievement snapshots. No local row is independent proof of entitlement.
// Every read must reverify the Cup against canonical finality before returning an active award.
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const hex=(x,n)=>typeof x==='string'&&new RegExp('^0x[0-9a-f]{'+n+'}$').test(x);
export function createPostgresCupAchievements420({pool,gameId,projection}={}){
 if(typeof pool?.connect!=='function'||!hex(gameId,64)||typeof projection?.standings!=='function')fail('cup-achievement-config-invalid');
 const retryable=new Set(['40001','40P01','55P03']);
 const maxAttempts=3;
 async function transaction(fn){
  // Each attempt owns a fresh connection and SERIALIZABLE transaction. A failed
  // transaction is rolled back before any retry; no partial award can escape.
  for(let attempt=1;attempt<=maxAttempts;attempt++){
   const c=await pool.connect();let opened=false;
   try{
    await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');opened=true;
    await c.query("SET LOCAL lock_timeout='5s'");
    const value=await fn(c);
    await c.query('COMMIT');opened=false;return value;
   }catch(e){
    if(opened){try{await c.query('ROLLBACK');}catch{fail('cup-rollback-failed');}}
    if(!retryable.has(e?.code))throw e;
    if(attempt===maxAttempts)fail('cup-retry-required');
   }finally{c.release();}
  }
 }
 return Object.freeze({
  async synchronize({cupId}){
   // RPC and DB cannot be atomic. Source is checked again on every read;
   // stored snapshots are never accepted as authorization or current proof.
   return transaction(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[gameId,cupId]);
    // A retry must not reuse a stale canonical witness after a failed commit.
    // Reading the authoritative source happens separately on EVERY attempt.
    const current=await projection.standings({cupId});
    await c.query(`INSERT INTO highcountry_cup.achievements
      (game_id,cup_id,chain_id,cup_address,block_hash,champion,commitment,scope,prestige)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(game_id,cup_id) DO UPDATE SET
      chain_id=excluded.chain_id,cup_address=excluded.cup_address,
      block_hash=excluded.block_hash,champion=excluded.champion,
      commitment=excluded.commitment,scope=excluded.scope,prestige=excluded.prestige,
      updated_at=now()`,[gameId,cupId,current.chainId,current.cupAddress,current.blockHash,
       current.champion,current.resultCommitment,current.scope,!!current.achievement]);
    await c.query(`INSERT INTO highcountry_cup.history
      (game_id,cup_id,block_hash,commitment,champion,prestige)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
     [gameId,cupId,current.blockHash,current.resultCommitment,current.champion,!!current.achievement]);
    return current;
   });
  },
  async current({cupId}){
   const verified=await projection.standings({cupId});
   const c=await pool.connect();
   try{
    const row=(await c.query(`SELECT * FROM highcountry_cup.achievements
      WHERE game_id=$1 AND cup_id=$2`,[gameId,cupId])).rows[0];
    // A stale row never returns its persisted trophy, even if a chain rollback occurs.
    if(!row||row.block_hash!==verified.blockHash||row.commitment!==verified.resultCommitment||
       row.champion!==verified.champion||row.prestige!==!!verified.achievement)
      return {current:false,standings:verified,recorded:false};
    return {current:true,standings:verified,recorded:true};
   }finally{c.release();}
  }
 });
}
