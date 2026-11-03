// Measured from canonical /assets/420bet/cabinet/420bet_slots_cabinet_empty.png.
// Source image is 1448 x 1086 RGBA pixels. Never stretch the hotspot geometry separately
// from its cabinet background; normalized percentages follow responsive scaling.
export const CABINET_WIDTH=1448;
export const CABINET_HEIGHT=1086;
export const CABINET_HOTSPOTS=Object.freeze({
 info:Object.freeze([53,927,65,65]),
 menu:Object.freeze([126,927,66,66]),
 decrease:Object.freeze([198,941,49,53]),
 increase:Object.freeze([347,941,52,53]),
 spin:Object.freeze([616,868,179,179]),
 autoplay:Object.freeze([1204,931,99,62]),
 turbo:Object.freeze([1308,925,61,72]),
 betPerWay:Object.freeze([250,947,95,43]),
 totalBet:Object.freeze([408,943,145,49]),
 win:Object.freeze([858,943,161,49]),
 balance:Object.freeze([1031,943,161,49])
});
export function cabinetArea(name){
 const rect=CABINET_HOTSPOTS[name];
 if(!rect)throw Error('Unknown cabinet hotspot: '+name);
 const [x,y,width,height]=rect;
 return Object.freeze({left:(x/CABINET_WIDTH*100)+'%',top:(y/CABINET_HEIGHT*100)+'%',width:(width/CABINET_WIDTH*100)+'%',height:(height/CABINET_HEIGHT*100)+'%'});
}
export function assertCabinetHotspots(){
 const keys=Object.keys(CABINET_HOTSPOTS);
 for(const name of keys){
  const [x,y,w,h]=CABINET_HOTSPOTS[name];
  if(w<=0||h<=0||x<0||y<0||x+w>CABINET_WIDTH||y+h>CABINET_HEIGHT)throw Error('Hotspot out of cabinet image: '+name);
 }
 for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
  const a=CABINET_HOTSPOTS[keys[i]],c=CABINET_HOTSPOTS[keys[j]];
  if(a[0]<c[0]+c[2]&&c[0]<a[0]+a[2]&&a[1]<c[1]+c[3]&&c[1]<a[1]+a[3])throw Error('Overlapping cabinet hotspots: '+keys[i]+' and '+keys[j]);
 }
 return true;
}
assertCabinetHotspots();
