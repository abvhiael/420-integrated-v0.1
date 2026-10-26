// HC-ART-03-C: visual artwork catalogue. Ownership, inventory and prices are server-authoritative.
const specs=[["emerald-misty-shore","Emerald Coast Misty Shore",2,2,"emerald-coast"],["prairie-harvest-sunset","Golden Prairie Harvest Sunset",2,2,"golden-prairie"],["mesa-desert-twilight","Red Mesa Desert Twilight",2,2,"red-mesa"],["pressed-fern","Pressed Fern Herbarium",1,2,null],["wildflower-pollinators","Wildflower & Pollinator Study",1,2,null],["heritage-seed-study","Heritage Seed & Leaf Study",1,2,null],["greenhouse-morning","Morning in the Greenhouse",2,2,null],["cabin-pines","The Cabin Beyond the Pines",2,2,null],["long-road-home","The Long Road Home",2,2,null],["old-homestead","The Old Homestead",2,1,null],["explorers-map","High Country Explorer's Map",2,2,null],["sun-moon-mountains","Sun, Moon & Mountain Folk Art",2,2,null]];
export const framedArtCatalogue=Object.freeze(specs.map(([slug,name,width,height,originRegion])=>{
 const id='hc-wall-art-'+slug;
 return Object.freeze({id,name,originRegion,collection:'HC-ART-03-C',category:'framed-art',
  assetUrl:'/assets/cultivation/props/interior-decorations/framed-art/'+id+'.png',
  footprint:Object.freeze({width,height,tileSizePx:64}),
  placement:Object.freeze({layer:'wall_decor',surface:'wall',requiresWallAnchor:true,wallSlotExclusive:true,
    blocksMovement:false,blocksFurniture:false,allowsPlacementBehindFurniture:true,regionRestriction:null}),
  marketplace:Object.freeze({category:'decorative-framed-art',currency:'BUDS',price:null,
    inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const byId=new Map(framedArtCatalogue.map(x=>[x.id,x]));
export function getFramedArt(id){return byId.get(id)??null;}
// Advisory only: trusted server must validate ownership and occupancy again before persistence.
export function canPlaceFramedArt({id,owned=false,hasWallAnchor=false,wallOccupied=false}={}){
 return byId.has(id)&&owned===true&&hasWallAnchor===true&&wallOccupied===false;
}
