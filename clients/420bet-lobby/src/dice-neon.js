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
const ASSET='/assets/420bet/dice/rackets-loaded-dice/';
const asset=(folder,file)=>ASSET+folder+'/'+file;
const meterStage=value=>Math.max(0,Math.min(4,Math.floor(value/20)));
export function createNeonDice(doc=globalThis.document){
 let state=initial('dice');const rolls=[];
 const root=doc.createElement('section');root.className='neon-dice-page racket-dice practice';root.dataset.practiceGame='dice';
 const el=(tag,cls,txt)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
 const chance=()=>((state.choice==='under'?state.threshold:10000-state.threshold)/100);
 const artImage=(cls,folder,file,alt)=>{const img=el('img',cls);img.src=asset(folder,file);img.alt=alt;img.loading='eager';img.decoding='async';return img;};
 const render=()=>{
  root.replaceChildren();
  const hero=el('header','nd-hero racket-hero');
  const art=el('div','nd-dice-art racket-character');art.append(artImage('racket-character-png','characters',rolls.length?(rolls[0].win?(rolls.slice(0,5).length===5&&rolls.slice(0,5).every(r=>r.win)?'character_racket_laughing_win.png':'character_racket_pointing_explaining.png'):(rolls.slice(0,5).length===5&&rolls.slice(0,5).every(r=>!r.win)?'character_racket_furious_feral.png':'character_racket_annoyed_loss.png')):'character_racket_idle_smug.png','Racket the raccoon reacts to the last practice roll'));;
  const intro=el('div','nd-intro');const brands=el('div','racket-brands');brands.append(artImage('racket-brand-logo','logos','brand_420bet_originals.png','420Bet Originals'),artImage('racket-brand-logo','logos','brand_mad_buds.png','Mad Buds'));intro.append(brands);intro.append(el('p','','“They\'re not loaded. They\'re creatively calibrated.”'));hero.append(intro);
  const mode=el('div','nd-mode','✦ PRACTICE MODE · NO WALLET · NO WAGERS');mode.style.backgroundImage="url('"+asset('ui','ui_practice_mode_toggle.png')+"')";hero.append(mode);root.append(hero);
  const board=el('div','nd-board racket-board'),left=el('div','nd-controls'),right=el('div','nd-result racket-result');
 const scene=el('div','racket-scene');const title=el('h1','racket-scene-title');title.append(artImage('racket-title-png','logos','logo_rackets_loaded_dice.png','Racket\'s Loaded Dice'));const machine=el('div','racket-machine');machine.append(artImage('racket-machine-png','machine','machine_full_dice_rig.png','Racket\'s homemade coffee-can dice machine'));scene.append(title,art,machine);board.append(scene);
  const toggle=el('div','nd-toggle racket-toggle');
  for(const [key,label] of [['under','BET UNDER ↓'],['over','BET OVER ↑']]){const btn=el('button',state.choice===key?'nd-choice active':'nd-choice',label);btn.type='button';btn.setAttribute('aria-pressed',String(state.choice===key));btn.addEventListener('click',()=>{state=next(state,{type:'choice',value:key});render();});toggle.append(btn);}left.append(toggle);
  const thresholdLabel=el('label','nd-threshold-label','PICK YOUR POISON · THRESHOLD');thresholdLabel.setAttribute('for','nd-threshold');
  const thresholdValue=el('output','nd-threshold-number',state.threshold.toLocaleString('en-US'));thresholdValue.setAttribute('for','nd-threshold');const sliderArt=el('div','racket-slider-art');sliderArt.append(thresholdValue);left.append(thresholdLabel,sliderArt);
  const range=el('input','nd-slider');range.id='nd-threshold';range.type='range';range.min='1';range.max='9999';range.step='1';range.value=String(state.threshold);range.setAttribute('aria-label','Dice threshold');range.setAttribute('aria-valuetext',state.threshold.toLocaleString('en-US'));
  range.addEventListener('input',()=>{state=next(state,{type:'threshold',value:range.value});thresholdValue.textContent=state.threshold.toLocaleString('en-US');range.setAttribute('aria-valuetext',state.threshold.toLocaleString('en-US'));range.style.setProperty('--racket-range-progress',((state.threshold-1)/9998*100).toFixed(2)+'%');const chanceNumber=left.querySelector('.nd-chance-number');if(chanceNumber)chanceNumber.textContent=chance().toFixed(2)+'%';});range.style.setProperty('--racket-range-progress',((state.threshold-1)/9998*100).toFixed(2)+'%');sliderArt.append(range);
  const ends=el('div','nd-range-ends');ends.append(el('span','','0000'),el('span','','9999'));left.append(ends);
  const stats=el('div','nd-stats');const chanceBox=el('div','nd-stat racket-win-chance');chanceBox.style.backgroundImage="url('"+asset('ui','ui_win_chance_panel_blank.png')+"')";chanceBox.append(el('span','racket-hidden-label','WIN CHANCE'),el('strong','nd-chance-number',chance().toFixed(2)+'%'));stats.append(chanceBox);
  const rewards=el('div','nd-stat racket-potential-haul');rewards.style.backgroundImage="url('"+asset('ui','ui_potential_haul_panel_blank.png')+"')";rewards.append(el('span','racket-hidden-label','POTENTIAL HAUL'),el('strong','','Practice only'));stats.append(rewards);left.append(stats);
  const roll=el('button','nd-roll racket-roll','SHAKE THE CAN! · Roll practice dice');roll.type='button';roll.style.backgroundImage="url('"+asset('ui','ui_shake_the_can_button.png')+"')";
  roll.addEventListener('click',()=>{state=next(state,{type:'play'});rolls.unshift({value:state.result[0],win:state.message.includes('winning side')});if(rolls.length>10)rolls.pop();render();});left.append(roll);
  const temp=racketTemper(rolls);
  const meter=el('div','racket-temper');meter.append(artImage('racket-meter-png','ui','ui_racketometer_stage_'+meterStage(temp)+'_'+['empty','low','medium','high','full'][meterStage(temp)]+'.png','Racket-O-Meter level '+(meterStage(temp)+1)+' of 5'));meter.append(el('div','racket-temper-label','RACKET-O-METER • '+(temp>75?'ABSOLUTELY FERAL':temp>45?'GETTING IRRITATED':'SUSPICIOUSLY CALM')));
  const track=el('div','racket-temper-track'),fill=el('div','racket-temper-fill');fill.style.width=temp+'%';track.append(fill);meter.append(track);left.append(meter);
  right.append(el('div','nd-result-heading','THE CAN HAS SPOKEN'));
  const diceStage=el('div','racket-dice-stage');diceStage.append(artImage('racket-dice-png','icons','icon_dice_pair.png','Decorative dice'));right.append(diceStage);
  const resultDisplay=el('div','racket-result-display');resultDisplay.style.backgroundImage="url('"+asset('ui','ui_roll_result_panel_blank.png')+"')";resultDisplay.append(el('div','nd-big-number',state.result.length?String(state.result[0]).padStart(4,'0'):'—'));right.append(resultDisplay);
  right.append(el('div',state.result.length?(rolls[0]?.win?'nd-win':'nd-lose'):'nd-wait',state.result.length?(rolls[0]?.win?'✓ WINNING SIDE':'× OTHER SIDE'):'AWAITING ROLL'));
  const dialogue=el('p','racket-dialogue',racketLine(rolls,chance()));dialogue.setAttribute('aria-live','polite');right.append(dialogue);
  right.append(el('p','nd-result-sub practice-message','Simulated result · no credits or payouts'));
  board.append(left,right);root.append(board);
  const bottom=el('div','nd-bottom');const history=el('div','nd-history racket-history');history.style.backgroundImage="url('"+asset('ui','ui_evidence_locker_blank.png')+"')";history.append(el('h2','','↻ RACKET\'S EVIDENCE LOCKER · RECENT ROLLS'));
  const pills=el('div','nd-pills');if(!rolls.length)pills.append(el('p','','The evidence locker is empty. Shake the can.'));
  for(const item of rolls)pills.append(el('span',item.win?'nd-pill win':'nd-pill lose',String(item.value).padStart(4,'0')+(item.win?' ✓':' ×')));history.append(pills);bottom.append(history);
  const rules=el('details','nd-rules');rules.append(el('summary','','ⓘ THE HOUSE RULES'),el('p','','Dice practice draws one simulated result from 0000 to 9999. Under wins below the selected threshold; Over wins at or above it. The character, dice artwork, temper meter and dialogue never affect the result. Real games use separately qualified contracts and cannot be activated here.'));bottom.append(rules);root.append(bottom);
  root.append(el('p','nd-disclaimer','Browser-only simulation. No funds. No wallet connection, actual wagers, canonical randomness, or payouts.'));
 };
 render();return root;
}
