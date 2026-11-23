// BC-2.1: executable rules qualification; does not enable unqualified live play.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {
 LABYRINTH_CRIBBAGE_TARGET,LABYRINTH_CRIBBAGE_VARIANTS,labyrinthCribbageVariant,
 labyrinthCribbageShowOrder,labyrinthCribbageDeal,labyrinthCribbageFinishDeal,
 labyrinthCribbageScoreShow,labyrinthCribbagePegPoints,labyrinthCribbageClassify,
 labyrinthCribbageAward,labyrinthCribbageHeels,labyrinthCribbageCanPlay,
 labyrinthCribbageSequenceEnd
} from '../core/labyrinth-cribbage-rules.js';

const ref=new URL('../../../docs/games/classics/',import.meta.url);
const bytes=await readFile(new URL('BC-2-1-LABYRINTH-CRIBBAGE-VARIANTS.json',ref));
const manifest=JSON.parse(bytes.toString('utf8'));
const rules=await readFile(new URL('BC-2-1-LABYRINTH-CRIBBAGE-RULES.md',ref),'utf8');

test('BC-2.1 is a dedicated versioned 325-point account ruleset',()=>{
 assert.equal(manifest.schemaVersion,1);
 assert.equal(manifest.gameId,'labyrinth-cribbage');
 assert.equal(manifest.rulesetId,'bc-labyrinth-cribbage-325');
 assert.equal(manifest.rulesetVersion,'2.0.0');
 assert.equal(manifest.scope,'offchain-account-classics-only');
 assert.equal(manifest.targetScore,LABYRINTH_CRIBBAGE_TARGET);
 assert.equal(manifest.reference,'BC-2-1-LABYRINTH-CRIBBAGE-RULES.md');
 assert.match(createHash('sha256').update(bytes).digest('hex'),/^[a-f0-9]{64}$/);
 assert.ok(rules.includes('bc-labyrinth-cribbage-325@2.0.0'));
 assert.match(rules,/must not enable Play/i);
 assert.equal(manifest.defaultFourPlayerVariantId,'labyrinth-4p-partners');
 assert.equal(manifest.board.scoringHolesPerRun,324);
 assert.equal(manifest.board.finishHole,325);
 assert.equal(manifest.board.startingScore,0);
});
test('BC-2.1 deals and discards conserve 52 cards, with exactly six retained and six in crib',()=>{
 const scenarios=[
  [2,'partnerships','labyrinth-2p',9,3,0,[0,1]],
  [3,'partnerships','labyrinth-3p',8,2,0,[0,1,2]],
  [4,'partnerships','labyrinth-4p-partners',7,1,2,[0,1,0,1]],
  [4,'individual','labyrinth-4p-individual',7,1,2,[0,1,2,3]]
 ];
 assert.deepEqual(manifest.variants.map(v=>v.id),scenarios.map(x=>x[2]));
 const deck=Array.from({length:52},(_,i)=>i);
 for(const [n,format,id,deal,discard,extra,teams] of scenarios){
  const v=labyrinthCribbageVariant(n,format),m=manifest.variants.find(x=>x.id===id);
  assert.equal(v.id,id);
  assert.deepEqual(v.teams,teams);
  assert.deepEqual(m.teamBySeat,teams);
  assert.equal(m.seatCount,n);
  assert.equal(v.deal,deal);
  assert.equal(m.cardsDealtPerSeat,deal);
  assert.equal(v.discard,discard);
  assert.equal(m.discardsPerSeat,discard);
  assert.equal(m.extraCribCards,extra);
  assert.equal(m.cribCardCount,6);
  assert.equal(m.cardsRetainedPerSeat,6);
  assert.equal(n*discard+extra,6);
  for(let dealer=0;dealer<n;dealer++){
   const raw=labyrinthCribbageDeal(deck,n,dealer,format);
   assert.equal(raw.crib.length,extra);
   assert.equal(raw.stock.length,52-n*deal-extra);
   assert.equal(raw.hands[dealer].length,deal);
   const discardList=raw.hands.map(h=>h.slice(0,discard));
   const after=labyrinthCribbageFinishDeal(raw,discardList);
   assert.equal(after.variantId,id);
   assert.equal(after.starter,deck[n*deal+extra]);
   assert.ok(after.hands.every(h=>h.length===6));
   assert.equal(after.crib.length,6);
   assert.equal(new Set([...after.hands.flat(),...after.crib,after.starter,...after.stock]).size,52);
   assert.deepEqual(labyrinthCribbageShowOrder(n,dealer).map(x=>x.seat),
    [...Array.from({length:n},(_,i)=>(dealer+i+1)%n),dealer]);
   assert.equal(labyrinthCribbageShowOrder(n,dealer).at(-1).isCrib,true);
  }
 }
 assert.equal(labyrinthCribbageVariant(4).id,'labyrinth-4p-partners');
 assert.throws(()=>labyrinthCribbageVariant(4,'unknown'),RangeError);
 assert.throws(()=>labyrinthCribbageVariant(5),RangeError);
 assert.throws(()=>labyrinthCribbageDeal([0,1],4,0),RangeError);
 assert.throws(()=>labyrinthCribbageDeal(deck,4,4),RangeError);
 const bad=labyrinthCribbageDeal(deck,2,0);
 assert.throws(()=>labyrinthCribbageFinishDeal(bad,[[1,3,5],[0,2,50]]),RangeError);
 assert.throws(()=>labyrinthCribbageFinishDeal(bad,[[1,3],[0,2,4]]),RangeError);
});
test('BC-2.1 seven-card counting scores all 15 subsets and rank multiplicities',()=>{
 const allRun=labyrinthCribbageScoreShow([0,1,2,3,4,5],6);
 // A through 7 of spades: eight distinct fifteens, one 7-run and a 7 flush.
 assert.deepEqual(allRun,{fifteens:16,pairs:0,runs:7,flush:7,nobs:0,total:30});
 const multiples=labyrinthCribbageScoreShow([2,15,28,3,16,43],7);
 assert.equal(multiples.runs,18); // 3 x 2 x 1 longest 3-runs
 const equals=labyrinthCribbageScoreShow([0,13,26,39,1,14],27);
 assert.equal(equals.pairs,18); // 4 aces (12) + three twos (6)
 assert.equal(equals.runs,0);
 assert.equal(equals.fifteens,0);
 assert.equal(equals.total,18);
 const nobs=labyrinthCribbageScoreShow([10,0,1,2,3,4],5);
 assert.equal(nobs.nobs,1);
 const nonNobs=labyrinthCribbageScoreShow([10,0,1,2,3,4],23);
 assert.equal(nonNobs.nobs,0); // starter Jack independently awards heels
});
test('BC-2.1 six-card flush threshold applies to hands, crib requires seventh match',()=>{
 const six=[0,1,2,3,4,5],five=[0,1,2,3,4,13];
 assert.equal(labyrinthCribbageScoreShow(six,6).flush,7);
 assert.equal(labyrinthCribbageScoreShow(six,13).flush,6);
 assert.equal(labyrinthCribbageScoreShow(six,6,{crib:true}).flush,7);
 assert.equal(labyrinthCribbageScoreShow(six,13,{crib:true}).flush,0);
 assert.equal(labyrinthCribbageScoreShow(five,6).flush,0);
 assert.equal(labyrinthCribbageScoreShow(five,6,{crib:true}).flush,0);
 assert.throws(()=>labyrinthCribbageScoreShow(six,5),RangeError);
 assert.throws(()=>labyrinthCribbageScoreShow(six.slice(0,5),13),RangeError);
 assert.throws(()=>labyrinthCribbageScoreShow([...five,13],6),RangeError);
 assert.equal(manifest.scoring.show.handFlushSix,6);
 assert.equal(manifest.scoring.show.handFlushSeven,7);
 assert.equal(manifest.scoring.show.cribFlushSevenOnly,7);
});
test('BC-2.1 ordinary pegging awards 15, 31, pairs and only longest suffix runs',()=>{
 assert.deepEqual(labyrinthCribbagePegPoints([0,1,2,3,4]),{
  count:15,points:7,pairCount:1,run:5,exact15:true,exact31:false
 });
 assert.equal(labyrinthCribbagePegPoints([12,25,10,0]).points,2); // 31
 assert.equal(labyrinthCribbagePegPoints([0,13]).points,2);
 assert.equal(labyrinthCribbagePegPoints([0,13,26]).points,6);
 assert.equal(labyrinthCribbagePegPoints([0,13,26,39]).points,12);
 assert.equal(labyrinthCribbagePegPoints([2,4,3]).run,3);
 assert.throws(()=>labyrinthCribbagePegPoints([12,25,10,0,1]),RangeError);
 assert.throws(()=>labyrinthCribbagePegPoints([0,0]),RangeError);
});
test('BC-2.1 Jack starter, legal Go and last-card conditions never double-score 31',()=>{
 assert.equal(labyrinthCribbageHeels(10),2);
 assert.equal(labyrinthCribbageHeels(23),2);
 assert.equal(labyrinthCribbageHeels(9),0);
 assert.equal(labyrinthCribbageCanPlay([12,0],30),true);
 assert.equal(labyrinthCribbageCanPlay([12,25],30),false);
 assert.equal(labyrinthCribbageCanPlay([],22),false);
 assert.deepEqual(labyrinthCribbageSequenceEnd(2,4,30,false),
  {seat:2,kind:'go',points:1});
 assert.deepEqual(labyrinthCribbageSequenceEnd(0,3,30,true),
  {seat:0,kind:'last-card',points:1});
 assert.equal(labyrinthCribbageSequenceEnd(1,2,31,true),null);
 assert.equal(labyrinthCribbageSequenceEnd(1,2,31,false),null);
 assert.throws(()=>labyrinthCribbageCanPlay([0],32),RangeError);
 assert.throws(()=>labyrinthCribbageSequenceEnd(2,2,20,false),RangeError);
});

