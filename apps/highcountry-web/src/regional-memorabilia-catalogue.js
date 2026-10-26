// HC-ART-03-F: ordinary cosmetic souvenirs, not authenticated achievement emblems.
const specs=[["emerald","heritage-pennant","Emerald Coast Heritage Pennant",2,1,"wall_decor"],["emerald","cedar-sailboat","Coastal Cedar Sailboat Model",1,1,"tabletop_decor"],["emerald","lighthouse-medallion","Emerald Lighthouse Commemorative Medallion",1,1,"tabletop_decor"],["emerald","coast-relief","Emerald Coast Relief Map",2,2,"wall_decor"],["prairie","heritage-pennant","Golden Prairie Heritage Pennant",2,1,"wall_decor"],["prairie","windmill-miniature","Prairie Windmill Miniature",1,1,"tabletop_decor"],["prairie","harvest-medallion","Prairie Harvest Heritage Medallion",1,1,"tabletop_decor"],["prairie","homestead-relief","Golden Prairie Homestead Relief",2,2,"wall_decor"],["mesa","heritage-pennant","Red Mesa Heritage Pennant",2,1,"wall_decor"],["mesa","sandstone-miniature","Red Mesa Sandstone Miniature",1,1,"tabletop_decor"],["mesa","sun-medallion","Red Mesa Sun Medallion",1,1,"tabletop_decor"],["mesa","canyon-relief","Red Mesa Canyon Relief",2,2,"wall_decor"]];
export const regionalMemorabiliaCatalogue=Object.freeze(specs.map(([region,slug,name,width,height,layer])=>{
 const id='hc-memorabilia-'+region+'-'+slug;
 const wall=layer==='wall_decor';
 return Object.freeze({id,name,originRegion:region,collection:'HC-ART-03-F',category:'regional-memorabilia',
 assetUrl:'/assets/cultivation/props/interior-decorations/regional-memorabilia/'+id+'.png',
 footprint:Object.freeze({width,height,tileSizePx:64}),
 placement:Object.freeze({layer,surface:wall?'wall':'tabletop_or_shelf',requiresWallAnchor:wall,requiresSurfaceAnchor:!wall,
 wallSlotExclusive:wall,surfaceSlotExclusive:!wall,blocksMovement:false,blocksFurniture:false,
 allowsPlacementBehindFurniture:wall,regionRestriction:null}),
 marketplace:Object.freeze({category:'regional-cosmetic-souvenirs',currency:'BUDS',price:null,
 inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none',achievementEntitlement:false})});
}));
const byId=new Map(regionalMemorabiliaCatalogue.map(x=>[x.id,x]));
export function getRegionalMemorabilia(id){return byId.get(id)??null;}
// Advisory UI predicate; permanent placements require authoritative revalidation.
export function canPlaceRegionalMemorabilia({id,owned=false,hasWallAnchor=false,wallOccupied=false,hasSurfaceAnchor=false,surfaceOccupied=false}={}){
 const item=byId.get(id);
 return !!item&&owned===true&&(item.placement.layer==='wall_decor'?(hasWallAnchor===true&&wallOccupied===false):(hasSurfaceAnchor===true&&surfaceOccupied===false));
}
