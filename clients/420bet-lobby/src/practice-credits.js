// Ephemeral demo-only credits. No wallets, tokens, storage, transfers, or redemption.
const START=1000,UNITS=10_000_000;
let balanceUnits=START*UNITS,history=[];
export function practiceCreditSnapshot(){return Object.freeze({balance:balanceUnits/UNITS,balanceUnits,history:history.map(x=>({...x}))});}
export function practiceCreditRoundUnits({stakeUnits,payoutUnits,game='slots'}){
 if(!Number.isSafeInteger(stakeUnits)||stakeUnits<0||!Number.isSafeInteger(payoutUnits)||payoutUnits<0)throw Error('Invalid practice amount');
 if(stakeUnits>balanceUnits)throw Error('Insufficient practice credits');
 if(payoutUnits>1_000_000*UNITS)throw Error('Demo payout too large');
 balanceUnits=balanceUnits-stakeUnits+payoutUnits;
 const entry={game,stake:stakeUnits/UNITS,payout:payoutUnits/UNITS,net:(payoutUnits-stakeUnits)/UNITS,balance:balanceUnits/UNITS};
 history.push(entry);if(history.length>30)history.shift();
 return practiceCreditSnapshot();
}
export function practiceCreditRound({stake,payout,game='slots'}){
 if(!Number.isSafeInteger(stake)||stake<0||!Number.isSafeInteger(payout)||payout<0)throw Error('Invalid practice amount');
 return practiceCreditRoundUnits({stakeUnits:stake*UNITS,payoutUnits:payout*UNITS,game});
}
export function resetPracticeCredits(){balanceUnits=START*UNITS;history=[];return practiceCreditSnapshot();}
export const PRACTICE_CREDIT_START=START;
