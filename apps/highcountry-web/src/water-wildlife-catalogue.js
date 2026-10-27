// HC-ART-04-C cosmetic water/wildlife visual catalogue; no irrigation, pollination or water resource grants.
const specs=[["water","heritage-stone-birdbath","Heritage Stone Birdbath",1,1,"universal","wildlife"],["water","botanical-tiered-fountain","Botanical Tiered Fountain",2,2,"universal","fountain"],["water","lily-dragonfly-pond","Lily Pond & Dragonfly Garden",3,3,"universal","pond"],["water","heritage-rain-barrel","Heritage Rain Barrel",1,1,"universal","decorative-water-storage"],["wildlife","woodland-bird-feeding-station","Woodland Bird Feeding Station",2,1,"universal","habitat"],["wildlife","pollinator-sanctuary","Pollinator & Insect Sanctuary",2,2,"universal","habitat"],["water","emerald-mossy-waterfall","Emerald Coast Mossy Waterfall",3,3,"emerald-coast","waterfall"],["water","emerald-driftwood-fountain","Coastal Driftwood Fountain",2,2,"emerald-coast","fountain"],["water","prairie-homestead-pump","Prairie Homestead Pump & Trough",2,2,"golden-prairie","decorative-water-storage"],["water","prairie-butterfly-garden","Prairie Butterfly Water Garden",3,2,"golden-prairie","wildlife"],["water","mesa-hacienda-fountain","Red Mesa Hacienda Fountain",2,2,"red-mesa","fountain"],["water","mesa-wildlife-oasis","Desert Wildlife Oasis",3,3,"red-mesa","pond"]];
export const waterWildlifeCatalogue=Object.freeze(specs.map(([kind,slug,name,width,height,originRegion,featureType])=>{
 const id='hc-outdoor-'+kind+'-'+slug;
 return Object.freeze({id,name,collection:'HC-ART-04-C',category:'outdoor-water-wildlife',featureType,originRegion,
  assetUrl:'/assets/cultivation/props/outdoor-leisure/04-c-water-wildlife/'+id+'.png',
  footprint:Object.freeze({width,height,tileSizePx:64}),
  placement:Object.freeze({layer:'outdoor_feature',surface:'outdoor_ground',requiresOutdoorAnchor:true,requiresFlatTerrain:true,
   requiresCollisionValidation:true,requiresWaterEdgeValidation:featureType==='pond'||featureType==='waterfall'||featureType==='fountain',
   collisionMaskStatus:'pending-qualified-geometry',placementWithoutValidation:'deny',allowsOverlappingFurniture:false,regionRestriction:null,
   resourceEffect:'none',cultivationEffect:'none',fairnessEffect:'none'}),
  marketplace:Object.freeze({category:'cosmetic-outdoor-water-wildlife',currency:'BUDS',price:null,inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const byId=new Map(waterWildlifeCatalogue.map(asset=>[asset.id,asset]));
export function getWaterWildlifeFeature(id){return byId.get(id)??null;}
// UI preflight only: final placement requires authoritative validation of ownership, collision and water edge.
export function canPlaceWaterWildlifeFeature({id,owned=false,hasOutdoorAnchor=false,flatTerrain=false,collisionQualified=false,waterEdgeQualified=false,overlapsExisting=false}={}){
 const asset=byId.get(id);
 return !!asset&&owned===true&&hasOutdoorAnchor===true&&flatTerrain===true&&collisionQualified===true
  &&(!asset.placement.requiresWaterEdgeValidation||waterEdgeQualified===true)&&overlapsExisting===false;
}
