// Best Buds: Hotbox Road Trip — deterministic practice-only slot model.
// Candidate values, NOT a certified RNG/RTP or real-money gambling implementation.
export const REELS=5, ROWS=3, MAX_WIN_MULTIPLIER=5000;
export const SYMBOLS=Object.freeze(['BONG','JOINT','CHIPS','RECORD','PAPERS','LIGHTER','SUNGLASSES','GUITAR','LEAF','BUDDY1','BUDDY2','WILD1','WILD2','SCATTER','HOTBOX']);
export const ORDINARY=Object.freeze(['BONG','JOINT','CHIPS','RECORD','PAPERS','LIGHTER','SUNGLASSES','GUITAR','LEAF','BUDDY1','BUDDY2']);
export const PAYTABLE=Object.freeze({
 BUDDY1:[.5,1.5,5], BUDDY2:[.5,1.5,5], GUITAR:[.35,1,3], BONG:[.3,.8,2.5],
 CHIPS:[.25,.7,2],RECORD:[.2,.6,1.8],SUNGLASSES:[.2,.6,1.8],
 PAPERS:[.12,.4,1.2],LIGHTER:[.12,.4,1.2],JOINT:[.12,.4,1.2],LEAF:[.1,.3,1]
});
export const JACKPOTS=Object.freeze({MINI:20,MINOR:50,MAJOR:200,GRAND:1000});
export const FREE_WILD_MULTIPLIERS=Object.freeze([2,3,5,10]);
export const LINES=Object.freeze([
 [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
 [0,0,1,0,0],[2,2,1,2,2],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
 [2,1,1,1,2],[1,0,1,0,1],[1,2,1,2,1],[0,1,2,2,2],[2,1,0,0,0],
 [0,0,1,2,2],[2,2,1,0,0],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],
 [2,1,2,1,2],[0,2,1,2,0],[2,0,1,0,2],[0,1,0,1,2],[2,1,2,1,0]
].map(p=>Object.freeze(p)));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const cash=n=>Math.round((n+Number.EPSILON)*100)/100;
const pick=(n,rng)=>Math.floor(clamp(rng(),0,.9999999)*n);
export const BASE_STRIPS=Object.freeze(Array.from({length:REELS},(_,r)=>{
 const s=Array.from({length:60},(_,i)=>ORDINARY[(i*7+Math.floor(i/3)+r*3)%ORDINARY.length]);
 // Consecutive windows never contain two SCATTER symbols on a given reel.
 for(const [i,v] of [[3,'SCATTER'],[10,'HOTBOX'],[15,'HOTBOX'],[22,'WILD1'],[27,'HOTBOX'],[33,'HOTBOX'],[39,'WILD2'],[46,'HOTBOX'],[53,'HOTBOX']])
  s[(i+r*4)%60]=v;
 return Object.freeze(s);
}));
export const FREE_STRIPS=Object.freeze(BASE_STRIPS.map((strip,r)=>Object.freeze(strip.map((s,i)=>s==='HOTBOX'?ORDINARY[(i+r)%ORDINARY.length]:s))));
export const boardAt=(strips,stops)=>strips.map((s,r)=>Array.from({length:ROWS},(_,y)=>s[(stops[r]+y)%s.length]));
export const initialState=()=>({
 balance:1000,bet:2,mode:'base',board:boardAt(BASE_STRIPS,[0,7,14,21,28]),
 lastWins:[],lastWin:0,lastFeature:'',message:'SPIN TO START YOUR ROAD TRIP',roundBet:2,roundGross:0,
 hold:[],respins:0,holdReturn:'base',pendingFree:0,freeLeft:0,freeTotal:0,freeSummary:null,
 featureTotal:0,spinNumber:0,qa:null,holdReveal:null,holdNewKeys:[],collectSmokeEvent:null,freeWildMultipliers:{}
});
export const coinValue=(rng=Math.random)=>[.2,.4,.6,1,1.5,2,3,5,10][pick(9,rng)];
const isWild=s=>s==='WILD1'||s==='WILD2';
export function evaluateLines(board,bet,{wildMultipliers={}}={}){
 const wins=[];
 for(let p=0;p<LINES.length;p++){
  const cells=LINES[p];
  const first=board[0][cells[0]];
  let type=isWild(first)?null:first;
  if(first==='SCATTER'||first==='HOTBOX')continue;
  if(!type){
   for(let r=1;r<REELS;r++){const sym=board[r][cells[r]];if(!isWild(sym)){type=sym;break;}}
  }
  type??='BUDDY1';
  if(!PAYTABLE[type])continue;
  let length=0;
  for(let r=0;r<REELS;r++){
   const s=board[r][cells[r]];
   if(s===type||isWild(s))length++;else break;
  }
  if(length>=3){
   const wildMultiplier=Math.max(1,...cells.slice(0,length).map((y,r)=>isWild(board[r][y])?(wildMultipliers[r*ROWS+y]??1):1));
   const multiplier=PAYTABLE[type][length-3];
   wins.push({line:p+1,rows:[...cells],symbol:type,length,wildMultiplier,amount:cash(multiplier*bet*wildMultiplier)});
  }
 }
 return {wins,amount:cash(wins.reduce((n,w)=>n+w.amount,0))};
}
export const scatterCount=board=>board.filter(col=>col.includes('SCATTER')).length;
export const coinPositions=board=>board.flatMap((col,r)=>col.flatMap((s,y)=>s==='HOTBOX'?[r*ROWS+y]:[]));
export const randomStops=(rng=Math.random)=>BASE_STRIPS.map(s=>pick(s.length,rng));
const clone=s=>({...s,board:s.board.map(col=>[...col]),hold:s.hold.map(v=>({...v})),holdReveal:s.holdReveal?.map(v=>({...v}))??null,holdNewKeys:[...(s.holdNewKeys??[])],collectSmokeEvent:s.collectSmokeEvent?{...s.collectSmokeEvent}:null,freeWildMultipliers:{...(s.freeWildMultipliers??{})},lastWins:[],qa:null});
const capAward=(s,amount)=>{
 const left=Math.max(0,cash(s.roundBet*MAX_WIN_MULTIPLIER-s.roundGross));
 const award=cash(Math.min(Math.max(0,amount),left));
 s.roundGross=cash(s.roundGross+award);s.balance=cash(s.balance+award);s.lastWin=award;
 return award;
};
// Each Collect Smoke pays a snapshot of the currently locked ordinary HOTBOX
// coin multipliers. Prior Collect Smoke prizes do not collect themselves, and
// jackpots and multiplier modifiers are excluded from the collection pool.
export const collectSmokeValue=coins=>cash(coins.reduce((sum,c)=>sum+(c.kind==='coin'?c.value:0),0));
export const hotboxTotalMultiplier=coins=>{
 let total=0,multiplier=1;
 for(const c of coins){
  if(c.kind==='coin'||c.kind==='collect')total+=c.value;
  else if(c.kind==='jackpot')total+=JACKPOTS[c.value];
  else if(c.kind==='multiplier')multiplier*=c.value;
 }
 return cash(total*Math.min(multiplier,6));
};
function lockedCoin(s,key,rng){
 const jackpots=['MINI','MINOR','MAJOR','GRAND'];
 let kind='coin',value=coinValue(rng);
 if(s.hold.length>=12&&rng()<.10){kind='jackpot';value=jackpots[pick(jackpots.length,rng)];}
 return {key,kind,value};
}
function startHold(s,board,rng,returnTo='base'){
 s.mode='hold';s.holdReturn=returnTo;s.respins=3;
 s.hold=coinPositions(board).map(key=>lockedCoin(s,key,rng));
 s.holdReveal=s.hold.map(v=>({...v}));s.holdNewKeys=s.hold.map(v=>v.key);s.collectSmokeEvent=null;
 s.lastFeature='hold-start';s.message='HOTBOX HOLD & WIN — 3 RESPINS';
}
function finishHold(s){
 const total=hotboxTotalMultiplier(s.hold);
 const paid=capAward(s,s.roundBet*total);
 s.featureTotal=paid;s.lastFeature='hold-end';s.message='HOTBOX COMPLETE · '+paid.toFixed(2)+' CREDITS';
 s.holdReveal=s.hold.map(v=>({...v}));s.hold=[];s.respins=0;
 if(s.pendingFree>0){s.mode='free';s.freeLeft=s.pendingFree;s.pendingFree=0;s.freeTotal=0;s.message+=' · FREE RIDES NEXT';}
 else s.mode=s.holdReturn;
}
export function nextSpin(previous,{rng=Math.random,stops=null,force=null}={}){
 const s=clone(previous),mode=s.mode;
 s.freeSummary=null;s.lastFeature='';s.lastWin=0;s.lastWins=[];s.collectSmokeEvent=null;
 if(mode==='base'){
  s.holdReveal=null;s.holdNewKeys=[];
  if(s.balance<s.bet){s.message='NOT ENOUGH PRACTICE CREDITS';return s;}
  s.balance=cash(s.balance-s.bet);s.roundBet=s.bet;s.roundGross=0;s.featureTotal=0;
 }
 s.spinNumber++;
 if(mode==='hold'){
  s.respins--;
  const occupied=new Set(s.hold.map(c=>c.key));
  s.holdNewKeys=[];
  const candidates=Array.from({length:15},(_,i)=>i).filter(i=>!occupied.has(i));
  // Three independently selected opportunities per respin. Existing coins remain locked.
  for(const key of candidates){
   if((force==='fill'||((force==='collect'||force==='jackpot')&&key===candidates[0]))||rng()<.105){
    let c=lockedCoin(s,key,rng);
    if(force==='collect'&&key===candidates[0])c={key,kind:'collect',value:collectSmokeValue(s.hold)};
    if(force==='jackpot'&&key===candidates[0])c={key,kind:'jackpot',value:'MAJOR'};
    s.hold.push(c);
   }
  }
  s.hold.sort((a,b)=>a.key-b.key);
  s.holdNewKeys=s.hold.filter(c=>!occupied.has(c.key)).map(c=>c.key);
  if(s.holdNewKeys.length){
   s.respins=3;s.lastFeature='hold-hit';
   // At each threshold convert a newly landed coin, not whichever coin
   // happened to sort last on the board. Its collection is a one-time
   // snapshot of all OTHER locked ordinary coin values.
   for(const threshold of [10,13]){
    if(occupied.size<threshold&&s.hold.length>=threshold){
     const coin=s.hold.find(c=>c.key===s.holdNewKeys.at(-1));
     if(coin?.kind==='coin'&&force!=='fill'){
      const roll=rng();
      if(roll<.33){coin.kind='collect';coin.value=collectSmokeValue(s.hold.filter(c=>c!==coin));}
      else if(roll<.66){coin.kind='multiplier';coin.value=2;}
      else {coin.kind='jackpot';coin.value='MINI';}
     }
    }
   }
   const newCollects=s.hold.filter(c=>s.holdNewKeys.includes(c.key)&&c.kind==='collect');
   if(newCollects.length){
    const sum=cash(newCollects.reduce((a,c)=>a+c.value,0));
    s.collectSmokeEvent={multipliers:sum,credits:cash(sum*s.roundBet),keys:newCollects.map(c=>c.key)};
    s.lastFeature='collect-smoke';
   }
  }
  // Keep the final reveal in sync with milestone upgrades.
  s.holdReveal=s.hold.map(v=>({...v}));
  s.message=s.collectSmokeEvent?'COLLECT SMOKE! +'+s.collectSmokeEvent.credits.toFixed(2)+' CREDITS ADDED · '+s.respins+' RESPINS LEFT':'HOTBOX · '+s.hold.length+'/15 COINS · '+s.respins+' RESPINS LEFT';
  if(s.respins===0||s.hold.length===15)finishHold(s);
  return s;
 }
 const strips=mode==='free'?FREE_STRIPS:BASE_STRIPS;
 const board=boardAt(strips,stops??randomStops(rng));
 if(force==='hold'){
  for(let r=0;r<REELS;r++)for(let y=0;y<ROWS;y++)board[r][y]=r<3&&y<2?'HOTBOX':ORDINARY[(r*3+y)%ORDINARY.length];
 }else if(force==='free'){
  for(let r=0;r<REELS;r++)for(let y=0;y<ROWS;y++)board[r][y]=r<3&&y===0?'SCATTER':ORDINARY[(r*3+y)%ORDINARY.length];
 }
 // Free Ride WILDs keep their character artwork, with a random multiplier badge.
 // For each winning line, only the highest WILD multiplier on that line applies.
 s.freeWildMultipliers={};
 if(mode==='free'){
  if(force==='wild10'){
   for(let r=0;r<3;r++)board[r][1]=r%2?'WILD2':'WILD1';
  }
  for(let r=0;r<REELS;r++)for(let y=0;y<ROWS;y++)
   if(isWild(board[r][y]))s.freeWildMultipliers[r*ROWS+y]=force==='wild10'?10:FREE_WILD_MULTIPLIERS[pick(FREE_WILD_MULTIPLIERS.length,rng)];
 }
 s.board=board;
 const score=evaluateLines(board,s.roundBet,{wildMultipliers:s.freeWildMultipliers});
 s.lastWins=score.wins;
 const paid=capAward(s,score.amount);
 if(mode==='free'){s.freeLeft--;s.freeTotal=cash(s.freeTotal+paid);}
 const scatter=scatterCount(board),coins=coinPositions(board).length;
 // Hold has priority and the scatter feature is queued, never lost.
 if(mode==='base'&&scatter>=3)s.pendingFree=8;
 if(mode==='base'&&coins>=6){startHold(s,board,rng);return s;}
 if(mode==='base'&&s.pendingFree){
  s.mode='free';s.freeLeft=s.pendingFree;s.pendingFree=0;s.freeTotal=0;
  s.lastFeature='free-start';s.message='8 FREE RIDES AWARDED!';
  return s;
 }
 if(mode==='free'){
  if(s.freeLeft===0){
   s.mode='base';s.freeSummary=s.freeTotal;s.lastFeature='free-end';
   s.message='ROAD TRIP COMPLETE · '+s.freeTotal.toFixed(2)+' CREDITS';
  }else{s.lastFeature='free-spin';s.message=s.freeLeft+' FREE RIDES LEFT';}
 }else s.message=paid>0?'WIN '+paid.toFixed(2)+' CREDITS':'KEEP ON ROLLING!';
 return s;
}
export const practiceBonus=(state,choice,rng=Math.random)=>{
 const s=clone(state);
 if(choice==='hold'||choice==='free')return nextSpin({...s,mode:'base',balance:Math.max(s.balance,s.bet)}, {rng,force:choice});
 // QA shortcuts create isolated bonus boards without charging a stake.
 s.roundBet=s.bet;s.roundGross=0;s.featureTotal=0;s.pendingFree=0;
 if(choice==='wild10'){
  s.mode='free';s.freeLeft=2;s.freeTotal=0;s.qa='wild10';s.message='QA WILD MULTIPLIER · NEXT FREE RIDE';return s;
 }
 if(choice==='collect'||choice==='jackpot'||choice==='fill'){
  s.mode='hold';s.respins=3;s.holdReturn='base';s.hold=Array.from({length:choice==='fill'?14:9},(_,key)=>({key,kind:'coin',value:coinValue(rng)}));s.holdReveal=s.hold.map(v=>({...v}));s.holdNewKeys=[];s.collectSmokeEvent=null;s.message='QA HOTBOX · TEST '+choice.toUpperCase();s.qa=choice;return s;
 }
 return s;
};
