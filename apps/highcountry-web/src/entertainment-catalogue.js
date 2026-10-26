// HC-ART-02-F — visual catalogue, not a grant of ownership or a BUDS price authority.
const BASE='/assets/cultivation/props/entertainment-recreation/universal/';
const specs=[["stereo-console","Vintage Stereo Console",2,1,"floor","universal"],["vinyl-crate","Vinyl Record Crate",1,1,"floor","universal"],["acoustic-guitar","Acoustic Guitar & Stand",1,2,"floor","universal"],["chess-set","Wooden Chess Set",1,1,"tabletop","universal"],["dartboard","Dartboard Cabinet",1,2,"wall","universal"],["retro-radio","Retro Tabletop Radio",1,1,"tabletop","universal"],["board-games","Board Game Collection",1,1,"tabletop","universal"],["cornhole","Cornhole Lawn Game",2,2,"outdoor","universal"],["lava-lamp","Vintage Lava Lamp",1,1,"tabletop","universal"],["reading-books","Reading Book Collection",1,1,"tabletop","universal"],["vintage-tv","Vintage Television",1,1,"floor","universal"],["horseshoes","Horseshoe Toss Set",2,2,"outdoor","universal"]];
export const entertainmentCatalogue=Object.freeze(specs.map(([key,name,width,height,layer,region])=>{
 const id='hc-prop-entertainment-'+key;
 const anchor=layer==='wall'?'wall':layer==='tabletop'?'furniture':null;
 return Object.freeze({id,name,collection:'HC-ART-02-F',region,category:'entertainment-recreation',
  assetUrl:BASE+id+'.png',footprint:Object.freeze({width,height}),
  placement:Object.freeze({layer,anchor,blocksMovement:layer==='floor'||layer==='outdoor',
   blocksFurniture:layer==='floor'||layer==='outdoor',renderLayer:layer==='wall'?'wall':layer==='tabletop'?'furniture-accessory':'furniture'}),
  marketplace:Object.freeze({category:'decorative-furnishings',currency:'BUDS',price:null,
   inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})});
}));
const byId=new Map(entertainmentCatalogue.map(a=>[a.id,a]));
export function getEntertainmentAsset(id){return byId.get(id)??null;}
export function canPlaceEntertainment({id,anchor,region,occupied=false}={}){
 const asset=getEntertainmentAsset(id);
 if(!asset)return false;
 if(asset.placement.anchor&&asset.placement.anchor!==anchor)return false;
 if(asset.placement.layer==='outdoor'&&region==='indoor')return false;
 return !occupied;
}
