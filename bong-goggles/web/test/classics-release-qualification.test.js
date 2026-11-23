import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CLASSIC_ROADMAP,ALL_CLASSICS} from '../core/classics.js';
import {renderClassicGamePage} from '../core/games-ui.js';
import {renderSharedGameScreen} from '../core/shared-game-ui.js';
import {validateRuntimeConfig} from '../core/runtime-config.js';
import {assertCatalogueAndEvidence,checkEvidenceShape,verifyReleaseEvidence,
 auditRelease,loadReleaseEvidence,BC12_REPO,BC12_WORKFLOWS} from '../scripts/classics-release-gate.mjs';
const sha='a'.repeat(40),hash='b'.repeat(64);
const one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';
const proof=()=>({gameId:'cribbage',sourceSha:sha,rulesHash:hash,
 deployedOrigin:'https://bonggoggles.420integrated.org',
 frameworkRunId:123,liveRunId:124,
 result:'completed-two-account-match',evidenceVersion:1});
const goodRun=(kind)=>({conclusion:'success',status:'completed',head_sha:sha,
 repository:{full_name:BC12_REPO},path:BC12_REPO+'/'+BC12_WORKFLOWS[kind]+'@refs/heads/main',
 event:kind==='live'?'workflow_dispatch':'pull_request',
 head_branch:kind==='live'?'main':'feature/bc-0-12',
 inputs:kind==='live'?{game_id:'cribbage',rules_hash:hash}:null,
 name:kind==='live'?'BC-0.12 Live Classics Acceptance':'BC-0.12 Classics Test and Release Qualification'});
const noPlay=html=>/data-game-action="(?:create|play|move|rematch)"|data-classic-quick-play|<button[^>]*>Start game<\/button>/i.test(html);

