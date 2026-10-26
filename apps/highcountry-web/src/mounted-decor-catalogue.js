// HC-ART-03-D cosmetic mounted decorations; stock/prices/ownership remain server-controlled.
const specs=[["heritage-oak-clock","Heritage Oak Wall Clock",1,1],["workshop-gear-clock","Workshop Gear Clock",1,1],["prairie-sunburst-clock","Prairie Sunburst Clock",2,2],["walnut-oval-mirror","Carved Walnut Oval Mirror",1,2],["coastal-driftwood-mirror","Emerald Coast Driftwood Mirror",2,2],["mesa-hacienda-mirror","Red Mesa Hacienda Mirror",1,2],["forest-guardian-carving","Forest Guardian Woodcarving",1,1],["prairie-horseshoe-wreath","Prairie Horseshoe & Wheat Wreath",1,1],["desert-sun-moon-medallion","Desert Sun & Moon Medallion",2,2],["botanical-hanging-shelf","Botanical Hanging Shelf",2,1],["heritage-candle-sconce","Heritage Candle Sconce",1,2],["homestead-key-rack","Homestead Key & Keepsake Rack",2,1]];
export const mountedDecorCatalogue=Object.freeze(specs.map(([slug,name,width,height])=>{
 const id='hc-wall-decor-'+slug;
 return Object.freeze({id,name,collection:'HC-ART-03-D',category:'mounted-decor',
  assetUrl:'/assets/cultivation/props/interior-decorations/mounted-decor/'+id+'.png',
  footprint:Object.freeze({width,height,tileSizePx:64}),
  placement:Object.freeze({layer:'wall_decor',surface:'wall',requiresWallAnchor:true,wallSlotExclusive:true,
   blocksMovement:false,blocksFurniture:false,allowsPlacementBehindFurniture:true,regionRestriction:null}),
  marketplace:Object.freeze({category:'decorative-mounted-wall-items',currency:'BUDS',price:null,
   inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const byId=new Map(mountedDecorCatalogue.map(x=>[x.id,x]));
export function getMountedDecor(id){return byId.get(id)??null;}
// Advisory predicate, not a substitute for server-side authenticated scene validation.
export function canPlaceMountedDecor({id,owned=false,hasWallAnchor=false,wallOccupied=false}={}){
 return byId.has(id)&&owned===true&&hasWallAnchor===true&&wallOccupied===false;
}
