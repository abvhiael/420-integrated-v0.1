// HC-ART-04-E decorative paths and edging. These are not road connections or parcel access grants.
const definitions=[["heritage-flagstone-path","Heritage Flagstone Stepping Path",2,1,"universal","outdoor_path"],["rustic-timber-border","Rustic Timber Garden Border",2,1,"universal","landscape_border"],["river-pebble-mosaic","River Pebble Mosaic",2,2,"universal","ground_ornament"],["dry-stack-fieldstone-wall","Dry-Stack Fieldstone Wall",2,1,"universal","landscape_border"],["gravel-timber-walkway","Gravel & Timber Walkway",3,1,"universal","outdoor_path"],["botanical-brick-edging","Botanical Brick Garden Edging",2,2,"universal","landscape_border"],["emerald-moss-slate-path","Emerald Moss & Slate Path",3,2,"emerald-coast","outdoor_path"],["emerald-driftwood-border","Coastal Driftwood Landscape Border",2,1,"emerald-coast","landscape_border"],["prairie-homestead-brick-path","Prairie Homestead Brick Path",3,2,"golden-prairie","outdoor_path"],["prairie-railway-timber-border","Prairie Railway-Timber Border",2,1,"golden-prairie","landscape_border"],["mesa-terracotta-tile-path","Red Mesa Terracotta Tile Path",3,2,"red-mesa","outdoor_path"],["mesa-sandstone-garden-edge","Red Mesa Sandstone Garden Edge",2,1,"red-mesa","landscape_border"]];
export const landscapeCatalogue=Object.freeze(definitions.map(([slug,name,width,height,originRegion,placementSubtype])=>{
 const id='hc-outdoor-landscape-'+slug;
 return Object.freeze({id,name,collection:'HC-ART-04-E',originRegion,placementSubtype,
 assetUrl:'/assets/cultivation/props/outdoor-leisure/04-e-paths-landscape/'+id+'.png',
 footprint:Object.freeze({width,height,tileSizePx:64}),
 placement:Object.freeze({layer:'outdoor_feature',subtype:placementSubtype,surface:'outdoor_ground',requiresOutdoorAnchor:true,
 requiresTerrainValidation:true,requiresCollisionValidation:true,collisionMaskStatus:'pending-qualified-geometry',
 connectivityStatus:'unqualified',parcelAccessEffect:'none',roadNetworkEffect:'none',movementEffect:'none',
 rotationStatus:'not-qualified',placementWithoutValidation:'deny',regionRestriction:null,cultivationEffect:'none'}),
 marketplace:Object.freeze({category:'cosmetic-outdoor-landscape',currency:'BUDS',price:null,inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const byId=new Map(landscapeCatalogue.map(item=>[item.id,item]));
export function getLandscapeAsset(id){return byId.get(id)??null;}
// UI-only preflight. Never grants occupancy, road access, traversability or purchase rights.
export function canPlaceLandscapeAsset({id,owned=false,hasOutdoorAnchor=false,terrainQualified=false,collisionQualified=false,overlapsExisting=false}={}){
 return byId.has(id)&&owned===true&&hasOutdoorAnchor===true&&terrainQualified===true&&collisionQualified===true&&overlapsExisting===false;
}
