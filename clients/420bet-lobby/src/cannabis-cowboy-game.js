import {createCannabisCowboyShell,COWBOY_SYMBOLS} from './cannabis-cowboy-ui.js';
import {BET_CHOICES,createPracticeSession,playPracticeRound} from './cannabis-cowboy-engine.js';
const format=n=>Number(n).toLocaleString('en-US');
export function createCannabisCowboyPractice(doc=globalThis.document,options={}){
 const rng=options.rng??Math.random;
 const schedule=options.setTimeout??setTimeout;
 const cancel=options.clearTimeout??clearTimeout;
 let session=createPracticeSession({credits:options.credits??10000,bet:options.bet??20,rng});
 const root=createCannabisCowboyShell(doc);
 root.dataset.mode='base-game-practice';
 const grid=[...root.querySelectorAll('.cc-cell')];
 const consoleBar=root.querySelector('.cc-console');
 const spin=root.querySelector('.cc-spin');
 const minus=root.querySelector('.cc-minus');
 const plus=root.querySelector('.cc-plus');
 const auto=root.querySelector('.cc-auto');
 const menu=root.querySelector('.cc-menu');
 const readouts=[...root.querySelectorAll('.cc-readout')];
 const bet=readouts[0].querySelector('strong');
 const balance=readouts[1].querySelector('strong');
 const win=readouts[2].querySelector('strong');
 const labels=readouts.map(n=>n.querySelector('span'));
 labels[0].textContent='BET · DEMO CREDITS';
 labels[1].textContent='BALANCE · DEMO CREDITS';
 labels[2].textContent='WIN · DEMO CREDITS';
 const info=root.querySelector('.cc-info-panel');
 const notice=root.querySelector('.cc-practice-notice');
 notice.textContent='PRACTICE CREDITS · SMOKE RING WILDS & GROWING HARVEST ACTIVE · FREE SPINS DISABLED';
 root.querySelector('.cc-board-readonly').textContent='BASE-GAME PRACTICE';
 root.querySelector('.cc-board-foot').textContent='5+ ADJACENT · SMOKE RING WILD ×2 · GROWING HARVEST ×2→×32';
 const status=doc.createElement('p');status.className='cc-round-status';status.setAttribute('aria-live','polite');
 status.textContent='Saddle up! Your base-game cluster engine is ready.';
 consoleBar.after(status);
 const setSymbol=(cell,id)=>{
  const sym=COWBOY_SYMBOLS[id];cell.className='cc-cell cc-symbol-'+sym.kind;cell.dataset.symbol=sym.kind;
  cell.replaceChildren();const glyph=doc.createElement('span');glyph.className='cc-cell-glyph';glyph.textContent=sym.glyph;glyph.setAttribute('aria-hidden','true');cell.append(glyph);
  if(sym.kind==='smoke-wild'){const wild=doc.createElement('span');wild.className='cc-wild-tag';wild.textContent='WILD ×2';cell.append(wild);}
 };
 const showBoard=(board,highlight=[],fertile=[],phase='idle',upgraded=[])=>{
  const wins=new Set(highlight),grown=new Set(upgraded);
  grid.forEach((cell,i)=>{
   setSymbol(cell,board[i]);cell.classList.toggle('cc-winning',wins.has(i));
   cell.classList.toggle('cc-harvest-upgrade',grown.has(i));
   cell.dataset.phase=phase;
   const value=fertile[i]||0;
   if(value){cell.dataset.harvest=String(value);const badge=doc.createElement('span');badge.className='cc-harvest-badge';badge.textContent='×'+value;cell.append(badge);}
   else delete cell.dataset.harvest;
  });
 };
 let busy=false,dead=false,handle=null,queue=[],lastWin=0;
 let displayedFertile=Array(grid.length).fill(0);
 const reducedMotion=options.reducedMotion??false;
 const timings=reducedMotion?{start:0,announce:0,burst:0,drop:0}:{start:450,announce:1000,burst:520,drop:580};
 const effects=doc.createElement('div');effects.className='cc-effect-banner';effects.setAttribute('aria-live','polite');effects.hidden=true;
 root.querySelector('.cc-middle').append(effects);
 const announce=(message)=>{effects.textContent=message;effects.hidden=false;};
 const hideEffects=()=>{effects.hidden=true;effects.textContent='';};
 const sync=()=>{
  bet.textContent=format(session.bet);
  balance.textContent=format(session.credits);
  win.textContent=format(lastWin);
  minus.disabled=busy||session.bet===BET_CHOICES[0];
  plus.disabled=busy||session.bet===BET_CHOICES[BET_CHOICES.length-1];
  spin.disabled=busy||session.credits<session.bet;
  spin.textContent=busy?'···':'SPIN';
 };
 const tick=(fn,ms)=>{
  handle=schedule(()=>{handle=null;if(!dead)fn();},ms);
 };
 const finish=()=>{
  busy=false;queue=[];showBoard(session.board);hideEffects();sync();
  status.textContent=lastWin?'HARVEST COMPLETE · '+format(lastWin)+' demo credits won':'No more clusters · Spin again';
 };
 const advance=()=>{
  if(dead)return;
  if(!queue.length){finish();return;}
  const step=queue.shift();
  const highlighted=step.clusters.flatMap(x=>x.positions);
  const smokeRings=step.clusters.reduce((count,c)=>count+c.wildCount,0);
  const prior=displayedFertile.slice();
  showBoard(step.before,highlighted,prior,'cluster');
  const mult=step.clusters.map(c=>'×'+c.multiplier).join(' · ');
  status.textContent='CASCADE '+step.index+' · '+step.clusters.length+' clusters · +'+format(step.cascadeWin)+' demo credits';
  announce(smokeRings?'SMOKE RING WILD! ×2  ·  '+mult:'HARVEST! '+mult);
  tick(()=>{
   showBoard(step.before,highlighted,prior,'burst');
   announce('GROWING HARVEST · '+step.removed.length+' CELLS');
   tick(()=>{
    const upgraded=step.removed.filter(p=>step.fertile[p]!==prior[p]);
    displayedFertile=step.fertile.slice();
    showBoard(step.after,[],displayedFertile,'drop',upgraded);
    announce('MULTIPLIERS GROW · '+upgraded.map(p=>'×'+step.fertile[p]).slice(0,5).join('  '));
    tick(()=>{hideEffects();advance();},timings.drop);
   },timings.burst);
  },timings.announce);
 };
 const play=()=>{
  if(busy||dead||session.credits<session.bet)return;
  let result;
  try{result=playPracticeRound(session,rng);}
  catch(error){status.textContent='Round could not finish safely; no credits changed';return;}
  if(!result.accepted){status.textContent='Insufficient practice credits';return;}
  // Commit credits and the outcome exactly once before replaying the visuals.
  session=result.state;lastWin=result.outcome.total;busy=true;
  sync();
  status.textContent='Harvest in progress · '+result.outcome.steps.length+' cascades';
  if(!result.outcome.steps.length){showBoard(result.outcome.board);tick(finish,reducedMotion?0:350);return;}
  queue=result.outcome.steps.slice();
  displayedFertile=Array(grid.length).fill(0);
  showBoard(result.outcome.startingBoard);
  tick(advance,timings.start);
 };
 const betChange=delta=>{
  if(busy||dead)return;
  const i=BET_CHOICES.indexOf(session.bet),next=BET_CHOICES[i+delta];
  if(next!==undefined){session={...session,bet:next};sync();}
 };
 spin.disabled=false;spin.addEventListener('click',play);
 minus.disabled=false;minus.addEventListener('click',()=>betChange(-1));
 plus.disabled=false;plus.addEventListener('click',()=>betChange(1));
 // Existing menu and auto remain disabled until their M4+ implementation.
 menu.title='Menu options coming in a later milestone';
 auto.title='Autoplay unavailable in this practice build';
 showBoard(session.board);sync();
 root.stopAnimation=()=>{dead=true;busy=false;queue=[];hideEffects();if(handle!==null){cancel(handle);handle=null;}};
 root.getPracticeState=()=>({credits:session.credits,bet:session.bet,round:session.round,busy,lastWin});
 return root;
}
