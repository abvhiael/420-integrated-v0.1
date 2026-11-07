// Cannabis Cowboy M6: interactive, five-stop, practice-only road trip.
// The 3 cases at each stop are drawn before the user chooses. No wallet access.
export const ROAD_STOPS=Object.freeze([
 Object.freeze({name:'Sunset Ridge',scene:'🌄',description:'Take the high road into the mountains'}),
 Object.freeze({name:'Pine Creek',scene:'🌲',description:'Where the river meets the green valley'}),
 Object.freeze({name:'Emerald Ranch',scene:'🌿',description:'A bountiful stop in the high country'}),
 Object.freeze({name:'Old Music Hall',scene:'🎸',description:'Play a tune for the travelling crowd'}),
 Object.freeze({name:'Last Light Lookout',scene:'🌅',description:'Bring the harvest home'})
]);
export const ROAD_ART_ROOT='/assets/420bet/cannabis-cowboy/on-the-road-again/';
export const ROAD_STOP_SLUGS=Object.freeze(['sunset-ridge','pine-creek','emerald-ranch','old-music-hall','last-light-lookout']);
export const roadStopBackground=index=>ROAD_ART_ROOT+'ontheroad_bg_'+ROAD_STOP_SLUGS[index]+'.png';
export const roadCaseArtwork=(stopIndex,caseIndex)=>ROAD_ART_ROOT+'guitarcase_'+ROAD_STOP_SLUGS[stopIndex]+'_'+String(caseIndex+1).padStart(2,'0')+'.png';
export const ROAD_CASE_MULTIPLIERS=Object.freeze([0,0.5,1,1.5,2,3,4.2]); // ordinary credit cases
export const ROAD_STACKABLE_MULTIPLIERS=Object.freeze([2,3,5,10]);
export const ROAD_CASE_COUNT=3;
const sample=rng=>{const v=rng();if(!Number.isFinite(v)||v<0||v>=1)throw Error('Road Trip RNG outside [0,1)');return v;};
export function createRoadTrip(bet,rng=Math.random){
 if(!Number.isSafeInteger(bet)||bet<=0)throw Error('Invalid Road Trip practice bet');
 return {stops:ROAD_STOPS.map((stop,index)=>{
  const multiplierCase=Math.floor(sample(rng)*ROAD_CASE_COUNT);
  const multiplier=ROAD_STACKABLE_MULTIPLIERS[Math.floor(sample(rng)*ROAD_STACKABLE_MULTIPLIERS.length)];
  const caseValues=Array.from({length:ROAD_CASE_COUNT},(_,i)=>i===multiplierCase?0:
   Math.round(bet*ROAD_CASE_MULTIPLIERS[Math.floor(sample(rng)*ROAD_CASE_MULTIPLIERS.length)]));
  return {...stop,index,caseValues,multiplierCase,multiplier};
 }),bet};
}
export function chooseRoadCase(trip,previous,caseIndex){
 if(!trip||!Array.isArray(trip.stops)||trip.stops.length!==5)throw Error('Invalid Road Trip');
 if(!Number.isInteger(caseIndex)||caseIndex<0||caseIndex>=ROAD_CASE_COUNT)throw Error('Invalid case choice');
 if(!Array.isArray(previous)||previous.length>=trip.stops.length)throw Error('Invalid Road Trip progress');
 const stop=trip.stops[previous.length];
 if(!Array.isArray(stop.caseValues)||stop.caseValues.length!==ROAD_CASE_COUNT||stop.caseValues.some(x=>!Number.isSafeInteger(x)||x<0))throw Error('Invalid case prizes');
 if(!Number.isInteger(stop.multiplierCase)||stop.multiplierCase<0||stop.multiplierCase>=ROAD_CASE_COUNT||!ROAD_STACKABLE_MULTIPLIERS.includes(stop.multiplier))throw Error('Invalid multiplier case');
 const kind=caseIndex===stop.multiplierCase?'multiplier':'credits';
 const award=kind==='multiplier'?0:stop.caseValues[caseIndex];
 const multiplier=kind==='multiplier'?stop.multiplier:1;
 const picks=[...previous.map(p=>({...p})),{stop:previous.length,caseIndex,award,kind,multiplier}];
 const subtotal=picks.reduce((n,p)=>n+p.award,0);
 // Add collected multiplier values; without a multiplier case, keep a neutral 1×.
 const multipliers=picks.filter(p=>p.kind==='multiplier').map(p=>p.multiplier);
 const stackedMultiplier=multipliers.length?multipliers.reduce((n,value)=>n+value,0):1;
 const total=subtotal*stackedMultiplier;
 if(!Number.isSafeInteger(subtotal)||!Number.isSafeInteger(total)||!Number.isSafeInteger(stackedMultiplier))throw Error('Unsafe road trip total');
 return {picks,subtotal,stackedMultiplier,total,done:picks.length===trip.stops.length,award,kind,multiplier};
}
