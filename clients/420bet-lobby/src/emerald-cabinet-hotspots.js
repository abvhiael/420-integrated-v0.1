// Measured from canonical /assets/420bet/cabinet/420bet_slots_cabinet_empty.png.
// Source image is 1448 x 1086 RGBA pixels. Console centers and readouts
// recalibrated against the 1920x1080 live-site screenshot (Nov 2, 2026). Never stretch the hotspot geometry separately
// from its cabinet background; normalized percentages follow responsive scaling.
export const CABINET_WIDTH=1448;
export const CABINET_HEIGHT=1086;
export const CABINET_HOTSPOTS=Object.freeze({
 info:Object.freeze([112,927,60,65]),
 menu:Object.freeze([179,927,60,65]),
 decrease:Object.freeze([247,941,48,53]),
 increase:Object.freeze([388,941,49,53]),
 spin:Object.freeze([637,868,179,179]),
 autoplay:Object.freeze([1190,931,98,62]),
 turbo:Object.freeze([1292,925,60,72]),
 betPerWay:Object.freeze([298,968,85,30]),
 totalBet:Object.freeze([446,964,133,35]),
 win:Object.freeze([870,964,146,35]),
 balance:Object.freeze([1030,964,146,35])
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
