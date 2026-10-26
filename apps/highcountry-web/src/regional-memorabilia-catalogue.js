// HC-ART-03-F: universal regional memorabilia, cosmetic-only catalogue.
// Client listings never confer inventory, ownership, verified placement, or BUDS pricing.
const specs=[["emerald-coast","emerald-heritage-pennant","Emerald Coast Heritage Pennant",2,1,"wall_decor",640,320],["emerald-coast","emerald-cedar-sailboat","Coastal Cedar Sailboat Model",1,1,"tabletop_decor",320,320],["emerald-coast","emerald-lighthouse-medallion","Lighthouse Commemorative Medallion",1,1,"tabletop_decor",320,320],["emerald-coast","emerald-coast-relief","Emerald Coast Relief Map",2,2,"wall_decor",640,640],["golden-prairie","prairie-heritage-pennant","Golden Prairie Heritage Pennant",2,1,"wall_decor",640,320],["golden-prairie","prairie-windmill-miniature","Prairie Windmill Miniature",1,1,"tabletop_decor",320,320],["golden-prairie","prairie-harvest-medallion","Harvest Heritage Medallion",1,1,"tabletop_decor",320,320],["golden-prairie","prairie-homestead-relief","Prairie Homestead Relief",2,2,"wall_decor",640,640],["red-mesa","mesa-heritage-pennant","Red Mesa Heritage Pennant",2,1,"wall_decor",640,320],["red-mesa","mesa-sandstone-miniature","Sandstone Mesa Miniature",1,1,"tabletop_decor",320,320],["red-mesa","mesa-sun-medallion","Red Mesa Sun Medallion",1,1,"tabletop_decor",320,320],["red-mesa","mesa-canyon-relief","Red Mesa Canyon Relief",2,2,"wall_decor",640,640]];
const base='/assets/cultivation/props/interior-decorations/regional-memorabilia/';
export const regionalMemorabiliaCatalogue=Object.freeze(specs.map(([region,key,name,width,height,layer,pixelWidth,pixelHeight])=>{
 const id='hc-memorabilia-'+key;
 return Object.freeze({id,name,region,collection:'HC-ART-03-F',category:'regional-memorabilia',
  assetUrl:base+id+'.png',canvas:Object.freeze({width:pixelWidth,height:pixelHeight,transparent:true}),
  footprint:Object.freeze({width,height,tileSizePx:64}),
  placement:Object.freeze({layer,surface:layer==='wall_decor'?'wall':'furniture',blocksMovement:false,blocksFurniture:false,
    attachmentRequired:layer==='tabletop_decor',regionRestriction:null}),
  marketplace:Object.freeze({category:'regional-memorabilia',currency:'BUDS',price:null,
   inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const byId=new Map(regionalMemorabiliaCatalogue.map(item=>[item.id,item]));
export const getRegionalMemorabilia=id=>byId.get(id)??null;
export function canPlaceRegionalMemorabilia({id,owned=false,occupied=false,surface}={}){
 const item=getRegionalMemorabilia(id);
 return !!item&&owned===true&&occupied===false&&surface===item.placement.surface;
}
