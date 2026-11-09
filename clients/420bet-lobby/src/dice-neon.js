import {initial,next} from './practice-engine.js';
// Racket's Loaded Dice is presentation only. The existing practice engine resolves every roll.
// Never derive, replace, or bias the simulated outcome using this character layer.
const LINES={
  idle:['The house always wins. Unless Racket built it.'],
  win:['Okay, you\'re definitely cheating.','Don\'t spend it all in one dumpster.','That was supposed to be MY garbage.'],
  lose:['I never said I was good at math.','Creatively calibrated!','That\'s the way the coffee can crumbles.'],
  streakWin:['Alright! I demand a recount!'],
  streakLose:['This stupid can is cursed.','I\'m filing a complaint with myself.'],
  longshot:['Oh, this is gonna be spectacularly stupid.']
};
export function racketTemper(rolls){
 const recent=rolls.slice(0,5),wins=recent.filter(r=>r.win).length;
 return Math.max(8,Math.min(100,35+recent.length*5+(wins-(recent.length-wins))*12));
}
export function racketLine(rolls,chance){
 if(!rolls.length)return LINES.idle[0];
 const row=rolls[0],streak=rolls.slice(0,5);
 if(streak.length===5&&streak.every(r=>r.win))return LINES.streakWin[0];
 if(streak.length===5&&streak.every(r=>!r.win))return LINES.streakLose[(rolls.length-1)%LINES.streakLose.length];
 if(chance<=5&&row.win)return LINES.longshot[0];
 const pool=row.win?LINES.win:LINES.lose;
 return pool[(rolls.length-1)%pool.length];
}
export function createNeonDice(doc=globalThis.document){
 let state=initial('dice');const rolls=[];
 const root=doc.createElement('section');root.className='neon-dice-page racket-dice practice';root.dataset.practiceGame='dice';
 const el=(tag,cls,txt)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
 const chance=()=>((state.choice==='under'?state.threshold:10000-state.threshold)/100);
 const render=()=>{
  root.replaceChildren();
  const hero=el('header','nd-hero racket-hero');
  const art=el('div','nd-dice-art racket-character');art.setAttribute('aria-hidden','true');art.append(el('span','racket-face','🦝'),el('span','racket-can','🥫'));hero.append(art);
  const intro=el('div','nd-intro');intro.append(el('div','nd-kicker','420BET ORIGINALS • MAD BUDS'),el('h1','','RACKET\'S LOADED DICE'),el('p','','“They\'re not loaded. They\'re creatively calibrated.”'));hero.append(intro);
  hero.append(el('div','nd-mode','✦ PRACTICE MODE · NO WALLET · NO WAGERS'));root.append(hero);
  const board=el('div','nd-board racket-board'),left=el('div','nd-controls'),right=el('div','nd-result racket-result');
  const toggle=el('div','nd-toggle racket-toggle');
  for(const [key,label] of [['under','↓ ROLL UNDER'],['over','↑ ROLL OVER']]){const btn=el('button',state.choice===key?'nd-choice active':'nd-choice',label);btn.type='button';btn.setAttribute('aria-pressed',String(state.choice===key));btn.addEventListener('click',()=>{state=next(state,{type:'choice',value:key});render();});toggle.append(btn);}left.append(toggle);
  const thresholdLabel=el('label','nd-threshold-label','PICK YOUR POISON · THRESHOLD');thresholdLabel.setAttribute('for','nd-threshold');
  const thresholdValue=el('output','nd-threshold-number',state.threshold.toLocaleString('en-US'));left.append(thresholdLabel,thresholdValue);
  const range=el('input','nd-slider');range.id='nd-threshold';range.type='range';range.min='1';range.max='9999';range.step='1';range.value=String(state.threshold);range.setAttribute('aria-label','Dice threshold');
  range.addEventListener('input',()=>{state=next(state,{type:'threshold',value:range.value});thresholdValue.textContent=state.threshold.toLocaleString('en-US');const chanceNumber=left.querySelector('.nd-chance-number');if(chanceNumber)chanceNumber.textContent=chance().toFixed(2)+'%';});left.append(range);
  const ends=el('div','nd-range-ends');ends.append(el('span','','0000'),el('span','','9999'));left.append(ends);
  const stats=el('div','nd-stats');const chanceBox=el('div','nd-stat');chanceBox.append(el('span','','◎ HOW STUPID IS THIS BET?'),el('strong','nd-chance-number',chance().toFixed(2)+'%'));stats.append(chanceBox);
  const rewards=el('div','nd-stat');rewards.append(el('span','','✦ POTENTIAL HAUL'),el('strong','','Bragging rights'));stats.append(rewards);left.append(stats);
  const roll=el('button','nd-roll racket-roll','🥫 SHAKE THE CAN! · Roll practice dice');roll.type='button';
  roll.addEventListener('click',()=>{state=next(state,{type:'play'});rolls.unshift({value:state.result[0],win:state.message.includes('winning side')});if(rolls.length>10)rolls.pop();render();});left.append(roll);
  const temp=racketTemper(rolls);
  const meter=el('div','racket-temper');meter.append(el('div','racket-temper-label','RACKET-O-METER • '+(temp>75?'ABSOLUTELY FERAL':temp>45?'GETTING IRRITATED':'SUSPICIOUSLY CALM')));
  const track=el('div','racket-temper-track'),fill=el('div','racket-temper-fill');fill.style.width=temp+'%';track.append(fill);meter.append(track);left.append(meter);
  right.append(el('div','nd-result-heading','THE CAN HAS SPOKEN'));
  const diceStage=el('div','racket-dice-stage');diceStage.setAttribute('aria-hidden','true');diceStage.append(el('span','racket-die','⚄'),el('span','racket-die','⚅'));right.append(diceStage);
  right.append(el('div','nd-big-number',state.result.length?String(state.result[0]).padStart(4,'0'):'—'));
  right.append(el('div',state.result.length?(rolls[0]?.win?'nd-win':'nd-lose'):'nd-wait',state.result.length?(rolls[0]?.win?'✓ WINNING SIDE':'× OTHER SIDE'):'AWAITING ROLL'));
  const dialogue=el('p','racket-dialogue',racketLine(rolls,chance()));dialogue.setAttribute('aria-live','polite');right.append(dialogue);
  right.append(el('p','nd-result-sub practice-message','Simulated result · no credits or payouts'));
  board.append(left,right);root.append(board);
  const bottom=el('div','nd-bottom');const history=el('div','nd-history');history.append(el('h2','','↻ RACKET\'S EVIDENCE LOCKER · RECENT ROLLS'));
  const pills=el('div','nd-pills');if(!rolls.length)pills.append(el('p','','The evidence locker is empty. Shake the can.'));
  for(const item of rolls)pills.append(el('span',item.win?'nd-pill win':'nd-pill lose',String(item.value).padStart(4,'0')+(item.win?' ✓':' ×')));history.append(pills);bottom.append(history);
  const rules=el('details','nd-rules');rules.append(el('summary','','ⓘ THE HOUSE RULES'),el('p','','Dice practice draws one simulated result from 0000 to 9999. Under wins below the selected threshold; Over wins at or above it. The character, dice artwork, temper meter and dialogue never affect the result. Real games use separately qualified contracts and cannot be activated here.'));bottom.append(rules);root.append(bottom);
  root.append(el('p','nd-disclaimer','Browser-only simulation. No funds. No wallet connection, actual wagers, canonical randomness, or payouts.'));
 };
 render();return root;
}
