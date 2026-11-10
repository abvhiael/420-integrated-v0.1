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
 assert(root.querySelector('.racket-scene .racket-scene-title .racket-title-png'));
 assert.equal(root.querySelector('.racket-hero h1'),null);
 assert.equal(root.querySelectorAll('.racket-scene-title').length,1);
 assert.match(root.textContent,/NO WALLET/);
 assert.equal(root.querySelectorAll('.nd-choice').length,2);
 assert(root.querySelector('.racket-temper-fill'));
 assert(root.querySelector('.racket-dialogue'));
 assert.equal(root.querySelector('.nd-big-number').textContent,'—');
 for(let i=0;i<5;i++)root.querySelector('.nd-roll').dispatchEvent(new window.Event('click'));
 assert.match(root.querySelector('.nd-big-number').textContent,/^\d{4}$/);
 assert.equal(root.querySelectorAll('.nd-pill').length,5);
 assert.match(root.textContent,/No funds, real wagering/);
});
test('Racket meter and dialogue are deterministic derived decorations',()=>{
 assert.equal(racketTemper([]),35);
 assert(racketTemper([{win:true}])>racketTemper([{win:false}]));
 assert.match(racketLine([]),/house always wins/);
 assert.match(racketLine(Array(5).fill({win:true}),50),/recount/);
 assert.match(racketLine(Array(5).fill({win:false}),50),/cursed/);
});

test('uploaded image paths are wired to the UI and numeric overlays come from the practice state',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createNeonDice(document);
 const base='/assets/420bet/dice/rackets-loaded-dice/';
 const images=[...root.querySelectorAll('img')];
 assert(images.some(img=>img.getAttribute('src')===base+'logos/logo_rackets_loaded_dice.png'));
 assert(images.some(img=>img.getAttribute('src')===base+'characters/character_racket_idle_smug.png'));
 assert(images.some(img=>img.getAttribute('src')===base+'machine/machine_full_dice_rig.png'));
 assert(images.some(img=>img.getAttribute('src')===base+'ui/ui_racketometer_stage_0_empty.png'));
 assert(root.querySelector('.racket-scene .racket-character-png'));
 assert(root.querySelector('.racket-scene .racket-machine-png'));
 assert(root.querySelector('.racket-scene .racket-temper .racket-meter-png'));
 assert.equal(root.querySelector('.nd-controls .racket-temper'),null);
 assert.equal(root.querySelector('.racket-slider-art input.nd-slider')?.getAttribute('type'),'range');
 assert.equal(root.querySelectorAll('.racket-toggle .nd-choice').length,2);
 assert.match(root.querySelector('.racket-toggle').textContent,/BET UNDER/);
 assert.match(root.querySelector('.racket-toggle').textContent,/BET OVER/);
 assert.match(root.querySelector('.racket-result-display').style.backgroundImage,/ui_roll_result_panel_blank/);
 assert.match(root.querySelector('.racket-win-chance').style.backgroundImage,/ui_win_chance_panel_blank/);
 assert.match(root.querySelector('.racket-potential-haul').style.backgroundImage,/ui_potential_haul_panel_blank/);
 assert.match(root.querySelector('.racket-history').style.backgroundImage,/ui_evidence_locker_blank/);
 assert.equal(root.querySelector('.nd-chance-number').textContent,'50.00%');
 const slider=root.querySelector('.nd-slider');
 slider.value='4200';
 slider.dispatchEvent(new window.Event('input'));
 assert.equal(root.querySelector('.nd-threshold-number').textContent,'4,200');
 assert.equal(root.querySelector('.nd-chance-number').textContent,'42.00%');
 assert.equal(root.querySelector('.nd-slider').getAttribute('aria-valuetext'),'4,200');
 assert.match(root.querySelector('.nd-slider').style.getPropertyValue('--racket-range-progress'),/41\.99|42\.00/);
 root.querySelectorAll('.nd-choice')[1].dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelectorAll('.nd-choice')[1].getAttribute('aria-pressed'),'true');
 assert.equal(root.querySelector('.nd-chance-number').textContent,'58.00%');
 root.querySelector('.nd-roll').dispatchEvent(new window.Event('click'));
 assert.match(root.querySelector('.nd-big-number').textContent,/^\d{4}$/);
 assert.equal(root.querySelectorAll('.racket-history .nd-pill').length,1);
 assert.match(root.textContent,/VIRTUAL CREDITS/);
});

test('Double Trouble UI exposes real virtual-credit values, charge and ready feedback',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createNeonDice(document);
 assert.match(root.querySelector('.racket-credit-balance').textContent,/1,000\\.00/);
 assert.match(root.querySelector('.racket-credit-stake').textContent,/10\\.00/);
 assert.match(root.querySelector('.nd-potential-credits').textContent,/19\\.20 credits/);
 assert.equal(root.querySelector('.racket-double-trouble-banner'),null);
 const roll=()=>root.querySelector('.nd-roll').dispatchEvent(new window.Event('click'));
 for(let i=0;i<10;i++)roll();
 // At least ten rolls, no matter the outcomes, fill the 100% meter.
 assert(root.querySelector('.double-trouble-ready'));
 assert(root.querySelector('.racket-double-trouble-banner'));
 assert.match(root.querySelector('.nd-potential-credits').textContent,/credits/);
 roll();
 assert.equal(root.querySelector('.double-trouble-ready'),null);
 assert(root.querySelector('.racket-double-trouble-hit')||root.querySelector('.racket-double-trouble-miss'));
 assert.match(root.querySelector('.racket-virtual-payout').textContent,/DOUBLE TROUBLE/);
});
