// R05.6 qualified Gaming owner resolver. Only prior canonical event provenance
// and active R05.2 wallet links can establish an event's account/game scope.
const fail=code=>{throw Object.assign(new Error(code),{code});};
const bytes32=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x);
const wallet=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/.test(x);
const uint64=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<(1n<<64n);
const admin=new Set(['GameRegistered','GameUpdated','GameStatusChanged']);
function numericClaim(x){
 if(!bytes32(x))fail('event-scope-claim-invalid');
 const n=BigInt(x);return n>0n&&n<(1n<<64n)?String(n):null;
}
export function createGamingEventScopeResolver420({pool,gameId,chainId}={}){
 if(typeof pool?.connect!=='function'||!bytes32(gameId)||!uint64(chainId)||chainId==='0')
  fail('event-scope-config');
 return async ({chainId:observedChain,kind,payload}={})=>{
  if(String(observedChain)!==chainId||typeof kind!=='string'||!payload||typeof payload!=='object')
   fail('event-scope-request-invalid');
  if(admin.has(kind))return null; // public registry operations have no player owner
  let target=null,profileId=payload.profileId??null;
  if(['MigrationClaimIssued','GrowerGamingProfileBound','GameProfileCreated'].includes(kind)){
   target=payload.targetAccount??payload.account;
   if(!wallet(target))fail('event-scope-target-invalid');
  }
  const c=await pool.connect();
  try{
   await c.query('BEGIN READ ONLY');
   if(!(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS ok")).rows[0]?.ok)
    fail('event-scope-operator-denied');
   await c.query('SET LOCAL ROLE gaming_datastore_migrator');
   const lookup=async(kind,key,value,column='payload')=>{
    if(typeof value!=='string')return null;
    const rows=(await c.query(`SELECT payload,target_wallet FROM gaming_datastore.event_logs
      WHERE chain_id=$1 AND game_id=$2 AND event_kind=$3 AND ${column}->>$4=$5
      AND status<>'ORPHANED' ORDER BY block_number DESC LIMIT 2`,
      [chainId,gameId,kind,key,value])).rows;
    if(rows.length>1&&JSON.stringify(rows[0].payload)!==JSON.stringify(rows[1].payload))
     fail('event-scope-conflicting-history');
    return rows[0]??null;
   };
   if(!target&&payload.claimId){
    const id=numericClaim(payload.claimId);
    if(id){
     const apps=(await c.query(`SELECT target_wallet FROM gaming_datastore.migration_applications
       WHERE chain_id=$1 AND game_id=$2 AND claim_id=$3 LIMIT 2`,
       [chainId,gameId,id])).rows;
     if(apps.length>1)fail('event-scope-conflict');
     target=apps[0]?.target_wallet??null;
    }
    if(!target){
     const row=await lookup('MigrationClaimIssued','claimId',payload.claimId);
     target=row?.target_wallet??null;
    }
   }
   if(!profileId&&payload.entitlementId){
    const row=await lookup('EntitlementIssued','entitlementId',payload.entitlementId);
    profileId=row?.payload?.profileId??null;
   }
   if(!profileId&&payload.attestationId){
    const row=await lookup('AttestationIssued','attestationId',payload.attestationId);
    profileId=row?.payload?.profileId??null;
   }
   if(!target&&profileId){
    if(!bytes32(profileId))fail('event-scope-invalid-profile');
    const row=await lookup('GameProfileCreated','profileId',profileId);
    target=row?.payload?.account??null;
   }
   if(!target&&payload.growerId){
    if(!uint64(payload.growerId))fail('event-scope-invalid-grower');
    const row=await lookup('GrowerGamingProfileBound','growerId',payload.growerId);
    target=row?.payload?.account??null;
   }
   if(!target){await c.query('COMMIT');return null;}
   if(!wallet(target))fail('event-scope-invalid-wallet');
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
