// R05.6 canonical owner-scope resolver. Never trusts a client-provided account ID.
// Unresolvable events remain unscoped: they cannot leak into user query feeds.
const fail=code=>{throw Object.assign(new Error(code),{code});};
const bytes32=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x);
const wallet=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/.test(x);
const uint64=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<(1n<<64n);
function fromClaim(claim){
 if(!bytes32(claim))fail('event-scope-claim-invalid');
 const n=BigInt(claim);
 if(n===0n||n>=1n<<64n)return null;
 return String(n);
}
export function createGamingEventScopeResolver420({pool,gameId,chainId}={}){
 if(typeof pool?.connect!=='function'||!bytes32(gameId)||!uint64(chainId)||chainId==='0')
  fail('event-scope-config');
 return async ({chainId:observedChain,kind,payload}={})=>{
  if(String(observedChain)!==chainId||typeof kind!=='string'||!payload||typeof payload!=='object')
   fail('event-scope-request-invalid');
  let target=null;
  if(['MigrationClaimIssued','GrowerGamingProfileBound'].includes(kind)){
   target=payload.targetAccount??payload.account;
   if(!wallet(target))fail('event-scope-target-invalid');
  }else{
   if(!bytes32(payload.claimId))fail('event-scope-claim-invalid');
  }
  const c=await pool.connect();
  try{
   await c.query('BEGIN READ ONLY');
   if(!(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS ok")).rows[0]?.ok)
    fail('event-scope-operator-denied');
   await c.query('SET LOCAL ROLE gaming_datastore_migrator');
   if(!target){
    const id=fromClaim(payload.claimId);
    if(id){
     const app=(await c.query(`SELECT target_wallet FROM gaming_datastore.migration_applications
      WHERE chain_id=$1 AND game_id=$2 AND claim_id=$3 LIMIT 2`,[chainId,gameId,id])).rows;
     if(app.length>1)fail('event-scope-conflict');
     target=app[0]?.target_wallet??null;
    }
    if(!target){
     const earlier=(await c.query(`SELECT target_wallet FROM gaming_datastore.event_logs
      WHERE chain_id=$1 AND game_id=$2 AND claim_id=$3 AND event_kind='MigrationClaimIssued'
        AND status<>'ORPHANED' ORDER BY block_number DESC LIMIT 2`,
       [chainId,gameId,payload.claimId])).rows;
     if(earlier.length>1&&earlier[0].target_wallet!==earlier[1].target_wallet)
      fail('event-scope-conflicting-claims');
     target=earlier[0]?.target_wallet??null;
    }
   }
   if(!target){await c.query('COMMIT');return null;}
   const candidates=(await c.query(`SELECT w.account_id FROM gaming_datastore.wallet_links w
     JOIN gaming_datastore.accounts a USING(account_id)
     WHERE w.chain_id=$1 AND w.game_id=$2 AND w.wallet=$3 AND w.unlinked_at IS NULL
       AND a.status='ACTIVE' LIMIT 2`,[chainId,gameId,target])).rows;
   if(candidates.length>1)fail('event-scope-owner-collision');
   await c.query('COMMIT');
   return candidates.length?Object.freeze({accountId:candidates[0].account_id,gameId}):null;
  }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
 };
}
