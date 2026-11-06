import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {initialState,nextRound} from '../src/sin-city-engine.js';
import {makeSinCityBonusPreview,SIN_CITY_BONUS_PREVIEWS} from '../src/sin-city-bonus-preview.js';
import {createSinCityPractice} from '../src/sin-city-ui.js';

test('each QA scenario uses real visible reel strips and triggers its requested bonus',()=>{
 for(const preview of SIN_CITY_BONUS_PREVIEWS){
  const fixture=makeSinCityBonusPreview(preview.id,initialState());
  assert.equal(fixture.stops.length,5);
  assert.equal(fixture.board.filter(reel=>reel.includes(preview.symbol)).length,3);
  const result=nextRound(fixture.state,()=>.25,fixture.stops);
  if(preview.id==='puff')assert.equal(result.lastFeature,'puff');
  if(preview.id==='hotbox'){assert.equal(result.lastFeature,'hotbox-start');assert.equal(result.mode,'hotbox');assert.ok(result.locked.length>=3);}
  if(preview.id==='free'){assert.equal(result.lastFeature,'free-start');assert.equal(result.mode,'free');assert.equal(result.freeRemaining,8);}
  if(preview.id==='lowrider'){assert.equal(result.lastFeature,'lowrider');assert.ok(result.freeMultiplier>=2);assert.ok(result.freeMultiplier<=5);}
 }
});
test('bonus QA preview can be initialized with zero credits without charging real credits',()=>{
 const original={...initialState(),balance:0,stake:7};
 const preview=makeSinCityBonusPreview('hotbox',original);
 assert.ok(preview.state.balance>=preview.state.stake);
 assert.equal(original.balance,0);
 assert.equal(original.stake,7);
});
test('temporary tester shows four choices and restores original state on End Test',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createSinCityPractice(document,{rng:()=>.25});document.body.append(root);
 try{
  const panel=root.querySelector('.sc-qa-panel');
  assert.ok(panel);assert.equal(panel.querySelectorAll('option').length,4);
  const originalBalance=root.querySelector('.sc-metric strong').textContent;
  const click=label=>{
   const btn=[...root.querySelectorAll('button')].find(b=>b.textContent.includes(label));
   assert.ok(btn,'Missing '+label);btn.dispatchEvent(new window.Event('click',{bubbles:true}));
  };
  click('TEST SELECTED BONUS');
  assert.equal(root.getPresentationState().qaActive,true);
  assert.equal(root.getPresentationState().qaSelection,'puff');
  assert.match(root.textContent,/TEST MODE/);
  click('END BONUS TEST');
  assert.equal(root.getPresentationState().qaActive,false);
  assert.equal(root.getPresentationState().phase,'idle');
  assert.equal(root.querySelector('.sc-metric strong').textContent,originalBalance);
 }finally{root.stopAnimation();}
});
test('selector launches chosen feature and test mode remains active to manually advance free spins',async()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createSinCityPractice(document,{rng:()=>.25});document.body.append(root);
 try{
  const select=root.querySelector('.sc-qa-select');select.value='free';
  select.dispatchEvent(new window.Event('change',{bubbles:true}));
  root.querySelector('.sc-qa-button').dispatchEvent(new window.Event('click',{bubbles:true}));
  assert.equal(root.getPresentationState().qaSelection,'free');
  assert.equal(root.getPresentationState().qaActive,true);
  await new Promise(resolve=>setTimeout(resolve,3150));
  assert.equal(root.getPresentationState().mode,'free');
  assert.ok(root.getPresentationState().qaActive);
  const button=root.querySelector('.sc-spin');
  assert.match(button.textContent,/FREE SPIN/);
 }finally{root.stopAnimation();}
});
