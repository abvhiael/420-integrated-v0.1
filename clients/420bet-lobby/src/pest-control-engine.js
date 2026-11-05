// Pest Control: deterministic game rules, independent of artwork or DOM.
// Practice-credit simulation only. No wallet, settlement contracts or wagers.
export const PC_RULES=Object.freeze({tiles:25,minHazards:1,maxHazards:24,minBet:1,maxBet:100,rtp:0.96});
const validInt=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export function survivalProbability(hazards,picks){
 if(!validInt(hazards,1,24)||!validInt(picks,0,25-hazards))throw RangeError('Invalid hazard count or pick depth');
 let p=1;for(let i=0;i<picks;i++)p*=(25-hazards-i)/(25-i);return p;
}
export function payoutMultiplier(hazards,picks){
 if(picks===0)return 0;
 return PC_RULES.rtp/survivalProbability(hazards,picks);
}
export function nextPickProbability(hazards,picks){
 if(!validInt(hazards,1,24)||!validInt(picks,0,25-hazards))throw RangeError('Invalid pick depth');
 return picks===25-hazards?null:(25-hazards-picks)/(25-picks);
}
export const roundCents=n=>Math.floor((n+1e-9)*100+0.5)/100;
function secureIndex(max,rng){
 if(!Number.isSafeInteger(max)||max<1)throw RangeError('Invalid random bound');
 const range=0x100000000,limit=Math.floor(range/max)*max;
 for(let attempts=0;attempts<10000;attempts++){
  const n=rng();
  if(!Number.isInteger(n)||n<0||n>=range)throw Error('Invalid RNG output');
  if(n<limit)return n%max;
 }
 throw Error('Unbiased random sampling unavailable');
}
export function secureUint32(){
 if(!globalThis.crypto?.getRandomValues)throw Error('Secure randomness unavailable');
 const n=new Uint32Array(1);globalThis.crypto.getRandomValues(n);return n[0];
}
export function shuffledHazards(count,rng=secureUint32){
 if(!validInt(count,1,24))throw RangeError('Invalid hazard count');
 const positions=Array.from({length:25},(_,i)=>i);
 for(let i=24;i>0;i--){const j=secureIndex(i+1,rng);[positions[i],positions[j]]=[positions[j],positions[i]];}
 return new Set(positions.slice(0,count));
}
export function createPestControl(options={}){
 return {phase:'ready',balance:options.balance??1000,bet:10,hazards:5,picks:[],hazardTiles:new Set(),return:0,result:null,log:['Buddy Bloom is ready. Pick your risk!'],round:0,rng:options.rng??secureUint32};
}
export function pestAction(game,type,value){
 const ready=game.phase==='ready'||game.phase==='finished';
 if(type==='bet'){if(!ready||!validInt(value,1,100))return false;game.bet=value;return true;}
 if(type==='hazards'){if(!ready||!validInt(value,1,24))return false;game.hazards=value;return true;}
 if(type==='refill'){if(!ready)return false;game.balance=roundCents(game.balance+1000);return true;}
 if(type==='start'){
  if(!ready||game.balance<game.bet)return false;
  const tiles=shuffledHazards(game.hazards,game.rng); // Generate before debiting funds.
  game.balance=roundCents(game.balance-game.bet);game.hazardTiles=tiles;game.picks=[];game.return=0;game.result=null;game.phase='active';game.round++;
  game.log=['Grow started — '+game.hazards+' pests hidden.'];return true;
 }
 if(type==='pick'){
  if(game.phase!=='active'||!validInt(value,0,24)||game.picks.includes(value))return false;
  game.picks.push(value);
  if(game.hazardTiles.has(value)){game.phase='finished';game.result='infested';game.return=0;game.log.unshift('INFESTED! The crop was lost.');return true;}
  const count=game.picks.length;
  game.log.unshift('Healthy bud found! '+count+' clean '+(count===1?'tray':'trays')+'.');
  if(count===25-game.hazards)return pestAction(game,'harvest');
  return true;
 }
 if(type==='harvest'){
  if(game.phase!=='active'||game.picks.length===0||game.picks.some(i=>game.hazardTiles.has(i)))return false;
  game.return=roundCents(game.bet*payoutMultiplier(game.hazards,game.picks.length));
  game.balance=roundCents(game.balance+game.return);game.phase='finished';game.result='harvest';
  game.log.unshift('CROP SAVED! Harvested '+game.return.toFixed(2)+' practice credits.');return true;
 }
 if(type==='cancel'){
  if(game.phase!=='active'||game.picks.length>0)return false;
  game.balance=roundCents(game.balance+game.bet);game.phase='finished';game.result='cancelled';game.return=game.bet;game.log.unshift('Grow cancelled, wager refunded.');return true;
 }
 return false;
}
