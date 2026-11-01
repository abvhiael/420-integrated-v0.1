// Browser-only practice. Not the canonical resolver, randomness, settlement, or RTP.
export const PRACTICE_GAMES=Object.freeze(['dice','keno','plinko','slots','roulette','blackjack','mines','crash']);
export function sample(max,random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296){if(!Number.isSafeInteger(max)||max<1)throw Error('invalid sample size');const x=random();if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>=1)throw Error('invalid entropy');return Math.floor(x*max);}
export function uniqueNumbers(count,max,random){const numbers=Array.from({length:max},(_,i)=>i+1);for(let i=0;i<count;i++){const j=i+sample(max-i,random);[numbers[i],numbers[j]]=[numbers[j],numbers[i]];}return numbers.slice(0,count);}
export function initial(id){if(!PRACTICE_GAMES.includes(id))throw Error('unknown practice game');return {id,round:0,message:'Practice mode. No funds, real RNG proof, payouts or transaction history.',choice:id==='roulette'?'red':'under',threshold:5000,picks:[],mineCount:3,open:[],mines:[],done:false,auto:2,score:0,cards:[],dealer:[],result:[],selection:0};}
export function scoreCards(cards){let sum=0,aces=0;for(const card of cards){const value=card%13+1;if(value===1){sum+=11;aces++;}else sum+=Math.min(value,10);}while(sum>21&&aces){sum-=10;aces--;}return sum;}
export function next(state,action,random){const s={...state,picks:[...state.picks],open:[...state.open],mines:[...state.mines],cards:[...state.cards],dealer:[...state.dealer],result:[...state.result]};const draw=n=>sample(n,random);const card=()=>draw(52);
 if(action.type==='choice'){s.choice=action.value;return s;}
 if(action.type==='threshold'){const n=Number(action.value);if(Number.isInteger(n)&&n>=1&&n<=9999)s.threshold=n;return s;}
 if(action.type==='auto'){const n=Number(action.value);if(Number.isFinite(n)&&n>1&&n<=100000)s.auto=n;return s;}
 if(action.type==='mine-count'){const n=Number(action.value);if(Number.isInteger(n)&&n>=1&&n<=24){s.mineCount=n;s.done=false;s.open=[];s.mines=[];}return s;}
 if(action.type==='pick'&&s.id==='keno'){if(Number.isInteger(action.value)&&action.value>=1&&action.value<=80){const n=action.value;s.picks=s.picks.includes(n)?s.picks.filter(v=>v!==n):s.picks.length<10?[...s.picks,n]:s.picks;}return s;}
 if(action.type==='reset'&&s.id==='mines'){s.mines=uniqueNumbers(s.mineCount,25,random).map(x=>x-1);s.open=[];s.done=false;s.message='New simulated board; select a tile.';s.round++;return s;}
 if(action.type==='tile'&&s.id==='mines'){const i=action.value;if(!Number.isInteger(i)||i<0||i>24||s.done)return s;if(!s.mines.length)s.mines=uniqueNumbers(s.mineCount,25,random).map(x=>x-1);if(s.open.includes(i))return s;s.open.push(i);s.done=s.mines.includes(i)||s.open.length===25-s.mineCount;s.message=s.mines.includes(i)?'Simulated mine — round ended.':s.done?'All safe tiles revealed in practice.':'Safe tile (simulation).';return s;}
 if(action.type==='cashout'&&s.id==='mines'){if(s.open.length&&!s.done){s.done=true;s.message='Practice cash-out. No tokens or payouts.';}return s;}
 if(action.type==='hit'&&s.id==='blackjack'){if(s.done||!s.cards.length)return s;s.cards.push(card());s.score=scoreCards(s.cards);if(s.score>=21){s.done=true;s.message=s.score>21?'Practice bust.':'21 — practice hand complete.';}return s;}
 if(action.type==='stand'&&s.id==='blackjack'){if(s.done||!s.cards.length)return s;while(scoreCards(s.dealer)<17)s.dealer.push(card());s.done=true;const d=scoreCards(s.dealer),p=scoreCards(s.cards);s.message=d>21||p>d?'Practice win (no payout).':p===d?'Practice push.':'Practice dealer wins.';return s;}
 if(action.type!=='play')return s;
 s.round++;s.done=false;
 switch(s.id){
 case 'dice':{const roll=draw(10000);const won=s.choice==='over'?roll>=s.threshold:roll<s.threshold;s.result=[roll];s.message='Practice roll '+roll+' / 9999 — '+(won?'winning side':'other side')+' (no prize).';break;}
 case 'keno':{if(s.picks.length<1){s.message='Select 1–10 numbers before drawing.';return s;}const numbers=uniqueNumbers(20,80,random);const hits=numbers.filter(x=>s.picks.includes(x));s.result=numbers;s.message='Simulated 20-number draw: '+hits.length+' matches. No paytable or payout applied.';break;}
 case 'plinko':{const path=Array.from({length:12},()=>draw(2));const bucket=path.reduce((a,b)=>a+b,0);s.result=path;s.message='Simulated 12-row path, bucket '+bucket+' of 12. No payout table applied.';break;}
 case 'slots':{s.result=Array.from({length:20},()=>draw(7));s.message='Simulated 5-reel × 4-row symbol layout. No canonical reel strips, paytable or winnings applied.';break;}
 case 'roulette':{const pocket=draw(37);s.result=[pocket];const reds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);const colour=pocket===0?'green':reds.has(pocket)?'red':'black';s.message='Simulated pocket '+pocket+' ('+colour+'). No winnings applied.';break;}
 case 'blackjack':{s.cards=[card(),card()];s.dealer=[card(),card()];s.score=scoreCards(s.cards);s.done=s.score>=21;s.message='Simulated six-deck-style practice hand. Hit or stand; no stake or payout.';break;}
 case 'mines':{s.mines=uniqueNumbers(s.mineCount,25,random).map(x=>x-1);s.open=[];s.message='New 5×5 practice board. Reveal tiles or cash out.';break;}
 case 'crash':{const bps=10000+draw(100001);const target=Math.round(s.auto*10000);s.result=[bps/10000];s.done=true;s.message='Simulated crash at '+(bps/10000).toFixed(2)+'×, auto target '+s.auto.toFixed(2)+'×: '+(target<bps?'target reached':'crashed before target')+'. No stake or payout.';break;}
 }
 return s;
}
