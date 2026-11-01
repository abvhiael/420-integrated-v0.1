import {initial,next} from './practice-engine.js';
// Casino presentation only: this component never reads wallets or sends transactions.
export function createNeonDice(doc=globalThis.document){
 let state=initial('dice');const rolls=[];
 const root=doc.createElement('section');root.className='neon-dice-page';root.dataset.practiceGame='dice';
 const el=(tag,cls,txt)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
 const render=()=>{
  root.replaceChildren();
  const hero=el('div','nd-hero');const art=el('img','nd-dice-art');art.src='/assets/420bet/dice/neon-dice.png';art.alt='Two glowing emerald glass dice';art.loading='lazy';hero.append(art);
  const intro=el('div','nd-intro');intro.append(el('div','nd-kicker','420BET CASINO'),el('h1','','Dice'),el('p','','Pick a side. Set your threshold. Roll the neon.'));hero.append(intro);hero.append(el('div','nd-mode','✦ PRACTICE MODE · NO WAGERS'));root.append(hero);
  const board=el('div','nd-board'),left=el('div','nd-controls'),right=el('div','nd-result');
  const toggle=el('div','nd-toggle');for(const [key,label] of [['under','Roll Under ↓'],['over','Roll Over ↑']]){const btn=el('button',state.choice===key?'nd-choice active':'nd-choice',label);btn.type='button';btn.setAttribute('aria-pressed',String(state.choice===key));btn.addEventListener('click',()=>{state=next(state,{type:'choice',value:key});render();});toggle.append(btn);}left.append(toggle);
  const thresholdLabel=el('label','nd-threshold-label','Threshold');thresholdLabel.setAttribute('for','nd-threshold');const thresholdValue=el('output','nd-threshold-number',state.threshold.toLocaleString('en-US'));left.append(thresholdLabel,thresholdValue);
  const range=el('input','nd-slider');range.id='nd-threshold';range.type='range';range.min='1';range.max='9999';range.step='1';range.value=String(state.threshold);range.setAttribute('aria-label','Dice threshold');range.addEventListener('input',()=>{state=next(state,{type:'threshold',value:range.value});thresholdValue.textContent=state.threshold.toLocaleString('en-US');const chance=left.querySelector('.nd-chance-number');if(chance)chance.textContent=((state.choice==='under'?state.threshold:10000-state.threshold)/100).toFixed(2)+'%';});left.append(range);
  const ends=el('div','nd-range-ends');ends.append(el('span','','0000'),el('span','','9999'));left.append(ends);
  const stats=el('div','nd-stats');const chance=el('div','nd-stat');chance.append(el('span','','◎  WIN CHANCE'),el('strong','nd-chance-number',((state.choice==='under'?state.threshold:10000-state.threshold)/100).toFixed(2)+'%'));stats.append(chance);const note=el('div','nd-stat');note.append(el('span','','✦  REWARDS'),el('strong','','Practice only'));stats.append(note);left.append(stats);
  const roll=el('button','nd-roll','✦  ROLL PRACTICE DICE');roll.type='button';roll.addEventListener('click',()=>{state=next(state,{type:'play'});rolls.unshift({value:state.result[0],win:state.message.includes('winning side')});if(rolls.length>10)rolls.pop();render();});left.append(roll);
  right.append(el('div','nd-result-heading','LAST PRACTICE ROLL'));right.append(el('div','nd-big-number',state.result.length?String(state.result[0]).padStart(4,'0'):'—'));right.append(el('div',state.result.length?(rolls[0]?.win?'nd-win':'nd-lose'):'nd-wait',state.result.length?(rolls[0]?.win?'✓ WINNING SIDE':'× OTHER SIDE'):'AWAITING ROLL'));right.append(el('p','nd-result-sub','Simulated result · no credits or payouts'));
  board.append(left,right);root.append(board);
  const bottom=el('div','nd-bottom');const history=el('div','nd-history');history.append(el('h2','','↻ Recent Practice Rolls'));const pills=el('div','nd-pills');if(!rolls.length)pills.append(el('p','','Your simulated rolls will appear here.'));for(const item of rolls)pills.append(el('span',item.win?'nd-pill win':'nd-pill lose',String(item.value).padStart(4,'0')+(item.win?' ✓':' ×')));history.append(pills);bottom.append(history);const rules=el('details','nd-rules');rules.append(el('summary','','ⓘ Game Rules & Info'),el('p','','Dice practice draws one simulated result from 0000 to 9999. Under wins below the selected threshold; Over wins at or above it. Real games use separately qualified contracts and cannot be activated here.'));bottom.append(rules);root.append(bottom);
  root.append(el('p','nd-disclaimer','Browser-only simulation. No wallet connection, money, actual wagers, canonical randomness, or payouts.'));
 };
 render();return root;
}
