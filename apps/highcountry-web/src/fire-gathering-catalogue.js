// HC-ART-04-B visual references only. All economy and placement writes remain authoritative server operations.
const specs=[["fieldstone-fire-pit","Rustic Fieldstone Fire Pit",2,2,"universal"],["cast-iron-fire-bowl","Cast-Iron Fire Bowl",2,2,"universal"],["botanical-chiminea","Botanical Clay Chiminea",2,2,"universal"],["heritage-brick-fireplace","Heritage Brick Outdoor Fireplace",3,2,"universal"],["campfire-kettle-tripod","Campfire Kettle Tripod",2,2,"universal"],["communal-campfire-circle","Communal Campfire Circle",3,3,"universal"],["emerald-driftwood-hearth","Emerald Coast Driftwood Hearth",2,2,"emerald-coast"],["emerald-cedar-hearth-station","Cedar Woodshed & Hearth Station",3,2,"emerald-coast"],["prairie-horseshoe-fire-pit","Prairie Horseshoe Fire Pit",3,2,"golden-prairie"],["prairie-heritage-fire-barrel","Prairie Heritage Fire Barrel",2,2,"golden-prairie"],["mesa-adobe-kiva-fireplace","Red Mesa Adobe Kiva Fireplace",3,2,"red-mesa"],["mesa-sandstone-fire-circle","Red Mesa Sandstone Fire Circle",3,3,"red-mesa"]];
export const fireGatheringCatalogue=Object.freeze(specs.map(([slug,name,width,height,originRegion])=>{
 const id='hc-outdoor-feature-'+slug;
 return Object.freeze({id,name,collection:'HC-ART-04-B',category:'outdoor-gathering',originRegion,
  assetUrl:'/assets/cultivation/props/outdoor-leisure/04-b-fire-gathering/'+id+'.png',
  footprint:Object.freeze({width,height,tileSizePx:64}),
  placement:Object.freeze({layer:'outdoor_feature',surface:'outdoor_ground',requiresOutdoorAnchor:true,
   requiresFlatTerrain:true,requiresCollisionValidation:true,requiresFireClearanceValidation:true,
   collisionMaskStatus:'pending-qualified-geometry',fireClearanceStatus:'pending-qualified-geometry',
   placementWithoutValidation:'deny',allowsOverlappingFurniture:false,regionRestriction:null,fairnessEffect:'none'}),
  marketplace:Object.freeze({category:'cosmetic-outdoor-gathering',currency:'BUDS',price:null,
   inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const byId=new Map(fireGatheringCatalogue.map(x=>[x.id,x]));
export function getFireGatheringFeature(id){return byId.get(id)??null;}
// UI preflight only; never substitutes for authenticated authoritative placement verification.
export function canPlaceFireGatheringFeature({id,owned=false,hasOutdoorAnchor=false,flatTerrain=false,collisionQualified=false,fireClearanceQualified=false,overlapsExisting=false}={}){
 return byId.has(id)&&owned===true&&hasOutdoorAnchor===true&&flatTerrain===true&&collisionQualified===true&&fireClearanceQualified===true&&overlapsExisting===false;
}
