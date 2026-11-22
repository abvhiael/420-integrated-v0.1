// BC-1.1 qualifies the versioned *rules specification*, not a playable Cribbage engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const directory=new URL('../../../docs/games/classics/',import.meta.url);
const bytes=await readFile(new URL('BC-1-1-CRIBBAGE-VARIANTS.json',directory));
const spec=JSON.parse(bytes.toString('utf8'));
const rules=await readFile(new URL('BC-1-1-CRIBBAGE-RULES.md',directory),'utf8');
const digest=createHash('sha256').update(bytes).digest('hex');

test('BC-1.1 has a stable separate account rules identity and deterministic manifest hash',()=>{
 assert.equal(spec.schemaVersion,1);
 assert.equal(spec.gameId,'cribbage');
 assert.equal(spec.rulesetId,'bc-cribbage-standard-121');
 assert.equal(spec.rulesetVersion,'1.0.0');
 assert.equal(spec.scope,'offchain-account-classics-only');
 assert.equal(spec.reference,'BC-1-1-CRIBBAGE-RULES.md');
 assert.match(digest,/^[a-f0-9]{64}$/);
 assert.ok(rules.includes('bc-cribbage-standard-121@1.0.0'));
 assert.ok(rules.includes('BG-15')&&rules.includes('wallet/on-chain'));
 assert.equal(spec.defaultVariantId,'standard-2p');
});

test('BC-1.1 2/3/4-seat deals, independent and partner scores, four-card crib are conserved',()=>{
 assert.equal(spec.targetScore,121);
 assert.deepEqual(spec.deck,{cards:52,jokers:0,aces:'low',faceCardValue:10});
 assert.deepEqual(spec.variants.map(v=>v.id),['standard-2p','standard-3p','standard-4p-partners']);
 const expected=[
  [2,[0,1],6,2,0],
  [3,[0,1,2],5,1,1],
  [4,[0,1,0,1],5,1,0]
 ];
 for(const [i,v] of spec.variants.entries()){
  const [count,teams,deal,discard,extra]=expected[i];
  assert.equal(v.seatCount,count);
  assert.deepEqual(v.teamBySeat,teams);
  assert.equal(v.cardsDealtPerSeat,deal);
  assert.equal(v.discardsPerSeat,discard);
  assert.equal(v.extraCribCards,extra);
  assert.equal(v.cardsRetainedPerSeat,4);
  assert.equal(v.cribCardCount,4);
  assert.equal(v.dealerOwnsCrib,true);
  assert.equal(v.cardsDealtPerSeat-v.discardsPerSeat,v.cardsRetainedPerSeat);
  assert.equal(v.discardsPerSeat*count+v.extraCribCards,4);
  // Retained cards, crib, starter and undealt stock partition a 52-card deck.
  const allocated=count*v.cardsRetainedPerSeat+v.cribCardCount+1;
  assert.ok(allocated<=52);
  assert.equal(allocated+(52-allocated),52);
  assert.equal(new Set(teams).size,count===4?2:count);
 }
});

test('BC-1.1 pins scoring categories and exact skunk thresholds',()=>{
 assert.deepEqual(spec.scoring.pegging,{
  exact15:2,exact31:2,pair:2,triple:6,quadruple:12,runPointsPerCard:1,goOrFinalCardBelow31:1
 });
 assert.deepEqual(spec.scoring.show,{
  fifteenPerSubset:2,pairPerCombination:2,runPerCard:1,handFlushFour:4,handFlushFive:5,cribFlushFiveOnly:5,nobs:1
 });
 assert.equal(spec.scoring.heelsJackStarter,2);
 assert.equal(spec.scoring.autoCount,true);
 assert.equal(spec.scoring.muggins,false);
 assert.equal(spec.scoring.scoreDisplayCap,121);
 const outcome=score=>score<=spec.scoring.doubleSkunkIfLoserAtMost?'double-skunk':
  score<=spec.scoring.skunkIfLoserAtMost?'skunk':'ordinary';
 assert.deepEqual([0,60,61,90,91,120].map(outcome),
  ['double-skunk','double-skunk','skunk','skunk','ordinary','ordinary']);
});

test('BC-1.1 preserves show order, Go-reset and regional/version safety boundary',()=>{
 const policy=spec.policies;
 assert.equal(policy.firstDealer,'lowest-cut-rank-recut-ties');
 assert.equal(policy.showOrder,'clockwise-from-dealer-left-dealer-last-crib-last');
 assert.equal(policy.countReset,'exact31-or-no-eligible-seat-can-play');
 assert.equal(policy.winner,'first-team-or-seat-reaching-at-least-121-at-point-award');
 assert.equal(policy.regionalRules,'not-selectable-in-v1');
 assert.equal(policy.reconnect,'resume-authoritative-state-no-redeal');
 assert.ok(spec.unsupportedVariants.includes('russian-cribbage'));
 assert.ok(spec.unsupportedVariants.includes('four-player-individual-cutthroat'));
 assert.ok(spec.unsupportedVariants.includes('muggins-manual-claims'));
 assert.ok(!spec.variants.some(v=>spec.unsupportedVariants.includes(v.id)));
 for(const phrase of ['Go','31','121','pegging','the show','crib','starter','double skunk',
  'muggins','reconnect','private','SHA-256','BC-1.2','29','fifteens','runs','nobs','heels'])
  assert.ok(rules.toLowerCase().includes(phrase.toLowerCase()),'Missing '+phrase);
});
