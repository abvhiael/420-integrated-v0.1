// CCC-ART-3: visual-only vehicle identity. No impact on shuffle, mileage, scoring or authority.
const root='/assets/games/cross-country-chaos/vehicles/';
export const CHAOS_VEHICLES=Object.freeze([
 {id:'wagon',name:'Woodie Wagon'},
 {id:'compact',name:'Bluebird Compact'},
 {id:'pickup',name:'Canoe Pickup'},
 {id:'camper',name:'Prairie Camper'},
 {id:'convertible',name:'Coastal Convertible'},
 {id:'minibus',name:'Touring Minibus'}
].map(x=>Object.freeze({...x,src:root+x.id+'.svg'})));
export const CHAOS_VEHICLE_SOURCE_SHA=Object.freeze({
 wagon:'2ea3634ae6c371ac9dfee27815271111845b07e9',
 compact:'9b375b59d1a264e5e6b1d7c8cb58a6a8722555fb',
 pickup:'a465dce64913cc553c36402175c03b0e583101ec',
 camper:'fb5035fa98cddaeb494ed3df193e72af1b5fe21d',
 convertible:'cc8312bbf238d3af9c54c1437ac3bf34be962c20',
 minibus:'f8031df42eba8b64c0d0c4a3f8a3e5b9da4b0ac1'
});
export const CHAOS_VEHICLE_COLORS=Object.freeze(['#f4bf57','#83d4fc','#ffa3a1','#c7a0ff']);
export const CHAOS_VEHICLE_ASSETS=Object.freeze(CHAOS_VEHICLES.map(x=>x.src.slice(1)));
export function chaosVehicle(id,seat=0){
 return CHAOS_VEHICLES.find(v=>v.id===id)||CHAOS_VEHICLES[Math.max(0,Math.min(CHAOS_VEHICLES.length-1,seat))];
}
export function applyChaosVehicleSelection(game,ids){
 if(!Array.isArray(ids)||ids.length!==game.players.length)throw Error('Choose a vehicle for each driver.');
 const allowed=new Set(CHAOS_VEHICLES.map(x=>x.id));
 if(ids.some(x=>!allowed.has(x)))throw Error('Unknown Cross-Country Chaos vehicle.');
 for(let i=0;i<ids.length;i++)game.players[i].vehicle=ids[i];
 return game;
}
export function chaosVehicleHeading(angle){
 if(!Number.isFinite(angle))throw Error('Invalid highway direction.');
 const normalized=((angle%360)+360)%360;
 return Math.round(normalized/45)%8;
}
