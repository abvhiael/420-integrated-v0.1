// HC-ART-04-A decorative outdoor structures. No unqualified collision geometry or economy grants.
const specs=[["cedar-pergola","Classic Cedar Pergola",4,4,"universal","open_roof"],["flowering-arbor","Flowering Garden Arbor",2,2,"universal","walkthrough"],["octagonal-gazebo","Rustic Octagonal Gazebo",4,4,"universal","open_roof"],["canvas-shade-sail","Canvas Shade Sail",3,3,"universal","open_roof"],["botanical-privacy-screen","Botanical Privacy Screen",3,2,"universal","privacy"],["garden-archway-tunnel","Garden Archway Tunnel",2,4,"universal","walkthrough"],["emerald-cedar-pavilion","Emerald Coast Cedar Pavilion",4,4,"emerald-coast","open_roof"],["emerald-driftwood-arbor","Coastal Driftwood Arbor",2,2,"emerald-coast","walkthrough"],["prairie-picnic-shelter","Prairie Heritage Picnic Shelter",4,4,"golden-prairie","open_roof"],["prairie-woven-windbreak","Prairie Woven Windbreak",3,2,"golden-prairie","privacy"],["mesa-hacienda-pergola","Red Mesa Hacienda Pergola",4,4,"red-mesa","open_roof"],["mesa-reed-ramada","Desert Reed Ramada",3,3,"red-mesa","open_roof"]];
export const outdoorStructureCatalogue=Object.freeze(specs.map(([slug,name,width,height,originRegion,structureType])=>{
 const id='hc-outdoor-structure-'+slug;
 return Object.freeze({id,name,collection:'HC-ART-04-A',originRegion,category:'outdoor-structure',structureType,
 assetUrl:'/assets/cultivation/props/outdoor-leisure/04-a-structures-shade/'+id+'.png',
 footprint:Object.freeze({width,height,tileSizePx:64}),
 placement:Object.freeze({layer:'outdoor_structure',surface:'outdoor_ground',requiresOutdoorAnchor:true,
  requiresFlatTerrain:true,regionRestriction:null,collisionMaskStatus:'pending-qualified-geometry',
  placementWithoutCollisionMask:'deny',allowsFurnitureUnderRoof:structureType==='open_roof',
  roofOcclusion:'fade_when_player_behind',fairnessEffect:'none'}),
 marketplace:Object.freeze({category:'cosmetic-outdoor-structures',currency:'BUDS',price:null,
  inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const byId=new Map(outdoorStructureCatalogue.map(x=>[x.id,x]));
export function getOutdoorStructure(id){return byId.get(id)??null;}
// Fail closed until terrain, authoritative ownership, overlap and exact collision geometry are validated server-side.
export function canPlaceOutdoorStructure({id,owned=false,hasOutdoorAnchor=false,flatTerrain=false,collisionMaskQualified=false,overlapsExisting=false}={}){
 return byId.has(id)&&owned===true&&hasOutdoorAnchor===true&&flatTerrain===true&&collisionMaskQualified===true&&overlapsExisting===false;
}
