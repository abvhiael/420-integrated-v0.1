import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createNeonDice,racketLine,racketTemper} from '../src/dice-neon.js';
import {initial,next} from '../src/practice-engine.js';
test('Mad Buds dice preserves engine range and exact roll-over/under boundaries',()=>{
 for(const threshold of [1,420,5000,9999]){
  for(const choice of ['under','over']){
   const s=next(next(initial('dice'),{type:'threshold',value:threshold}),{type:'choice',value:choice});
   for(const outcome of [0,threshold-1,threshold,9999]){
    const played=next(s,{type:'play'},()=>outcome/10000);
    assert.equal(played.result[0],outcome);
    assert.equal(played.message.includes('winning side'),choice==='under'?outcome<threshold:outcome>=threshold);
   }
  }
 }
});
test('Racket uses presentation-only reactions and accessible practice UI',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createNeonDice(document);
 assert.equal(root.dataset.practiceGame,'dice');
 assert.match(root.textContent,/RACKET'S LOADED DICE/);
 assert.match(root.textContent,/NO WALLET/);
 assert.equal(root.querySelectorAll('.nd-choice').length,2);
 assert(root.querySelector('.racket-temper-fill'));
 assert(root.querySelector('.racket-dialogue'));
 assert.equal(root.querySelector('.nd-big-number').textContent,'—');
 for(let i=0;i<5;i++)root.querySelector('.nd-roll').dispatchEvent(new window.Event('click'));
 assert.match(root.querySelector('.nd-big-number').textContent,/^\d{4}$/);
 assert.equal(root.querySelectorAll('.nd-pill').length,5);
 assert.match(root.textContent,/No wallet connection/);
});
test('Racket meter and dialogue are deterministic derived decorations',()=>{
 assert.equal(racketTemper([]),35);
 assert(racketTemper([{win:true}])>racketTemper([{win:false}]));
 assert.match(racketLine([]),/house always wins/);
 assert.match(racketLine(Array(5).fill({win:true}),50),/recount/);
 assert.match(racketLine(Array(5).fill({win:false}),50),/cursed/);
});
