// CCC-ART-2: allowlisted, uploaded vintage Canadian road-atlas scenery.
// These are decorative source assets; highway and vehicle geometry stay live in chaos-board.js.
const prefix='assets/games/cross-country-chaos/maps/';
const board=(region,underlay,foreground)=>Object.freeze({
 region,
 underlay:Object.freeze({path:prefix+region+'-atlas-underlay.webp',url:'/'+prefix+region+'-atlas-underlay.webp',
  bytes:underlay.bytes,gitBlobSha:underlay.sha,transparent:false}),
 foreground:Object.freeze({path:prefix+region+'-atlas-foreground.webp',url:'/'+prefix+region+'-atlas-foreground.webp',
  bytes:foreground.bytes,gitBlobSha:foreground.sha,transparent:true})
});
export const CHAOS_MAP_DIMENSIONS=Object.freeze({width:1920,height:830,svgWidth:960,svgHeight:415});
export const CHAOS_MAP_ART=Object.freeze({
 east:board('east',{bytes:182536,sha:'928be0ffc351bb21891707e8b87aec95c784b1d0'},
  {bytes:81202,sha:'9cb615c5515687b25f6beda126440546675ee74c'}),
 ontario:board('ontario',{bytes:181884,sha:'ed457416bca064c109e60f22007aca870b631463'},
  {bytes:81022,sha:'abf96780fa09d691d8509a35b1fa77ced747f0c5'}),
 west:board('west',{bytes:181884,sha:'ecd10c43951bbe66cd81a1fe03701f3604c10150'},
  {bytes:81802,sha:'51c25fc224ead140b800976a4cd1ef5e56aa900c'})
});
export const CHAOS_MAP_ASSETS=Object.freeze(Object.values(CHAOS_MAP_ART).flatMap(x=>[x.underlay,x.foreground]));
export function chaosMapArt(region){
 return Object.hasOwn(CHAOS_MAP_ART,region)?CHAOS_MAP_ART[region]:null;
}
