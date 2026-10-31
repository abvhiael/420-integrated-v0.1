// HC-ART-04-D garden ornaments are cosmetic. Neither placement nor purchases are granted locally.
const definitions=[["happy-grower-gnome","Happy Grower Gnome",1,1,"universal"],["woodland-guardian-owl","Woodland Guardian Owl",1,1,"universal"],["copper-leaf-wind-spinner","Copper Cannabis Wind Spinner",1,2,"universal"],["riverstone-cairn","Balanced Riverstone Cairn",1,1,"universal"],["crooked-garden-signpost","Crooked Garden Signpost",1,2,"universal"],["enchanted-mushroom-cluster","Enchanted Mushroom Cluster",2,2,"universal"],["emerald-driftwood-salmon","Emerald Driftwood Salmon",2,1,"emerald-coast"],["emerald-cedar-wind-chimes","Coastal Cedar Wind Chimes",1,2,"emerald-coast"],["prairie-wagon-wheel","Prairie Heritage Wagon Wheel",2,2,"golden-prairie"],["prairie-rooster-weathervane","Prairie Rooster Weathervane",1,2,"golden-prairie"],["mesa-terracotta-sun-totem","Red Mesa Terracotta Sun Totem",2,2,"red-mesa"],["mesa-coyote-silhouette","Red Mesa Coyote Silhouette",2,2,"red-mesa"]];
export const gardenOrnamentCatalogue=Object.freeze(definitions.map(([slug,name,width,height,originRegion])=>{
 const id='hc-outdoor-decor-'+slug;
 return Object.freeze({id,name,collection:'HC-ART-04-D',originRegion,
  assetUrl:'/assets/cultivation/props/outdoor-leisure/04-d-garden-ornaments/'+id+'.png',
  footprint:Object.freeze({width,height,tileSizePx:64}),
  placement:Object.freeze({layer:'outdoor_decor',surface:'outdoor_ground',requiresOutdoorAnchor:true,requiresFlatTerrain:true,
   requiresCollisionValidation:true,collisionMaskStatus:'pending-qualified-geometry',placementWithoutValidation:'deny',
   regionRestriction:null,allowsOverlappingFurniture:false,gameplayEffect:'none'}),
  marketplace:Object.freeze({category:'cosmetic-outdoor-decor',currency:'BUDS',price:null,inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const catalogueById=new Map(gardenOrnamentCatalogue.map(item=>[item.id,item]));
export function getGardenOrnament(id){return catalogueById.get(id)??null;}
// Non-authoritative UI preflight only; no replacement for server-side occupancy and ownership checks.
export function canPlaceGardenOrnament({id,owned=false,hasOutdoorAnchor=false,flatTerrain=false,collisionQualified=false,overlapsExisting=false}={}){
 return catalogueById.has(id)&&owned===true&&hasOutdoorAnchor===true&&flatTerrain===true&&collisionQualified===true&&overlapsExisting===false;
}
