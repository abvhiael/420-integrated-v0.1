import {initialState,nextSpin,practiceBonus,LINES,PAYTABLE,JACKPOTS,ROWS,REELS,MAX_WIN_MULTIPLIER} from './best-buds-engine.js';
const ROOT='/assets/420bet/best-buds/';
const SYMBOL_ART=Object.freeze({
 BONG:'sym_bong.png',JOINT:'sym_joint.png',CHIPS:'sym_chips.png',RECORD:'sym_record.png',
 PAPERS:'sym_rollingpapers.png',LIGHTER:'sym_lighter.png',SUNGLASSES:'sym_sunglasses.png',
 GUITAR:'sym_guitar.png',LEAF:'sym_leaf.png',BUDDY1:'sym_buddy1_portrait.png',
 BUDDY2:'sym_buddy2_portrait.png',WILD1:'sym_buddy1_wild.png',
 WILD2:'sym_buddy2_wild.png',SCATTER:'sym_scatter_van.png',HOTBOX:'sym_hotbox_100.png'
});
const asset=(group,name)=>ROOT+group+'/'+name;
const make=(doc,tag,cls,text)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const sprite=(doc,group,file,alt='',cls='')=>{const img=make(doc,'img',cls);img.src=asset(group,file);img.alt=alt;img.draggable=false;return img;};
const button=(doc,title,klass,action)=>{const el=make(doc,'button',klass,title);el.type='button';el.addEventListener('click',action);return el;};
const credit=n=>Number(n).toFixed(2);
const REACTIONS={
 idle:['buddy1_laugh.png','buddy2_peace.png'], spin:['buddy1_skeptical.png','buddy2_inhale.png'],
 win:['buddy1_thumbs_up.png','buddy2_laugh.png'], hold:['buddy1_surprised.png','buddy2_surprised.png'],
 free:['buddy1_exhale.png','buddy2_exhale.png'], big:['buddy1_big_win.png','buddy2_celebrate.png']
};
const randomSymbol=()=>['BONG','JOINT','RECORD','CHIPS','PAPERS','GUITAR','LEAF','LIGHTER','SUNGLASSES'][Math.floor(Math.random()*9)];
export function createBestBudsPractice(doc=globalThis.document,options={}){
 const view=doc.defaultView||globalThis;
 const root=make(doc,'section','bb-game');root.dataset.practiceGame='best-buds-hotbox-road-trip';
 let state=options.initialState??initialState(),display=state.board,phase='idle',stopped=0,lineIndex=0;
 let modal='',qaMenu=false,dead=false,visualMode=state.mode,sessionSummary=null;
 let previousHold=[],reactionPair=null,reactionSpins=0;
 const chooseReactions=()=>{
  const one=['buddy1_laugh.png','buddy1_skeptical.png','buddy1_exhale.png','buddy1_surprised.png','buddy1_big_win.png','buddy1_thumbs_up.png'];
  const two=['buddy2_peace.png','buddy2_inhale.png','buddy2_exhale.png','buddy2_surprised.png','buddy2_laugh.png','buddy2_celebrate.png'];
  const rng=options.rng??Math.random;
  reactionPair=[one[Math.floor(Math.min(.999999,rng())*one.length)],two[Math.floor(Math.min(.999999,rng())*two.length)]];
 };
 chooseReactions();
 const timers=new Set();const reduced=!!view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const later=(fn,ms)=>{if(dead)return;const id=view.setTimeout?.(()=>{timers.delete(id);if(!dead)fn();},ms);if(id!==undefined)timers.add(id);else fn();};
 const clear=()=>{for(const id of timers)view.clearTimeout?.(id);timers.clear();};
 root.stopAnimation=()=>{dead=true;clear();};
 root.getPresentationState=()=>({phase,stopped,lineIndex,mode:state.mode,feature:state.lastFeature,lastWin:state.lastWin,winCount:state.lastWins.length,respins:state.respins,freeLeft:state.freeLeft,qaMenu,summary:sessionSummary,collectSmokeEvent:state.collectSmokeEvent,reactionPair:[...reactionPair],reactionSpins,holdShown:previousHold.length});
 root.getGameState=()=>state;
 const layout=()=>{
  if(dead)return;root.replaceChildren();
  const screen=make(doc,'div','bb-screen'+(state.mode==='hold'?' bb-hold':'')+(state.mode==='free'?' bb-free':''));
  screen.style.setProperty('--bb-wallpaper','url("'+asset('backgrounds',state.mode==='hold'||state.mode==='free'?'bestbuds-bg-night-roadtrip.png':'bestbuds-bg-desert-sunset.png')+'")');
  const header=make(doc,'header','bb-header');
  header.append(sprite(doc,'characters',reactionPair[0],'Buddy 1 reaction','bb-buddy bb-buddy-one'));
  header.append(sprite(doc,'ui','bestbuds-logo.png','Best Buds: Hotbox Road Trip','bb-title-logo'));
  header.append(sprite(doc,'characters',reactionPair[1],'Buddy 2 reaction','bb-buddy bb-buddy-two'));
  screen.append(header);
  const frame=make(doc,'div','bb-frame');
  const info=make(doc,'div','bb-topline');
  info.append(make(doc,'span','','25 FIXED LINES'),make(doc,'strong','bb-mode',state.mode==='hold'?'HOTBOX HOLD & WIN · '+state.respins+' RESPINS':state.mode==='free'?'ROAD TRIP · '+state.freeLeft+' FREE RIDES':'HOTBOX ROAD TRIP · PRACTICE'),make(doc,'span','','MAX '+MAX_WIN_MULTIPLIER+'×'));
  frame.append(info);
  const stage=make(doc,'div','bb-stage');stage.setAttribute('role','group');stage.setAttribute('aria-label','Best Buds five reel three row game board');
  stage.addEventListener('click',()=>{if(phase==='spinning'||phase==='paylines')skip();else if(sessionSummary){sessionSummary=null;layout();}});
  const reelGrid=make(doc,'div','bb-reel-grid');
  const holdPresentation=phase==='spinning'?visualMode==='hold':state.mode==='hold'||state.lastFeature==='hold-end';
  if(holdPresentation){
   // The entire Hold & Win board stays on screen throughout each player-initiated
   // respin. Previously landed coins remain locked while only empty cells spin.
   const oldCoins=phase==='spinning'?previousHold:(state.holdReveal??state.hold);
   const newCoins=state.holdReveal??state.hold;
   const previous=new Map(oldCoins.map(c=>[c.key,c]));
   const final=new Map(newCoins.map(c=>[c.key,c]));
   for(let r=0;r<REELS;r++){
    const reel=make(doc,'div','bb-reel bb-hold-reel'+(phase==='spinning'&&r>=stopped?' bb-hold-reel-spinning':'')+(phase==='spinning'&&r<stopped?' bb-hold-reel-stopped':''));
    for(let y=0;y<ROWS;y++){
     const key=r*ROWS+y;
     const revealed=phase!=='spinning'||r<stopped;
     const coin=previous.get(key)??(revealed?final.get(key):null);
     const cell=make(doc,'div','bb-cell'+(coin?' bb-coin-locked':' bb-empty')+
       (!coin&&phase==='spinning'&&!revealed?' bb-hold-cell-rolling':'')+
       (coin&&revealed&&!previous.has(key)&&state.holdNewKeys.includes(key)?' bb-new-coin':'')+
       (coin?.kind==='collect'&&revealed?' bb-collect-coin':''));
     if(coin)cell.append(coinVisual(coin));
     else if(phase==='spinning'&&!revealed){
      // Repeated, vertically scrolling real artwork makes each unoccupied
      // position behave like a moving reel strip rather than a blinking coin.
      const mask=make(doc,'div','bb-hold-spin-window');
      const track=make(doc,'div','bb-hold-spin-track');
      for(let i=0;i<10;i++){
       const tile=make(doc,'div','bb-hold-spin-tile');
       const art=i%5===0?'icon_collect_smoke.png':i%4===0?'icon_jackpot_mini.png':
         i%3===0?'icon_multiplier_x2.png':'icon_hotbox_coin.png';
       tile.append(sprite(doc,'ui',art,''));
       track.append(tile);
      }
      mask.append(track);cell.append(mask);
     }
     reel.append(cell);
    }
    reelGrid.append(reel);
   }
  }else{
   for(let r=0;r<REELS;r++){
    const rolling=phase==='spinning'&&r>=stopped;
    const reel=make(doc,'div','bb-reel'+(rolling?' bb-reel-rolling':''));
    for(let y=0;y<ROWS;y++){
     const cell=make(doc,'div','bb-cell'),s=display[r][y];
     if(s){
      cell.append(sprite(doc,'reels',SYMBOL_ART[s]??SYMBOL_ART.LEAF,s));
      if((s==='WILD1'||s==='WILD2')&&state.freeWildMultipliers?.[r*ROWS+y]&&
         (visualMode==='free'||state.lastFeature==='free-end'||state.mode==='free')){
       cell.append(make(doc,'b','bb-wild-multiplier','×'+state.freeWildMultipliers[r*ROWS+y]));
      }
     }
     reel.append(cell);
    }
    if(rolling){
     const strip=make(doc,'div','bb-roll-mask'),track=make(doc,'div','bb-roll-track');
     for(let i=0;i<12;i++)track.append(sprite(doc,'reels',SYMBOL_ART[randomSymbol()],''));
     strip.append(track);reel.append(strip);
    }
    reelGrid.append(reel);
   }
  }
  stage.append(reelGrid);
  if(phase==='paylines'&&state.lastWins.length){
   const line=state.lastWins[lineIndex%state.lastWins.length];
   const svg=doc.createElementNS?.('http://www.w3.org/2000/svg','svg');
   if(svg){
    svg.setAttribute('class','bb-win-overlay');svg.setAttribute('viewBox','0 0 500 300');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-label','Winning payline '+line.line);
    const route=doc.createElementNS('http://www.w3.org/2000/svg','polyline');
    route.setAttribute('points',[[0,line.rows[0]],[...line.rows.map((y,r)=>[50+r*100,y])],[500,line.rows[4]]].flatMap(v=>Array.isArray(v[0])?v:[v]).map(([x,y])=>x+','+(50+y*100)).join(' '));
    route.setAttribute('class','bb-win-path');svg.append(route);stage.append(svg);
   }
   stage.append(make(doc,'div','bb-payline-note','LINE '+line.line+' · '+line.length+' '+line.symbol+' · +'+credit(line.amount)+(line.wildMultiplier>1?' (WILD ×'+line.wildMultiplier+')':'')+' · CLICK TO SKIP'));
  }
  frame.append(stage);
  // On a Collect Smoke landing, the credit collection is called out
  // immediately on the board as well as included in the final feature total.
  if(state.collectSmokeEvent&&phase!=='spinning'){
   const event=make(doc,'div','bb-collect-announcement');
   event.append(sprite(doc,'ui','icon_collect_smoke.png','Collect Smoke'));
   event.append(make(doc,'strong','','COLLECT SMOKE!'));
   event.append(make(doc,'span','','+'+credit(state.collectSmokeEvent.credits)+' CREDITS · '+credit(state.collectSmokeEvent.multipliers)+'× BET'));
   frame.append(event);
  }
  if(state.mode==='hold'||(state.lastFeature==='hold-end'&&phase!=='spinning')){
   const count=(state.holdReveal??state.hold).length;
   const progress=make(doc,'div','bb-meter',state.mode==='hold'
    ?'LOCKED '+count+'/15 · '+state.respins+' RESPINS LEFT · PRESS RESPIN TO CONTINUE'
    :'HOTBOX COMPLETE · '+count+'/15 COINS · FEATURE WIN '+credit(state.featureTotal)+' CREDITS');
   frame.append(progress);
  }
  frame.append(make(doc,'div','bb-message',phase==='spinning'?'ROLLING DOWN THE HIGHWAY…':state.message));
  const foot=make(doc,'div','bb-controls');
  const bet=make(doc,'div','bb-bet');
  bet.append(button(doc,'−','bb-bet-button',()=>changeBet(-1)),make(doc,'span','bb-bet-value','BET '+credit(state.bet)),button(doc,'+','bb-bet-button',()=>changeBet(1)));
  const spin=button(doc,state.mode==='hold'?'RESPIN':state.mode==='free'?'FREE SPIN':'SPIN','bb-spin',startSpin);
  spin.disabled=phase!=='idle'||!!sessionSummary;
  foot.append(bet,make(doc,'div','bb-balance','CREDITS '+credit(state.balance)),spin,make(doc,'div','bb-win-number','WIN '+credit(state.lastWin)));
  const opts=make(doc,'div','bb-extras');
  opts.append(button(doc,'INFO / PAYTABLE','bb-small-button',()=>{if(phase==='idle'){modal='info';layout();}}));
  opts.append(button(doc,'BONUS TEST','bb-small-button bb-qa-button',()=>{if(phase==='idle'){qaMenu=!qaMenu;layout();}}));
  frame.append(foot,opts);
  if(qaMenu){
   const qa=make(doc,'div','bb-qa-panel');qa.append(make(doc,'strong','','PRACTICE BONUS TEST · NO REAL STAKES'));
   for(const [name,choice] of [['Trigger Hold & Win','hold'],['8 Free Rides','free'],['Collect Smoke','collect'],['Jackpot / Mystery','jackpot'],['Fill the Hotbox','fill'],['Test WILD ×10','wild10']]){
    qa.append(button(doc,name,'bb-qa-option',()=>{clear();phase='idle';qaMenu=false;state=practiceBonus({...state,mode:'base'},choice,options.rng??Math.random);display=state.board;visualMode=state.mode;layout();}));
   }
   frame.append(qa);
  }
  screen.append(frame);
  screen.append(make(doc,'p','bb-disclaimer','PRACTICE ONLY · CANDIDATE PAYTABLE · NO MONEY OR WALLET TRANSACTIONS'));
  if(modal){const overlay=make(doc,'div','bb-modal-cover'),dialog=make(doc,'section','bb-modal');
   dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
   dialog.append(button(doc,'×','bb-close',()=>{modal='';layout();}),make(doc,'h2','','BEST BUDS · RULES'));
   dialog.append(make(doc,'p','','Five reels, three rows, 25 fixed paylines. Three matching symbols from left to right win; the two Buddy WILDs substitute for ordinary symbols only. All 25 lines are included in the total bet.'));
   dialog.append(make(doc,'p','','6+ HOTBOX COINS trigger Hold & Win: start with 3 respins; every new locked coin resets to 3. At 10 and 13 coins, the latest coin may transform into Collect Smoke, a multiplier or a jackpot. Three van scatters on separate reels trigger 8 Free Rides. If both features trigger, Free Rides follow Hold & Win.'));
   dialog.append(make(doc,'p','','Collect Smoke locks in place and adds the sum of the values of the other locked ordinary HOTBOX coins as a one-time extra award. The amount appears when the symbol lands, and is included in the final bonus payout. Jackpot and multiplier symbols are not part of that collection sum.'));
   dialog.append(make(doc,'p','','HOTBOX: MINI ×20, MINOR ×50, MAJOR ×200, GRAND ×1000. During Free Rides, each landed Buddy WILD receives a random ×2, ×3, ×5 or ×10 badge; the highest multiplier on each winning line applies once (never multiplied together). All winnings are bounded to ×5000 total bet per initiating round. Feature thresholds and paytable are uncalibrated practice mechanics.'));
   const table=make(doc,'table','bb-paytable'),tr=make(doc,'tr');
   for(const h of ['SYMBOL','3','4','5'])tr.append(make(doc,'th','',h));table.append(tr);
   for(const [key,pays] of Object.entries(PAYTABLE)){const r=make(doc,'tr');r.append(make(doc,'td','',key));for(const v of pays)r.append(make(doc,'td','',v+'×'));table.append(r);}
   dialog.append(table,make(doc,'p','','BONUS TEST enters simulated bonus states to inspect the mechanics. No deposit, bonus purchase, or real-world payout.'));
   overlay.append(dialog);screen.append(overlay);
  }
  if(sessionSummary!==null){
   const shade=make(doc,'div','bb-summary');shade.append(make(doc,'h2','','ROAD TRIP COMPLETE!'),make(doc,'div','bb-summary-total',credit(sessionSummary)+' CREDITS'),make(doc,'span','','CLICK ANYWHERE TO CONTINUE'));
   shade.addEventListener('click',()=>{sessionSummary=null;layout();});screen.append(shade);
  }
  root.append(screen);
 };
 function coinVisual(c){
  const span=make(doc,'div','bb-coin-kind bb-kind-'+c.kind);
  if(c.kind==='coin'){span.append(sprite(doc,'ui','icon_hotbox_coin.png','Hotbox coin'),make(doc,'b','','×'+c.value));}
  else if(c.kind==='jackpot'){span.append(sprite(doc,'ui','icon_jackpot_'+c.value.toLowerCase()+'.png',c.value+' jackpot'));}
  else if(c.kind==='collect'){
   span.append(sprite(doc,'ui','icon_collect_smoke.png','Collect Smoke'));
   span.append(make(doc,'b','bb-collect-value','×'+credit(c.value)));
  }
  else span.append(sprite(doc,'ui','icon_multiplier_x2.png','Multiplier'));
  return span;
 }
 function changeBet(delta){if(phase!=='idle'||state.mode!=='base')return;const bets=[.5,1,2,5,10,20,50];let i=bets.indexOf(state.bet);state={...state,bet:bets[Math.max(0,Math.min(bets.length-1,i+delta))]};layout();}
 function showWins(){
  if(state.lastWins.length&&visualMode!=='hold'&&state.lastFeature!=='hold-end'){
   phase='paylines';lineIndex=0;layout();scheduleLine();
  }else finish();
 }
 function scheduleLine(){later(()=>{if(phase!=='paylines')return;lineIndex++;if(lineIndex>=state.lastWins.length){finish();return;}layout();scheduleLine();},reduced?80:650);}
 function finish(){
  clear();phase='idle';stopped=REELS;
  if(state.freeSummary!==null){sessionSummary=state.freeSummary;state={...state,freeSummary:null};}
  layout();
 }
 function skip(){if(phase==='spinning'){clear();stopped=REELS;display=state.board;showWins();}else if(phase==='paylines')finish();}
 function startSpin(){
  if(dead||phase!=='idle'||sessionSummary!==null||modal)return;
  if(state.mode==='base'&&state.balance<state.bet)return;
  clear();qaMenu=false;
  // A pair of randomly selected portraits persists across exactly three
  // player-initiated spins; rendering and skipping never reroll reactions.
  if(reactionSpins===3){chooseReactions();reactionSpins=0;}
  reactionSpins++;
  // QA hold variants use a forced outcome on the FIRST bonus respin only.
  const force=state.qa;
  const before=state;
  previousHold=before.hold.map(c=>({...c}));
  const next=nextSpin(state,{rng:options.rng??Math.random,force});
  state=next;
  visualMode=before.mode;
  display=before.board;
  phase='spinning';stopped=0;layout();
  const interval=reduced?65:330,begin=reduced?90:900;
  for(let r=1;r<=REELS;r++)later(()=>{
   if(phase!=='spinning')return;
   stopped=r;display=display.map((col,i)=>i===r-1?[...state.board[i]]:col);
   layout();if(r===REELS)later(showWins,reduced?10:260);
  },begin+(r-1)*interval);
 }
 layout();return root;
}