test('BC-2.1 shared teams and independent four-seat scores win at award 325',()=>{
 const two=labyrinthCribbageAward([323,0,323,0],'labyrinth-4p-partners',2,2);
 assert.deepEqual(two.scores,[325,0,325,0]);
 assert.equal(two.winningTeam,0);
 assert.equal(two.winnerSeat,2);
 assert.equal(two.losers[0].classification,'double-skunk');
 const four=labyrinthCribbageAward([324,0,1,2],'labyrinth-4p-individual',0,1);
 assert.deepEqual(four.scores,[325,0,1,2]);
 assert.equal(four.winningTeam,0);
 assert.equal(four.losers.length,3);
 assert.deepEqual([162,163,243,244,324].map(labyrinthCribbageClassify),
  ['double-skunk','skunk','skunk','ordinary','ordinary']);
 const ongoing=labyrinthCribbageAward([100,101],'labyrinth-2p',0,15);
 assert.equal(ongoing.winningTeam,null);
 assert.deepEqual(ongoing.scores,[115,101]);
 assert.throws(()=>labyrinthCribbageAward([121,110,122,110],'labyrinth-4p-partners',2,1),RangeError);
 assert.throws(()=>labyrinthCribbageAward([325,0],'labyrinth-2p',0,1),RangeError);
});
test('BC-2.1 declares no unauthorized regional/muggins/online release',()=>{
 assert.deepEqual(manifest.scoring.pegging,{exact15:2,exact31:2,pair:2,triple:6,
  quadruple:12,runPointsPerCard:1,goOrFinalCardBelow31:1});
 assert.equal(manifest.scoring.autoCount,true);
 assert.equal(manifest.scoring.muggins,false);
 assert.equal(manifest.scoring.heelsJackStarter,2);
 assert.equal(manifest.scoring.scoreDisplayCap,325);
 assert.equal(manifest.policies.fourPlayerDefault,'partners');
 assert.equal(manifest.policies.regionalRules,'none-selectable-in-v1');
 for(const phrase of ['Go','31','325','six-card','six retained','partner',
  'individual','starter','nobs','heels','reconnect','hidden','Muggins',
  '162','243','after all','the dealer'])assert.match(rules,new RegExp(phrase,'i'));
});
