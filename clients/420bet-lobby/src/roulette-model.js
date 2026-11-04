// American roulette: one 0 and one 00, 38 equally likely pockets.
// Pure, practice-credit-only functions; never access wallets or transactions.
export const ROULETTE_WHEEL=Object.freeze(['0','28','9','26','30','11','7','20','32','17','5','22','34','15','3','24','36','13','1','00','27','10','25','29','12','8','19','31','18','6','21','33','16','4','23','35','14','2']);
export const RED_NUMBERS=Object.freeze([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const RED=new Set(RED_NUMBERS);
export const ROULETTE_CHIPS=Object.freeze([1,5,10,25,100,500]);
export const STARTING_CREDITS=10000;
const isStraight=key=>/^straight:(00|0|[1-9]|[12][0-9]|3[0-6])$/.test(key);
export function rouletteColor(number){
 const value=String(number);
 if(value==='0'||value==='00')return 'green';
 return RED.has(Number(value))?'red':'black';
}
export function rouletteBetKeys(){
 return ['0','00',...Array.from({length:36},(_,i)=>String(i+1))].map(n=>'straight:'+n)
 .concat(['dozen:1','dozen:2','dozen:3','column:1','column:2','column:3','low','high','even','odd','red','black']);
}
const ALLOWED=new Set(rouletteBetKeys());
export function rouletteProfitOdds(key){
 if(!ALLOWED.has(key))throw Error('Invalid roulette bet');
 return isStraight(key)?35:key.startsWith('dozen:')||key.startsWith('column:')?2:1;
}
export function rouletteBetWins(key,pocket){
 if(!ALLOWED.has(key)||!ROULETTE_WHEEL.includes(String(pocket)))throw Error('Invalid roulette bet or pocket');
 const n=Number(pocket);
 if(key.startsWith('straight:'))return key.slice(9)===String(pocket);
 if(pocket==='0'||pocket==='00')return false;
 if(key.startsWith('dozen:'))return Math.ceil(n/12)===Number(key.slice(6));
 if(key.startsWith('column:'))return ((n-1)%3)+1===Number(key.slice(7));
 if(key==='low')return n<=18;
 if(key==='high')return n>=19;
 if(key==='even')return n%2===0;
 if(key==='odd')return n%2===1;
 return rouletteColor(pocket)===key;
}
export function rouletteTotal(bets){
 if(!Array.isArray(bets))throw Error('Invalid bets');
 let total=0;
 for(const bet of bets){
  if(!ALLOWED.has(bet.key)||!ROULETTE_CHIPS.includes(bet.amount))throw Error('Invalid practice chip');
  total+=bet.amount;
 }
 return total;
}
export function rouletteSettle(bets,pocket,balance){
 if(!Number.isSafeInteger(balance)||balance<0)throw Error('Invalid practice balance');
 const stake=rouletteTotal(bets);
 if(!ROULETTE_WHEEL.includes(String(pocket))||stake===0||stake>balance)throw Error('Invalid practice spin');
 let returned=0;
 const winningKeys=[];
 for(const {key,amount} of bets)if(rouletteBetWins(key,pocket)){
  returned+=amount*(rouletteProfitOdds(key)+1);
  winningKeys.push(key);
 }
 return {pocket:String(pocket),color:rouletteColor(pocket),stake,returned,net:returned-stake,balance:balance-stake+returned,winningKeys};
}
export function rouletteRandomPocket(random=Math.random){
 const value=random();
 if(typeof value!=='number'||value<0||value>=1)throw Error('Invalid practice random draw');
 return ROULETTE_WHEEL[Math.floor(value*ROULETTE_WHEEL.length)];
}
