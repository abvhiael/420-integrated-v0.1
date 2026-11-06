// TEMPORARY bonus QA fixtures for Sin City High Rollers.
// All fixtures use the real, unchanged reel strips and the real nextRound engine.
import {BASE_STRIPS,FREE_STRIPS,initialState,visibleBoard} from './sin-city-engine.js';

export const SIN_CITY_BONUS_PREVIEWS=Object.freeze([
 Object.freeze({id:'puff',label:'Puff Puff Pass',symbol:'ASH',reels:3}),
 Object.freeze({id:'hotbox',label:'Hotbox Respins',symbol:'GEM',reels:3}),
 Object.freeze({id:'free',label:'Chronic Sessions Free Spins',symbol:'SCATTER',reels:3}),
 Object.freeze({id:'lowrider',label:"Drop It Like It's Hot",symbol:'CAR',reels:3})
]);
const visible=(strip,stop)=>Array.from({length:4},(_,row)=>strip[(stop+row)%strip.length]);
const choose=(strip,symbol,required)=>{
 for(let stop=0;stop<strip.length;stop++){
  const symbols=visible(strip,stop);
  if(symbols.includes(symbol)===required)return stop;
 }
 throw Error('Unable to create QA fixture for '+symbol);
};
export function makeSinCityBonusPreview(type,prior=initialState()){
 const feature=SIN_CITY_BONUS_PREVIEWS.find(item=>item.id===type);
 if(!feature)throw new RangeError('Unknown Sin City bonus preview');
 const strips=type==='lowrider'?FREE_STRIPS:BASE_STRIPS;
 const stops=strips.map((strip,reel)=>choose(strip,feature.symbol,reel<feature.reels));
 const board=visibleBoard(strips,stops);
 const matching=board.filter(reel=>reel.includes(feature.symbol)).length;
 if(matching!==feature.reels)throw Error('QA preview does not match its trigger');
 const state={
  ...prior,
  mode:type==='lowrider'?'free':'base',
  freeRemaining:type==='lowrider'?3:0,
  freePlayed:0,freeMultiplier:1,
  sticky:[],locked:[],respins:0,respinReturn:'base',
  roundGross:0,roundStake:prior.stake,
  lastFeature:'',lastWins:[],lastReveal:null
 };
 return {state,stops,board,feature};
}
