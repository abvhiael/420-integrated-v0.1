import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import {BLACKJACK_RULES,SUITS,RANKS,makeDeck,handTotal,canSplit,createBlackjackGame,blackjackAction,blackjackAvailable} from '../src/blackjack-engine.js';
import {createBlackjackTable} from '../src/blackjack-ui.js';
const card=(rank,suit='♠')=>({rank,suit});
test('Deck uses four ordinary suits, 52 unique cards and standard ace scoring',()=>{
 assert.equal(makeDeck().length,52);
 assert.equal(new Set(makeDeck().map(c=>c.rank+c.suit)).size,52);
 assert.deepEqual(SUITS,['♠','♥','♦','♣']);
 assert.equal(RANKS.length,13);
 assert.equal(handTotal([card('A'),card('K')]).value,21);
 assert.equal(handTotal([card('A'),card('9'),card('8')]).value,18);
 assert.equal(handTotal([card('A'),card('6')]).soft,true);
 assert.equal(handTotal([card('10'),card('J'),card('2')]).bust,true);
});
test('Requested house rules: 3 seats, only 2 split hands, DAS, 3:2 BJ, S17, no insurance',()=>{
 assert.equal(BLACKJACK_RULES.seats,3);
 assert.equal(BLACKJACK_RULES.maxHandsPerSeat,2);
 assert.equal(BLACKJACK_RULES.doubleAfterSplit,true);
 assert.equal(BLACKJACK_RULES.insurance,false);
 assert.equal(BLACKJACK_RULES.resplit,false);
 assert.equal(BLACKJACK_RULES.blackjackPayout,1.5);
 assert.equal(BLACKJACK_RULES.dealerStandsSoft17,true);
 assert(canSplit([card('J'),card('K')]));
 assert(canSplit([card('A'),card('A')]));
 assert(!canSplit([card('8'),card('9')]));
});
test('Three seats enable separately, bet independently and advance turns clockwise',()=>{
 // active all seats; shoe order: 3 players then dealer, twice.
 const g=createBlackjackGame({shoe:[
  card('9'),card('7'),card('6'),card('5'),
  card('2'),card('4'),card('8'),card('9'),
  card('10'),card('7'),card('5'),card('2')
 ]});
 blackjackAction(g,'toggle-seat',{seat:0});
 blackjackAction(g,'toggle-seat',{seat:2});
 assert.equal(g.seats.filter(s=>s.enabled).length,3);
 blackjackAction(g,'wager',{seat:0,amount:10});
 blackjackAction(g,'wager',{seat:1,amount:20});
 blackjackAction(g,'wager',{seat:2,amount:30});
 assert(blackjackAction(g,'deal'));
 assert.equal(g.credits,9940);
 assert.equal(g.currentSeat,0);
 assert.equal(g.dealer.length,2);
 blackjackAction(g,'stand');assert.equal(g.currentSeat,1);
 blackjackAction(g,'stand');assert.equal(g.currentSeat,2);
 blackjackAction(g,'stand');assert.equal(g.phase,'finished');
 assert(g.seats.every(s=>s.hands[0].result));
});
test('Mixed ten-value initial cards split into two separate hands with equal additional wager and no resplit',()=>{
 const g=createBlackjackGame({shoe:[
  card('J'),card('6'),card('K'),card('8'),
  card('4'),card('3'),card('2'),card('5'),card('10'),card('3')
 ]});
 assert(blackjackAction(g,'deal'));
 assert.equal(g.credits,9975);
 assert(blackjackAvailable(g).includes('split'));
 assert(blackjackAction(g,'split'));
 assert.equal(g.credits,9950);
 assert.equal(g.seats[1].hands.length,2);
 assert.deepEqual(g.seats[1].hands.map(h=>h.cards.map(c=>c.rank)),[['J','4'],['K','3']]);
 assert(!blackjackAvailable(g).includes('split'));
 blackjackAction(g,'stand');
 assert.equal(g.currentHand,1);
 assert(blackjackAvailable(g).includes('double'));
 blackjackAction(g,'double');
 assert.equal(g.seats[1].hands[1].bet,50);
 assert.equal(g.credits>=0,true);
 assert.equal(g.phase,'finished');
 assert.deepEqual(g.seats[1].hands.map(h=>h.done),[true,true]);
});
test('Split aces get one new card on each and automatically finish with exactly 2 cards',()=>{
 const g=createBlackjackGame({shoe:[card('A'),card('6'),card('A'),card('9'),card('K'),card('5'),card('2')]});
 blackjackAction(g,'deal');assert(blackjackAvailable(g).includes('split'));
 assert(blackjackAction(g,'split'));
 assert.equal(g.phase,'finished');
 assert.deepEqual(g.seats[1].hands.map(h=>h.cards.length),[2,2]);
 assert(g.seats[1].hands.every(h=>h.splitAces&&h.done));
 assert(!blackjackAvailable(g).includes('hit'));
});
test('Natural blackjack pays 3:2 profit and returns stake, split 21 does not',()=>{
 const g=createBlackjackGame({shoe:[card('A'),card('9'),card('K'),card('7')]});
 blackjackAction(g,'deal');
 assert.equal(g.phase,'finished');
 assert.equal(g.seats[1].hands[0].result,'BLACKJACK');
 assert.equal(g.seats[1].hands[0].return,62.5);
 assert.equal(g.credits,10037.5);
});
test('Dealer stands on soft 17; win/loss/push results each settle independently',()=>{
 const g=createBlackjackGame({shoe:[card('10'),card('A'),card('8'),card('6'),card('5')]});
 blackjackAction(g,'deal');
 blackjackAction(g,'stand');
 assert.equal(g.phase,'finished');
 assert.equal(g.dealer.length,2);
 assert.equal(handTotal(g.dealer).value,17);
 assert.equal(g.seats[1].hands[0].result,'WIN');
});
test('Practice table displays 3 seats, card back, all actions and credit-only status',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createBlackjackTable(document,{shoe:[card('8'),card('6'),card('8'),card('9'),card('4'),card('3'),card('7'),card('5')]});
 document.body.append(root);
 assert.equal(root.dataset.practiceGame,'blackjack');
 assert.equal(root.querySelectorAll('.bj-seat').length,3);
 assert.equal(root.querySelectorAll('.bj-chip').length,5);
 assert.match(root.textContent,/NO INSURANCE/);
 root.querySelector('.bj-seat[data-seat="0"] .bj-seat-toggle').click();
 assert.equal(root.querySelectorAll('.bj-seat-enabled').length,2);
 root.querySelector('.bj-button-deal').click();
 assert(root.querySelector('.bj-dealer .bj-card-back'));
 assert(root.querySelector('.bj-button-double'));
 assert(root.querySelector('.bj-button-split'));
 const css=readFileSync(new URL('../src/blackjack.css',import.meta.url),'utf8');
 assert(css.includes('red-felt-casino.svg'));
 assert(css.includes('card-back.svg'));
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert(main.includes("active.id==='blackjack'?createBlackjackTable(document)"));
 root.stopAnimation();
});
