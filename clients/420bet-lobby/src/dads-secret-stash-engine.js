// Dad's Secret Stash — browser-only practice mathematics. NOT a certified real-money game.
export const ROWS=4, COLS=5, MAX_WIN_MULTIPLIER=10000;
export const SYMBOLS=Object.freeze(['gary','jen','tyler','emma','keller','bud','jar','bong','pizza','lighter','papers','A','K','Q','J','10','wild','scatter','stash','mower']);
const WEIGHTS=Object.freeze([3,4,5,5,4,5,7,7,10,12,12,14,14,14,14,14,3,2,3,2]);
export const PAY=Object.freeze({gary:[0,.3,1,4],jen:[0,.25,.8,3],tyler:[0,.2,.65,2.5],emma:[0,.2,.65,2.5],keller:[0,.2,.65,2.5],bud:[0,.2,.65,2.5],jar:[0,.16,.5,2],bong:[0,.16,.5,2],pizza:[0,.1,.3,1],lighter:[0,.08,.25,.8],papers:[0,.08,.25,.8],A:[0,.05,.16,.5],K:[0,.05,.16,.5],Q:[0,.05,.16,.5],J:[0,.05,.16,.5],'10':[0,.05,.16,.5]});
export const CHARACTERS=Object.freeze({jen:{min:3},family:{min:1},keller:{min:3},bud:{min:3}});
const PREMIUM=new Set(['gary','jen','tyler','emma','keller','bud','jar','bong']);
const LOW=new Set(['A','K','Q','J','10','papers','lighter','pizza']);
const rand=(rng)=>{const value=rng();if(!(value>=0&&value<1))throw Error('RNG must return a number in [0,1)');return value;};
const integer=(rng,n)=>Math.floor(rand(rng)*n);
export function choose(rng,items){return items[integer(rng,items.length)];}
export function draw(rng){let n=integer(rng,WEIGHTS.reduce((a,b)=>a+b,0));for(let i=0;i<SYMBOLS.length;i++){n-=WEIGHTS[i];if(n<0)return SYMBOLS[i];}return '10';}
export function board(rng){return Array.from({length:ROWS*COLS},()=>draw(rng));}
export function count(grid,symbol){return grid.filter(s=>s===symbol).length;}
export function qualify(grid){return {jen:count(grid,'jen')>=3,family:count(grid,'tyler')>0&&count(grid,'emma')>0,keller:count(grid,'keller')>=3,bud:count(grid,'bud')>=3};}
export function triggerCharacters(grid,rng){const flags=qualify(grid);return Object.fromEntries(Object.keys(flags).map(k=>[k,flags[k]&&rand(rng)<.25]));}
export function evaluate(grid){if(grid.length!==20)throw Error('Expected five reels, four rows');let units=0;const wins=[];for(const [symbol,pay] of Object.entries(PAY)){let ways=1,matched=0;for(let reel=0;reel<COLS;reel++){const hits=grid.slice(reel*ROWS,reel*ROWS+ROWS).filter(x=>x===symbol||x==='wild').length;if(!hits)break;ways*=hits;matched++;}if(matched>=3){const multiplier=pay[matched-2];const amount=ways*multiplier;units+=amount;wins.push({symbol,matched,ways,amount});}}return {units,wins};}
export function replaceRandom(grid,rng,eligible,replacement,n){const out=grid.slice(),available=out.map((s,i)=>eligible(s,i)?i:-1).filter(i=>i>=0);for(let k=0;k<n&&available.length;k++){const p=integer(rng,available.length);out[available.splice(p,1)[0]]=replacement;}return out;}
export function modifier(grid,type,rng){let out=grid.slice(),label='';if(type==='jen'){const event=choose(rng,['HIDE THE STASH','PANIC WILDS','GARAGE CLEANUP','CAUGHT RED-HANDED']);label=event;if(event==='HIDE THE STASH')out=replaceRandom(out,rng,s=>s!=='scatter'&&s!=='stash','stash',2+integer(rng,4));if(event==='PANIC WILDS')out=replaceRandom(out,rng,s=>s!=='scatter'&&s!=='wild','wild',2+integer(rng,3));if(event==='GARAGE CLEANUP')out=out.map(s=>LOW.has(s)?choose(rng,[...PREMIUM]):s);return {grid:out,label,multiplier:event==='CAUGHT RED-HANDED'?2+integer(rng,2):1};}
if(type==='family'){const event=choose(rng,['LOW SYMBOL UPGRADE','WILD GRAFFITI','SCATTER SCRAMBLE','GARAGE MAYHEM']);label=event;if(event==='LOW SYMBOL UPGRADE')out=out.map(s=>LOW.has(s)?choose(rng,[...PREMIUM]):s);if(event==='WILD GRAFFITI')out=replaceRandom(out,rng,s=>s!=='scatter'&&s!=='stash','wild',2+integer(rng,3));if(event==='SCATTER SCRAMBLE')out=replaceRandom(out,rng,s=>s!=='scatter','scatter',1+integer(rng,2));if(event==='GARAGE MAYHEM')out=replaceRandom(out,rng,s=>LOW.has(s),choose(rng,[...PREMIUM]),3+integer(rng,3));return {grid:out,label,multiplier:1};}
if(type==='bud')return {grid:replaceRandom(out,rng,s=>s!=='wild'&&s!=='scatter'&&s!=='stash','wild',2+integer(rng,4)),label:'FETCH WILD!',multiplier:1};
throw Error('Unknown modifier');}
export function inspection(grid,rng){const spins=2+integer(rng,4),locked=new Map(grid.map((s,i)=>PREMIUM.has(s)?[i,s]:null).filter(Boolean));let total=0;const boards=[];for(let n=0;n<spins;n++){const next=board(rng);for(const [i,s] of locked)next[i]=s;next.forEach((s,i)=>{if(PREMIUM.has(s))locked.set(i,s);});const units=evaluate(next).units;total+=units;boards.push({grid:next,units});}return {label:'HOA INSPECTION',spins,boards,units:total,locked:[...locked.keys()]};}
// Practice-only Hold & Win: 3 initial crates, 3 respins, new prizes lock and
// replenish the respins. The complete generated timeline determines the award;
// the UI must replay every snapshot before returning to the base reels.
export function stashBonus(rng){
 const slots=Array(ROWS*COLS).fill(null),values=[.2,.5,1,1.5,2,3,5,10];
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
   if(slots[i]===null&&rand(rng)<.085){slots[i]=choose(rng,values);added.push(i);}
  }
  remaining=added.length?3:remaining-1;
  steps.push({board:slots.slice(),newIndices:added,remaining,kind:'respin',number});
 }
 const prizes=slots.filter(v=>v!==null);
 const units=Math.round(prizes.reduce((a,b)=>a+b,0)*100)/100;
 return {spins:number,steps,prizes,units,filled:prizes.length,
  completed:prizes.length===slots.length,label:'SECRET STASH HOLD & WIN'};
}
export function freeBonus(rng){const spins=8+integer(rng,3)*7;let total=0,sticky=new Map();const boards=[];for(let spin=0;spin<spins;spin++){let grid=board(rng);for(const [i,s] of sticky)grid[i]=s;grid.forEach((s,i)=>{if(s==='wild')sticky.set(i,'wild');});const mult=Math.min(5,1+Math.floor(spin/4));const units=evaluate(grid).units*mult;total+=units;boards.push({grid,units,mult});}return {spins,boards,units:total,label:'FIVE MINUTES OF PEACE'};}
export function mow(grid,rng){let current=grid.slice(),total=0;const boards=[];for(let n=0;n<3;n++){const hit=current.map((s,i)=>LOW.has(s)?i:-1).filter(i=>i>=0);if(!hit.length)break;const selected=hit.slice(0,Math.min(hit.length,3+integer(rng,3)));current=current.map((s,i)=>selected.includes(i)?draw(rng):s);const units=evaluate(current).units;total+=units;boards.push({grid:current,units});}return {label:'MOW THE LAWN',boards,units};}
export function newGame(){return {balance:1000,bet:1,rounds:0,last:null,history:[],message:'Gary needs five minutes in his garage.',mode:'practice'};}
export function spin(state,rng=Math.random){if(!Number.isFinite(state.bet)||state.bet<=0||state.bet>50||state.bet>state.balance)throw Error('Invalid practice stake');const grid=board(rng),base=evaluate(grid),flags=triggerCharacters(grid,rng),events=[];let units=base.units;
for(const type of ['jen','family','keller','bud']){if(!flags[type])continue;if(type==='keller'){const event=inspection(grid,rng);units+=event.units;events.push({type,...event});}else{const event=modifier(grid,type,rng);event.units=evaluate(event.grid).units*event.multiplier;units+=event.units;events.push({type,...event});}}
if(count(grid,'scatter')>=3){const event=freeBonus(rng);units+=event.units;events.push({type:'free',...event});}
if(count(grid,'stash')>=3){const event=stashBonus(rng);units+=event.units;events.push({type:'stash',...event});}
if(count(grid,'mower')>=3){const event=mow(grid,rng);units+=event.units;events.push({type:'mow',...event});}
const win=Math.min(MAX_WIN_MULTIPLIER*state.bet,Math.round(units*state.bet*100)/100);
const next={...state,balance:Math.round((state.balance-state.bet+win)*100)/100,rounds:state.rounds+1,last:{grid,base,flags,events,win,stake:state.bet},message:events.length?events.map(e=>e.label).join(' • '):win?'GARAGE WIN!':'Just five more minutes…'};next.history=[{stake:state.bet,win,events:events.map(e=>e.type)},...state.history].slice(0,20);return next;}
