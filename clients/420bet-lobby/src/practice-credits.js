// Ephemeral demo-only credits. No wallets, tokens, storage, transfers, or redemption.
const START=1000;
let balance=START,history=[];
export function practiceCreditSnapshot(){return Object.freeze({balance,history:history.map(x=>({...x}))});}
export function practiceCreditRound({stake,payout,game='slots'}){
 if(!Number.isSafeInteger(stake)||stake<0||!Number.isSafeInteger(payout)||payout<0)throw Error('Invalid practice credit amount');
 if(stake>balance)throw Error('Insufficient practice credits');
 if(payout>1_000_000)throw Error('Demo payout exceeds safety ceiling');
 balance=balance-stake+payout;
 history.push({game,stake,payout,net:payout-stake,balance});
 if(history.length>30)history.shift();
 return practiceCreditSnapshot();
}
export function resetPracticeCredits(){balance=START;history=[];return practiceCreditSnapshot();}
export const PRACTICE_CREDIT_START=START;
