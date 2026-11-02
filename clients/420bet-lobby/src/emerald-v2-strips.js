// Provisional 42-stop math candidate, not certified production odds.
import {sample} from './practice-engine.js';
export const BASE_REELS=Object.freeze([
[0,6,3,0,4,2,1,1,0,0,2,1,0,2,1,5,1,0,0,4,1,0,1,2,0,0,3,2,1,5,0,2,4,3,0,0,2,3,3,1,1,0],
[4,1,0,1,6,2,3,1,1,1,2,1,0,3,0,1,2,3,5,0,3,1,2,2,0,1,2,0,3,0,0,1,5,4,2,0,1,1,0,0,0,2],
[0,3,2,2,1,3,1,6,2,0,1,1,3,2,0,0,4,2,0,1,0,5,0,2,0,2,2,1,0,0,1,4,1,0,0,5,0,4,3,0,0,1],
[3,0,3,0,2,2,1,2,0,1,6,0,1,1,0,2,0,0,4,1,0,3,4,1,5,4,3,0,3,1,2,3,1,2,1,0,1,0,5,0,2,0],
[1,2,0,2,1,0,2,0,1,2,0,0,3,6,2,1,3,1,0,2,1,1,0,1,4,0,4,5,2,1,3,3,3,1,0,2,2,1,1,0,0,5]
].map(reel=>Object.freeze(reel)));
export const FEATURE_REELS=Object.freeze(BASE_REELS.map(reel=>Object.freeze(reel.map(s=>s===6?5:s))));
export function visibleGrid(strips,stops){
 if(stops.length!==5||strips.length!==5||stops.some(x=>!Number.isInteger(x)||x<0||x>=42))throw Error('Invalid five reel stops');
 const grid=[];
 for(let row=0;row<4;row++)for(let reel=0;reel<5;reel++)grid.push(strips[reel][(stops[reel]+row)%42]);
 return grid;
}
export function chooseStops(random){
 return Array.from({length:5},()=>sample(42,random));
}
export function scatterReelCount(board){
 if(board.length!==20)throw Error('Invalid 5x4 board');
 return Array.from({length:5},(_,reel)=>[0,1,2,3].some(row=>board[row*5+reel]===6)).filter(Boolean).length;
}
export function awardedFreeSpins(board){
 return ({3:6,4:15,5:25})[scatterReelCount(board)]||0;
}
export function validateReels(){
 for(const strips of [BASE_REELS,FEATURE_REELS]){
  for(const reel of strips){
   if(reel.length!==42)throw Error('Reel must contain 42 positions');
   for(let stop=0;stop<42;stop++){
    const window=Array.from({length:4},(_,i)=>reel[(stop+i)%42]);
    if(window.filter(s=>s===5||s===6).length>1)throw Error('Special symbols overlap');
   }
  }
 }
 return true;
}
validateReels();
