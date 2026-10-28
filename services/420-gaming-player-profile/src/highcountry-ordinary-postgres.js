// HC-NEXT-7.2 transaction repository: separately provisioned PostgreSQL schema.
const fail=code=>{throw Object.assign(new Error(code),{code});};
const safe=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const mapEvent=r=>r&&({eventId:r.event_id,seasonId:r.season_id,category:r.category,version:r.version,
 rulesHash:r.rules_hash,organizer:r.organizer,opensAt:Number(r.opens_at),closesAt:Number(r.closes_at),
 challengeUntil:Number(r.challenge_until),finalized:r.finalized,cancelled:r.cancelled,
 winner:r.winner,winnerScore:r.winner_score});
const mapResult=r=>r&&({eventId:r.event_id,accountId:r.account_id,harvestId:r.harvest_id,
 qualityBps:r.quality_bps,finalizedAt:Number(r.finalized_at),provenanceHash:r.provenance_hash,rejected:r.rejected});
export function createPostgresOrdinaryExhibitionRepository420({pool,gameId}={}){
 if(typeof pool?.connect!=='function'||!/^0x[0-9a-fA-F]{64}$/.test(gameId||''))fail('repository-config-invalid');
 return Object.freeze({
 async transaction(work,{isolation}={}){
  if(isolation!=='serializable')fail('serializable-required');
  const c=await pool.connect();
  let opened=false;
  try{
   await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');opened=true;
   await c.query("SET LOCAL lock_timeout = '5s'");
   const query=(sql,values=[])=>c.query(sql,values);
   const one=async(sql,values)=>((await query(sql,values)).rows[0]??null);
   const args=(...items)=>[gameId,...items];
   const tx=Object.freeze({
    season:async sid=>{const r=await one('SELECT * FROM highcountry_exhibitions.seasons WHERE game_id=$1 AND season_id=$2',args(sid));return r?{organizer:r.organizer,opensAt:Number(r.opens_at),closesAt:Number(r.closes_at),cancelled:r.cancelled}:null;},
    category:async(cat,v)=>{const r=await one('SELECT * FROM highcountry_exhibitions.categories WHERE game_id=$1 AND category=$2 AND version=$3',args(cat,v));return r?{rulesHash:r.rules_hash,walletRequired:r.wallet_required,scope:r.scope}:null;},
    event:async id=>mapEvent(await one('SELECT * FROM highcountry_exhibitions.events WHERE game_id=$1 AND event_id=$2',args(id))),
    lockEvent:async id=>mapEvent(await one('SELECT * FROM highcountry_exhibitions.events WHERE game_id=$1 AND event_id=$2 FOR UPDATE',args(id))),
    insertEvent:async e=>query('INSERT INTO highcountry_exhibitions.events(game_id,event_id,season_id,category,version,rules_hash,organizer,opens_at,closes_at,challenge_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      args(e.eventId,e.seasonId,e.category,e.version,e.rulesHash,e.organizer,e.opensAt,e.closesAt,e.challengeUntil)),
    entry:async(e,a)=>!!await one('SELECT 1 FROM highcountry_exhibitions.entries WHERE game_id=$1 AND event_id=$2 AND account_id=$3',args(e,a)),
    entryCount:async e=>Number((await one('SELECT count(*)::int AS count FROM highcountry_exhibitions.entries WHERE game_id=$1 AND event_id=$2',args(e))).count),
    insertEntry:async(e,a)=>query('INSERT INTO highcountry_exhibitions.entries(game_id,event_id,account_id) VALUES($1,$2,$3)',args(e,a)),
    result:async(e,a)=>mapResult(await one('SELECT * FROM highcountry_exhibitions.results WHERE game_id=$1 AND event_id=$2 AND account_id=$3',args(e,a))),
    harvestClaim:async(e,h)=>!!await one('SELECT 1 FROM highcountry_exhibitions.results WHERE game_id=$1 AND event_id=$2 AND harvest_id=$3',args(e,h)),
    insertResult:async r=>query('INSERT INTO highcountry_exhibitions.results(game_id,event_id,account_id,harvest_id,quality_bps,finalized_at,provenance_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',
      args(r.eventId,r.accountId,r.harvestId,r.qualityBps,r.finalizedAt,r.provenanceHash)),
    results:async e=>(await query('SELECT * FROM highcountry_exhibitions.results WHERE game_id=$1 AND event_id=$2 ORDER BY account_id',args(e))).rows.map(mapResult),
    isAdjudicator:async a=>!!await one('SELECT 1 FROM highcountry_exhibitions.adjudicators WHERE game_id=$1 AND account_id=$2 AND active=true',args(a)),
    rejectResult:async(e,a,h)=>query('UPDATE highcountry_exhibitions.results SET rejected=true,reason_hash=$4 WHERE game_id=$1 AND event_id=$2 AND account_id=$3 AND rejected=false',args(e,a,h)),
    finalizeEvent:async o=>query('UPDATE highcountry_exhibitions.events SET finalized=true,winner=$3,winner_score=$4,finalized_at=$5,evidence_digest=$6 WHERE game_id=$1 AND event_id=$2 AND finalized=false',
      args(o.eventId,o.winner,o.winnerScore,o.finalizedAt,o.evidenceDigest))
   });
   const value=await work(tx);
   await c.query('COMMIT');opened=false;
   return value;
  }catch(e){
   if(opened)try{await c.query('ROLLBACK');}catch{}
   if(e?.code==='40001'||e?.code==='40P01'||e?.code==='55P03')fail('exhibition-retry-required');
   if(e?.code==='23505'||e?.code==='23503'||e?.code==='23514')fail('exhibition-conflict');
   throw e;
  }finally{c.release();}
 }
 });
}
