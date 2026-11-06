// Royal Kush: practice-only single-hand Jacks or Better draw poker.
export const RK_PAY=Object.freeze([
 {key:'royal',name:'ROYAL FLUSH',unit:800},
 {key:'straight-flush',name:'STRAIGHT FLUSH',unit:50},
 {key:'quads',name:'FOUR OF A KIND',unit:25},
 {key:'full-house',name:'FULL HOUSE',unit:9},
 {key:'flush',name:'FLUSH',unit:6},
 {key:'straight',name:'STRAIGHT',unit:4},
 {key:'trips',name:'THREE OF A KIND',unit:3},
 {key:'two-pair',name:'TWO PAIR',unit:2},
 {key:'jacks',name:'JACKS OR BETTER',unit:1}
]);
export const RK_SUITS=Object.freeze(['♠','♥','♦','♣']);
export const RK_RANKS=Object.freeze(['2','3','4','5','6','7','8','9','10','J','Q','K','A']);
const rankValue=r=>RK_RANKS.indexOf(r)+2;
export function evaluateRoyalKush(cards){
 if(!Array.isArray(cards)||cards.length!==5)throw new RangeError('Requires five cards');
 const seen=new Set(cards.map(c=>c.rank+c.suit));
 if(seen.size!==5||cards.some(c=>!RK_SUITS.includes(c.suit)||!RK_RANKS.includes(String(c.rank))))throw new RangeError('Invalid hand');
 const nums=cards.map(c=>rankValue(String(c.rank))).sort((a,b)=>a-b);
 const counts=new Map();for(const n of nums)counts.set(n,(counts.get(n)||0)+1);
 const groups=[...counts.values()].sort((a,b)=>b-a);
 const flush=cards.every(c=>c.suit===cards[0].suit);
 const straight=nums.every((n,i)=>i===0||n===nums[0]+i)||(nums.join(',')==='2,3,4,5,14');
 let key=null;
 if(flush&&straight&&nums[0]===10)key='royal';
 else if(flush&&straight)key='straight-flush';
 else if(groups[0]===4)key='quads';
 else if(groups[0]===3&&groups[1]===2)key='full-house';
 else if(flush)key='flush';
 else if(straight)key='straight';
 else if(groups[0]===3)key='trips';
 else if(groups[0]===2&&groups[1]===2)key='two-pair';
 else if(groups[0]===2){const pair=[...counts].find(([,v])=>v===2)?.[0];if(pair>=11)key='jacks';}
 return {key,name:RK_PAY.find(p=>p.key===key)?.name||'NO WIN',unit:RK_PAY.find(p=>p.key===key)?.unit||0};
}
function cryptoUint(){
 if(!globalThis.crypto?.getRandomValues)throw new Error('Secure RNG unavailable');
 const a=new Uint32Array(1);globalThis.crypto.getRandomValues(a);return a[0];
}
function uniform(max,rng){
 // Rejection sampling removes modulo bias for the default 32-bit generator.
 const limit=Math.floor(4294967296/max)*max;
 for(let tries=0;tries<1000;tries++){const n=rng();if(!Number.isInteger(n)||n<0||n>4294967295)throw new RangeError('Invalid RNG value');if(n<limit)return n%max;}
 throw new Error('Randomness source failed');
}
export function shuffledDeck(rng=cryptoUint){
 const deck=RK_SUITS.flatMap(suit=>RK_RANKS.map(rank=>({rank,suit})));
 for(let i=deck.length-1;i>0;i--){const j=uniform(i+1,rng);[deck[i],deck[j]]=[deck[j],deck[i]];}
 return deck;
}
export function createRoyalKush({credits=12750,bet=5,rng=cryptoUint}={}){
 if(!Number.isSafeInteger(credits)||credits<0||!Number.isSafeInteger(bet)||bet<1||bet>5)throw new RangeError('Invalid practice balance or bet');
 return {phase:'ready',credits,bet,hand:[],held:[false,false,false,false,false],deck:[],win:0,lastHand:'',round:0,rng,message:'Choose a bet, then DEAL. Hold cards before DRAW.'};
}
export function royalKushAction(s,type,value){
 const changeable=s.phase!=='draw';
 if(type==='bet'&&changeable&&Number.isInteger(value)&&value>=1&&value<=5){s.bet=value;return true;}
 if(type==='bet-one'&&changeable){s.bet=s.bet===5?1:s.bet+1;return true;}
 if(type==='bet-max'&&changeable){s.bet=5;return true;}
 if(type==='refill'&&changeable){s.credits+=1000;s.message='Added 1,000 practice credits. No transfer or payout.';return true;}
 if(type==='hold'&&s.phase==='draw'&&Number.isInteger(value)&&value>=0&&value<5){s.held[value]=!s.held[value];return true;}
 if(type==='deal'&&s.phase!=='draw'&&s.credits>=s.bet){
  s.credits-=s.bet;s.deck=shuffledDeck(s.rng);s.hand=s.deck.splice(0,5);s.held=[false,false,false,false,false];
  s.win=0;s.lastHand='';s.phase='draw';s.round++;s.message='Select HOLD on the cards you want to keep, then DRAW.';return true;
 }
 if(type==='draw'&&s.phase==='draw'){
  for(let i=0;i<5;i++)if(!s.held[i])s.hand[i]=s.deck.shift();
  const result=evaluateRoyalKush(s.hand);
  s.win=result.unit*s.bet;s.credits+=s.win;s.lastHand=result.name;s.phase='finished';
  s.message=s.win?result.name+' — WIN '+s.win.toLocaleString('en-US')+' PRACTICE CREDITS':'No win this time. Deal again!';
  return true;
 }
 return false;
}
