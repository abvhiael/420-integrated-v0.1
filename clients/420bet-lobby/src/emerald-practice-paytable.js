// Educational practice fixture, NOT approved or economically calibrated.
export const DEMO_WAYS_CREDITS=Object.freeze([2,3,4,5,6]);
export const DEMO_SCATTER_CREDITS=Object.freeze({3:5,4:12,5:25});
export const DEMO_STAKE=10;
export function demoSlotBreakdown(board,wins,{freeSpin=false}={}){
 if(board.length!==20)throw Error('Invalid visible grid');
 const lines=wins.map(w=>({symbol:w.symbol,reels:w.reels,ways:w.ways,unit:DEMO_WAYS_CREDITS[w.symbol],credits:w.ways*DEMO_WAYS_CREDITS[w.symbol]}));
 const scatterReels=new Set(board.flatMap((v,i)=>v===6?[i%5]:[])).size;
 const scatters=DEMO_SCATTER_CREDITS[scatterReels]||0;
 const subtotal=lines.reduce((s,w)=>s+w.credits,0)+scatters;
 return {lines,scatterReels,scatters,subtotal,multiplier:freeSpin?2:1,payout:subtotal*(freeSpin?2:1)};
}
