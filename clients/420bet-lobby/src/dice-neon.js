import {initial,next} from './practice-engine.js';
import {initialRacketSession,settleRacketRoll,racketPotentialPayoutCents,formatRacketCredits,RACKET_STAKE_CENTS} from './racket-double-trouble.js';
// Racket's Loaded Dice reads authoritative practice roll outcomes; virtual credits and bonus never influence the dice RNG.
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
export function createNeonDice(doc=globalThis.document,random){
 let state=initial('dice');let virtual=initialRacketSession();const rolls=[];
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
  range.addEventListener('input',()=>{state=next(state,{type:'threshold',value:range.value});thresholdValue.textContent=state.threshold.toLocaleString('en-US');range.setAttribute('aria-valuetext',state.threshold.toLocaleString('en-US'));range.style.setProperty('--racket-range-progress',((state.threshold-1)/9998*100).toFixed(2)+'%');const chanceNumber=left.querySelector('.nd-chance-number');if(chanceNumber)chanceNumber.textContent=chance().toFixed(2)+'%';const potential=left.querySelector('.nd-potential-credits');if(potential)potential.textContent=formatRacketCredits(racketPotentialPayoutCents(state.choice,state.threshold,virtual.charge===100))+' credits';});range.style.setProperty('--racket-range-progress',((state.threshold-1)/9998*100).toFixed(2)+'%');sliderArt.append(range);
  const ends=el('div','nd-range-ends');ends.append(el('span','','0000'),el('span','','9999'));left.append(ends);
  const stats=el('div','nd-stats');const chanceBox=el('div','nd-stat racket-win-chance');chanceBox.style.backgroundImage="url('"+asset('ui','ui_win_chance_panel_blank.png')+"')";chanceBox.append(el('span','racket-hidden-label','WIN CHANCE'),el('strong','nd-chance-number',chance().toFixed(2)+'%'));stats.append(chanceBox);
  const rewards=el('div','nd-stat racket-potential-haul');rewards.style.backgroundImage="url('"+asset('ui','ui_potential_haul_panel_blank.png')+"')";const potential=el('strong','nd-potential-credits',formatRacketCredits(racketPotentialPayoutCents(state.choice,state.threshold,virtual.charge===100))+' credits');rewards.append(el('span','racket-hidden-label','POTENTIAL HAUL'),potential);stats.append(rewards);left.append(stats);
  const creditBar=el('div','racket-credit-bar');creditBar.append(el('span','racket-credit-balance','VIRTUAL CREDITS: '+formatRacketCredits(virtual.balanceCents)),el('span','racket-credit-stake','STAKE: '+formatRacketCredits(RACKET_STAKE_CENTS)));left.append(creditBar);
  if(virtual.balanceCents<RACKET_STAKE_CENTS){const restart=el('button','racket-credit-restart','RESET PRACTICE CREDITS');restart.type='button';restart.addEventListener('click',()=>{virtual=initialRacketSession();render();});left.append(restart);}
  const roll=el('button','nd-roll racket-roll','SHAKE THE CAN! · Roll practice dice');roll.type='button';roll.disabled=virtual.balanceCents<RACKET_STAKE_CENTS;roll.style.backgroundImage="url('"+asset('ui','ui_shake_the_can_button.png')+"')";
  roll.addEventListener('click',()=>{if(virtual.balanceCents<RACKET_STAKE_CENTS)return;const previous=state;state=next(state,{type:'play'},random);virtual=settleRacketRoll(virtual,{roll:state.result[0],choice:previous.choice,threshold:previous.threshold});rolls.unshift({value:state.result[0],win:virtual.lastWin,bonus:virtual.lastBonus});if(rolls.length>10)rolls.pop();render();});left.append(roll);
  const temp=virtual.charge;
  const meter=el('div',virtual.charge===100?'racket-temper double-trouble-ready':'racket-temper');meter.append(artImage('racket-meter-png','ui','ui_racketometer_stage_'+meterStage(temp)+'_'+['empty','low','medium','high','full'][meterStage(temp)]+'.png','Racket-O-Meter level '+(meterStage(temp)+1)+' of 5'));meter.append(el('div','racket-temper-label','RACKET-O-METER • '+(temp===100?'DOUBLE TROUBLE READY!':temp>=75?'ALMOST THERE!':temp>=40?'BUILDING CHAOS':'CHARGING UP')));
  const track=el('div','racket-temper-track'),fill=el('div','racket-temper-fill');fill.style.width=temp+'%';track.append(fill);meter.append(track);if(virtual.charge===100){const ready=el('div','racket-double-trouble-banner','⚡ DOUBLE TROUBLE READY! NEXT WIN PAYS 2× ⚡');ready.setAttribute('role','status');meter.append(ready);}scene.append(meter);
  right.append(el('div','nd-result-heading','THE CAN HAS SPOKEN'));
  const diceStage=el('div','racket-dice-stage');diceStage.append(artImage('racket-dice-png','icons','icon_dice_pair.png','Decorative dice'));right.append(diceStage);
  const resultDisplay=el('div','racket-result-display');resultDisplay.style.backgroundImage="url('"+asset('ui','ui_roll_result_panel_blank.png')+"')";resultDisplay.append(el('div','nd-big-number',state.result.length?String(state.result[0]).padStart(4,'0'):'—'));right.append(resultDisplay);
  right.append(el('div',state.result.length?(rolls[0]?.win?'nd-win':'nd-lose'):'nd-wait',state.result.length?(rolls[0]?.win?'✓ WINNING SIDE':'× OTHER SIDE'):'AWAITING ROLL'));if(virtual.lastBonus){const flash=el('div',virtual.lastWin?'racket-double-trouble-hit':'racket-double-trouble-miss',virtual.lastWin?'⚡ DOUBLE TROUBLE! 2× VIRTUAL PAYOUT!':'⚡ DOUBLE TROUBLE CONSUMED');flash.setAttribute('role','status');right.append(flash);}
  const dialogue=el('p','racket-dialogue',racketLine(rolls,chance()));dialogue.setAttribute('aria-live','polite');right.append(dialogue);
  const payoutLine=el('p','racket-virtual-payout',virtual.rounds?(virtual.lastBonus?(virtual.lastWin?'⚡ DOUBLE TROUBLE! 2× WIN · ':'⚡ DOUBLE TROUBLE MISSED · '):'')+(virtual.lastWin?'VIRTUAL RETURN +'+formatRacketCredits(virtual.lastPayoutCents):'NO VIRTUAL RETURN')+' · NET '+(virtual.lastNetCents>=0?'+':'')+formatRacketCredits(virtual.lastNetCents):'1,000.00 virtual credits to start · 10.00 per roll');payoutLine.setAttribute('aria-live','polite');right.append(payoutLine);
  right.append(el('p','nd-result-sub practice-message','Browser-only virtual credits · no wallet, funds or withdrawable winnings'));
  board.append(left,right);root.append(board);
  const bottom=el('div','nd-bottom');const history=el('div','nd-history racket-history');history.style.backgroundImage="url('"+asset('ui','ui_evidence_locker_blank.png')+"')";history.append(el('h2','','↻ RACKET\'S EVIDENCE LOCKER · RECENT ROLLS'));
  const pills=el('div','nd-pills');if(!rolls.length)pills.append(el('p','','The evidence locker is empty. Shake the can.'));
  for(const item of rolls)pills.append(el('span',item.win?'nd-pill win':'nd-pill lose',String(item.value).padStart(4,'0')+(item.bonus?' ⚡':item.win?' ✓':' ×')));history.append(pills);bottom.append(history);
  const rules=el('details','nd-rules');rules.append(el('summary','','ⓘ THE HOUSE RULES'),el('p','','Dice draws one simulated result from 0000 to 9999. Under wins below threshold; Over wins at or above it. Every roll costs 10.00 virtual credits; ordinary winning virtual returns are based on 96% divided by the exact win probability. The Racket-O-Meter charges 10% each roll, plus 5% for a win. Once full, the NEXT roll consumes Double Trouble: if it wins, the virtual credit return is doubled; otherwise no return. The meter resets to zero after either outcome. All numbers are browser-only practice: no funds, wagering, withdrawable prizes or change to the dice outcome engine.'));bottom.append(rules);root.append(bottom);
  root.append(el('p','nd-disclaimer','Browser-only simulated credits. No funds, real wagering, withdrawal, wallet connection or canonical random/settlement.'));
 };
 render();return root;
}
