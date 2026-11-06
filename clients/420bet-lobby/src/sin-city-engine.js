// Sin City High Rollers: non-transactional, candidate 5×4 practice math.
// Values are demonstration-only. No certified RTP, wager or wallet connection.
export const ROWS=4,REELS=5,STRIP_LENGTH=42,MAX_MULTIPLIER=5000;
export const SYMBOLS=Object.freeze(['BUD','JAR','ASH','GRINDER','LIGHTER','PAPERS','BONG','CAR','CHIPS','MIC','DOLLAR','10','J','Q','K','A','BOBBY','WILD','SCATTER','GEM']);
const ordinary=['BUD','JAR','ASH','GRINDER','LIGHTER','PAPERS','BONG','CAR','CHIPS','MIC','DOLLAR','10','J','Q','K','A','BOBBY'];
// Four equal-length strips, one per visible reel; SCATTER occurs once per reel.
// Spread special symbols so no reel can show two scatters in four rows.
export const BASE_STRIPS=Object.freeze(Array.from({length:REELS},(_,r)=>{
 const arr=Array.from({length:STRIP_LENGTH},(_,i)=>ordinary[(i*7+Math.floor(i/3)+r*3)%ordinary.length]);
 const special=[[2,'SCATTER'],[10,'WILD'],[18,'GEM'],[26,'ASH'],[34,'WILD'],[39,r===0?'BUD':'GEM']];
 for(const [i,v] of special)arr[(i+r*5)%STRIP_LENGTH]=v;
 return Object.freeze(arr);
}));
// Free-spin strips retain scarce Wilds. GEM becomes a regular symbol, not a Wild.
export const FREE_STRIPS=Object.freeze(BASE_STRIPS.map((reel,r)=>Object.freeze(reel.map(symbol=>symbol==='GEM'?'BUD':symbol))));
export const BASE_WAYS_SCALE=0.3125;
export const FREE_WAYS_SCALE=0.075;
const UNCALIBRATED_PAYTABLE=Object.freeze({
 BOBBY:[.3,1,4.2],DOLLAR:[.25,.8,3],CAR:[.2,.6,2],MIC:[.15,.4,1.5],
 CHIPS:[.15,.4,1.5],BONG:[.15,.4,1.5],JAR:[.1,.25,.8],
 BUD:[.1,.25,.8],GRINDER:[.1,.25,.8],LIGHTER:[.1,.25,.8],
 PAPERS:[.05,.15,.5],ASH:[.05,.15,.5],
 '10':[.05,.15,.5],J:[.05,.15,.5],Q:[.05,.15,.5],K:[.05,.15,.5],A:[.05,.15,.5]
});
export const PAYTABLE=Object.freeze(Object.fromEntries(Object.entries(UNCALIBRATED_PAYTABLE).map(([symbol,pays])=>[symbol,Object.freeze(pays.map(value=>+(value*BASE_WAYS_SCALE).toFixed(6)))])));
export const FREE_PAYTABLE=Object.freeze(Object.fromEntries(Object.entries(UNCALIBRATED_PAYTABLE).map(([symbol,pays])=>[symbol,Object.freeze(pays.map(value=>+(value*FREE_WAYS_SCALE).toFixed(6)))])));
const round=value=>Math.round((value+Number.EPSILON)*100)/100;
// Candidate final Hotbox awards in multiples of the initiating total stake.
// Paid once at the end of the collection feature.
export const HOTBOX_PAYS=Object.freeze([0,0,0,.2,.4,.6,.8,1,1.4,1.8,2.4,3.2,4,5,6,8,10,15,25,50,100]);
export const hotboxPayout=(gems,stake)=>round(stake*HOTBOX_PAYS[Math.max(0,Math.min(20,gems))]);
export function randomStops(rng=Math.random){return Array.from({length:REELS},()=>Math.floor(Math.min(.999999999,Math.max(0,rng()))*STRIP_LENGTH));}
export function visibleBoard(strips,stops){return strips.map((strip,r)=>Array.from({length:ROWS},(_,row)=>strip[(stops[r]+row)%strip.length]));}
export function count(board,symbol){return board.flat().filter(s=>s===symbol).length;}
export function awardFreeSpins(board){
 const reels=board.filter(reel=>reel.includes('SCATTER')).length;
 return reels>=5?20:reels===4?12:reels===3?8:0;
}
export function waysWins(board,stake,table=PAYTABLE,{wildExcludes=[]}={}){
 const wins=[];let total=0;
 // Only count all-Wild ways once, at the highest available pay tier.
 for(const [symbol,pays] of Object.entries(table)){
  let ways=1,wildOnly=1,length=0;
  for(const reel of board){
   const matches=reel.filter(s=>s===symbol||(!wildExcludes.includes(symbol)&&s==='WILD')).length;
   if(!matches)break;
   ways*=matches;wildOnly*=reel.filter(s=>s==='WILD').length;length++;
  }
  if(length>=3){
   const distinctWays=ways-(wildExcludes.includes(symbol)?0:wildOnly);
   if(distinctWays>0){
    const amount=round(stake*distinctWays*pays[length-3]);
    wins.push({symbol,length,ways:distinctWays,amount});total+=amount;
   }
  }
 }
 let pureWildWays=1,pureWildLength=0;
 for(const reel of board){
  const matches=reel.filter(s=>s==='WILD').length;
  if(!matches)break;
  pureWildWays*=matches;pureWildLength++;
 }
 if(pureWildLength>=3){
  const amount=round(stake*pureWildWays*table.BOBBY[pureWildLength-3]);
  wins.push({symbol:'WILD',length:pureWildLength,ways:pureWildWays,amount});
  total+=amount;
 }
 return {wins,total:round(total)};
}
export function puffPuffPass(board,rng=Math.random){
 const next=board.map(reel=>[...reel]);const changed=[];
 if(count(board,'ASH')<3)return {board:next,changed};
 // One wild substitution per affected reel; deterministic given RNG.
 for(let r=0;r<REELS;r++){
  if(!next[r].includes('ASH'))continue;
  const choices=next[r].map((s,i)=>s==='SCATTER'||s==='GEM'?-1:i).filter(i=>i>=0);
  if(!choices.length)continue;
  const row=choices[Math.floor(Math.min(.9999999,Math.max(0,rng()))*choices.length)];
  next[r][row]='WILD';changed.push([r,row]);
 }
 return {board:next,changed};
}
export function initialState(){
 return {balance:1000,stake:2,mode:'base',freeRemaining:0,freePlayed:0,freeMultiplier:1,
  locked:[],respins:0,respinReturn:'base',sticky:[],wildMultipliers:{},freeSessionWin:0,freeCompletedTotal:null,lastWin:0,lastMessage:'PRESS SPIN TO PLAY',lastBoard:visibleBoard(BASE_STRIPS,[0,8,16,24,32]),lastStops:null,lastFeature:'',lastWins:[],lastReveal:null,lastAwardedSpins:0,lastRetriggeredSpins:0,lastMultiplier:1,roundGross:0,roundStake:2};
}
const copy=s=>({...s,locked:[...s.locked],sticky:[...s.sticky],wildMultipliers:{...(s.wildMultipliers||{})},lastBoard:s.lastBoard.map(reel=>[...reel])});
const lockKey=(r,row)=>r*ROWS+row;
export function nextRound(previous,rng=Math.random,forcedStops){
 const s=copy(previous);const isFree=s.mode==='free',isRespin=s.mode==='hotbox';
 if(!isFree&&!isRespin&&s.balance<s.stake)return {...s,lastMessage:'NOT ENOUGH PRACTICE CREDITS'};
 if(!isFree&&!isRespin){s.balance=round(s.balance-s.stake);s.roundGross=0;s.roundStake=s.stake;s.freeMultiplier=1;s.sticky=[];s.wildMultipliers={};s.freeSessionWin=0;s.freeCompletedTotal=null;}
 const stops=forcedStops??randomStops(rng);
 let board=visibleBoard(isFree?FREE_STRIPS:BASE_STRIPS,stops);
 const before=board.map(reel=>[...reel]);
 let feature='',payout=0,changed=[],lastWins=[];
 s.lastAwardedSpins=0;s.lastRetriggeredSpins=0;s.lastMultiplier=1;
 if(isRespin){
  s.respins--;
  const locked=new Set(s.locked);
  for(const key of locked){
   const r=Math.floor(key/ROWS),row=key%ROWS;
   before[r][row]='GEM';
  }
  for(let r=0;r<REELS;r++)for(let row=0;row<ROWS;row++){
   const key=lockKey(r,row);
   if(locked.has(key)){board[r][row]='GEM';continue;}
   if(board[r][row]==='GEM'){locked.add(key);s.respins=3;}
   // Keep original symbols behind the collecting emerald gems.
  }
  s.locked=[...locked].sort((a,b)=>a-b);
  changed=s.locked.filter(key=>!previous.locked.includes(key)).map(key=>[Math.floor(key/ROWS),key%ROWS]);
  if(s.locked.length===20||s.respins===0)payout=hotboxPayout(s.locked.length,s.roundStake);
  if(s.locked.length===20||s.respins===0){
   s.mode=s.respinReturn;s.respins=0;s.locked=[];
   feature='hotbox-end';
  }else feature='hotbox';
 }else{
  if(isFree){
   s.freeRemaining--;s.freePlayed++;
   // Every previously held Wild remains fixed, and every new Wild locks for
   // the remainder of the feature. All twenty cells may eventually lock.
   for(const key of s.sticky){
    const r=Math.floor(key/ROWS),row=key%ROWS;
    before[r][row]='WILD';board[r][row]='WILD';
   }
   for(let r=0;r<REELS;r++)for(let row=0;row<ROWS;row++){
    if(board[r][row]==='WILD'&&!s.sticky.includes(lockKey(r,row)))s.sticky.push(lockKey(r,row));
   }
   s.sticky.sort((a,b)=>a-b);
  }
  // Puff wild conversions belong to the base feature. Free spins keep only
  // their bounded sticky-Wild mechanic; do not spread extra Wilds every spin.
  const puff=isFree?{board,changed:[]}:puffPuffPass(board,rng);
  board=puff.board;
  changed=puff.changed;
  if(puff.changed.length)feature='puff';
  // The Lowrider itself is always a natural symbol. Its multiplier is marked
  // on an individual Wild, and persists in that Wild's position.
  if(isFree&&count(board,'CAR')>=1){
   const choose=items=>items[Math.floor(Math.min(.999999999,Math.max(0,rng()))*items.length)];
   const availableWild=[],availableConversion=[];
   for(let r=0;r<REELS;r++)for(let row=0;row<ROWS;row++){
    const key=lockKey(r,row),symbol=board[r][row];
    if(symbol==='WILD'&&!s.wildMultipliers[key])availableWild.push(key);
    if(!['CAR','ASH','SCATTER','WILD'].includes(symbol)&&!s.sticky.includes(key))availableConversion.push(key);
   }
   const key=availableWild.length?choose(availableWild):availableConversion.length?choose(availableConversion):null;
   if(key!==null){
    const r=Math.floor(key/ROWS),row=key%ROWS;
    if(board[r][row]!=='WILD'){board[r][row]='WILD';s.sticky.push(key);s.sticky.sort((a,b)=>a-b);changed.push([r,row]);}
    s.wildMultipliers[key]=[2,3,4,5][Math.floor(Math.min(.999999999,Math.max(0,rng()))*4)];
    feature='lowrider';
   }
  }
  const regular=waysWins(board,s.roundStake,isFree?FREE_PAYTABLE:PAYTABLE,isFree?{wildExcludes:['ASH','CAR']}:{});
  lastWins=regular.wins;
  const activeMults=Object.values(s.wildMultipliers).filter(Number.isFinite);
  const currentMult=isFree&&activeMults.length?Math.max(...activeMults):1;
  s.freeMultiplier=currentMult;s.lastMultiplier=currentMult;
  payout=round(regular.total*currentMult);
  if(isFree){
   const extra=awardFreeSpins(board);
   if(extra&&s.freePlayed+s.freeRemaining<50){const awarded=Math.min(5,50-s.freePlayed-s.freeRemaining);s.freeRemaining+=awarded;s.lastRetriggeredSpins=awarded;feature=feature==='lowrider'?'lowrider':'free-retrigger';}
   if(!s.freeRemaining){s.mode='base';feature='free-end';}
  }else{
   const scatters=awardFreeSpins(board);
   if(scatters){s.mode='free';s.freeRemaining=scatters;s.freePlayed=0;s.freeSessionWin=0;s.freeCompletedTotal=null;s.wildMultipliers={};s.sticky=[];s.lastAwardedSpins=scatters;feature='free-start';}
   else if(count(board,'GEM')>=3){
    s.mode='hotbox';s.respinReturn='base';s.respins=3;
    s.locked=[];
    for(let r=0;r<REELS;r++)for(let row=0;row<ROWS;row++)if(board[r][row]==='GEM')s.locked.push(lockKey(r,row));
    feature='hotbox-start';
   }
   const scatterCount=board.filter(reel=>reel.includes('SCATTER')).length;
   payout=round(payout+s.roundStake*({3:.5,4:2,5:10}[scatterCount]||0));
  }
 }
 // Strict cap per initiating paid round including its entire bonus sequence.
 const available=Math.max(0,round(s.roundStake*MAX_MULTIPLIER-s.roundGross));
 payout=round(Math.min(payout,available));
 if(isFree){s.freeSessionWin=round(s.freeSessionWin+payout);if(s.mode==='base'){s.freeCompletedTotal=s.freeSessionWin;}}
 s.roundGross=round(s.roundGross+payout);
 s.balance=round(s.balance+payout);
 s.lastWin=payout;s.lastStops=[...stops];s.lastBoard=board;s.lastFeature=feature;
 s.lastWins=lastWins;
 s.lastReveal={before,after:board.map(reel=>[...reel]),changed,feature,wins:lastWins,payout};
 s.lastMessage=feature==='free-start'?'CHRONIC SESSIONS · '+s.lastAwardedSpins+' FREE SPINS AWARDED!':
 feature==='hotbox-start'?'HOTBOX RESPINS — THREE RESPINS!':
 feature==='lowrider'?'LOWRIDER ×'+s.freeMultiplier+' APPLIED TO WAYS WIN · '+s.freeRemaining+' FREE SPINS LEFT':
 feature==='puff'?'PUFF PUFF PASS — WILDS SPREAD!':
 feature==='free-retrigger'?'+'+s.lastRetriggeredSpins+' EXTRA FREE SPINS · '+s.freeRemaining+' REMAINING':
 feature==='hotbox'?'HOTBOX · '+s.locked.length+' LOCKED GEMS · '+s.respins+' RESPINS LEFT':
 feature==='hotbox-end'?'HOTBOX COLLECTION COMPLETE · WIN '+payout.toFixed(2):
 feature==='free-end'?'FREE SPINS COMPLETE · TOTAL '+s.freeCompletedTotal.toFixed(2):
 payout>0?'PRACTICE WIN '+payout.toFixed(2):'NO WIN — TRY AGAIN';
 return s;
}
