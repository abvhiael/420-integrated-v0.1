// High Country matched cultivation illustration pack. Paths are static and never derived from saved game input.
export const CULTIVATION_ART_BASE='/assets/cultivation/';
export const CULTIVATION_STAGE_ART=Object.freeze({
 germination:Object.freeze({file:'hc-stage-germination-tray.png',alt:'Illustrated germination tray with emerging cannabis seedlings'}),
 seedling:Object.freeze({file:'hc-stage-seedling-pot.png',alt:'Illustrated young cannabis seedling in a nursery pot'}),
 vegetative:Object.freeze({file:'hc-stage-vegetative-pot.png',alt:'Illustrated healthy vegetative cannabis plant in a fabric pot'}),
 flowering:Object.freeze({file:'hc-stage-preflower-pot.png',alt:'Illustrated early flowering cannabis plant with developing pistils'}),
 ready:Object.freeze({file:'hc-stage-flowering-pot.png',alt:'Illustrated mature harvest-ready cannabis plant with resinous flowers'})
});
export const CULTIVATION_SUPPORT_ART=Object.freeze({
 growTent:'hc-env-grow-tent.png',
 irrigation:'hc-equipment-irrigation-kit.png',
 trimming:'hc-process-trimming-station.png',
 drying:'hc-process-drying-rack.png',
 curing:'hc-process-curing-jars.png'
});
export function cultivationStageArt(stage){
 if(!Object.hasOwn(CULTIVATION_STAGE_ART,stage))throw Error('unknown-cultivation-stage');
 const item=CULTIVATION_STAGE_ART[stage];
 return Object.freeze({src:CULTIVATION_ART_BASE+item.file,alt:item.alt,
  fallback:stage==='ready'?'/assets/highcountry-ready.svg':'/assets/highcountry-growing.svg'});
}
