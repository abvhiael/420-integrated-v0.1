// Sin City High Rollers: non-transactional, candidate 5×4 practice math.
// Values are demonstration-only. No certified RTP, wager or wallet connection.
export const ROWS=4,REELS=5,STRIP_LENGTH=42,MAX_MULTIPLIER=5000;
export const SYMBOLS=Object.freeze(['BUD','JAR','ASH','GRINDER','LIGHTER','PAPERS','BONG','CAR','CHIPS','MIC','DOLLAR','10','J','Q','K','A','BOBBY','WILD','SCATTER','GEM']);
const ordinary=['BUD','JAR','ASH','GRINDER','LIGHTER','PAPERS','BONG','CAR','CHIPS','MIC','DOLLAR','10','J','Q','K','A','BOBBY'];
// Four equal-length strips, one per visible reel; SCATTER occurs once per reel.
// Spread special symbols so no reel can show two scatters in four rows.
export const BASE_STRIPS=Object.freeze(Array.from({length:REELS},(_,r)=>{
 const arr=Array.from({length:STRIP_LENGTH},(_,i)=>ordinary[(i*7+Math.floor(i/3)+r*3)%ordinary.length]);
 const special=[[2,'SCATTER'],[10,'WILD'],[18,'GEM'],[26,'ASH'],[34,'WILD'],[39,'GEM']];
 for(const [i,v] of special)arr[(i+r*5)%STRIP_LENGTH]=v;
 return Object.freeze(arr);
}));
// Free-spin strips retain scarce Wilds. GEM becomes a regular symbol, not a Wild.
export const FREE_STRIPS=Object.freeze(BASE_STRIPS.map((reel,r)=>Object.freeze(reel.map(symbol=>symbol==='GEM'?'ASH':symbol))));
export const PAYTABLE=Object.freeze({
 BOBBY:[.3,1,4.2],DOLLAR:[.25,.8,3],CAR:[.2,.6,2],MIC:[.15,.4,1.5],
 CHIPS:[.15,.4,1.5],BONG:[.15,.4,1.5],JAR:[.1,.25,.8],
 BUD:[.1,.25,.8],GRINDER:[.1,.25,.8],LIGHTER:[.1,.25,.8],
 PAPERS:[.05,.15,.5],ASH:[.05,.15,.5],
 '10':[.05,.15,.5],J:[.05,.15,.5],Q:[.05,.15,.5],K:[.05,.15,.5],A:[.05,.15,.5]
});
const round=value=>Math.round((value+Number.EPSILON)*100)/100;
export function randomStops(rng=Math.random){return Array.from({length:REELS},()=>Math.floor(Math.min(.999999999,Math.max(0,rng()))*STRIP_LENGTH));}
export function visibleBoard(strips,stops){return strips.map((strip,r)=>Array.from({length:ROWS},(_,row)=>strip[(stops[r]+row)%strip.length]));}
export function count(board,symbol){return board.flat().filter(s=>s===symbol).length;}
export function awardFreeSpins(board){
 const reels=board.filter(reel=>reel.includes('SCATTER')).length;
 return reels>=5?20:reels===4?12:reels===3?8:0;
}
export function waysWins(board,stake){
 const wins=[];let total=0;
 // Only count all-Wild ways once, at the highest available pay tier.
 for(const [symbol,pays] of Object.entries(PAYTABLE)){
  let ways=1,wildOnly=1,length=0;
  for(const reel of board){
   const matches=reel.filter(s=>s===symbol||s==='WILD').length;
   if(!matches)break;
   ways*=matches;wildOnly*=reel.filter(s=>s==='WILD').length;length++;
  }
  if(length>=3){
   const distinctWays=ways-wildOnly;
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
  const amount=round(stake*pureWildWays*PAYTABLE.BOBBY[pureWildLength-3]);
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
  locked:[],respins:0,respinReturn:'base',sticky:[],lastWin:0,lastMessage:'PRESS SPIN TO PLAY',lastBoard:visibleBoard(BASE_STRIPS,[0,8,16,24,32]),lastStops:null,lastFeature:'',lastWins:[],lastReveal:null,lastAwardedSpins:0,lastRetriggeredSpins:0,lastMultiplier:1,roundGross:0,roundStake:2};
}
const copy=s=>({...s,locked:[...s.locked],sticky:[...s.sticky],lastBoard:s.lastBoard.map(reel=>[...reel])});
const lockKey=(r,row)=>r*ROWS+row;
export function nextRound(previous,rng=Math.random,forcedStops){
 const s=copy(previous);const isFree=s.mode==='free',isRespin=s.mode==='hotbox';
 if(!isFree&&!isRespin&&s.balance<s.stake)return {...s,lastMessage:'NOT ENOUGH PRACTICE CREDITS'};
 if(!isFree&&!isRespin){s.balance=round(s.balance-s.stake);s.roundGross=0;s.roundStake=s.stake;s.freeMultiplier=1;s.sticky=[];}
 const stops=forcedStops??randomStops(rng);
 let board=visibleBoard(isFree?FREE_STRIPS:BASE_STRIPS,stops);
 const before=board.map(reel=>[...reel]);
 let feature='',payout=0,changed=[],lastWins=[];
 s.lastAwardedSpins=0;s.lastRetriggeredSpins=0;s.lastMultiplier=1;
 if(isRespin){
  s.respins--;
  const locked=new Set(s.locked);
  for(let r=0;r<REELS;r++)for(let row=0;row<ROWS;row++){
   const key=lockKey(r,row);
   if(locked.has(key)){board[r][row]='GEM';continue;}
   if(board[r][row]==='GEM'){locked.add(key);s.respins=3;}
   // Keep original symbols behind the collecting emerald gems.
  }
  s.locked=[...locked].sort((a,b)=>a-b);
  changed=s.locked.filter(key=>!previous.locked.includes(key)).map(key=>[Math.floor(key/ROWS),key%ROWS]);
  if(s.locked.length===20)payout=100*s.roundStake;
  else if(s.respins===0)payout=round(s.locked.length*s.roundStake*.2);
  if(s.locked.length===20||s.respins===0){
   s.mode=s.respinReturn;s.respins=0;s.locked=[];
   feature='hotbox-end';
  }else feature='hotbox';
 }else{
  if(isFree){
   s.freeRemaining--;s.freePlayed++;
   for(const key of s.sticky){const r=Math.floor(key/ROWS),row=key%ROWS;board[r][row]='WILD';}
   // Three maximum sticky Wild positions, adding no more than one per free spin.
   if(s.sticky.length<3){
    outer:for(let r=0;r<REELS;r++)for(let row=0;row<ROWS;row++){
     const key=lockKey(r,row);
     if(board[r][row]==='WILD'&&!s.sticky.includes(key)){s.sticky.push(key);break outer;}
    }
   }
   s.sticky.sort((a,b)=>a-b);
  }
  const puff=puffPuffPass(board,rng);
  board=puff.board;
  changed=puff.changed;
  const regular=waysWins(board,s.roundStake);
  lastWins=regular.wins;
  payout=regular.total;
  if(puff.changed.length)feature='puff';
  if(isFree&&board.filter(reel=>reel.includes('CAR')).length>=3){
   const mult=[2,3,4,5][Math.floor(Math.min(.9999999,Math.max(0,rng()))*4)];
   s.freeMultiplier=mult;s.lastMultiplier=mult;payout=round(payout*mult);feature='lowrider';
  }
  if(isFree){
   const extra=awardFreeSpins(board);
   if(extra&&s.freePlayed+s.freeRemaining<50){const awarded=Math.min(5,50-s.freePlayed-s.freeRemaining);s.freeRemaining+=awarded;s.lastRetriggeredSpins=awarded;feature=feature==='lowrider'?'lowrider':'free-retrigger';}
   if(!s.freeRemaining){s.mode='base';s.sticky=[];feature=feature||'free-end';}
  }else{
   const scatters=awardFreeSpins(board);
   if(scatters){s.mode='free';s.freeRemaining=scatters;s.freePlayed=0;s.lastAwardedSpins=scatters;feature='free-start';}
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
 feature==='hotbox-end'?'HOTBOX BONUS COMPLETE':
 feature==='free-end'?'FREE SPINS COMPLETE':
 payout>0?'PRACTICE WIN '+payout.toFixed(2):'NO WIN — TRY AGAIN';
 return s;
}
