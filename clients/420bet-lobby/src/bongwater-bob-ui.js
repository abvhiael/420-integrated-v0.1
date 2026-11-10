// Bongwater Bob's Bad Decisions — self-contained, practice-credit-only classic slot.
const ROOT='/assets/420bet/bongwater-bob-bad-decisions/';
const img=(folder,name)=>ROOT+folder+'/'+name+'.png';
const icons={pizza:'symbol-leftover-pizza',bill:'symbol-unpaid-bill',burrito:'symbol-flaming-microwave-burrito',bag:'symbol-suspicious-weed-bag',lighter:'symbol-lighter',ashtray:'symbol-ashtray-roaches',papers:'symbol-rolling-papers',snack:'symbol-moldy-snack',couch:'symbol-couch-on-fire',wild:'symbol-bob-wild',pick:'symbol-pick-bonus-trigger',free:'symbol-free-spins-trigger'};
const names={pizza:'Leftover Pizza',bill:'Unpaid Bill',burrito:'Flaming Burrito',bag:'Suspicious Weed Bag',lighter:'Lighter',ashtray:'Ashtray',papers:'Rolling Papers',snack:'Moldy Snack',couch:'Couch on Fire',wild:'Bob WILD',pick:'Bad Decisions',free:'One More Hit'};
const pays={pizza:6,bill:5,burrito:30,bag:20,lighter:10,ashtray:6,papers:5,snack:8,couch:12,wild:75};
const bonusObjects=['backpack','bathroom-cabinet','filthy-couch-cushion','laundry-hamper','microwave','mini-fridge','pizza-box','snack-cupboard','tool-box'];
const paylines=[[0,0,0],[1,1,1],[2,2,2],[0,1,0],[2,1,2]];
// Deliberately provisional strips: this is NOT a calibrated RTP or certified game.
const base=[
['pizza','bill','bag','ashtray','free','snack','lighter','burrito','papers','pick','couch','pizza','wild','bill','bag','papers','snack','lighter','free','burrito','ashtray','pizza','pick','bill','couch','bag','papers','snack','wild','lighter','burrito','ashtray','pizza','bill','couch','free','snack','papers','bag','pick','lighter','ashtray'],
['bill','pizza','free','bag','snack','ashtray','papers','pick','burrito','lighter','wild','couch','bill','bag','pizza','snack','free','ashtray','papers','burrito','lighter','pick','couch','bill','bag','snack','pizza','wild','papers','ashtray','lighter','free','burrito','couch','bag','bill','pizza','snack','pick','papers','lighter','ashtray'],
['snack','papers','bill','bag','wild','pizza','couch','pick','lighter','ashtray','free','burrito','snack','papers','bill','bag','pizza','couch','ashtray','free','lighter','pick','snack','burrito','papers','bill','bag','wild','pizza','lighter','ashtray','couch','free','snack','papers','bill','bag','pick','burrito','pizza','lighter','ashtray']
];
// Preserve the existing free-spin strips, then double their WILD counts exactly.
const freeWildSource=base.map(strip=>strip.map((s,i)=>s==='pick'?(i%2===0?'wild':'bag'):s));
const freeStrips=freeWildSource.map((strip,reel)=>{
 const original=strip.filter(symbol=>symbol==='wild').length;
 const result=[...strip];
 const candidates=[...result.keys()].filter(i=>!['wild','free','pick'].includes(result[i]));
 // Fixed, reproducible distribution around each circular strip, not arbitrary per-spin substitutions.
 for(let n=0;n<original;n++){const at=Math.floor((n+.5)*candidates.length/original);result[candidates[(at+reel)%candidates.length]]='wild';}
 if(result.filter(symbol=>symbol==='wild').length!==original*2)throw new Error('Free-spin WILD distribution failed');
 return Object.freeze(result);
});
const rand=n=>Math.floor(Math.random()*n);
const choice=a=>a[rand(a.length)];
const el=(d,tag,cls='',value)=>{const n=d.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
function gridFrom(stops,strips){return stops.map((stop,i)=>[0,1,2].map(row=>strips[i][(stop+row)%strips[i].length]));}
function evaluate(grid,stake,multiplier=1){
 const perLine=stake/5;let total=0;const winners=[];
 paylines.forEach((line,i)=>{const triple=line.map((r,c)=>grid[c][r]);if(triple.some(s=>s==='pick'||s==='free'))return;
 let symbol=triple.find(s=>s!=='wild')??'wild';if(!triple.every(s=>s===symbol||s==='wild'))return;
 const amount=(pays[symbol]??0)*perLine*multiplier;total+=amount;winners.push({line:i+1,symbol,amount});});
 return {total,winners};
}
function sample(stake,freeMode=false){const strips=freeMode?freeStrips:base;const stops=strips.map(s=>rand(s.length));const grid=gridFrom(stops,strips);const result=evaluate(grid,stake,freeMode?2:1);const count=s=>grid.flat().filter(v=>v===s).length;return {...result,grid,pick:!freeMode&&count('pick')>=3,free:count('free')>=3};}
function pickThree(){const pool=[...bonusObjects];const result=[];for(let i=0;i<3;i++)result.push(pool.splice(rand(pool.length),1)[0]);return result;}
const awards=[5,10,20,35,50];
const faces={idle:'bongwater-bob-01-default',loss:'bongwater-bob-06-side-eye',win:'bongwater-bob-04-laughing',big:'bongwater-bob-17-mind-blown',pick:'bongwater-bob-22-mischievous',free:'bongwater-bob-12-dizzy',end:'bongwater-bob-18-celebration'};
export {evaluate,gridFrom,sample,pickThree,paylines,pays,base,freeStrips,bonusObjects};
export function createBongwaterBobPractice(doc=globalThis.document){
 let credits=10000,bet=2,totalWin=0,mode='base',freeRemaining=0,freeGranted=0,freeTotal=0,busy=false,disposed=false;let pendingPick=null,testingMode=false;const spinTimers=new Set();let spinInterval=null;
 const root=el(doc,'section','bob-slot');root.setAttribute('aria-label',"Bongwater Bob's Bad Decisions — practice slot");
 const header=el(doc,'header','bob-slot-title');const logo=el(doc,'img');logo.src=img('branding','bongwater-bobs-bad-decisions-logo');logo.alt="Bongwater Bob's Bad Decisions";header.append(logo);
 const scene=el(doc,'div','bob-scene');
 const paytable=el(doc,'section','bob-paytable');
 const payHeading=el(doc,'h2','','BOB\'S TERRIBLE PAYTABLE');paytable.append(payHeading);
 for(const [symbol,value] of Object.entries(pays)){
  const row=el(doc,'div','bob-pay-row');const icon=el(doc,'img');icon.src=img('symbols',icons[symbol]);icon.alt='';
  row.append(icon,el(doc,'span','',names[symbol]),el(doc,'strong','',value+'× LINE BET'));paytable.append(row);
 }
 const payFoot=el(doc,'p','','Five fixed paylines · WILD substitutes · 3 matching symbols to win');
 paytable.append(payFoot);
 // Keep the wallpaper's illustrated Bob unobstructed; no duplicate foreground character.
 const machine=el(doc,'div','bob-machine');const title=el(doc,'div','bob-reel-caption','THREE REELS · FIVE FIXED LINES');
 const board=el(doc,'div','bob-board');const tiles=[];for(let row=0;row<3;row++){for(let c=0;c<3;c++){const cell=el(doc,'div','bob-cell');const picture=el(doc,'img');picture.alt='';cell.append(picture);board.append(cell);tiles.push(picture);}}
 // Overlay only: never adds an extra grid cell or affects reel evaluation.
 const paylineSvg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
 paylineSvg.setAttribute('viewBox','0 0 300 300');
 paylineSvg.setAttribute('preserveAspectRatio','none');
 paylineSvg.setAttribute('class','bob-payline-overlay');
 paylineSvg.setAttribute('aria-hidden','true');
 board.append(paylineSvg);
 const status=el(doc,'div','bob-status');status.setAttribute('aria-live','polite');machine.append(title,board,paytable,status);scene.append(machine);
 const bonus=el(doc,'div','bob-bonus');bonus.hidden=true;scene.append(bonus);
 const panel=el(doc,'div','bob-panel');const creditLabel=el(doc,'div','bob-meter'),betLabel=el(doc,'div','bob-meter'),winLabel=el(doc,'div','bob-meter');
 const smaller=el(doc,'button','','BET −'),larger=el(doc,'button','','BET +'),spin=el(doc,'button','bob-spin','SPIN'),info=el(doc,'button','','INFO'),testPick=el(doc,'button','bob-test','TEST PICK BONUS'),testFree=el(doc,'button','bob-test','TEST FREE SPINS');
 [smaller,larger,spin,info,testPick,testFree].forEach(b=>b.type='button');
 panel.append(creditLabel,smaller,betLabel,larger,winLabel,info,testPick,testFree);
 const spinDock=el(doc,'div','bob-spin-dock');spinDock.append(spin);machine.append(spinDock);
 const details=el(doc,'div','bob-rules');details.hidden=true;details.textContent='Practice credits only. 3×3 reels, five fixed paylines. Three matching symbols on a line pay; Bob WILD substitutes for ordinary symbols. Three BAD DECISIONS symbols anywhere trigger a pick bonus: three different objects are sampled from nine, and the prize is chosen independently of the object artwork. Three ONE MORE HIT symbols anywhere award 8 free spins with 2× line wins. Retriggers award 8 more, with a maximum of 24 awarded spins. Reel strips and RTP are provisional and not certified.';
 root.append(header,scene,panel,details);
 const money=n=>n.toFixed(2);
 function face(key){root.dataset.bobReaction=key;}
 function wallpaper(kind){scene.style.backgroundImage='url("'+img('backgrounds',kind==='pick'?'bob-pick-bonus-wallpaper':kind==='free'?'bob-free-spins-wallpaper':'bob-base-game-wallpaper')+'")';}
 function paintColumn(col,values){for(let row=0;row<3;row++){const symbol=values[row],picture=tiles[row*3+col];picture.src=img('symbols',icons[symbol]);picture.alt=names[symbol];}}
 function paint(grid){for(let c=0;c<3;c++)paintColumn(c,grid[c]);}
 function clearPaylines(){paylineSvg.replaceChildren();}
 function showWinningPaylines(winners){
  clearPaylines();
  for(const {line} of winners){
   const rows=paylines[line-1];if(!rows)continue;
   const points=[[0,50+100*rows[0]],...rows.map((row,col)=>[50+100*col,50+100*row]),[300,50+100*rows[2]]];
   const d=points.map(([x,y],i)=>(i===0?'M':'L')+x+' '+y).join(' ');
   const glow=doc.createElementNS('http://www.w3.org/2000/svg','path');
   glow.setAttribute('d',d);glow.setAttribute('class','bob-payline-glow');
   const core=doc.createElementNS('http://www.w3.org/2000/svg','path');
   core.setAttribute('d',d);core.setAttribute('class','bob-payline-core');
   paylineSvg.append(glow,core);
  }
 }
 function schedule(fn,ms){const id=setTimeout(()=>{spinTimers.delete(id);if(!disposed)fn();},ms);spinTimers.add(id);}
 function clearSpin(){if(spinInterval!==null){clearInterval(spinInterval);spinInterval=null;}for(const id of spinTimers)clearTimeout(id);spinTimers.clear();board.classList.remove('bob-reels-spinning');}
 function animate(result,finished){
  const strips=mode==='free'?freeStrips:base;let positions=strips.map(s=>rand(s.length));const stopped=[false,false,false];
  board.classList.add('bob-reels-spinning');message('BOB IS MAKING QUESTIONABLE CHOICES...');
  spinInterval=setInterval(()=>{if(disposed)return;for(let c=0;c<3;c++)if(!stopped[c]){positions[c]=(positions[c]+1)%strips[c].length;paintColumn(c,[0,1,2].map(offset=>strips[c][(positions[c]+offset)%strips[c].length]));}},65);
  [900,1575,2250].forEach((duration,col)=>schedule(()=>{
   stopped[col]=true;paintColumn(col,result.grid[col]);const column=board.querySelectorAll('.bob-cell:nth-child(3n + '+(col+1)+')');
   for(const cell of column){cell.classList.remove('bob-reel-landed');void cell.offsetWidth;cell.classList.add('bob-reel-landed');}
   if(col===2){clearSpin();finished();}
  },duration));
 }
 function meters(){creditLabel.textContent='CREDITS '+money(credits);betLabel.textContent='BET '+money(bet);winLabel.textContent='WIN '+money(totalWin);spin.textContent=mode==='free'?'FREE SPIN ('+freeRemaining+')':'SPIN';spin.disabled=busy||mode==='pick';smaller.disabled=larger.disabled=busy||mode!=='base';testPick.disabled=testFree.disabled=busy||mode!=='base';}
 function message(s){status.textContent=s;}
 function finishFeature(){mode='base';freeRemaining=0;freeGranted=0;wallpaper('base');face('end');message('FREE SPINS COMPLETE! TOTAL '+money(freeTotal)+(testingMode?' · DEMO ONLY':''));testingMode=false;meters();}
 function settle(result){
  showWinningPaylines(result.winners);
  totalWin=result.total;if(!testingMode)credits+=result.total;if(mode==='free')freeTotal+=result.total;
  face(result.total>=bet*20?'big':result.total>0?'win':'loss');
  message(result.winners.length?result.winners.map(w=>'LINE '+w.line+' '+money(w.amount)).join(' · '):'BOB MADE ANOTHER BAD DECISION');
  if(mode==='base'&&result.pick){pendingPick={options:pickThree(),award:choice(awards)*bet};mode='pick';wallpaper('pick');face('pick');showPick();}
  else if(result.free){if(mode==='base'){mode='free';freeGranted=8;freeRemaining=8;freeTotal=0;wallpaper('free');face('free');message('JUST ONE MORE HIT! 8 FREE SPINS · 2× LINE WINS');}else{const additional=Math.min(8,24-freeGranted);freeGranted+=additional;freeRemaining+=additional;message(additional?'BOB FOUND '+additional+' MORE FREE SPINS!':'24 FREE SPINS MAXIMUM');}}
  else if(mode==='free'&&freeRemaining===0)finishFeature();
  busy=false;meters();
 }
 function drawSpin(){
  if(disposed||busy||mode==='pick')return;
  if(mode==='base'&&credits<bet){message('NOT ENOUGH PRACTICE CREDITS');return;}
  if(mode==='base')credits-=bet;
  if(mode==='free')freeRemaining--;
  busy=true;clearPaylines();meters();
  const result=sample(bet,mode==='free');
  animate(result,()=>settle(result));
 }
 function startTest(kind){
  if(disposed||busy||mode!=='base')return;
  testingMode=true;totalWin=0;clearPaylines();
  if(kind==='pick'){pendingPick={options:pickThree(),award:choice(awards)*bet};mode='pick';wallpaper('pick');face('pick');showPick();message('TEST MODE: PICK ANY ONE OF THE THREE RANDOM PROPS');}
  else {mode='free';freeGranted=8;freeRemaining=8;freeTotal=0;wallpaper('free');face('free');message('TEST MODE: EIGHT FREE SPINS, NO CREDIT CHANGES');}
  meters();
 }
 function showPick(){
 bonus.replaceChildren();bonus.hidden=false;const branding=el(doc,'img','bob-bonus-logo');branding.src=img('branding','whats-the-worst-that-could-happen-logo');branding.alt="What's the Worst That Could Happen?";
 const heading=el(doc,'p','','PICK ONE TERRIBLE DECISION');const choices=el(doc,'div','bob-choices');for(const name of pendingPick.options){const b=el(doc,'button','bob-object');b.type='button';const picture=el(doc,'img');picture.src=img('bonus-objects','bonus-'+name);picture.alt=name.replaceAll('-',' ');b.append(picture);b.setAttribute('aria-label','Pick '+name.replaceAll('-',' '));b.addEventListener('click',()=>{if(mode!=='pick')return;const award=pendingPick.award;pendingPick=null;if(!testingMode)credits+=award;totalWin+=award;bonus.hidden=true;mode='base';wallpaper('base');face('big');message('WHAT COULD GO WRONG? '+money(award)+(testingMode?' TEST CREDITS (DEMO ONLY)':' PRACTICE CREDITS!'));testingMode=false;meters();});choices.append(b);}bonus.append(branding,heading,choices);
 }
 smaller.addEventListener('click',()=>{bet=Math.max(.5,bet/2);meters();});
 larger.addEventListener('click',()=>{bet=Math.min(20,bet*2);meters();});
 spin.addEventListener('click',drawSpin);testPick.addEventListener('click',()=>startTest('pick'));testFree.addEventListener('click',()=>startTest('free'));info.addEventListener('click',()=>{details.hidden=!details.hidden;});
 wallpaper('base');face('idle');paint(gridFrom([0,5,10],base));message('ONE MORE HIT. WHAT COULD POSSIBLY GO WRONG?');meters();
 root.stopAnimation=()=>{disposed=true;clearSpin();};
 return root;
}