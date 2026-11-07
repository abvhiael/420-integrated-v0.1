// Racket's Trash Stash · Slot #7 · practice credits only (no wallet activity).
export const ROOT='/assets/420bet/slots/rackets-trash-stash/';
export const ROWS=3,REELS=5,MAX_WIN=5000;
export const LINES=Object.freeze([
[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
[0,0,1,0,0],[2,2,1,2,2],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
[2,1,1,1,2],[1,0,1,0,1],[1,2,1,2,1],[0,1,0,1,0],[2,1,2,1,2],
[1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,2,1,2,0]
]);
export const JARS=Object.freeze({BLUE05:.5,BLUE075:.75,PURPLE1:1,PURPLE15:1.5,RED25:2.5,RED5:5});
export const ART=Object.freeze({
RACKET:'symbols/symbol_racket.png',WILD:'symbols/symbol_wild.png',BONUS:'symbols/symbol_bonus.png',
BLUE05:'symbols/prize_blue_0_5x.png',BLUE075:'symbols/prize_blue_0_75x.png',
PURPLE1:'symbols/prize_purple_1x.png',PURPLE15:'symbols/prize_purple_1_5x.png',
RED25:'symbols/prize_red_2_5x.png',RED5:'symbols/prize_red_5x.png',
TRASH:'symbols/symbol_trash_can.png',PIZZA:'symbols/symbol_pizza.png',LIGHTER:'symbols/symbol_lighter.png',
GLOVE:'symbols/symbol_garden_glove.png',SEEDS:'symbols/symbol_seed_packet.png',
BINOCULARS:'symbols/symbol_binoculars.png',COOLER:'symbols/symbol_cooler.png',
MUSHROOM:'symbols/symbol_mushrooms.png',A:'symbols/symbol_a.png',
K:'symbols/symbol_k.png',Q:'symbols/symbol_q.png',J:'symbols/symbol_j.png',
TEN:'symbols/symbol_10.png',NINE:'symbols/symbol_9.png'
});
export const PAY=Object.freeze({RACKET:[2,10,50],TRASH:[.8,2.5,12],PIZZA:[.7,2,9],LIGHTER:[.6,1.8,8],GLOVE:[.5,1.6,7],SEEDS:[.45,1.4,6],BINOCULARS:[.4,1.2,5],COOLER:[.35,1,4],MUSHROOM:[.3,.8,3],A:[.25,.6,2.5],K:[.25,.6,2.5],Q:[.2,.5,2],J:[.2,.5,2],TEN:[.15,.4,1.5],NINE:[.15,.4,1.5]});
const BASE=['RACKET','TRASH','PIZZA','LIGHTER','GLOVE','SEEDS','BINOCULARS','COOLER','MUSHROOM','A','K','Q','J','TEN','NINE',
'TRASH','PIZZA','LIGHTER','GLOVE','SEEDS','BINOCULARS','COOLER','MUSHROOM','A','K','Q','J','TEN','NINE',
'A','K','Q','J','TEN','NINE','COOLER','MUSHROOM','TRASH','PIZZA',
'BLUE05','BLUE075','PURPLE1','PURPLE15','RED25','RED5','BONUS'];
export const asset=key=>ROOT+ART[key];
const pick=(array,rng)=>array[Math.min(array.length-1,Math.floor(rng()*array.length))];
export function spinBoard(mode='base',rng=Math.random){
 const pool=mode==='free'?BASE.filter(x=>x!=='BONUS').concat(['WILD','WILD','WILD']):BASE;
 const grid=Array.from({length:REELS},()=>Array.from({length:ROWS},()=>pick(pool,rng)));
 // At most one BONUS on each reel; wilds are exclusive to free spins.
 if(mode==='base')for(let r=0;r<REELS;r++){
  let found=false;
  for(let y=0;y<ROWS;y++)if(grid[r][y]==='BONUS'){if(found)grid[r][y]='SEEDS';else found=true;}
 }
 return grid;
}
export function evaluate(board,bet=1,mode='base',multiplier=1){
 const lineBet=bet/LINES.length,wins=[];let qualifyingWilds=new Set();
 LINES.forEach((rows,i)=>{
  const symbols=rows.map((y,r)=>board[r][y]);
  // Prize jars pay their summed total on a line starting at reel 1.
  let jars=0,sum=0;
  while(jars<REELS&&Object.hasOwn(JARS,symbols[jars]))sum+=JARS[symbols[jars++]];
  if(jars>=3)wins.push({line:i+1,rows,amount:sum*bet*multiplier,kind:'prize',length:jars});
  if(!PAY[symbols[0]]&&!['WILD'].includes(symbols[0]))return;
  const candidates=symbols[0]==='WILD'?Object.keys(PAY):[symbols[0]];
  let best=null;
  for(const name of candidates){
   let length=0,wildPositions=[];
   while(length<REELS&&(symbols[length]===name||(mode==='free'&&symbols[length]==='WILD'))){
    if(symbols[length]==='WILD')wildPositions.push(length);
    length++;
   }
   if(length<3)continue;
   const amount=PAY[name][length-3]*lineBet*multiplier;
   if(!best||best.amount<amount)best={line:i+1,rows,length,kind:'match',name,amount,wildPositions};
  }
  if(best){wins.push(best);best.wildPositions.forEach(r=>qualifyingWilds.add(r+':'+rows[r]));}
 });
 let collection=0;
 if(mode==='free'&&qualifyingWilds.size){
  let prizeSum=0;
  for(let r=1;r<REELS;r++)for(let y=0;y<ROWS;y++)prizeSum+=JARS[board[r][y]]??0;
  collection=prizeSum*bet*qualifyingWilds.size*multiplier;
 }
 const total=Math.min(MAX_WIN*bet,wins.reduce((s,w)=>s+w.amount,0)+collection);
 const bonusReels=board.filter(reel=>reel.includes('BONUS')).length;
 return {wins,total,collection,qualifyingWilds:qualifyingWilds.size,bonusReels,trigger:mode==='base'&&bonusReels>=3?({3:10,4:15,5:20}[bonusReels]):0};
}
const el=(d,tag,cls,txt)=>{const n=d.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
const btn=(d,text,handler,cls='')=>{const b=el(d,'button',cls,text);b.type='button';b.addEventListener('click',handler);return b;};
const money=n=>Number(n).toFixed(2);
export function createRacketsTrashStash(doc=globalThis.document,options={}){
 const view=doc.defaultView??globalThis,root=el(doc,'section','rts-game');
 root.dataset.practiceGame='rackets-trash-stash';
 const rng=options.rng??Math.random,reduced=view.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
 let board=spinBoard('base',rng),balance=1000,bet=1,phase='idle',info=false,autoplay=0,spins=0;
 let freeLeft=0,freeTotal=0,retriggers=0,wildProgress=0,multiplier=1,spinCount=0;
 let testOpen=false,testScenario=null; // Separate practice-only QA controls; never purchases a bonus.
 let result={wins:[],total:0,collection:0},display=board,stopped=5,winIndex=0,dead=false;
 const timers=new Set();let lastMessage='Practice credits only · no real wagering';
 const delay=(fn,ms)=>{if(dead)return;const id=view.setTimeout?.(()=>{timers.delete(id);if(!dead)fn();},ms);if(id!==undefined)timers.add(id);else fn();};
 const clear=()=>{for(const id of timers)view.clearTimeout?.(id);timers.clear();};
 root.stopAnimation=()=>{dead=true;clear();};
 root.getGameState=()=>({board,balance,bet,phase,info,autoplay,spins,freeLeft,freeTotal,retriggers,wildProgress,multiplier,result,stopped,spinCount,testOpen,testScenario});
 function startBonusTest(kind){
  if(dead||info||phase!=='idle')return;
  autoplay=0;testOpen=false;freeTotal=0;wildProgress=0;retriggers=0;multiplier=1;spinCount=0;
  const setups={three:{spins:10,trigger:3},four:{spins:15,trigger:4},five:{spins:20,trigger:5},retrigger1:{spins:10,tier:1},retrigger2:{spins:10,tier:2},retrigger3:{spins:10,tier:3},collection:{spins:10,collection:true}};
  const setup=setups[kind];if(!setup)return;
  freeLeft=setup.spins;testScenario=kind;
  if(setup.tier){retriggers=setup.tier;multiplier=[1,2,3,10][retriggers];}
  // Display an actual qualifying BONUS layout before the free-spin feature begins.
  if(setup.trigger){board=Array.from({length:5},()=>['TRASH','PIZZA','SEEDS']);
   for(let r=0;r<setup.trigger;r++)board[r][1]='BONUS';display=board;
   result={wins:[],total:0,collection:0};lastMessage='TEST · '+setup.trigger+' BONUS BAGS → '+freeLeft+' FREE SPINS';
  }else{result={wins:[],total:0,collection:0};lastMessage=setup.collection?'TEST · WILD COLLECTS PRIZE JARS':'TEST · RETRIGGER '+retriggers+' · MULTIPLIER ×'+multiplier;}
  render();
 }
 function bonusTestPanel(){
  const panel=el(doc,'section','rts-test-panel');panel.append(el(doc,'h3','','BONUS TESTS · PRACTICE ONLY'));
  const descriptions=[['three','3 BONUS · 10 FREE SPINS'],['four','4 BONUS · 15 FREE SPINS'],['five','5 BONUS · 20 FREE SPINS'],['retrigger1','RETRIGGER 1 · ×2'],['retrigger2','RETRIGGER 2 · ×3'],['retrigger3','RETRIGGER 3 · ×10'],['collection','WILD PRIZE COLLECTION']];
  for(const [key,label] of descriptions)panel.append(btn(doc,label,()=>startBonusTest(key),'rts-test-choice'));
  panel.append(el(doc,'p','','Test starts the selected practice feature without deducting credits. Spin to play the feature; bonus tests do not alter paid game odds.'));
  return panel;
 }
 const image=(path,alt,cls='')=>{const n=el(doc,'img',cls);n.src=ROOT+path;n.alt=alt;n.draggable=false;return n;};
 function render(){
  if(dead)return;
  root.replaceChildren();
  const header=el(doc,'header','rts-header');
  const reaction=phase==='spinning'?'poses/racket_scavenging_searching_trash.png':result.collection?'poses/racket_pointing_at_prize_jar_highlight_value.png':result.total>=bet*10?'emotions/racket_jackpot_celebration.png':result.total>0?'emotions/racket_happy.png':freeLeft>0?'poses/racket_carrying_loot_hauling_prize.png':'poses/racket_idle_relaxed.png';
  header.append(el(doc,'h1','','RACKET’S TRASH STASH'),el(doc,'p','','SCAVENGE · SNATCH · SCORE!'),image(reaction,'Racket the Raccoon reacting to gameplay','rts-mascot'));
  root.append(header);
  if(info){renderInfo();return;}
  const layout=el(doc,'div','rts-layout'),game=el(doc,'div','rts-main'),side=el(doc,'aside','rts-side');
  const status=el(doc,'div','rts-status');
  status.append(el(doc,'strong','',freeLeft>0?'FREE SPINS · '+freeLeft+' LEFT · ×'+multiplier:'20 FIXED PAYLINES · PRACTICE'),el(doc,'span','', 'SPINS '+spinCount));
  game.append(status);
  const stage=el(doc,'div','rts-stage');stage.setAttribute('aria-label','Five reels, three rows');
  const grid=el(doc,'div','rts-grid');
  for(let r=0;r<REELS;r++){
   const reel=el(doc,'div','rts-reel'+(phase==='spinning'&&r>=stopped?' rts-spinning':''));
   for(let y=0;y<ROWS;y++){
    const cell=el(doc,'div','rts-cell');const sym=display[r][y];
    const pic=image(ART[sym],sym);cell.append(pic);reel.append(cell);
   }
   if(phase==='spinning'&&r>=stopped){
    const roll=el(doc,'div','rts-roll'),track=el(doc,'div','rts-roll-track');
    const symbols=['TRASH','PIZZA','RACKET','COOLER','MUSHROOM','GLOVE','BLUE05','A','SEEDS','WILD','K','PURPLE1'];
    for(let i=0;i<24;i++)track.append(image(ART[symbols[i%symbols.length]],''));
    roll.append(track);reel.append(roll);
   }
   grid.append(reel);
  }
  stage.append(grid);
  if(phase==='show-wins'&&result.wins.length){
   const win=result.wins[winIndex%result.wins.length];
   const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
   svg.setAttribute('viewBox','0 0 500 300');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('class','rts-lines');
   const path=doc.createElementNS('http://www.w3.org/2000/svg','polyline');
   const points=[[0,50+win.rows[0]*100],...win.rows.map((y,r)=>[50+r*100,50+y*100]),[500,50+win.rows[4]*100]];
   path.setAttribute('points',points.map(p=>p.join(',')).join(' '));
   path.setAttribute('class','rts-win-line');svg.append(path);stage.append(svg);
   stage.append(el(doc,'div','rts-win-note','LINE '+win.line+' · +'+money(win.amount)));
  }
  game.append(stage,el(doc,'div','rts-message',lastMessage));
  const controls=el(doc,'div','rts-controls');
  const spin=btn(doc,phase==='spinning'?'SPINNING…':freeLeft>0?'FREE SPIN':'SPIN',()=>startSpin(),'rts-spin-button');
  spin.disabled=phase==='spinning'||phase==='show-wins'||(freeLeft===0&&balance<bet);
  const smaller=btn(doc,'−',()=>{bet=Math.max(.2,Math.round((bet-.2)*100)/100);render();});
  const larger=btn(doc,'+',()=>{bet=Math.min(50,Math.round((bet+.2)*100)/100);render();});
  smaller.disabled=larger.disabled=phase!=='idle'||freeLeft>0;
  const auto=btn(doc,autoplay?'STOP AUTO ('+autoplay+')':'AUTOSPINS',()=>{autoplay=autoplay?0:10;render();if(autoplay&&phase==='idle')startSpin();});
  auto.disabled=freeLeft>0&&!autoplay;
  controls.append(el(doc,'span','','BALANCE '+money(balance)),smaller,el(doc,'span','','BET '+money(bet)),larger,spin,auto,el(doc,'span','','WIN '+money(result.total)),btn(doc,'INFO',()=>{if(phase==='idle'){autoplay=0;info=true;render();}}));
  game.append(controls);
  const tests=btn(doc,testOpen?'HIDE BONUS TESTS':'BONUS TESTS',()=>{if(phase!=='idle'||freeLeft>0)return;testOpen=!testOpen;render();},'rts-test-toggle');
  tests.disabled=phase!=='idle'||freeLeft>0;
  game.append(tests);if(testOpen)game.append(bonusTestPanel());
  const payouts=el(doc,'section','rts-panel');payouts.append(el(doc,'h2','','PAYOUTS'));
  payouts.append(el(doc,'p','','Values below are multiples of the bet per line (3 / 4 / 5 symbols).'));
  const table=el(doc,'table','rts-payout-table');const head=el(doc,'tr');
  ['SYMBOL','3','4','5'].forEach(x=>head.append(el(doc,'th','',x)));table.append(head);
  for(const [name,vals] of Object.entries(PAY)){
   const tr=el(doc,'tr');const sym=el(doc,'td');sym.append(image(ART[name],name));tr.append(sym);
   vals.forEach(v=>tr.append(el(doc,'td','',String(v)+'×')));table.append(tr);
  }
  payouts.append(table);
  const bonus=el(doc,'section','rts-panel');
  bonus.append(el(doc,'h2','','BONUS TRIGGERS'),
   el(doc,'p','','3 BONUS bags = 10 Free Spins; 4 = 15; 5 = 20. One per reel maximum.'),
   el(doc,'p','','During Free Spins, every fourth Wild used in a winning line adds 10 spins (maximum three retriggers). Multipliers advance ×2 → ×3 → ×10.'),
   el(doc,'p','','Every winning Wild also collects all prize jars visible on reels 2–5. Blue: ×0.5 / ×0.75 · Purple: ×1 / ×1.5 · Red: ×2.5 / ×5.'),
   el(doc,'p','',freeLeft?'FEATURE WIN '+money(freeTotal)+' · WILD PROGRESS '+wildProgress+'/4':'3+ consecutive prize jars on a line pay their summed values × total bet.'));
  side.append(payouts,bonus);layout.append(game,side);root.append(layout,el(doc,'p','rts-disclaimer','Practice game only. RTP not yet calibrated or certified; credits have no cash value.'));
 }
 function renderInfo(){
  const panel=el(doc,'section','rts-info');
  panel.append(btn(doc,'← BACK TO GAME',()=>{info=false;render();},'rts-back'),el(doc,'h2','','HOW TO PLAY · PAYLINES'));
  panel.append(el(doc,'p','','5 reels × 3 rows · 20 fixed lines · awards pay left to right on consecutive reels. Highest ordinary-symbol win per line. Total wager is split equally across 20 lines.'));
  panel.append(el(doc,'p','','BONUS: 3/4/5 BONUS bags on separate reels award 10/15/20 free spins. Every fourth Wild used by a winning combination adds 10 spins, to a maximum of three retriggers. The free-spin multiplier then becomes ×2, ×3, and ×10.'));
  panel.append(el(doc,'p','','Prize jars: 3 or more consecutive jars on a line pay their summed values times total bet. During free spins, each qualifying winning Wild collects all visible prize jars on reels 2–5. Wilds substitute for normal symbols but not BONUS or prize jars.'));
  panel.append(el(doc,'p','','Only practice credits are used. No real-money betting, bonus purchases, financial transactions, or certified RTP are claimed.'));
  const map=el(doc,'div','rts-payline-map');
  LINES.forEach((rows,i)=>{
   const item=el(doc,'div','rts-payline-mini');
   item.append(el(doc,'strong','','LINE '+(i+1)));
   const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 150 90');
   for(let r=0;r<5;r++)for(let y=0;y<3;y++){
    const rect=doc.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('x',String(r*30+2));rect.setAttribute('y',String(y*30+2));rect.setAttribute('width','26');rect.setAttribute('height','26');rect.setAttribute('rx','3');rect.setAttribute('class','rts-map-cell');svg.append(rect);
   }
   const line=doc.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('points',rows.map((y,r)=>(15+r*30)+','+(15+y*30)).join(' '));line.setAttribute('class','rts-map-line');svg.append(line);item.append(svg);map.append(item);
  });
  panel.append(map);panel.append(btn(doc,'BACK TO GAME',()=>{info=false;render();},'rts-back'));
  root.append(panel);
 }
 function endSpin(){
  phase='idle';
  if(freeLeft===0&&(retriggers||testScenario)){lastMessage='FEATURE COMPLETE · TOTAL '+money(freeTotal);retriggers=0;freeTotal=0;multiplier=1;wildProgress=0;testScenario=null;}
  render();
  if(autoplay>0){autoplay--;if(autoplay>0&&balance>=bet||autoplay>0&&freeLeft>0)delay(startSpin,250);else{autoplay=0;render();}}
 }
 function settle(next){
  board=next;display=board;
  const inFree=freeLeft>0;
  result=evaluate(board,bet,inFree?'free':'base',inFree?multiplier:1);
  balance+=result.total;spins++;spinCount++;if(inFree){freeLeft--;freeTotal+=result.total;
   wildProgress+=result.qualifyingWilds;
   while(wildProgress>=4&&retriggers<3){wildProgress-=4;retriggers++;freeLeft+=10;multiplier=[1,2,3,10][retriggers];lastMessage='RETRIGGER! +10 FREE SPINS · ×'+multiplier;}
   if(retriggers===3)wildProgress=Math.min(wildProgress,3);
  }else if(result.trigger){freeLeft=result.trigger;freeTotal=0;retriggers=0;wildProgress=0;multiplier=1;spinCount=0;lastMessage='BONUS! '+freeLeft+' FREE SPINS AWARDED';}
  else lastMessage=result.total?'WIN '+money(result.total):'NO WIN · KEEP SCAVENGING';
  if(result.collection)lastMessage='WILDS COLLECT PRIZES +'+money(result.collection)+' · '+lastMessage;
  if(result.wins.length){
   phase='show-wins';winIndex=0;render();
   const cycle=()=>{if(dead||phase!=='show-wins')return;winIndex++;
    if(winIndex>=Math.min(5,result.wins.length)){endSpin();return;}render();delay(cycle,470);};
   delay(cycle,reduced?20:550);
  }else endSpin();
 }
 function startSpin(){
  if(dead||info||phase!=='idle')return;
  const inFree=freeLeft>0;if(!inFree&&balance<bet){autoplay=0;return;}
  if(!inFree)balance=Math.round((balance-bet)*100)/100;
  phase='spinning';stopped=0;result={wins:[],total:0,collection:0};lastMessage=inFree?'FREE SPIN · ×'+multiplier:'RACKET IS SCAVENGING…';
  const target=spinBoard(inFree?'free':'base',rng);
  if(inFree&&testScenario==='collection'){
   // Deterministic demonstration: winning Wild on reel 1 and three prize jars
   // on reels 2–4. The existing evaluator calculates actual collection value.
   target[0][1]='WILD';target[1][1]='RACKET';target[2][1]='RACKET';
   target[1][0]='BLUE075';target[2][0]='PURPLE15';target[3][0]='RED5';
   testScenario=null;
  }
  render();
  const stop=()=>{if(dead)return;stopped++;if(stopped===5){settle(target);return;}render();delay(stop,reduced?15:220);};
  delay(stop,reduced?15:620);
 }
 render();return root;
}
