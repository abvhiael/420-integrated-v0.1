import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { validateSubmittedEventStream } from '../../../packages/arcade-score/src/index.mjs';

export class RankingAuthorityError extends Error { constructor(message){super(message);this.name='RankingAuthorityError';} }
const deny=m=>{throw new RankingAuthorityError(m)};
const hex=/^[a-f0-9]{32}$/;
const digest=/^[a-f0-9]{64}$/;
const gameplayId=/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/;
const playerId=/^[a-zA-Z0-9_-]{8,96}$/;
const hash=v=>createHash('sha256').update(v).digest('hex');

/**
 * Only an independent deterministic, server-owned rules verifier can accept a
 * competitive result. Neither a client digest nor a simulation fixture counts.
 * SQL owns atomic replay protection across API replicas.
 */
export class ArcadeRankingAuthority{
 #db;#games;#verifiers;#clock;#registry;
 constructor({db,games,verifiers={},registry,clock=()=>Date.now()}){
  if(typeof db?.connect!=='function'||!Array.isArray(games)||games.length!==11||typeof clock!=='function'||typeof registry?.assertFinalizedRegistration!=='function')throw new TypeError('Postgres, canonical games and finalized Registry resolver required');
  const allowed=new Map();
  for(const game of games){
   if(!gameplayId.test(game.gameId)||allowed.has(game.gameId)||game.registration!=='UNREGISTERED'||game.walletRequiredForCore!==false)deny('Invalid canonical game');
   allowed.set(game.gameId,Object.freeze({...game}));
  }
  this.#db=db;this.#games=allowed;this.#verifiers=new Map(Object.entries(verifiers));this.#registry=registry;this.#clock=clock;
 }
 #game(id){const game=this.#games.get(id);if(!game)deny('Unknown canonical game');return game;}
 #verifier(id){const v=this.#verifiers.get(id);if(typeof v?.verifyReplay!=='function'||v.approvedForCompetitive!==true||!digest.test(v.rulesetDigest??''))deny('Independent game replay verifier not approved');return v;}
 async issueChallenge({gameId,playerRef}){
  const game=this.#game(gameId);this.#verifier(gameId);
  if(!playerId.test(playerRef??''))deny('Invalid opaque player reference');
  await this.#registry.assertFinalizedRegistration(gameId);
  const sessionId=randomBytes(16).toString('hex'),seed=randomBytes(32).toString('hex'),issuedAt=this.#clock(),expiresAt=issuedAt+300000;
  const client=await this.#db.connect();
  try{
   await client.query('BEGIN');
   await client.query('INSERT INTO arcade_challenges (session_id,game_id,player_ref,seed_hash,issued_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6)',[sessionId,gameId,playerRef,hash(seed),issuedAt,expiresAt]);
   await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  return {sessionId,gameId,seed,issuedAt,expiresAt,rulesetVersion:game.rulesetVersion,contentVersion:game.contentVersion};
 }
 async submit({gameId,sessionId,playerRef,seed,events}){
  const game=this.#game(gameId),verifier=this.#verifier(gameId);
  if(!hex.test(sessionId??'')||!digest.test(seed??'')||!playerId.test(playerRef??''))deny('Malformed session identity');
  if(!events||typeof events!=='object'||events.verification!=='LOCAL_UNVERIFIED'||events.status!=='completed'||!digest.test(events.resultDigest??''))deny('Malformed or incomplete client evidence');
  if(JSON.stringify(events).length>262144)deny('Event payload budget exceeded');
  validateSubmittedEventStream(events,{game,sessionId});
  // Independently trusted server-side replay is compulsory, without fallback.
  const client=await this.#db.connect();
  try{
   await client.query('BEGIN');
   const record=await client.query('SELECT * FROM arcade_challenges WHERE session_id=$1 FOR UPDATE',[sessionId]);
   if(record.rows.length!==1)deny('Unknown challenge');
   const c=record.rows[0];
   if(c.consumed_at!==null||c.game_id!==gameId||c.player_ref!==playerRef||c.seed_hash!==hash(seed)||this.#clock()>Number(c.expires_at)||Number(c.issued_at)>this.#clock())deny('Expired, consumed or mismatched challenge');
   // A registration may be deactivated after challenge issuance.
   await this.#registry.assertFinalizedRegistration(gameId);
   const result=await verifier.verifyReplay({game,sessionId,seed,issuedAt:Number(c.issued_at),events});
   if(!result||result.accepted!==true||!Number.isSafeInteger(result.score)||result.score<0||result.score!==events.score||result.rulesetDigest!==verifier.rulesetDigest||!Array.isArray(result.achievements)||result.achievements.some(a=>!events.achievements.includes(a)))deny('Independent replay verification failed');
   await client.query('UPDATE arcade_challenges SET consumed_at=$2 WHERE session_id=$1 AND consumed_at IS NULL',[sessionId,this.#clock()]);
   await client.query('INSERT INTO arcade_verified_results (session_id,game_id,player_ref,score,ruleset_digest,verified_at) VALUES ($1,$2,$3,$4,$5,$6)',[sessionId,gameId,playerRef,result.score,verifier.rulesetDigest,this.#clock()]);
   await client.query('COMMIT');
   return Object.freeze({status:'SERVER_VERIFIED',gameId,sessionId,score:result.score,achievements:[...result.achievements]});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 async leaderboard({gameId,limit=25}){
  this.#game(gameId);this.#verifier(gameId);
  if(!Number.isInteger(limit)||limit<1||limit>100)deny('Invalid leaderboard limit');
  await this.#registry.assertFinalizedRegistration(gameId);
  const rows=await this.#db.query('SELECT player_ref,MAX(score)::bigint AS score FROM arcade_verified_results WHERE game_id=$1 GROUP BY player_ref ORDER BY score DESC,player_ref ASC LIMIT $2',[gameId,limit]);
  return Object.freeze(rows.rows.map((r,i)=>Object.freeze({rank:i+1,playerRef:r.player_ref,score:Number(r.score)})));
 }
}
