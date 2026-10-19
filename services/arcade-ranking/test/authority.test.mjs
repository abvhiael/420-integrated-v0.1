import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {webcrypto} from 'node:crypto';
import {ArcadeRankingAuthority,RankingAuthorityError} from '../src/authority.mjs';
import {ArcadeSessionEvents} from '../../../packages/arcade-score/src/index.mjs';
const game=JSON.parse(fs.readFileSync(new URL('../../../config/arcade-game-identities.json',import.meta.url))).games[0];
const games=JSON.parse(fs.readFileSync(new URL('../../../config/arcade-game-identities.json',import.meta.url))).games;
class DB {
 constructor(){this.challenges=new Map();this.results=new Map();this.locked=false;}
 async connect(){if(this.locked)throw Error('Concurrent transaction blocked');this.locked=true;const staged=[];return {query:async (sql,params=[])=>{
  if(sql==='BEGIN'||sql==='COMMIT'){if(sql==='COMMIT')for(const f of staged)f();return {rows:[]};}
  if(sql==='ROLLBACK'){staged.length=0;return {rows:[]};}
  if(sql.startsWith('INSERT INTO arcade_challenges')){staged.push(()=>this.challenges.set(params[0],{session_id:params[0],game_id:params[1],player_ref:params[2],seed_hash:params[3],issued_at:params[4],expires_at:params[5],consumed_at:null}));return {rows:[]};}
  if(sql.startsWith('SELECT *'))return {rows:this.challenges.has(params[0])?[this.challenges.get(params[0])]:[]};
  if(sql.startsWith('UPDATE arcade_challenges')){staged.push(()=>this.challenges.get(params[0]).consumed_at=params[1]);return {rows:[]};}
  if(sql.startsWith('INSERT INTO arcade_verified_results')){staged.push(()=>this.results.set(params[0],{game_id:params[1],player_ref:params[2],score:params[3]}));return {rows:[]};}
  throw Error('Unexpected query: '+sql);
 },release:()=>{this.locked=false}};}
 async query(sql,params){const scores=new Map();for(const r of this.results.values())if(r.game_id===params[0])scores.set(r.player_ref,Math.max(scores.get(r.player_ref)??0,r.score));return {rows:[...scores].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,params[1]).map(([player_ref,score])=>({player_ref,score}))};}
}
const player='guest12345678',rulesetDigest='a'.repeat(64);
function setup({approved=true,registered=true,verify=async ({events})=>({accepted:true,score:events.score,rulesetDigest,achievements:[]})}={}){
 const db=new DB(),registry={assertFinalizedRegistration:async()=>{if(!registered)throw new RankingAuthorityError('No finalized game registration');}};
 const auth=new ArcadeRankingAuthority({db,games,registry,clock:()=>1000,verifiers:{[game.gameId]:{approvedForCompetitive:approved,rulesetDigest,verifyReplay:verify}}});
 return {auth,db};
}
async function proof(challenge){const s=new ArcadeSessionEvents({game,sessionId:challenge.sessionId,seedProvenance:{kind:'server-issued-unverified',reference:'server-issued'},startedAt:challenge.issuedAt,clock:()=>1001});s.append({type:'score',sequence:1,delta:42});s.append({type:'complete',sequence:2,finalScore:42});return s.finish(webcrypto);}
test('fails closed when no independent verifier or finalized registration',async()=>{await assert.rejects(setup({approved:false}).auth.issueChallenge({gameId:game.gameId,playerRef:player}),RankingAuthorityError);await assert.rejects(setup({registered:false}).auth.issueChallenge({gameId:game.gameId,playerRef:player}),RankingAuthorityError);});
test('server-owned challenge, independent replay, durable one-time record and verified leaderboard',async()=>{const {auth,db}=setup();const c=await auth.issueChallenge({gameId:game.gameId,playerRef:player});const events=await proof(c);const receipt=await auth.submit({gameId:game.gameId,sessionId:c.sessionId,playerRef:player,seed:c.seed,events});assert.equal(receipt.status,'SERVER_VERIFIED');assert.equal(receipt.score,42);assert.equal(db.results.size,1);assert.deepEqual(await auth.leaderboard({gameId:game.gameId}),[{rank:1,playerRef:player,score:42}]);await assert.rejects(auth.submit({gameId:game.gameId,sessionId:c.sessionId,playerRef:player,seed:c.seed,events}),RankingAuthorityError);});
test('unverified client score cannot bypass replay approval or write leaderboard',async()=>{const {auth,db}=setup({verify:async()=>({accepted:false})});const c=await auth.issueChallenge({gameId:game.gameId,playerRef:player});const events=await proof(c);await assert.rejects(auth.submit({gameId:game.gameId,sessionId:c.sessionId,playerRef:player,seed:c.seed,events}),RankingAuthorityError);assert.equal(db.results.size,0);assert.deepEqual(await auth.leaderboard({gameId:game.gameId}),[]);});
test('tampered input, forged game/player/seed and malformed limits refused',async()=>{const {auth}=setup();const c=await auth.issueChallenge({gameId:game.gameId,playerRef:player});const events=await proof(c);for(const delta of [{playerRef:'invalid'},{seed:'b'.repeat(64)},{gameId:'foreign'}])await assert.rejects(auth.submit({gameId:game.gameId,sessionId:c.sessionId,playerRef:player,seed:c.seed,events,...delta}),RankingAuthorityError);const poisoned=structuredClone(events);poisoned.events[0].verified=true;await assert.rejects(auth.submit({gameId:game.gameId,sessionId:c.sessionId,playerRef:player,seed:c.seed,events:poisoned}));await assert.rejects(auth.leaderboard({gameId:game.gameId,limit:1000}),RankingAuthorityError);});
