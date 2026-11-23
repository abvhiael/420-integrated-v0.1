// BC-2.1: executable rules qualification; does not enable unqualified live play.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {
 RUSSIAN_CRIBBAGE_TARGET,RUSSIAN_CRIBBAGE_VARIANTS,russianCribbageVariant,
 russianCribbageShowOrder,russianCribbageDeal,russianCribbageFinishDeal,
 russianCribbageScoreShow,russianCribbagePegPoints,russianCribbageClassify,
 russianCribbageAward,russianCribbageHeels,russianCribbageCanPlay,
 russianCribbageSequenceEnd
} from '../core/russian-cribbage-rules.js';

const ref=new URL('../../../docs/games/classics/',import.meta.url);
const bytes=await readFile(new URL('BC-2-1-RUSSIAN-CRIBBAGE-VARIANTS.json',ref));
const manifest=JSON.parse(bytes.toString('utf8'));
const rules=await readFile(new URL('BC-2-1-RUSSIAN-CRIBBAGE-RULES.md',ref),'utf8');

test('BC-2.1 is a dedicated versioned 241-point account ruleset',()=>{
 assert.equal(manifest.schemaVersion,1);
 assert.equal(manifest.gameId,'russian-cribbage');
 assert.equal(manifest.rulesetId,'bc-russian-cribbage-241');
 assert.equal(manifest.rulesetVersion,'1.0.0');
 assert.equal(manifest.scope,'offchain-account-classics-only');
 assert.equal(manifest.targetScore,RUSSIAN_CRIBBAGE_TARGET);
 assert.equal(manifest.reference,'BC-2-1-RUSSIAN-CRIBBAGE-RULES.md');
 assert.match(createHash('sha256').update(bytes).digest('hex'),/^[a-f0-9]{64}$/);
 assert.ok(rules.includes('bc-russian-cribbage-241@1.0.0'));
 assert.match(rules,/must not enable Play/i);
 assert.equal(manifest.defaultFourPlayerVariantId,'russian-4p-partners');
});
test('BC-2.1 deals and discards conserve 52 cards, with exactly six retained and six in crib',()=>{
 const scenarios=[
  [2,'partnerships','russian-2p',9,3,0,[0,1]],
  [3,'partnerships','russian-3p',8,2,0,[0,1,2]],
  [4,'partnerships','russian-4p-partners',7,1,2,[0,1,0,1]],
  [4,'individual','russian-4p-individual',7,1,2,[0,1,2,3]]
 ];
 assert.deepEqual(manifest.variants.map(v=>v.id),scenarios.map(x=>x[2]));
 const deck=Array.from({length:52},(_,i)=>i);
 for(const [n,format,id,deal,discard,extra,teams] of scenarios){
  const v=russianCribbageVariant(n,format),m=manifest.variants.find(x=>x.id===id);
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
   const raw=russianCribbageDeal(deck,n,dealer,format);
   assert.equal(raw.crib.length,extra);
   assert.equal(raw.stock.length,52-n*deal-extra);
   assert.equal(raw.hands[dealer].length,deal);
   const discardList=raw.hands.map(h=>h.slice(0,discard));
   const after=russianCribbageFinishDeal(raw,discardList);
   assert.equal(after.variantId,id);
   assert.equal(after.starter,deck[n*deal+extra]);
   assert.ok(after.hands.every(h=>h.length===6));
   assert.equal(after.crib.length,6);
   assert.equal(new Set([...after.hands.flat(),...after.crib,after.starter,...after.stock]).size,52);
   assert.deepEqual(russianCribbageShowOrder(n,dealer).map(x=>x.seat),
    [...Array.from({length:n},(_,i)=>(dealer+i+1)%n),dealer]);
   assert.equal(russianCribbageShowOrder(n,dealer).at(-1).isCrib,true);
  }
 }
 assert.equal(russianCribbageVariant(4).id,'russian-4p-partners');
 assert.throws(()=>russianCribbageVariant(4,'unknown'),RangeError);
 assert.throws(()=>russianCribbageVariant(5),RangeError);
 assert.throws(()=>russianCribbageDeal([0,1],4,0),RangeError);
 assert.throws(()=>russianCribbageDeal(deck,4,4),RangeError);
 const bad=russianCribbageDeal(deck,2,0);
 assert.throws(()=>russianCribbageFinishDeal(bad,[[1,3,5],[0,2,50]]),RangeError);
 assert.throws(()=>russianCribbageFinishDeal(bad,[[1,3],[0,2,4]]),RangeError);
});
test('BC-2.1 seven-card counting scores all 15 subsets and rank multiplicities',()=>{
 const allRun=russianCribbageScoreShow([0,1,2,3,4,5],6);
 // A through 7 of spades: eight distinct fifteens, one 7-run and a 7 flush.
 assert.deepEqual(allRun,{fifteens:16,pairs:0,runs:7,flush:7,nobs:0,total:30});
 const multiples=russianCribbageScoreShow([2,15,28,3,16,43],7);
 assert.equal(multiples.runs,18); // 3 x 2 x 1 longest 3-runs
 const equals=russianCribbageScoreShow([0,13,26,39,1,14],27);
 assert.equal(equals.pairs,18); // 4 aces (12) + three twos (6)
 assert.equal(equals.runs,0);
 assert.equal(equals.fifteens,0);
 assert.equal(equals.total,18);
 const nobs=russianCribbageScoreShow([10,0,1,2,3,4],5);
 assert.equal(nobs.nobs,1);
 const nonNobs=russianCribbageScoreShow([10,0,1,2,3,4],23);
 assert.equal(nonNobs.nobs,0); // starter Jack independently awards heels
});
test('BC-2.1 six-card flush threshold applies to hands, crib requires seventh match',()=>{
 const six=[0,1,2,3,4,5],five=[0,1,2,3,4,13];
 assert.equal(russianCribbageScoreShow(six,6).flush,7);
 assert.equal(russianCribbageScoreShow(six,13).flush,6);
 assert.equal(russianCribbageScoreShow(six,6,{crib:true}).flush,7);
 assert.equal(russianCribbageScoreShow(six,13,{crib:true}).flush,0);
 assert.equal(russianCribbageScoreShow(five,6).flush,0);
 assert.equal(russianCribbageScoreShow(five,6,{crib:true}).flush,0);
 assert.throws(()=>russianCribbageScoreShow(six,5),RangeError);
 assert.throws(()=>russianCribbageScoreShow(six.slice(0,5),13),RangeError);
 assert.throws(()=>russianCribbageScoreShow([...five,13],6),RangeError);
 assert.equal(manifest.scoring.show.handFlushSix,6);
 assert.equal(manifest.scoring.show.handFlushSeven,7);
 assert.equal(manifest.scoring.show.cribFlushSevenOnly,7);
});
test('BC-2.1 ordinary pegging awards 15, 31, pairs and only longest suffix runs',()=>{
 assert.deepEqual(russianCribbagePegPoints([0,1,2,3,4]),{
  count:15,points:7,pairCount:1,run:5,exact15:true,exact31:false
 });
 assert.equal(russianCribbagePegPoints([12,25,10,0]).points,2); // 31
 assert.equal(russianCribbagePegPoints([0,13]).points,2);
 assert.equal(russianCribbagePegPoints([0,13,26]).points,6);
 assert.equal(russianCribbagePegPoints([0,13,26,39]).points,12);
 assert.equal(russianCribbagePegPoints([2,4,3]).run,3);
 assert.throws(()=>russianCribbagePegPoints([12,25,10,0,1]),RangeError);
 assert.throws(()=>russianCribbagePegPoints([0,0]),RangeError);
});
test('BC-2.1 Jack starter, legal Go and last-card conditions never double-score 31',()=>{
 assert.equal(russianCribbageHeels(10),2);
 assert.equal(russianCribbageHeels(23),2);
 assert.equal(russianCribbageHeels(9),0);
 assert.equal(russianCribbageCanPlay([12,0],30),true);
 assert.equal(russianCribbageCanPlay([12,25],30),false);
 assert.equal(russianCribbageCanPlay([],22),false);
 assert.deepEqual(russianCribbageSequenceEnd(2,4,30,false),
  {seat:2,kind:'go',points:1});
 assert.deepEqual(russianCribbageSequenceEnd(0,3,30,true),
  {seat:0,kind:'last-card',points:1});
 assert.equal(russianCribbageSequenceEnd(1,2,31,true),null);
 assert.equal(russianCribbageSequenceEnd(1,2,31,false),null);
 assert.throws(()=>russianCribbageCanPlay([0],32),RangeError);
 assert.throws(()=>russianCribbageSequenceEnd(2,2,20,false),RangeError);
});

