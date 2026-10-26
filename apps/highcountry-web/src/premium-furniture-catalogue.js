// HC-ART-02-G: cosmetic visual definitions. Never grant authenticated items or assign prices here.
const specs=[["emerald","emerald-coast","chesterfield","Emerald Velvet Chesterfield",3,1],["emerald","emerald-coast","cedar-rocker","Carved Cedar Rocker",2,1],["emerald","emerald-coast","rattan-daybed","Botanical Rattan Daybed",3,2],["emerald","emerald-coast","writing-desk","Coastal Heritage Writing Desk",2,1],["prairie","golden-prairie","leather-chair","Prairie Leather Club Chair",2,1],["prairie","golden-prairie","trestle-table","Harvest Oak Trestle Table",3,2],["prairie","golden-prairie","heirloom-bench","Prairie Heirloom Bench",2,1],["prairie","golden-prairie","heritage-hutch","Prairie Heritage Hutch",2,1],["mesa","red-mesa","hacienda-sofa","Mesquite Hacienda Sofa",3,1],["mesa","red-mesa","mosaic-table","Terracotta Mosaic Coffee Table",2,1],["mesa","red-mesa","butterfly-chair","Desert Leather Butterfly Chair",1,1],["mesa","red-mesa","artisan-chest","Red Mesa Artisan Chest",2,1]];
export const premiumFurnitureCatalogue=Object.freeze(specs.map(([prefix,region,key,name,width,height])=>{
 const id='hc-prop-premium-'+prefix+'-'+key;
 return Object.freeze({id,name,region,collection:'HC-ART-02-G',category:'premium-comfort',
  assetUrl:'/assets/cultivation/props/premium-comfort/'+region+'/'+id+'.png',
  footprint:Object.freeze({width,height,tileSizePx:64}),
  placement:Object.freeze({layer:'furniture',surface:'floor',blocksMovement:true,blocksFurniture:true,
    furnitureAttachmentSurface:['writing-desk','trestle-table','mosaic-table','artisan-chest','heritage-hutch'].includes(key),
    regionRestriction:null}),
  marketplace:Object.freeze({category:'premium-decorative-furnishings',currency:'BUDS',price:null,
    inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const itemsById=new Map(premiumFurnitureCatalogue.map(item=>[item.id,item]));
export function getPremiumFurniture(id){return itemsById.get(id)??null;}
export function canPlacePremiumFurniture({id,occupied=false,owned=false}={}){
 const item=getPremiumFurniture(id);
 return !!item && owned===true && occupied===false;
}
