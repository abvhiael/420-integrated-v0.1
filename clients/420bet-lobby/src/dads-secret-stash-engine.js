// Dad's Secret Stash — browser-only practice mathematics. NOT a certified real-money game.
export const ROWS=4, COLS=5, MAX_WIN_MULTIPLIER=10000;
export const SYMBOLS=Object.freeze(['gary','jen','tyler','emma','keller','bud','jar','bong','pizza','lighter','papers','A','K','Q','J','10','wild','scatter','stash','mower']);
const WEIGHTS=Object.freeze([3,4,5,5,4,5,7,7,10,12,12,14,14,14,14,14,3,2,3,2]);
// A separate low-Wild strip distribution applies only to free spins. The
// main reel weights and primary paytable stay unchanged during calibration.
export const FREE_WEIGHTS=Object.freeze(WEIGHTS.map((weight,i)=>SYMBOLS[i]==='wild'?2:weight));
export const FREE_STICKY_LIMIT=6;
export const FREE_MULTIPLIER_STAGES=Object.freeze([1,2,4]);
export const PAY=Object.freeze({gary:[0,.3,1,4],jen:[0,.25,.8,3],tyler:[0,.2,.65,2.5],emma:[0,.2,.65,2.5],keller:[0,.2,.65,2.5],bud:[0,.2,.65,2.5],jar:[0,.16,.5,2],bong:[0,.16,.5,2],pizza:[0,.1,.3,1],lighter:[0,.08,.25,.8],papers:[0,.08,.25,.8],A:[0,.05,.16,.5],K:[0,.05,.16,.5],Q:[0,.05,.16,.5],J:[0,.05,.16,.5],'10':[0,.05,.16,.5]});
export const CHARACTERS=Object.freeze({jen:{min:3},family:{min:1},keller:{min:3},bud:{min:3}});
const PREMIUM=new Set(['gary','jen','tyler','emma','keller','bud','jar','bong']);
const LOW=new Set(['A','K','Q','J','10','papers','lighter','pizza']);
const rand=(rng)=>{const value=rng();if(!(value>=0&&value<1))throw Error('RNG must return a number in [0,1)');return value;};
const integer=(rng,n)=>Math.floor(rand(rng)*n);
export function choose(rng,items){return items[integer(rng,items.length)];}
function weightedDraw(rng,weights){let n=integer(rng,weights.reduce((a,b)=>a+b,0));for(let i=0;i<SYMBOLS.length;i++){n-=weights[i];if(n<0)return SYMBOLS[i];}return '10';}
export function draw(rng){return weightedDraw(rng,WEIGHTS);}
export function board(rng){return Array.from({length:ROWS*COLS},()=>draw(rng));}
const freeDraw=rng=>weightedDraw(rng,FREE_WEIGHTS);
const freeBoard=rng=>Array.from({length:ROWS*COLS},()=>freeDraw(rng));
const freeNonWild=rng=>{let symbol;do{symbol=freeDraw(rng);}while(symbol==='wild');return symbol;};
export function count(grid,symbol){return grid.filter(s=>s===symbol).length;}
export function qualify(grid){return {jen:count(grid,'jen')>=3,family:count(grid,'tyler')>0&&count(grid,'emma')>0,keller:count(grid,'keller')>=3,bud:count(grid,'bud')>=3};}
export function triggerCharacters(grid,rng){const flags=qualify(grid);return Object.fromEntries(Object.keys(flags).map(k=>[k,flags[k]&&rand(rng)<.25]));}
export function evaluate(grid){if(grid.length!==20)throw Error('Expected five reels, four rows');let units=0;const wins=[];for(const [symbol,pay] of Object.entries(PAY)){let ways=1,matched=0;for(let reel=0;reel<COLS;reel++){const hits=grid.slice(reel*ROWS,reel*ROWS+ROWS).filter(x=>x===symbol||x==='wild').length;if(!hits)break;ways*=hits;matched++;}if(matched>=3){const multiplier=pay[matched-2];const amount=ways*multiplier;units+=amount;wins.push({symbol,matched,ways,amount});}}return {units,wins};}
export function replaceRandom(grid,rng,eligible,replacement,n){const out=grid.slice(),available=out.map((s,i)=>eligible(s,i)?i:-1).filter(i=>i>=0);for(let k=0;k<n&&available.length;k++){const p=integer(rng,available.length);out[available.splice(p,1)[0]]=replacement;}return out;}
export function modifier(grid,type,rng){let out=grid.slice(),label='';if(type==='jen'){const event=choose(rng,['HIDE THE STASH','PANIC WILDS','GARAGE CLEANUP','CAUGHT RED-HANDED']);label=event;if(event==='HIDE THE STASH')out=replaceRandom(out,rng,s=>s!=='scatter'&&s!=='stash','stash',2+integer(rng,4));if(event==='PANIC WILDS')out=replaceRandom(out,rng,s=>s!=='scatter'&&s!=='wild','wild',2+integer(rng,3));if(event==='GARAGE CLEANUP')out=out.map(s=>LOW.has(s)?choose(rng,[...PREMIUM]):s);return {grid:out,label,multiplier:event==='CAUGHT RED-HANDED'?2+integer(rng,2):1};}
if(type==='family'){const event=choose(rng,['LOW SYMBOL UPGRADE','WILD GRAFFITI','SCATTER SCRAMBLE','GARAGE MAYHEM']);label=event;if(event==='LOW SYMBOL UPGRADE')out=out.map(s=>LOW.has(s)?choose(rng,[...PREMIUM]):s);if(event==='WILD GRAFFITI')out=replaceRandom(out,rng,s=>s!=='scatter'&&s!=='stash','wild',2);if(event==='SCATTER SCRAMBLE')out=replaceRandom(out,rng,s=>s!=='scatter','scatter',1+integer(rng,2));if(event==='GARAGE MAYHEM')out=replaceRandom(out,rng,s=>LOW.has(s),choose(rng,[...PREMIUM]),3+integer(rng,3));return {grid:out,label,multiplier:1};}
if(type==='bud')return {grid:replaceRandom(out,rng,s=>s!=='wild'&&s!=='scatter'&&s!=='stash','wild',3),label:'FETCH WILD!',multiplier:1};
throw Error('Unknown modifier');}
export function inspection(grid,rng){
 const spins=5;
 const locked=new Map(grid.map((s,i)=>PREMIUM.has(s)?[i,s]:null).filter(Boolean));
 let total=0;const boards=[];
 for(let n=0;n<spins;n++){
  const next=board(rng),prior=new Set(locked.keys());
  for(const [i,s] of locked)next[i]=s;
  const newLocks=[];
  next.forEach((s,i)=>{if(PREMIUM.has(s)&&!prior.has(i)){locked.set(i,s);newLocks.push(i);}});
  const units=evaluate(next).units;total+=units;
  boards.push({grid:next,units,newLocks,locked:[...locked.keys()]});
 }
 return {label:'HOA INSPECTION',spins,boards,units:total,locked:[...locked.keys()]};
}
// Practice-only Hold & Win: 3 initial crates, 3 respins, new prizes lock and
// replenish the respins. The complete generated timeline determines the award;
// the UI must replay every snapshot before returning to the base reels.
export function stashBonus(rng){
 const slots=Array(ROWS*COLS).fill(null),values=[.132,.33,.66,.99,1.32,1.98,3.3,6.6];
 const start=[];
 for(let i=0;i<3;i++){
  const free=slots.map((v,k)=>v===null?k:-1).filter(k=>k>=0);
  const index=choose(rng,free);slots[index]=choose(rng,values);start.push(index);
 }
 const steps=[{board:slots.slice(),newIndices:start,remaining:3,kind:'start',number:0}];
 let remaining=3,number=0;
 while(remaining>0&&number<40&&slots.some(v=>v===null)){
  number++;const added=[];
  for(let i=0;i<slots.length;i++){
   if(slots[i]===null&&rand(rng)<.075){slots[i]=choose(rng,values);added.push(i);}
  }
  remaining=added.length?3:remaining-1;
  steps.push({board:slots.slice(),newIndices:added,remaining,kind:'respin',number});
 }
 const prizes=slots.filter(v=>v!==null);
 const units=Math.round(prizes.reduce((a,b)=>a+b,0)*100)/100;
 return {spins:number,steps,prizes,units,filled:prizes.length,
  completed:prizes.length===slots.length,label:'SECRET STASH HOLD & WIN'};
}
export function freeBonus(rng){
 // 8/15/22 free spins stay intact. Sticky positions persist but can accumulate
 // at most six Wilds across the 5×4 board, preventing 1,024-ways saturation.
 // The initial free-spin strips are lighter on Wilds than the base game.
 const spins=8+integer(rng,3)*7;let total=0;
 const sticky=new Map(),boards=[];
 for(let spin=0;spin<spins;spin++){
  const grid=freeBoard(rng),previous=[...sticky.keys()];
  for(const [i,s] of sticky)grid[i]=s;
  const newWilds=[];
  grid.forEach((symbol,i)=>{
   if(symbol!=='wild'||sticky.has(i))return;
   if(sticky.size<FREE_STICKY_LIMIT){sticky.set(i,'wild');newWilds.push(i);}
   else grid[i]=freeNonWild(rng);
  });
  const mult=spin<6?FREE_MULTIPLIER_STAGES[0]:
   spin<12?FREE_MULTIPLIER_STAGES[1]:FREE_MULTIPLIER_STAGES[2];
  const units=evaluate(grid).units*mult;total+=units;
  boards.push({grid,units,mult,sticky:[...sticky.keys()],newWilds,previous});
 }
 return {spins,boards,units:Math.round(total*100)/100,label:'FIVE MINUTES OF PEACE'};
}
export function mow(grid,rng){
 // Five visually complete mower cascades. Existing non-cleared symbols are
 // preserved; only the cut positions receive fresh symbols.
 // Triggering lawnmowers are removed BEFORE cascade 1. They cannot
 // remain as stationary blocker symbols for any of the five paid cascades.
 const mowerIndices=grid.flatMap((symbol,i)=>symbol==='mower'?[i]:[]);
 // A mower may not land again as a cascade replacement. Using a
 // deterministic fallback also prevents infinite loops with fixed test RNGs.
 const ordinaryDraw=()=>{const symbol=draw(rng);return symbol==='mower'?'A':symbol;};
 const currentStart=grid.map(symbol=>symbol==='mower'?ordinaryDraw():symbol);
 let current=currentStart.slice(),total=0;const boards=[];
 for(let n=0;n<5;n++){
  let hit=current.map((symbol,i)=>LOW.has(symbol)?i:-1).filter(i=>i>=0);
  // On a depleted board, cut a few non-special positions so all five
  // advertised cascades actually play; avoid bonus triggers and sticky Wilds.
  if(!hit.length)hit=current.map((symbol,i)=>!['wild','scatter','stash','mower'].includes(symbol)?i:-1).filter(i=>i>=0);
  if(!hit.length){boards.push({grid:current.slice(),before:current.slice(),removed:[],units:0});continue;}
  const removed=hit.slice(0,Math.min(hit.length,4+integer(rng,3)));
  const before=current.slice();
  // Introduce recurring symbols within a cascade to create opportunities for
  // 1,024-ways matches, but do not guarantee a win or alter awards after spin.
  const candidate=choose(rng,['A','K','Q','jar','bong']);
  current=current.map((symbol,i)=>removed.includes(i)?
   (rand(rng)<.65?candidate:ordinaryDraw()):symbol);
  const units=evaluate(current).units;total+=units;
  boards.push({grid:current.slice(),before,removed,units});
 }
 return {label:'MOW THE LAWN',initialGrid:currentStart,mowerIndices,boards,units:Math.round(total*100)/100};
}
// TEMPORARY PRACTICE QA HOOK — preview only. This builds real feature event data
// without creating a paid spin, changing any balance, or crediting the win.
// Remove with the UI test controls when bonus qualification is finished.
export const BONUS_PREVIEW_TYPES=Object.freeze([
 'stash','free','mow','jen','family','family-graffiti','keller','bud'
]);
export function makeBonusPreview(requestedType,rng=Math.random){
 if(!BONUS_PREVIEW_TYPES.includes(requestedType))throw Error('Unknown practice bonus preview');
 const type=requestedType==='family-graffiti'?'family':requestedType;
 const grid=Array.from({length:ROWS*COLS},(_,i)=>['A','K','Q','J','10'][i%5]);
 if(type==='family'){grid[0]='tyler';grid[1]='emma';}
 if(type==='jen'||type==='keller'||type==='bud'){
  for(let i=0;i<3;i++)grid[i]=type;
 }
 if(type==='stash'||type==='free'||type==='mow'){
  const symbol={stash:'stash',free:'scatter',mow:'mower'}[type];
  for(let i=0;i<3;i++)grid[i]=symbol;
 }
 let event;
 if(type==='stash')event={type,...stashBonus(rng)};
 else if(type==='free')event={type,...freeBonus(rng)};
 else if(type==='mow')event={type,...mow(grid,rng)};
 else if(type==='keller')event={type,...inspection(grid,rng)};
 else {
  // The special choice deliberately selects the second family modifier
  // while retaining the actual modifier engine and presentation sequence.
  const eventRng=requestedType==='family-graffiti'?()=>.3:rng;
  const effect=modifier(grid,type,eventRng);
  event={type,...effect,units:evaluate(effect.grid).units*effect.multiplier};
 }
 return {grid,event};
}
export function newGame(){return {balance:1000,bet:1,rounds:0,last:null,history:[],message:'Gary needs five minutes in his garage.',mode:'practice'};}
export function spin(state,rng=Math.random){if(!Number.isFinite(state.bet)||state.bet<=0||state.bet>50||state.bet>state.balance)throw Error('Invalid practice stake');const grid=board(rng),base=evaluate(grid),flags=triggerCharacters(grid,rng),events=[];let units=base.units;
for(const type of ['jen','family','keller','bud']){if(!flags[type])continue;if(type==='keller'){const event=inspection(grid,rng);units+=event.units;events.push({type,...event});}else{const event=modifier(grid,type,rng);event.units=evaluate(event.grid).units*event.multiplier;units+=event.units;events.push({type,...event});}}
if(count(grid,'scatter')>=3){const event=freeBonus(rng);units+=event.units;events.push({type:'free',...event});}
if(count(grid,'stash')>=3){const event=stashBonus(rng);units+=event.units;events.push({type:'stash',...event});}
if(count(grid,'mower')>=3){const event=mow(grid,rng);units+=event.units;events.push({type:'mow',...event});}
const win=Math.min(MAX_WIN_MULTIPLIER*state.bet,Math.round(units*state.bet*100)/100);
const next={...state,balance:Math.round((state.balance-state.bet+win)*100)/100,rounds:state.rounds+1,last:{grid,base,flags,events,win,stake:state.bet},message:events.length?events.map(e=>e.label).join(' • '):win?'GARAGE WIN!':'Just five more minutes…'};next.history=[{stake:state.bet,win,events:events.map(e=>e.type)},...state.history].slice(0,20);return next;}
