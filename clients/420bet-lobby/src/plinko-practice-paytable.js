// The exact 13-slot 10_000-bps fixture from
// contracts/test/BetPlinkoVerticalSlice420.t.sol; NOT an activated/approved paytable.
export const PLINKO_PRACTICE_FIXTURE_BPS=Object.freeze([100000,50000,20000,10000,0,0,0,0,0,10000,20000,50000,100000]);
export const PLINKO_PRACTICE_WAGER=0;
export function plinkoMultiplierLabel(bucket){
 if(!Number.isInteger(bucket)||bucket<0||bucket>=PLINKO_PRACTICE_FIXTURE_BPS.length)throw Error('Invalid Plinko bucket');
 const bps=PLINKO_PRACTICE_FIXTURE_BPS[bucket];
 return (bps/10000).toString()+'×';
}
export function plinkoPracticeGrossPayout(bucket){
 plinkoMultiplierLabel(bucket);
 return 0; // Stake 0; never awards money or credits.
}
