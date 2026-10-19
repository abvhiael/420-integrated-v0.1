import test from 'node:test';
import assert from 'node:assert/strict';
import {rank5,rank7} from './nlhe-replay.mjs';
import {independentFive,independentSeven} from './nlhe-reference.mjs';
// Seeded data is deterministic and reproducible in GitHub Actions.
let seed=0x420ca55;
function draw(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
function sample(count){const deck=Array.from({length:52},(_,i)=>i);for(let i=51;i>0;i--){const j=draw(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}return deck.slice(0,count);}
test('independently implemented five-card evaluator agrees across 5000 reproducible deals',()=>{
 for(let i=0;i<5000;i++){const cards=sample(5);assert.deepEqual(rank5(cards),independentFive(cards),JSON.stringify({i,cards}));}
});
test('independently implemented seven-card evaluator agrees across 1500 reproducible deals',()=>{
 for(let i=0;i<1500;i++){const cards=sample(7);assert.deepEqual(rank7(cards),independentSeven(cards),JSON.stringify({i,cards}));}
});
test('all ace-low wheels and straight flushes agree',()=>{
 const cases=[[12,0,1,2,3],[12,13,27,41,3],[12,11,10,9,8],[0,13,26,39,1]];
 for(const cards of cases)assert.deepEqual(rank5(cards),independentFive(cards));
});
