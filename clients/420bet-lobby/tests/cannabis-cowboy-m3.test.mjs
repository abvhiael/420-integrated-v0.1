import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {COLUMNS,ROWS,CELL_COUNT,BET_CHOICES,START_CREDITS,CLUSTER_PAYS,makeBoard,findClusters,dropAndRefill,resolveRound,createPracticeSession,playPracticeRound,weightedSymbol,clusterPayout} from '../src/cannabis-cowboy-engine.js';
import {createCannabisCowboyPractice} from '../src/cannabis-cowboy-game.js';
import {SLOT_MACHINES} from '../src/slots-lobby.js';

const seeded=(initial=123456789)=>{let state=initial>>>0;return ()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296)};
const patterned=()=>Array.from({length:CELL_COUNT},(_,i)=>(Math.floor(i/COLUMNS)*3+i%COLUMNS)%8);

test('48 positions, orthogonal only, diagonal contact not counted and clusters deterministic',()=>{
 assert.equal(COLUMNS,6);assert.equal(ROWS,8);assert.equal(CELL_COUNT,48);
 let board=patterned();
 assert.deepEqual(findClusters(board),[]);
 // Diagonal group does not qualify.
 for(const i of [0,7,14,21,28])board[i]=0;
 assert.deepEqual(findClusters(board),[]);
 board=patterned();
 const indices=[0,1,6,7,12];
 for(const i of indices)board[i]=0;
 let wins=findClusters(board);
 assert.equal(wins.length,1);
 assert.deepEqual(wins[0].positions,indices);
 assert.equal(wins[0].symbol,0);
 const mirror=findClusters(board);
 assert.deepEqual(mirror,wins);
});
test('paytable brackets are total-spin multiples in integer demo credits',()=>{
 assert.equal(CLUSTER_PAYS.length,8);
 assert.equal(clusterPayout(0,5,20),8);
 assert.equal(clusterPayout(0,7,20),16);
 assert.equal(clusterPayout(7,20,20),800);
 assert.throws(()=>clusterPayout(0,4,20));
 assert.throws(()=>clusterPayout(99,5,20));
});
test('gravity keeps survivor order and fills each cleared column from the top',()=>{
 const board=patterned(),removed=[0,6,12,24,30];
 const r=dropAndRefill(board,removed,()=>0.999);
 assert.equal(r.board.length,48);
 // Bottom-up survivor sequence must retain its order.
 const original=Array.from({length:ROWS},(_,k)=>board[(ROWS-1-k)*COLUMNS]).filter((_,j)=>!removed.includes((ROWS-1-j)*COLUMNS));
 const expected=[board[42],board[36],board[18]];
 assert.deepEqual([r.board[42],r.board[36],r.board[30]],[board[42],board[36],board[18]]);
 assert.equal(r.refills.length,removed.length);
 assert.throws(()=>dropAndRefill(board,[48],seeded(1)));
});
test('seeded resolver returns reproducible cascade ledger and does not mutate input',()=>{
 const board=patterned();
 for(const i of [0,1,6,7,12])board[i]=0;
 const original=board.slice();
 const a=resolveRound(board,20,seeded(17));
 const b=resolveRound(board,20,seeded(17));
 assert.deepEqual(a,b);
 assert.deepEqual(board,original);
 assert(a.steps.length>=1);
 assert(a.total>=0);
 assert.equal(a.steps.reduce((sum,step)=>sum+step.cascadeWin,0),a.total);
 for(const step of a.steps){
  assert.equal(step.before.length,CELL_COUNT);
  assert.equal(step.after.length,CELL_COUNT);
  assert.equal(step.fertile.length,CELL_COUNT);
  assert(step.clusters.every(cluster=>cluster.size>=5));
  assert.equal(new Set(step.removed).size,step.removed.length);
 }
 assert.deepEqual(findClusters(a.board),[]);
});
test('practice credits are debited once, winnings credited once, no wallet flows',()=>{
 let state=createPracticeSession({credits:1000,bet:20,rng:seeded(7)});
 const result=playPracticeRound(state,seeded(9));
 assert.equal(result.accepted,true);
 assert.equal(state.credits,1000,'immutable original state');
 assert.equal(result.state.credits,980+result.outcome.total);
 assert.equal(result.state.round,1);
 assert.equal(result.outcome.bet,20);
 assert.equal(result.state.board.length,48);
 const insufficient=playPracticeRound(createPracticeSession({credits:5,bet:20,rng:seeded(7)}),seeded(2));
 assert.equal(insufficient.accepted,false);
 assert.equal(insufficient.state.credits,5);
 assert.throws(()=>weightedSymbol(()=>1));
 assert.throws(()=>makeBoard(()=>NaN));
});
test('non-terminating cascades reject safely before committing a wager',()=>{
 const board=Array(CELL_COUNT).fill(0);
 assert.throws(()=>resolveRound(board,10,()=>0),/Cascade safety bound/);
 const state=createPracticeSession({credits:100,bet:10,board,rng:seeded(5)});
 assert.throws(()=>playPracticeRound(state,()=>0),/Cascade safety bound/);
 assert.equal(state.credits,100);
});
test('visual round controls cannot spin twice while cascade animation is running',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const tasks=[];
 const rng=seeded(593);
 const root=createCannabisCowboyPractice(document,{rng,credits:200,bet:20,setTimeout:fn=>{tasks.push(fn);return tasks.length;},clearTimeout:()=>{}});
 assert.equal(root.dataset.mode,'base-game-practice');
 assert.equal(root.querySelectorAll('.cc-cell').length,48);
 const spin=root.querySelector('.cc-spin');
 assert.equal(spin.disabled,false);
 const before=root.getPracticeState();
 spin.dispatchEvent(new window.Event('click'));
 const current=root.getPracticeState();
 assert.equal(current.round,1);
 assert.equal(current.busy,true);
 assert.equal(spin.disabled,true);
 spin.dispatchEvent(new window.Event('click'));
 assert.equal(root.getPracticeState().round,1,'no second round charged');
 assert.equal(current.credits, before.credits-before.bet+current.lastWin);
 let guard=0;
 while(tasks.length&&guard++<500)tasks.shift()();
 assert(guard<500);
 assert.equal(root.getPracticeState().busy,false);
 assert.equal(root.querySelector('.cc-readout strong').textContent,'20');
 root.stopAnimation();
});
test('lobby identifies Slot #4 as an independent base-game practice beta',()=>{
 assert.equal(SLOT_MACHINES[3].id,'cannabis-cowboy');
 assert.equal(SLOT_MACHINES[3].practiceBeta,true);
 assert.equal(SLOT_MACHINES[3].preview,undefined);
});
