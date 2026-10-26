// HC-ART-03-A wall poster planning catalogue; decorative, not spendable inventory.
const specs=[["underground-show","Underground Show Poster",1,2],["harvest-festival","Harvest Festival Poster",1,2],["greenhouse-workshop","Greenhouse Workshop Poster",1,2],["botanical-counterculture","Botanical Counterculture Poster",1,2],["emerald-coast-music","Emerald Coast Music Poster",1,2],["prairie-dancehall","Prairie Dance Hall Poster",1,2],["red-mesa-night","Red Mesa Night Poster",1,2],["growers-rights","Growers' Rights Poster",1,2],["zine-collage","Counterculture Zine Poster",1,2],["late-night-radio","Late Night Radio Poster",1,2],["artisan-screenprint","Artisan Screenprint Poster",1,2],["cluster","Poster Cluster",2,2]];
const WALL_LAYER='wall_decor';
export const posterCatalogue=Object.freeze(specs.map(([slug,name,width,height])=>Object.freeze({
 id:'hc-wall-poster-'+slug,name,collection:'HC-ART-03-A',
 assetUrl:'/assets/cultivation/props/interior-decorations/posters/hc-wall-poster-'+slug+'.png',
 footprint:Object.freeze({width,height,tileSizePx:64}),
 placement:Object.freeze({layer:WALL_LAYER,surface:'wall',requiresWallAnchor:true,blocksMovement:false,
 blocksFurniture:false,allowsPlacementBehindFurniture:true,wallSlotExclusive:true}),
 marketplace:Object.freeze({category:'decorative-wall-art',currency:'BUDS',price:null,
 inventoryPolicy:'authenticated-server-owned',fairnessEffect:'none'})
})));
const byId=new Map(posterCatalogue.map(item=>[item.id,item]));
export function getPoster(id){return byId.get(id)??null;}
// Call with server-validated ownership, wall support, and wall occupancy; client results are advisory.
export function canPlacePoster({id,owned=false,hasWallAnchor=false,wallOccupied=false,floorOccupied=false}={}){
 return !!byId.get(id)&&owned===true&&hasWallAnchor===true&&wallOccupied===false;
}