test('BC-2.1 shared teams and independent four-seat scores win at award 241',()=>{
 const two=russianCribbageAward([239,0,239,0],'russian-4p-partners',2,2);
 assert.deepEqual(two.scores,[241,0,241,0]);
 assert.equal(two.winningTeam,0);
 assert.equal(two.winnerSeat,2);
 assert.equal(two.losers[0].classification,'double-skunk');
 const four=russianCribbageAward([240,0,1,2],'russian-4p-individual',0,1);
 assert.deepEqual(four.scores,[241,0,1,2]);
 assert.equal(four.winningTeam,0);
 assert.equal(four.losers.length,3);
 assert.deepEqual([120,121,180,181,240].map(russianCribbageClassify),
  ['double-skunk','skunk','skunk','ordinary','ordinary']);
 const ongoing=russianCribbageAward([100,101],'russian-2p',0,15);
 assert.equal(ongoing.winningTeam,null);
 assert.deepEqual(ongoing.scores,[115,101]);
 assert.throws(()=>russianCribbageAward([121,110,122,110],'russian-4p-partners',2,1),RangeError);
 assert.throws(()=>russianCribbageAward([241,0],'russian-2p',0,1),RangeError);
});
test('BC-2.1 declares no unauthorized regional/muggins/online release',()=>{
 assert.deepEqual(manifest.scoring.pegging,{exact15:2,exact31:2,pair:2,triple:6,
  quadruple:12,runPointsPerCard:1,goOrFinalCardBelow31:1});
 assert.equal(manifest.scoring.autoCount,true);
 assert.equal(manifest.scoring.muggins,false);
 assert.equal(manifest.scoring.heelsJackStarter,2);
 assert.equal(manifest.scoring.scoreDisplayCap,241);
 assert.equal(manifest.policies.fourPlayerDefault,'partners');
 assert.equal(manifest.policies.regionalRules,'none-selectable-in-v1');
 for(const phrase of ['Go','31','241','six-card','six retained','partner',
  'individual','starter','nobs','heels','reconnect','hidden','Muggins',
  '120','180','after all','the dealer'])assert.match(rules,new RegExp(phrase,'i'));
});
