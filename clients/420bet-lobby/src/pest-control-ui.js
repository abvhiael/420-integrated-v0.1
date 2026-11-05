import {createPestControl,pestAction,payoutMultiplier,nextPickProbability,PC_RULES} from './pest-control-engine.js';
const el=(d,t,c='',txt)=>{const n=d.createElement(t);if(c)n.className=c;if(txt!==undefined)n.textContent=txt;return n;};
const money=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=n=>(n*100).toFixed(2)+'%';
const asset='/assets/420bet/pest-control/';
const hd=asset+'hd/';
const art=(doc,cls,filename,fallback)=>{const img=el(doc,'img',cls);img.src=hd+filename;img.alt='';img.decoding='async';img.draggable=false;if(fallback)img.addEventListener('error',()=>{img.src=fallback;});return img;};
const hazards=['spider-mites','aphids','powdery-mildew','bud-rot','fungus-gnats'];
const buddies={ready:'idle',active:'nervous',infested:'infested',harvest:'harvest',cancelled:'idle'};
export function createPestControlTable(doc=globalThis.document,options={}){
 const state=createPestControl(options),root=el(doc,'section','pc-game');
 root.dataset.practiceGame='pest-control';let showInfo=false;
 function button(label,cls,fn,disabled=false){const b=el(doc,'button',cls,label);b.type='button';b.disabled=disabled;b.addEventListener('click',fn);return b;}
 function stat(label,value,cls=''){const s=el(doc,'div','pc-stat '+cls);s.append(el(doc,'span','pc-stat-label',label),el(doc,'strong','',value));return s;}
 function render(){
  root.replaceChildren();
  const title=el(doc,'header','pc-title');
  const heading=el(doc,'div','pc-heading');const logo=el(doc,'img','pc-logo');logo.src=hd+'pest-control-logo.webp';logo.addEventListener('error',()=>{logo.src=asset+'logo-concept.webp';});logo.alt='420Bet Originals Pest Control — Buddy Bloom’s Grow Room';logo.decoding='async';heading.append(logo,el(doc,'h1','pc-visually-hidden','PEST CONTROL'),el(doc,'p','','PRACTICE ONLY · SAVE THE CROP!'));
  title.append(el(doc,'span','pc-brand-label','✦ 420BET ORIGINALS · PRACTICE ONLY'),stat('PRACTICE CREDITS',money(state.balance)));
  root.append(title);
  const layout=el(doc,'div','pc-layout'),left=el(doc,'aside','pc-side pc-left');
  left.append(heading);
  const mood=state.phase==='finished'?buddies[state.result]:state.phase==='active'&&state.picks.length?(nextPickProbability(state.hazards,state.picks.length)<0.65?'nervous':'happy'):buddies[state.phase];
  const mascot=el(doc,'div','pc-mascot pc-mood-'+mood);mascot.setAttribute('aria-label','Buddy Bloom '+mood);
  const portrait=el(doc,'img','pc-mascot-art');portrait.src=hd+'buddy-'+mood+'.webp';portrait.alt='Buddy Bloom, '+mood+' expression';portrait.addEventListener('error',()=>{portrait.src=asset+'buddy-bloom.svg';});mascot.append(portrait);
  const sayings={ready:'Let’s inspect these trays!',active:'Careful... pests could be hiding!',infested:'NOOO! The pests got in!',harvest:'CROP SAVED! Nice work!',cancelled:'We’ll grow another day!'};
  mascot.append(el(doc,'div','pc-speech',sayings[state.phase==='finished'?state.result:state.phase]));left.append(mascot);
  const settings=el(doc,'div','pc-settings');
  const adjustable=(label,v,min,max,onMinus,onPlus)=>{
   const group=el(doc,'div','pc-setting');group.append(el(doc,'label','',label));
   const controls=el(doc,'div','pc-stepper');const locked=state.phase==='active';
   controls.append(button('−','pc-adjust',onMinus,locked||v<=min),el(doc,'strong','',String(v)),button('+','pc-adjust',onPlus,locked||v>=max));
   group.append(controls);return group;
  };
  settings.append(adjustable('BET · PRACTICE CREDITS',state.bet,1,100,()=>{pestAction(state,'bet',state.bet-1);render()},()=>{pestAction(state,'bet',state.bet+1);render()}));
  settings.append(adjustable('HAZARDS · PESTS',state.hazards,1,24,()=>{pestAction(state,'hazards',state.hazards-1);render()},()=>{pestAction(state,'hazards',state.hazards+1);render()}));
  settings.append(el(doc,'div','pc-setting-note',(25-state.hazards)+' healthy trays · '+state.hazards+' hazards'));
  left.append(settings);
  const actions=el(doc,'div','pc-actions');
  if(state.phase==='active'){
   actions.append(button('🌿 HARVEST NOW','pc-primary pc-harvest',()=>{pestAction(state,'harvest');render()},!state.picks.length));
   actions.append(button('🎲 AUTO PICK ONE TRAY','pc-secondary',()=>{pestAction(state,'auto-pick');render()}));
   actions.append(button('CANCEL GROW','pc-secondary',()=>{pestAction(state,'cancel');render()},state.picks.length!==0));
  }else actions.append(button(state.phase==='finished'?'▶ NEW ROUND':'▶ START GROWING','pc-primary',()=>{pestAction(state,'start');render()},state.balance<state.bet));
  actions.append(button('+ 1,000 PRACTICE CREDITS','pc-secondary',()=>{pestAction(state,'refill');render()},state.phase==='active'));
  actions.append(button('ⓘ RULES & PAYOUTS','pc-secondary',()=>{showInfo=!showInfo;render()}));
  left.append(actions);
  const center=el(doc,'main','pc-center');center.append(el(doc,'div','pc-board-title','HYDROPONIC GROW TRAYS'));
  const board=el(doc,'div','pc-board');board.setAttribute('role','group');board.setAttribute('aria-label','Five by five Pest Control grow tray board');
  for(let i=0;i<25;i++){
   const opened=state.picks.includes(i),finished=state.phase==='finished',hazard=state.hazardTiles.has(i);
   const show=opened||finished;const bust=show&&hazard;
   const card=button('', 'pc-tile '+(show?(bust?'pc-tile-bust pc-hazard-'+hazards[i%hazards.length]:'pc-tile-safe'):'pc-tile-closed')+(finished&&!opened?' pc-tile-disclosed':''),()=>{if(pestAction(state,'pick',i))render()},state.phase!=='active'||opened);
   card.dataset.tile=String(i);
   card.setAttribute('aria-label',show?(hazard?'Infested tray':'Healthy bud'):'Unopened grow tray '+(i+1));
   if(show){if(hazard){
     const type=hazards[i%hazards.length];
     const img=type==='fungus-gnats'?el(doc,'img','pc-icon'):art(doc,'pc-icon',type+'.webp',asset+type+'.svg');
     if(type==='fungus-gnats')img.src=asset+'fungus-gnats.svg';
     img.alt='';card.append(img);
    }else card.append(art(doc,'pc-icon','revealed-safe.webp',asset+'healthy-bud.svg'));}
   else{
    card.append(art(doc,'pc-tile-image pc-closed-art','closed-tray.webp',asset+'healthy-bud.svg'));
    card.append(art(doc,'pc-tile-image pc-hover-art','hover-tray.webp',asset+'healthy-bud.svg'));
   }
   board.append(card);
  }
  center.append(board);
  const legend=el(doc,'div','pc-board-legend','🌿 Healthy bud = safe  ·  🐛 Pest or rot = instant loss');center.append(legend);
  if(state.phase==='finished'){
   const result=el(doc,'div','pc-result pc-result-'+state.result,state.result==='harvest'?'CROP SAVED!':state.result==='infested'?'INFESTED!':'GROW CANCELLED');
   result.setAttribute('role','status');center.append(result);
  }
  const right=el(doc,'aside','pc-side pc-right');right.append(el(doc,'h2','','HARVEST STATUS'));
  const picks=state.picks.filter(i=>!state.hazardTiles.has(i)).length;
  const multi=picks?payoutMultiplier(state.hazards,picks):0;
  const next=state.phase==='active'?nextPickProbability(state.hazards,picks):state.phase==='ready'?nextPickProbability(state.hazards,0):null;
  right.append(stat('CURRENT MULTIPLIER',picks?multi.toFixed(4)+'×':'—','pc-multiplier'));
  right.append(stat('HARVEST VALUE',state.phase==='active'&&picks?money(state.bet*multi):state.result==='harvest'?money(state.return):'—','pc-value'));
  right.append(stat('SAFE PICKS',picks+' / '+(25-state.hazards)));
  const odds=el(doc,'div','pc-odds-row');
  odds.append(stat('SAFE',next===null?'—':pct(next),'pc-odds pc-odds-safe'));
  odds.append(stat('HAZARD',next===null?'—':pct(1-next),'pc-odds pc-odds-danger'));
  const oddsHeading=el(doc,'h3','pc-odds-heading','NEXT PICK ODDS');
  right.append(oddsHeading,odds);
  right.append(el(doc,'h3','','GROW LOG'));
  const log=el(doc,'ol','pc-log');for(const msg of state.log.slice(0,5))log.append(el(doc,'li','',msg));right.append(log);
  layout.append(left,center,right);root.append(layout);
  const foot=el(doc,'footer','pc-foot','96% theoretical RTP before credit rounding · All hazards equal · Practice only · No wallet transactions');root.append(foot);
  if(showInfo){
   const overlay=el(doc,'div','pc-info-overlay');const panel=el(doc,'section','pc-info');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Pest Control rules');
   panel.append(el(doc,'h2','','HOW TO PLAY PEST CONTROL'));
   for(const line of ['Choose a 1–100 credit practice bet and 1–24 hazards.','Start Growing and reveal any of the 25 hydroponic trays.','Every safe bud grows your multiplier. One pest or bud rot ends the round.','After your first safe pick, press Harvest Now to secure your return.','Payout multiplier = 0.96 ÷ survival probability. Payout includes original stake.','Survival probability after k picks = C(25−hazards,k) ÷ C(25,k).','No hazard gives a bonus or changes the math. All unopened trays are equally risky.'])panel.append(el(doc,'p','',line));
   panel.append(button('CLOSE RULES','pc-primary',()=>{showInfo=false;render()}));overlay.append(panel);root.append(overlay);
  }
 }
 render();root.stopAnimation=()=>{};root.gameState=state;return root;
}