test('BC-0.12 catalogue release audit covers exact 25 titles, sequence and fail-closed default',async()=>{
 const manifest=await loadReleaseEvidence();
 assert.deepEqual(manifest,{schema:'bc-0-12-release-evidence-v1',games:{}});
 const result=await auditRelease({manifest,fetchImpl:()=>{throw Error('should not call GitHub without release')}});
 assert.deepEqual(result,{count:25,released:0,locked:25});
 const cli=execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/classics-release-gate.mjs',import.meta.url)),'--audit'],{encoding:'utf8'});
 assert.match(cli,/BC-0.12 catalogue\/release audit/);
 assert.match(cli,/"locked":25/);
 const begin=performance.now();
 for(const g of CLASSIC_ROADMAP){
  for(const screen of ['intro','rules','play','setup','table','results','history','rematch']){
   const html=renderClassicGamePage(g.id,{screen});
   assert.equal(noPlay(html),false,g.id+' '+screen);
   assert.doesNotMatch(html,/\bwallet required\b|\bprize awarded\b/i);
   if(screen==='setup')assert.match(html,/disabled/);
  }
 }
 assert.ok(performance.now()-begin<12_000,'bounded 25-title/8-screen smoke exceeded 12 seconds');
 assert.equal(ALL_CLASSICS.filter(x=>x.status==='account').length,1);
 assert.equal(ALL_CLASSICS.find(x=>x.status==='account')?.id,'cross-country-chaos');
 assert.equal(CLASSIC_ROADMAP.filter(x=>x.status==='playable').length,0,'no fabricated BC-1.8 release');
});
test('BC-0.12 seeded property probes reject all altered title order, statuses and unauthorized proofs',()=>{
 let seed=0x812420;
 const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
 const manifest={schema:'bc-0-12-release-evidence-v1',games:{}};
 for(let i=0;i<512;i++){
  const index=next()%25;
  const items=CLASSIC_ROADMAP.map(x=>({...x}));
  const choice=next()%6;
  if(choice===0)items[index].id='unknown-'+i;
  if(choice===1)items[index].status='playable';
  if(choice===2)items[index].milestone='BC-999';
  if(choice===3)items[index].collection='counterfeit';
  if(choice===4)items[index].status='wager';
  if(choice===5)items[index].id=items[(index+1)%25].id;
  assert.throws(()=>assertCatalogueAndEvidence({manifest,roadmap:items}),/release denied/);
 }
 const released=CLASSIC_ROADMAP.map(g=>({...g}));
 released[0].status='playable';
 const good={schema:'bc-0-12-release-evidence-v1',games:{cribbage:proof()}};
 assert.equal(assertCatalogueAndEvidence({manifest:good,roadmap:released}).released,1);
 released[1].status='playable';
 good.games['labyrinth-cribbage']={...proof(),gameId:'labyrinth-cribbage'};
 assert.equal(assertCatalogueAndEvidence({manifest:good,roadmap:released}).released,2);
 released[3].status='playable';
 good.games.scrabble={...proof(),gameId:'scrabble'};
 assert.throws(()=>assertCatalogueAndEvidence({manifest:good,roadmap:released}),/order/);
});
test('BC-0.12 release proof requires two distinct 420IDs, one deployed origin, exact source hash and live workflow',()=>{
 const cases=[
 {subjects:[one,one]}, {subjects:[one,'fake']},{sourceSha:'a'.repeat(39)},
 {rulesHash:'hash'}, {frameworkRunId:124},{liveRunId:123},
 {deployedOrigin:'http://bonggoggles.420integrated.org'},
 {deployedOrigin:'https://evil.example'}, {gameId:'chess'},
 {result:'mock-completed'}, {evidenceVersion:2},
 {wager:true}, {sessionCookie:'secret'}
 ];
 assert.ok(checkEvidenceShape('cribbage',proof()));
 for(const tamper of cases)
  assert.equal(checkEvidenceShape('cribbage',{...proof(),...tamper}),false,JSON.stringify(tamper));
});
test('BC-0.12 GitHub runs must be successful and independent at exactly the game source',async()=>{
 const observed=[];
 const fetchImpl=async url=>{
  observed.push(url);
  const kind=url.endsWith('/123')?'framework':'live';
  return {ok:true,json:async()=>goodRun(kind)};
 };
 const result=await verifyReleaseEvidence('cribbage',proof(),{fetchImpl,token:null});
 assert.deepEqual(result,{gameId:'cribbage',sha,verified:true});
 assert.equal(observed.length,2);
 for(const tamper of [
  {head_sha:'c'.repeat(40)}, {status:'queued'}, {conclusion:'failure'},
  {event:'pull_request'}, {path:'evil/.github/workflows/other.yml@refs/heads/main'},
  {repository:{full_name:'attacker/fork'}}, {name:'Fake Release'},
  {head_branch:'attacker'}, {inputs:{game_id:'chess',rules_hash:hash}},
  {inputs:{game_id:'cribbage',rules_hash:'c'.repeat(64)}},
  {inputs:null}
 ]){
  await assert.rejects(verifyReleaseEvidence('cribbage',proof(),{token:null,
   fetchImpl:async url=>({ok:true,json:async()=>url.endsWith('/123')?goodRun('framework'):{...goodRun('live'),...tamper}})}),/release denied/);
 }
 await assert.rejects(verifyReleaseEvidence('cribbage',proof(),{fetchImpl:()=>{throw Error('offline')},token:null}),/release denied/);
});
test('BC-0.12 public rule previews and local fixture projections never grant an unqualified move',()=>{
 for(const g of CLASSIC_ROADMAP){
  const view={verified:false,source:'mock-browser',phase:'active',gameId:g.id,
   viewerSeat:0,players:[{name:'Alice',score:999},{name:'Bob',score:0}],
   tabletop:{hand:{seat:0,cards:[{id:'concealed-card',label:'Secret'}]}}};
  for(const screen of ['table','results','history']){
   const html=renderSharedGameScreen({game:g,screen,view});
   assert.doesNotMatch(html,/concealed-card|Secret|999|data-game-action=/);
  }
 }
 const config=validateRuntimeConfig({
  environment:'testnet',appOrigin:'https://bonggoggles.420integrated.org',
  chainId:420420,rpcUrl:'https://rpc.example',indexerUrl:'https://indexer.example',
  mediaUrl:'https://media.example',messengerUrl:'https://messenger.example',
  notificationsUrl:'https://notifications.example',walletUrl:'https://wallet.example',
  explorerUrl:'https://explorer.example',
  features:{accountSocial:false,accountGames:false,classicRooms:true,classicCommunications:true}
 });
 assert.equal(config.features.classicRooms,false);
 assert.equal(config.features.classicCommunications,false);
});

test('BC-1.8 Playable is exclusive to validated release evidence, not a registry/account label',()=>{
 const empty={schema:'bc-0-12-release-evidence-v1',games:{}};
 const draft=CLASSIC_ROADMAP.map(x=>({...x}));
 draft[0].status='playable';
 assert.throws(()=>assertCatalogueAndEvidence({manifest:empty,roadmap:draft}),/without evidence/);
 const withProof={schema:empty.schema,games:{cribbage:proof()}};
 assert.equal(assertCatalogueAndEvidence({manifest:withProof,roadmap:draft}).released,1);
 draft[1].status='playable';
 assert.throws(()=>assertCatalogueAndEvidence({manifest:withProof,roadmap:draft}),/without evidence/);
 const legacy=CLASSIC_ROADMAP.map(x=>({...x}));
 legacy[0].status='account';
 assert.throws(()=>assertCatalogueAndEvidence({manifest:withProof,roadmap:legacy}),/unknown game status/);
});
