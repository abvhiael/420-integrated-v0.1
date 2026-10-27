// HC-ART-04-F: visual recreational props, no playable activity or gameplay effect is granted.
const definitions=[["heritage-cornhole-game","Heritage Cornhole Game",2,2,"universal","game"],["rustic-horseshoe-pitch","Rustic Horseshoe Pitch",3,2,"universal","throwing-game"],["giant-stacking-blocks","Giant Garden Stacking Blocks",1,1,"universal","game"],["botanical-meditation-platform","Botanical Meditation Platform",2,2,"universal","relaxation"],["heritage-croquet-set","Heritage Croquet Set",2,1,"universal","game"],["garden-chess-table","Garden Chess Table",2,2,"universal","game"],["emerald-cedar-hammock","Emerald Coast Cedar Hammock",3,2,"emerald-coast","relaxation"],["emerald-driftwood-ring-toss","Coastal Driftwood Ring Toss",2,1,"emerald-coast","throwing-game"],["prairie-homestead-swing","Prairie Homestead Swing",3,2,"golden-prairie","moving-equipment"],["prairie-putting-green","Prairie Putting Green",3,3,"golden-prairie","game"],["mesa-bocce-court","Red Mesa Bocce Court",3,2,"red-mesa","game"],["mesa-desert-daybed","Red Mesa Desert Daybed",3,2,"red-mesa","relaxation"]];
export const recreationCatalogue=Object.freeze(definitions.map(([slug,name,width,height,originRegion,activityType])=>{
 const id='hc-outdoor-recreation-'+slug;
 return Object.freeze({id,name,collection:'HC-ART-04-F',originRegion,activityType,
 assetUrl:'/assets/cultivation/props/outdoor-leisure/04-f-recreation-relaxation/'+id+'.png',
 footprint:Object.freeze({width,height,tileSizePx:64}),
 placement:Object.freeze({layer:'outdoor_recreation',surface:'outdoor_ground',requiresOutdoorAnchor:true,requiresTerrainValidation:true,
 requiresCollisionValidation:true,requiresInteractionClearanceValidation:true,collisionMaskStatus:'pending-qualified-geometry',
 interactionZoneStatus:'pending-qualified-geometry',placementWithoutValidation:'deny',regionRestriction:null,
 activityStatus:'not-enabled',cultivationEffect:'none',movementEffect:'none'}),
 marketplace:Object.freeze({category:'cosmetic-outdoor-recreation',currency:'BUDS',price:null,inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const byId=new Map(recreationCatalogue.map(x=>[x.id,x]));
export function getRecreationAsset(id){return byId.get(id)??null;}
// UI-only preflight, never proof of authoritative ownership or collision/interaction geometry.
export function canPlaceRecreationAsset({id,owned=false,hasOutdoorAnchor=false,terrainQualified=false,collisionQualified=false,interactionClearanceQualified=false,overlapsExisting=false}={}){
 return byId.has(id)&&owned===true&&hasOutdoorAnchor===true&&terrainQualified===true&&collisionQualified===true&&interactionClearanceQualified===true&&overlapsExisting===false;
}
