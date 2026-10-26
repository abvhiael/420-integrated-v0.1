// HC-ART-03-B. Visual decoration metadata only; no currency, ownership or stock is issued here.
const specs=[["sign-grow-room-welcome","Welcome to the Grow Room",2,1],["sign-seed-company","High Country Seed Company",2,1],["plaque-keep-growing","Keep Growing",2,1],["sign-plants-at-work","Caution: Plants at Work",2,1],["sign-greenhouse-door","Close the Greenhouse Door",2,1],["sign-no-bad-vibes","No Bad Vibes Allowed",2,1],["plaque-measure-twice","Measure Twice, Cut Once",2,1],["sign-growing-since-forever","Growing Since Forever",2,1],["plaque-emerald-coast-cedar","Emerald Coast Cedar Plaque",2,1],["plaque-golden-prairie-harvest","Golden Prairie Harvest Plaque",2,1],["plaque-red-mesa-terracotta","Red Mesa Terracotta Plaque",2,1],["sign-growers-directions","Grower's Directional Sign",1,2]];
export const signsPlaquesCatalogue=Object.freeze(specs.map(([slug,name,width,height])=>{
 const id='hc-wall-'+slug;
 return Object.freeze({id,name,collection:'HC-ART-03-B',category:'signs-plaques',
  assetUrl:'/assets/cultivation/props/interior-decorations/signs-plaques/'+id+'.png',
  footprint:Object.freeze({width,height,tileSizePx:64}),
  placement:Object.freeze({layer:'wall_decor',surface:'wall',requiresWallAnchor:true,wallSlotExclusive:true,
    blocksMovement:false,blocksFurniture:false,allowsPlacementBehindFurniture:true,regionRestriction:null}),
  marketplace:Object.freeze({category:'decorative-wall-signs',currency:'BUDS',price:null,
    inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const byId=new Map(signsPlaquesCatalogue.map(x=>[x.id,x]));
export function getSignPlaque(id){return byId.get(id)??null;}
// Client-side eligibility hint only; the authoritative scene service must revalidate all inputs.
export function canPlaceSignPlaque({id,owned=false,hasWallAnchor=false,wallOccupied=false}={}){
 return byId.has(id)&&owned===true&&hasWallAnchor===true&&wallOccupied===false;
}
