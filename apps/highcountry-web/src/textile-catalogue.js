// HC-ART-02-E · visual catalogue only. Prices, inventory and purchases are server authoritative.
const BASE = '/assets/furnishings/02-e-rugs-textiles/';
const entries = [["rug_vintage_persian","Vintage Persian Rug",3,2,"floor_overlay","common"],["rug_braided_jute","Braided Jute Rug",2,2,"floor_overlay","common"],["rug_southwestern_woven","Southwestern Woven Rug",3,2,"floor_overlay","common"],["textile_botanical_tapestry","Botanical Wall Tapestry",2,2,"wall","heritage"],["textile_chunky_knit_throw","Chunky Knit Throw Blanket",1,1,"accessory","common"],["textile_decorative_cushions","Decorative Cushion Set",1,1,"accessory","common"],["textile_macrame_wall_hanging","Macramé Wall Hanging",1,2,"wall","artisan"],["textile_heritage_quilt","Patchwork Heritage Quilt",1,1,"accessory","heritage"],["textile_linen_curtains","Linen Window Curtains",2,2,"wall","common"],["rug_woven_runner","Woven Floor Runner",1,3,"floor_overlay","common"]];
export const textileCatalogue = Object.freeze(entries.map(([id,name,width,height,layer,rarity])=>Object.freeze({
  id, name, assetUrl: BASE + id + '.png', category:'soft_furnishings', collection:'HC-ART-02-E',
  footprint:Object.freeze({width,height}), rarity, marketplace:Object.freeze({category:'decor',currency:'BUDS',
    listingPolicy:'authenticated-inventory-only', suggestedPrice:null}),
  placement:Object.freeze({layer, blocksFurniture:layer!=='floor_overlay',blocksMovement:false,
    requiresAnchor:layer==='wall'?'wall':layer==='accessory'?'furniture':null,
    renderBelowFurniture:layer==='floor_overlay', stackableWithFurniture:layer==='floor_overlay'})
})));
const byId = new Map(textileCatalogue.map(x=>[x.id,x]));
export function getTextileAsset(id){return byId.get(id)??null;}
export function canPlaceTextile({id,anchor,existing=[]}={}){
 const asset=getTextileAsset(id);
 if(!asset||!Array.isArray(existing))return false;
 if(asset.placement.requiresAnchor&&anchor!==asset.placement.requiresAnchor)return false;
 // Rugs occupy a separate floor overlay layer; furniture is allowed to overlap them.
 if(asset.placement.layer==='floor_overlay')return !existing.some(x=>x.layer==='floor_overlay');
 if(asset.placement.layer==='wall')return !existing.some(x=>x.layer==='wall');
 return !existing.some(x=>x.layer==='accessory');
}
