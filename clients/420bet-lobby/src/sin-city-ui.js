import {initialState,nextRound,PAYTABLE,BASE_STRIPS,FREE_STRIPS,visibleBoard} from './sin-city-engine.js';
const ROOT='/assets/420bet/sin-city-high-rollers/';
const FILES={
 BUD:'sym_bud.png',JAR:'sym_jar.png',ASH:'sym_ashtray.png',GRINDER:'sym_grinder.png',
 LIGHTER:'sym_lighter.png',PAPERS:'sym_papers.png',BONG:'sym_bong.png',CAR:'sym_lowrider.png',
 CHIPS:'sym_chips.png',MIC:'sym_mic.png',DOLLAR:'sym_dollar_pendant.png',
 '10':'sym_10.png',J:'sym_j.png',Q:'sym_q.png',K:'sym_k.png',A:'sym_a.png',
 BOBBY:'sym_bobby_wild.png',WILD:'sym_wild_leaf.png',SCATTER:'sym_scatter_420.png',GEM:'sym_emerald_gem.png'
};
const art=(category,file)=>ROOT+category+'/'+file;
const el=(doc,tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
export function createSinCityPractice(doc=globalThis.document,options={}){
 const view=doc.defaultView||globalThis;
 const reduced=!!view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const root=el(doc,'section','sc-game');root.dataset.practiceGame='sin-city-high-rollers';
 let state=initialState(),panel='',auto=false,autoLeft=0,turbo=false,muted=true,busy=false,dead=false,showBanner='',visualBoard=null,audioContext=null;
 const timers=new Set();
 const playCue=()=>{if(muted||dead)return;try{const Constructor=view.AudioContext||view.webkitAudioContext;if(!Constructor)return;audioContext??=new Constructor();const tone=audioContext.createOscillator(),gain=audioContext.createGain();tone.type='sine';tone.frequency.value=520;gain.gain.value=.025;tone.connect(gain);gain.connect(audioContext.destination);tone.start();tone.stop(audioContext.currentTime+.11);}catch{}};
 const later=(fn,ms)=>{if(dead)return;const id=view.setTimeout?.(()=>{timers.delete(id);if(!dead)fn();},ms);if(id!==undefined)timers.add(id);else fn();};
 const clear=()=>{for(const id of timers)view.clearTimeout?.(id);timers.clear();};
 root.stopAnimation=()=>{dead=true;auto=false;busy=false;clear();void audioContext?.close?.();};
 const button=(label,cls,action)=>{const b=el(doc,'button',cls,label);b.type='button';b.addEventListener('click',action);return b;};
 function showPanel(){
  const scrim=el(doc,'div','sc-modal-backdrop'),modal=el(doc,'section','sc-modal');
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',panel==='info'?'Sin City rules and paytable':'Sin City practice menu');
  const close=button('×','sc-modal-close',()=>{panel='';render();});close.setAttribute('aria-label','Close dialog');modal.append(close,el(doc,'h2','',panel==='info'?'GAME RULES & PAYTABLE':'PRACTICE MENU'));
  if(panel==='info'){
   modal.append(el(doc,'p','','5 reels × 4 rows · 1,024 always-active ways to win. Match three or more identical symbols from left to right; Wild substitutes for paying symbols, not scatters or gems.'));
   const headings=[
    ['PUFF PUFF PASS','Three or more ashtray symbols: one eligible symbol on each affected reel becomes a Wild for this result.'],
    ['HOTBOX RESPINS','Three or more emerald gems activate three respins. Newly collected gems lock and reset the counter to three. Filling all twenty positions pays a 100× total-bet demonstration award.'],
    ['CHRONIC SESSIONS','Scatter symbols across 3, 4, or 5 reels trigger 8, 12, or 20 free spins. Wilds stick for the feature. Three new scatters retrigger five spins, subject to a 50-spin limit.'],
    ['DROP IT LIKE IT\'S HOT','During free spins, lowriders on three or more reels award a random 2×, 3×, 4×, or 5× multiplier to ordinary ways wins.']
   ];
   for(const [heading,copy] of headings)modal.append(el(doc,'h3','',heading),el(doc,'p','',copy));
   const table=el(doc,'table','sc-paytable');const hr=el(doc,'tr');for(const head of ['SYMBOL','3','4','5'])hr.append(el(doc,'th','',head));table.append(hr);
   for(const [key,values] of Object.entries(PAYTABLE)){const row=el(doc,'tr');row.append(el(doc,'td','',key));for(const value of values)row.append(el(doc,'td','',value.toFixed(2)+'×'));table.append(row);}
   modal.append(table);
   modal.append(el(doc,'p','sc-note','All awards are candidate practice-credit amounts. 5,000× total wager maximum across a paid spin and its feature. Reel strips and theoretical RTP are not certified.'));
  }else{
   modal.append(el(doc,'p','','All credits are fictional practice units with no cash value. AUTO plays up to 10 paid spins, then pauses when a bonus begins. TURBO changes animation speed only. No wallet, deposits or real-money settlement.'));
   const reset=button('RESET 1,000 PRACTICE CREDITS','sc-reset',()=>{auto=false;autoLeft=0;state=initialState();panel='';clear();render();});
   reset.disabled=busy||state.mode!=='base';modal.append(reset);
  }
  scrim.append(modal);scrim.addEventListener('click',e=>{if(e.target===scrim){panel='';render();}});
  scrim.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();panel='';render();}});
  root.append(scrim);close.focus();
 }
 function render(){
  if(dead)return;
  root.replaceChildren();
  const scene=el(doc,'div','sc-scene sc-mode-'+(state.mode==='hotbox'?'hotbox':state.mode==='free'?'free':'base'));
  scene.setAttribute('aria-label','Sin City High Rollers interactive slot cabinet');
  const mast=el(doc,'header','sc-masthead');
  const logo=el(doc,'img','sc-logo');logo.src=art('branding','logo_sin_city_high_rollers.png');logo.alt='Sin City High Rollers Cannabis Edition';
  mast.append(logo,el(doc,'span','sc-ways','1,024 WAYS'));scene.append(mast);
  const content=el(doc,'div','sc-machine');
  const mascot=el(doc,'aside','sc-mascot');
  const portrait=el(doc,'img','sc-bobby');portrait.src=art('characters',state.lastFeature==='free-start'||state.lastFeature==='free-retrigger'?'char_bobby_las_vegas_celebration.png':state.lastFeature==='puff'?'char_bobby_las_vegas_smoking.png':'char_bobby_las_vegas_confident.png');portrait.alt='Bobby Las Vegas, fictional casino host';
  const name=el(doc,'div','sc-host-name','BOBBY LAS VEGAS');mascot.append(portrait,name);content.append(mascot);
  const cabinet=el(doc,'div','sc-cabinet');
  const top=el(doc,'div','sc-cabinet-top');
  top.append(el(doc,'span','','SIN CITY HIGH ROLLERS'),el(doc,'span','sc-mode-label',state.mode==='free'?'FREE SPINS '+state.freeRemaining:state.mode==='hotbox'?'RESPINS '+state.respins:'PRACTICE PLAY'));
  cabinet.append(top);
  const reels=el(doc,'div','sc-reels');reels.setAttribute('role','group');reels.setAttribute('aria-label','Five reels with four symbols each');
  for(let r=0;r<5;r++){const col=el(doc,'div','sc-reel'+(busy?' sc-reel-spinning':''));for(let row=0;row<4;row++){
   const symbol=(visualBoard||state.lastBoard)[r][row],cell=el(doc,'div','sc-symbol'+(symbol==='WILD'?' sc-wild':'')+(symbol==='GEM'?' sc-gem':''));
   cell.setAttribute('role','img');cell.setAttribute('aria-label','Reel '+(r+1)+' row '+(row+1)+': '+(symbol||'Empty'));
   if(FILES[symbol]){const img=el(doc,'img','');img.src=art('symbols',FILES[symbol]);img.alt='';img.draggable=false;cell.append(img);}
   if(state.mode==='free'&&state.sticky.includes(r*4+row))cell.classList.add('sc-sticky');
   if(state.mode==='hotbox'&&state.locked.includes(r*4+row))cell.classList.add('sc-locked');
   col.append(cell);
  }reels.append(col);}
  cabinet.append(reels);
  const result=el(doc,'div','sc-result',busy?'REELS SPINNING…':state.lastMessage);result.setAttribute('role','status');result.setAttribute('aria-live','polite');cabinet.append(result);
  const metrics=el(doc,'div','sc-metrics');
  for(const [caption,value] of [['BALANCE',state.balance.toFixed(2)],['TOTAL BET',state.stake.toFixed(2)],['LAST WIN',state.lastWin.toFixed(2)]]){const cell=el(doc,'div','sc-metric');cell.append(el(doc,'small','',caption),el(doc,'strong','',value));metrics.append(cell);}
  cabinet.append(metrics);
  const controls=el(doc,'div','sc-controls');
  const info=button('INFO','sc-control',()=>{panel='info';render();});
  const menu=button('MENU','sc-control',()=>{panel='menu';render();});
  const minus=button('−','sc-control',()=>{state={...state,stake:Math.max(1,state.stake-1)};render();});
  const plus=button('+','sc-control',()=>{state={...state,stake:Math.min(50,state.stake+1)};render();});
  const spin=button(state.mode==='base'?'SPIN':state.mode==='free'?'FREE SPIN':'RESPIN','sc-spin',step);
  spin.disabled=busy||(!auto&&state.mode==='base'&&state.balance<state.stake);
  minus.disabled=plus.disabled=busy||auto||state.mode!=='base';
  const autoBtn=button('AUTO '+(auto?'ON':'OFF'),'sc-control'+(auto?' sc-selected':''),()=>{
   auto=!auto;autoLeft=auto?10:0;render();if(auto)later(autoContinue,250);
  });autoBtn.disabled=busy||state.mode!=='base';
  const turboBtn=button('TURBO '+(turbo?'ON':'OFF'),'sc-control'+(turbo?' sc-selected':''),()=>{turbo=!turbo;render();});turboBtn.disabled=busy;
  const sound=button(muted?'SOUND OFF':'SOUND ON','sc-control',()=>{muted=!muted;playCue();render();});
  sound.setAttribute('aria-pressed',String(!muted));
  controls.append(info,menu,minus,spin,plus,autoBtn,turboBtn,sound);
  cabinet.append(controls);content.append(cabinet);scene.append(content);
  const footer=el(doc,'p','sc-disclaimer','PRACTICE CREDITS ONLY · NO REAL WAGERS · NO CASH VALUE · PROVISIONAL UNVERIFIED ODDS');scene.append(footer);
  root.append(scene);
  if(showBanner){const overlay=el(doc,'div','sc-feature-overlay');overlay.setAttribute('role','status');const picture=el(doc,'img');picture.src=art('features',showBanner);picture.alt=state.lastMessage;overlay.append(picture);root.append(overlay);}
  if(panel)showPanel();
 }
 function autoContinue(){
  if(!auto||busy||dead)return;
  if(state.mode!=='base'||autoLeft<=0||state.balance<state.stake){auto=false;autoLeft=0;render();return;}
  autoLeft--;step();
 }
 function step(){
  if(dead||busy)return;
  if(state.mode==='base'&&state.balance<state.stake){auto=false;render();return;}
  if(showBanner)showBanner='';
  busy=true;playCue();render();
  if(!reduced){
   const baseStops=state.lastStops||[0,8,16,24,32];
   const count=turbo?3:6;
   for(let i=1;i<=count;i++)later(()=>{
    if(!busy)return;
    const stops=baseStops.map((stop,reel)=>(stop+i*(reel+3))%42);
    visualBoard=visibleBoard(state.mode==='free'?FREE_STRIPS:BASE_STRIPS,stops);
    render();
   },i*(turbo?50:100));
  }
  later(()=>{
   const next=nextRound(state,options.rng);
   state=next;busy=false;visualBoard=null;playCue();
   const banners={
    'puff':'banner_puff_puff_pass.png','hotbox-start':'banner_hotbox_respins.png','hotbox':'banner_hotbox_respins.png',
    'free-start':'banner_chronic_sessions_free_spins.png','free-retrigger':'banner_chronic_sessions_free_spins.png',
    'lowrider':'banner_drop_it_like_its_hot.png'
   };
   showBanner=banners[state.lastFeature]||(state.lastWin>=state.stake*10?'banner_big_win.png':'');
   if(state.mode!=='base'){auto=false;autoLeft=0;}
   render();
   if(showBanner)later(()=>{showBanner='';render();},reduced?350:turbo?700:1600);
   if(auto&&state.mode==='base'&&autoLeft>0)later(autoContinue,turbo?900:2400);
  },reduced?0:turbo?220:780);
 }
 render();return root;
}
