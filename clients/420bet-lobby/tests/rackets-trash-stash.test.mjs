import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {LINES,ART,JARS,PAY,spinBoard,evaluate,createRacketsTrashStash,MAX_WIN} from '../src/rackets-trash-stash.js';

test('Racket has 20 valid complete payline paths and all uploaded reel art',()=>{
 assert.equal(LINES.length,20);
 for(const line of LINES){assert.equal(line.length,5);assert.ok(line.every(y=>Number.isInteger(y)&&y>=0&&y<3));}
 for(const key of ['RACKET','WILD','BONUS','BLUE05','BLUE075','PURPLE1','PURPLE15','RED25','RED5','TRASH','PIZZA','LIGHTER','GLOVE','SEEDS','BINOCULARS','COOLER','MUSHROOM','A','K','Q','J','TEN','NINE'])assert.ok(ART[key],key);
 assert.deepEqual(Object.values(JARS),[.5,.75,1,1.5,2.5,5]);
});
test('Base spins keep bonus symbols to at most one per reel and have no wilds',()=>{
 const board=spinBoard('base',()=>.999);
 assert.equal(board.length,5);
 for(const reel of board){assert.equal(reel.length,3);assert.ok(reel.filter(x=>x==='BONUS').length<=1);assert.ok(!reel.includes('WILD'));}
});
test('Three separate bonus reels award ten spins, and jar prizes pay their sum',()=>{
 const board=Array.from({length:5},()=>['A','K','Q']);
 board[0][0]='BONUS';board[1][2]='BONUS';board[2][1]='BONUS';
 assert.equal(evaluate(board,2).trigger,10);
 board[3][1]='BONUS';assert.equal(evaluate(board,2).trigger,15);
 board[4][1]='BONUS';assert.equal(evaluate(board,2).trigger,20);
 const jars=Array.from({length:5},()=>['Q','A','J']);
 jars[0][0]='BLUE05';jars[1][0]='PURPLE1';jars[2][0]='RED25';
 const result=evaluate(jars,2);
 assert.ok(result.wins.some(w=>w.kind==='prize'&&w.line===2&&w.amount===8));
});
test('Winning Wilds collect prize jars on reels 2 through 5 in free spins',()=>{
 const board=Array.from({length:5},()=>['Q','Q','Q']);
 board[0][0]='WILD';board[1][0]='RACKET';board[2][0]='RACKET';
 board[1][2]='BLUE075';board[2][2]='PURPLE15';board[3][2]='RED5';
 const result=evaluate(board,2,'free',3);
 assert.ok(result.qualifyingWilds>=1);
 assert.ok(result.collection>=(.75+1.5+5)*2*3);
 assert.ok(result.total<=MAX_WIN*2);
});
test('Racket game renders independent 5x3 reels, payout panel, bonus triggers, info and back button',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createRacketsTrashStash(document,{rng:()=>.34});
 assert.equal(root.dataset.practiceGame,'rackets-trash-stash');
 assert.equal(root.querySelectorAll('.rts-reel').length,5);
 assert.equal(root.querySelectorAll('.rts-cell img').length,15);
 assert.equal(root.querySelectorAll('.rts-payout-table tr').length,1+Object.keys(PAY).length);
 assert.match(root.textContent,/BONUS TRIGGERS/);
 const info=[...root.querySelectorAll('button')].find(x=>x.textContent==='INFO');
 info.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.querySelectorAll('.rts-payline-mini').length,20);
 assert.match(root.textContent,/BACK TO GAME/);
 root.querySelector('.rts-back').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.querySelectorAll('.rts-reel').length,5);
 root.stopAnimation();
});

test('Bonus Tests exposes all seven feature scenarios and three bonus symbols start 10 free spins without debit',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createRacketsTrashStash(document,{rng:()=>.35});
 const tap=(label)=>{const b=[...root.querySelectorAll('button')].find(x=>x.textContent.trim()===label);assert.ok(b,label);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
 const initial=root.getGameState().balance;
 tap('BONUS TESTS');
 assert.equal(root.querySelectorAll('.rts-test-choice').length,7);
 tap('3 BONUS · 10 FREE SPINS');
 const state=root.getGameState();
 assert.equal(state.freeLeft,10);
 assert.equal(state.balance,initial);
 assert.equal(state.testScenario,'three');
 assert.equal(state.board.filter(reel=>reel.includes('BONUS')).length,3);
 root.stopAnimation();
});
test('Bonus Tests can select multiplier tiers and prize-collection demo',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createRacketsTrashStash(document,{rng:()=>.35});
 const tap=(label)=>{const b=[...root.querySelectorAll('button')].find(x=>x.textContent.trim()===label);assert.ok(b,label);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
 tap('BONUS TESTS');tap('RETRIGGER 3 · ×10');
 assert.equal(root.getGameState().multiplier,10);
 assert.equal(root.getGameState().retriggers,3);
 assert.equal(root.getGameState().freeLeft,10);
 root.stopAnimation();
 const root2=createRacketsTrashStash(document,{rng:()=>.35});
 const tap2=(label)=>{const b=[...root2.querySelectorAll('button')].find(x=>x.textContent.trim()===label);assert.ok(b,label);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
 tap2('BONUS TESTS');tap2('WILD PRIZE COLLECTION');
 assert.equal(root2.getGameState().testScenario,'collection');
 assert.equal(root2.getGameState().freeLeft,10);
 root2.stopAnimation();
});
