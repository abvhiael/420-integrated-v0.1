// HC-GFX-2.1.4 v1 — non-authoritative visual placement. Coordinates are not parcel or collision rights.
export const SCENE_CONTRACT_VERSION='hc-cultivation-scene/v1';
export const SCENE_SIZE=Object.freeze({width:1920,height:1080,grid:80});
export const CATEGORY_RULES=Object.freeze({
 raisedBed:Object.freeze({width:400,depth:1,anchorX:.5,anchorY:1}),
 container:Object.freeze({width:125,depth:2,anchorX:.5,anchorY:1}),
 irrigation:Object.freeze({width:110,depth:3,anchorX:.5,anchorY:1}),
 workstation:Object.freeze({width:340,depth:2,anchorX:.5,anchorY:1}),
 equipment:Object.freeze({width:170,depth:3,anchorX:.5,anchorY:1}),
 tallEquipment:Object.freeze({width:160,depth:3,anchorX:.5,anchorY:1})
});
export const PROP_CATALOG=Object.freeze({
 'raised-bed':Object.freeze({category:'raisedBed',file:'containers/hc-prop-raised-bed-wood-square-large.png',ratio:1.85}),
 'fabric-pot':Object.freeze({category:'container',file:'containers/hc-prop-pot-fabric-black-large.png',ratio:1.1}),
 'water-tank':Object.freeze({category:'irrigation',file:'irrigation/hc-prop-irrigation-water-tank-500gal.png',ratio:.95,width:175}),
 'workbench':Object.freeze({category:'workstation',file:'workstations/hc-prop-workbench-wood-basic.png',ratio:1.7}),
 'ladder':Object.freeze({category:'tallEquipment',file:'tools-equipment/hc-prop-ladder-wood-step-4.png',ratio:.57}),
 'fan':Object.freeze({category:'equipment',file:'tools-equipment/hc-prop-ventilation-floor-fan-black-large.png',ratio:1})
});
export const ENVIRONMENT_SLOTS=Object.freeze({
 outdoor:Object.freeze([{x:540,y:790},{x:1080,y:830},{x:1500,y:760}]),
 greenhouse:Object.freeze([{x:520,y:845},{x:1040,y:790},{x:1520,y:830}]),
 indoor:Object.freeze([{x:485,y:895},{x:1060,y:880},{x:1515,y:850}])
});
const valid=(v)=>typeof v==='number'&&Number.isFinite(v);
export function normalizePlacement({id,x,y,scale=1,category}){
 if(!Object.hasOwn(CATEGORY_RULES,category))throw Error('invalid-scene-category');
 if(!valid(x)||!valid(y)||x<0||x>SCENE_SIZE.width||y<0||y>SCENE_SIZE.height)throw Error('invalid-scene-coordinate');
 if(!valid(scale)||scale<.5||scale>1.5)throw Error('invalid-scene-scale');
 const rule=CATEGORY_RULES[category];return Object.freeze({id,x,y,scale,anchorX:rule.anchorX,anchorY:rule.anchorY,depth:rule.depth});
}
export function layoutProp(id,x,y,scale=1){
 if(!Object.hasOwn(PROP_CATALOG,id))throw Error('unknown-scene-prop');
 const prop=PROP_CATALOG[id],rule=CATEGORY_RULES[prop.category];
 const place=normalizePlacement({id,x,y,scale,category:prop.category});
 const width=Math.round((prop.width||rule.width)*scale);
 const height=Math.round(width/prop.ratio);
 return Object.freeze({...place,width,height,src:'/assets/cultivation/props/'+prop.file,
  // Stable ordering: category band, then ground-contact Y, then stable ID.
  zIndex:rule.depth*10000+Math.round(y)});
}
export function demoScene(environment){
 if(!Object.hasOwn(ENVIRONMENT_SLOTS,environment))throw Error('unknown-scene-environment');
 const slots=ENVIRONMENT_SLOTS[environment];
 return Object.freeze(['raised-bed','workbench','ladder'].map((id,i)=>layoutProp(id,slots[i].x,slots[i].y)));
}
export function placementStyle(item){
 return Object.freeze({left:(item.x/SCENE_SIZE.width*100)+'%',top:(item.y/SCENE_SIZE.height*100)+'%',
  width:(item.width/SCENE_SIZE.width*100)+'%',height:(item.height/SCENE_SIZE.height*100)+'%',zIndex:String(item.zIndex)});
}
