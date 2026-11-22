// CCC-ART-2: allowlisted, uploaded vintage Canadian road-atlas scenery.
// Printed underlays contain road/town art; only vehicle positions and effects stay live.
// Historical transparent foregrounds remain source-pinned but are no longer rendered.
// Approved atlases are now genuine opaque 1920×830 WebPs, matching the 960×415 SVG canvas.
const prefix='assets/games/cross-country-chaos/maps/';
const board=(region,underlay,foreground)=>Object.freeze({
 region,
 underlay:Object.freeze({path:prefix+region+'-atlas-underlay.webp',url:'/'+prefix+region+'-atlas-underlay.webp',
  width:1920,height:830,bytes:underlay.bytes,gitBlobSha:underlay.sha,transparent:false}),
 foreground:Object.freeze({path:prefix+region+'-atlas-foreground.webp',url:'/'+prefix+region+'-atlas-foreground.webp',
  width:1920,height:830,bytes:foreground.bytes,gitBlobSha:foreground.sha,transparent:true})
});
export const CHAOS_MAP_DIMENSIONS=Object.freeze({width:1920,height:830,svgWidth:960,svgHeight:415});
export const CHAOS_MAP_ART=Object.freeze({
 east:board('east',{bytes:3393494,sha:'508aa63f621c52430d8583d2152bb4ae927df17d'},
  {bytes:81202,sha:'9cb615c5515687b25f6beda126440546675ee74c'}),
 ontario:board('ontario',{bytes:3660605,sha:'6f92f4c032722762143e8a1bdf6fe8cfffec2541'},
  {bytes:81022,sha:'abf96780fa09d691d8509a35b1fa77ced747f0c5'}),
 west:board('west',{bytes:3646229,sha:'26c5db581aa199a867ef5f9126b717c97490ca4f'},
  {bytes:81802,sha:'51c25fc224ead140b800976a4cd1ef5e56aa900c'})
});
export const CHAOS_MAP_ASSETS=Object.freeze(Object.values(CHAOS_MAP_ART).flatMap(x=>[x.underlay,x.foreground]));
export function chaosMapArt(region){
 return Object.hasOwn(CHAOS_MAP_ART,region)?CHAOS_MAP_ART[region]:null;
}
