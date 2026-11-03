// EXPERIMENTAL V2 calibration candidate. NOT a certified 96% RTP or a live-terms authority.
// One credit has 10,000,000 indivisible calculation units; 1 $420 = 10 credits is a separate proposed conversion.
// Each coefficient is a number of micro-ten-millionth credits per ONE credit staked, per winning way.
// User-selected clean symbol payouts at 10-credit reference stake. Existing Scatter fixture unchanged. Preliminary cap-aware RTP bound approximately 96.421–96.437% at 250x, NOT a certification.
export const UNITS=10_000_000;
export const WAY_UNITS=Object.freeze([
 Object.freeze([50000,200000,600000]),       // Bud: 0.05, 0.20, 0.60 at 10 credits
 Object.freeze([100000,300000,1000000]),     // Grinder: 0.10, 0.30, 1.00
 Object.freeze([100000,300000,1000000]),     // Lighter: 0.10, 0.30, 1.00
 Object.freeze([200000,600000,2500000]),     // Bong: 0.20, 0.60, 2.50
 Object.freeze([300000,1000000,3500000])     // Chips: 0.30, 1.00, 3.50
]);
export const SCATTER_UNITS=Object.freeze({3:290985,4:872950,5:2327865});
export const FEATURE_NUMERATOR=42,FEATURE_DENOMINATOR=10;
export const REFERENCE_STAKE=10,MAX_STAKE=50;
export const CANDIDATE_CAPS=Object.freeze([50,100,250,500]);
export function v2Ways(board){
 if(!Array.isArray(board)||board.length!==20)throw Error('Expected 20 symbols');
 const results=[];let allWildReels=0;
 for(let reel=0;reel<5;reel++){
  if([0,1,2,3].some(row=>board[row*5+reel]===5))allWildReels++;
  else break;
 }
 for(let symbol=0;symbol<5;symbol++){
  let ways=1,reels=0;const positions=[];
  for(let reel=0;reel<5;reel++){
   const matches=[];
   for(let row=0;row<4;row++){const index=row*5+reel;if(board[index]===symbol||board[index]===5)matches.push(index);}
   if(!matches.length)break;
   ways*=matches.length;reels++;positions.push(...matches);
  }
  if(reels>=3){
   // A single all-Wild path is paid at the highest 3/4/5-reel eligible tier, once.
   const wildOnly=reels<=allWildReels?1:0;
   results.push({symbol,reels,ways:ways-wildOnly,positions});
  }
 }
 const allWildAward=allWildReels>=3?{symbol:4,reels:allWildReels,ways:1,positions:[]} : null;
 return {results,allWildAward};
}
export function v2Evaluate(board,stake=10,{feature=false}={}){
 if(!Number.isInteger(stake)||stake<1||stake>MAX_STAKE)throw Error('Stake must be 1..50 whole credits');
 const {results,allWildAward}=v2Ways(board);
 const lines=results.filter(x=>x.ways>0).map(x=>({...x,unit:WAY_UNITS[x.symbol][x.reels-3],units:x.ways*WAY_UNITS[x.symbol][x.reels-3]*stake}));
 if(allWildAward)lines.push({...allWildAward,unit:WAY_UNITS[4][allWildAward.reels-3],units:WAY_UNITS[4][allWildAward.reels-3]*stake,allWild:true});
 const scatterReels=Array.from({length:5},(_,reel)=>[0,1,2,3].some(row=>board[row*5+reel]===6)).filter(Boolean).length;
 if(feature&&scatterReels)throw Error('Feature reels may not contain Scatters');
 const scatterUnits=(SCATTER_UNITS[scatterReels]||0)*stake;
 const baseUnits=lines.reduce((acc,x)=>acc+x.units,0)+scatterUnits;
 // All quantities stay integers; bonus multiplier 4.20 has an exact /10 factor.
 const grossUnits=feature?baseUnits*FEATURE_NUMERATOR/FEATURE_DENOMINATOR:baseUnits;
 if(!Number.isSafeInteger(grossUnits))throw Error('Non-integral or unsafe payout');
 return {lines,scatterReels,scatterUnits,baseUnits,grossUnits,feature,stake};
}
export function capV2Payout(grossUnits,stake,cap=250){
 if(!CANDIDATE_CAPS.includes(cap)||!Number.isInteger(stake)||stake<1||stake>50)throw Error('Invalid candidate cap or wager');
 const ceiling=cap*stake*UNITS;
 return Math.min(grossUnits,ceiling);
}
export const creditAmount=units=>units/UNITS;
