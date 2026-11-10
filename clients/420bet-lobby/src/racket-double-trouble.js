// Racket's Loaded Dice: virtual credits only, separate from the 0–9999 practice outcome engine.
// No wallet, token accounting, wager, settlement, canonical multiplier or real payout.
export const RACKET_START_CENTS=100000;
export const RACKET_STAKE_CENTS=1000;
export const RACKET_RETURN_FACTOR=0.96; // Illustrative base-game virtual return before bonus.
export const RACKET_BONUS_MULTIPLIER=2;
export function initialRacketSession(){return {balanceCents:RACKET_START_CENTS,charge:0,lastPayoutCents:0,lastNetCents:0,lastBonus:false,lastWin:false,rounds:0};}
export function racketWinProbability(choice,threshold){
 if(!Number.isInteger(threshold)||threshold<1||threshold>9999||!['under','over'].includes(choice))throw Error('invalid dice selection');
 return (choice==='under'?threshold:10000-threshold)/10000;
}
export function racketPotentialPayoutCents(choice,threshold,bonus=false){
 const base=Math.round(RACKET_STAKE_CENTS*RACKET_RETURN_FACTOR/racketWinProbability(choice,threshold));
 return base*(bonus?RACKET_BONUS_MULTIPLIER:1);
}
export function settleRacketRoll(session,{roll,choice,threshold}){
 if(!Number.isInteger(roll)||roll<0||roll>9999)throw Error('invalid dice roll');
 if(session.balanceCents<RACKET_STAKE_CENTS)throw Error('not enough virtual credits');
 const win=choice==='under'?roll<threshold:roll>=threshold;
 const bonus=session.charge===100;
 const paid=win?racketPotentialPayoutCents(choice,threshold,bonus):0;
 const charge=bonus?0:Math.min(100,session.charge+10+(win?5:0));
 return {balanceCents:session.balanceCents-RACKET_STAKE_CENTS+paid,charge,lastPayoutCents:paid,lastNetCents:paid-RACKET_STAKE_CENTS,lastBonus:bonus,lastWin:win,rounds:session.rounds+1};
}
export const formatRacketCredits=cents=>(cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
