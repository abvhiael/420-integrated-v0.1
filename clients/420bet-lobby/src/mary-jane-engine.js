import {BASE_REELS,BONUS_REELS,PAYLINES,BASE_PAYTABLE,BONUS_PAYTABLE,PAY_SYMBOLS,CREDIT_MICROS,CYCLE_LENGTH,BONUS_SPINS,MAX_BUZZ,MAX_PAYOUT_X} from './mary-jane-model.js';

// Integer microcredits only. Stake is an integer number of practice credits.
const freshMask=()=>Array.from({length:5},()=>Array(4).fill(false));
const copyMask=mask=>mask.map(reel=>[...reel]);
export const creditText=micros=>(micros/CREDIT_MICROS).toFixed(2);
export const normalizeSymbol=s=>s?.startsWith('H01')?'H01':s;
export function visibleMaryJaneReels(reels,stops){
 if(!Array.isArray(stops)||stops.length!==5||stops.some(s=>!Number.isInteger(s)||s<0||s>=60))throw Error('Invalid reel stops');
 return reels.map((reel,r)=>Array.from({length:4},(_,row)=>reel[(stops[r]+row)%60]));
}
export function evaluateMaryJane(board,stakeCredits,buzz=1,bonus=false){
 if(!Array.isArray(board)||board.length!==5||board.some(reel=>reel.length!==4))throw Error('Invalid 5x4 board');
 if(!Number.isInteger(stakeCredits)||stakeCredits<1||stakeCredits>50||!Number.isInteger(buzz)||buzz<1||buzz>MAX_BUZZ)throw Error('Invalid stake or Buzz');
 const pay=bonus?BONUS_PAYTABLE:BASE_PAYTABLE,lines=[];let grossMicros=0;
 for(let line=0;line<20;line++){
  const cells=PAYLINES[line].map((row,r)=>normalizeSymbol(board[r][row]));
  let best=null;
  for(const symbol of PAY_SYMBOLS){
   let count=0;
   for(let r=0;r<5;r++){
    if(cells[r]===symbol||(symbol!=='WILD'&&symbol!=='COIN'&&cells[r]==='WILD'))count++;
    else break;
   }
   if(count<3)continue;
   const rate=pay[symbol][count-3];
   const amount=Math.round(rate*100)*stakeCredits*500*buzz;
   if(!best||amount>best.amount)best={line:line+1,symbol,count,amount};
  }
  if(best){lines.push(best);grossMicros+=best.amount;}
 }
 return {grossMicros,lines};
}
export function initialMaryJaneState(balanceCredits=1000){
 if(!Number.isInteger(balanceCredits)||balanceCredits<1)throw Error('Invalid practice credits');
 return {mode:'base',stake:10,balanceMicros:balanceCredits*CREDIT_MICROS,cycle:0,buzz:1,bonusBuzz:1,frames:freshMask(),sticky:freshMask(),freeRemaining:0,bonusAwardMicros:0,sessionCapRemaining:0,lastWinMicros:0,lastGrossMicros:0,lastLines:[],lastBoard:Array.from({length:5},()=>Array(4).fill(null)),lastStops:null,lastFrames:freshMask(),lastConverted:freshMask(),lastScatter:false,message:'Collect Gold Leaf Frames for the tenth-spin Wild reveal.',rounds:0,freeRounds:0};
}
export function setMaryJaneStake(state,stake){
 if(state.mode==='bonus'||!Number.isInteger(stake)||stake<1||stake>50)throw Error('Stake locked or out of range');
 return {...state,stake};
}
export function spinMaryJane(state,stops=Array.from({length:5},()=>Math.floor(Math.random()*60))){
 if(!state||!['base','bonus'].includes(state.mode))throw Error('Invalid session');
 const next={...state,frames:copyMask(state.frames),sticky:copyMask(state.sticky),lastConverted:freshMask()};
 const feature=next.mode==='bonus';
 if(!feature&&next.balanceMicros<next.stake*CREDIT_MICROS)throw Error('Not enough practice credits');
 const raw=visibleMaryJaneReels(feature?BONUS_REELS:BASE_REELS,stops);
 let board=raw.map(reel=>[...reel]),trigger=false;
 if(feature){
  for(let r=0;r<5;r++)for(let row=0;row<4;row++){
   if(raw[r][row]==='WILD')next.sticky[r][row]=true;
   if(next.sticky[r][row])board[r][row]='WILD';
  }
 }else{
  next.balanceMicros-=next.stake*CREDIT_MICROS;
  next.cycle++;
  for(let r=0;r<5;r++)for(let row=0;row<4;row++)if(raw[r][row]==='COIN'){
   if(next.frames[r][row])next.buzz=Math.min(MAX_BUZZ,next.buzz+1);
   else next.frames[r][row]=true;
  }
  if(next.cycle===CYCLE_LENGTH)for(let r=0;r<5;r++)for(let row=0;row<4;row++)if(next.frames[r][row]){
   board[r][row]='WILD';next.lastConverted[r][row]=true;
  }
  trigger=board.flat().filter(s=>s==='SCATTER').length===3;
  next.sessionCapRemaining=MAX_PAYOUT_X*next.stake*CREDIT_MICROS;
 }
 const awardBuzz=next.buzz;
 const evaluated=evaluateMaryJane(board,next.stake,feature?next.bonusBuzz:next.buzz,feature);
 const awarded=Math.min(evaluated.grossMicros,next.sessionCapRemaining);
 next.sessionCapRemaining-=awarded;
 next.balanceMicros+=awarded;
 next.lastWinMicros=awarded;
 next.lastGrossMicros=evaluated.grossMicros;
 next.lastLines=evaluated.lines;
 next.lastBoard=board;
 next.lastStops=[...stops];
 next.lastFrames=copyMask(next.frames);
 next.lastScatter=trigger;
 if(feature){
  next.bonusAwardMicros+=awarded;
  next.freeRounds++;
  next.freeRemaining--;
  next.message=next.freeRemaining?'STICKY WILD FREE SPINS · '+next.freeRemaining+' LEFT':'BONUS COMPLETE · '+creditText(next.bonusAwardMicros)+' PRACTICE CREDITS';
  if(next.freeRemaining===0){next.mode='base';next.sticky=freshMask();next.sessionCapRemaining=0;}
 }else{
  next.rounds++;
  if(next.cycle===CYCLE_LENGTH){next.frames=freshMask();next.cycle=0;next.buzz=1;}
  if(trigger){next.bonusBuzz=awardBuzz;next.mode='bonus';next.freeRemaining=BONUS_SPINS;next.bonusAwardMicros=0;next.sticky=freshMask();next.message='420 SCATTERS! 10 STICKY WILD FREE SPINS';}
  else next.message=next.lastConverted.flat().some(Boolean)?'GOLD LEAF FRAMES → MARY JANE WILDS!':evaluated.lines.length?'WINNING PAYLINES: '+evaluated.lines.map(x=>x.line).join(', '):'Collect Gold Leaf Frames!';
 }
 return next;
}
export function validatePracticeSession(state){
 if(!Number.isSafeInteger(state.balanceMicros)||state.balanceMicros<0||state.buzz<1||state.buzz>MAX_BUZZ||state.cycle<0||state.cycle>=10||state.freeRemaining<0||state.freeRemaining>10)return false;
 return true;
}
