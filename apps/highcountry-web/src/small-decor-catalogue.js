// HC-ART-03-E: decorative attachment objects; server governs ownership, stock and prices.
const specs=[["wildflower-ceramic-vase","Wildflower Ceramic Vase"],["mesa-painted-pottery-bowl","Red Mesa Painted Pottery Bowl"],["mini-fern-planter","Miniature Fern Planter"],["carved-cedar-fox","Carved Cedar Fox Figurine"],["prairie-barn-miniature","Prairie Heritage Barn Miniature"],["woodland-mushroom-carvings","Woodland Mushroom Carvings"],["antique-explorer-compass","Antique Explorer's Compass"],["coastal-driftwood-glass","Coastal Driftwood & Sea Glass"],["botanical-specimen-jar","Botanical Specimen Bell Jar"],["beeswax-candle-arrangement","Beeswax Candle Arrangement"],["vintage-books-glasses","Vintage Books & Reading Glasses"],["mesa-mini-cactus-garden","Red Mesa Miniature Cactus Garden"]];
export const smallDecorCatalogue=Object.freeze(specs.map(([slug,name])=>{
 const id='hc-decor-'+slug;
 return Object.freeze({id,name,collection:'HC-ART-03-E',category:'small-decor',
  assetUrl:'/assets/cultivation/props/interior-decorations/small-decor/'+id+'.png',
  footprint:Object.freeze({width:1,height:1,tileSizePx:64}),
  placement:Object.freeze({layer:'tabletop_decor',surface:'tabletop_or_shelf',requiresSurfaceAnchor:true,
   surfaceSlotExclusive:true,blocksMovement:false,blocksFurniture:false,regionRestriction:null}),
  marketplace:Object.freeze({category:'decorative-tabletop-items',currency:'BUDS',price:null,
   inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const byId=new Map(smallDecorCatalogue.map(x=>[x.id,x]));
export function getSmallDecor(id){return byId.get(id)??null;}
// UI eligibility hint only; canonical placement must revalidate authoritative ownership and slots.
export function canPlaceSmallDecor({id,owned=false,hasSurfaceAnchor=false,surfaceOccupied=false}={}){
 return byId.has(id)&&owned===true&&hasSurfaceAnchor===true&&surfaceOccupied===false;
}
