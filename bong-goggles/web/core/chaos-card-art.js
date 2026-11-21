// Approved Cross-Country Chaos card artwork only. Static mappings prevent untrusted filenames/URLs.
export const CHAOS_ART_BASE='/assets/games/cross-country-chaos/cards/';
const mileage=Object.freeze({
 100:'common/mileage-100',150:'common/mileage-150',200:'common/mileage-200',
 250:'common/mileage-250',300:'common/mileage-300',400:'common/mileage-400',500:'common/mileage-500'
});
const fixes=Object.freeze({
 toolbox:'common/fix-toolbox',atlas:'common/fix-atlas',plows:'common/fix-plows',
 jerry:'common/fix-jerry',detour:'common/fix-detour',help:'common/fix-help'
});
const upgrades=Object.freeze({
 'duct-tape':'power/upgrade-duct-tape','road-atlas':'power/upgrade-road-atlas',
 'winter-tires':'power/upgrade-winter-tires','jerry-can':'power/upgrade-jerry-can',
 'cb-radio':'power/upgrade-cb-radio','station-wagon':'power/upgrade-station-wagon',
 thermos:'power/upgrade-thermos','shortcut-specialist':'power/upgrade-shortcut-specialist'
});
const legendary=Object.freeze({
 truck:'power/legendary-truck',rodeo:'power/legendary-rodeo',
 shortcut:'power/legendary-shortcut',sunshine:'power/legendary-sunshine'
});
const hazards=Object.freeze({
 east:Object.freeze({
  ferry:'hazards/east/hazard-east-ferry-cancelled',
  moose:'hazards/east/hazard-east-moose-on-the-loose',
  fog:'hazards/east/hazard-east-fog-thicker-than-pea-soup',
  cabot:'hazards/east/hazard-east-cabot-trail-temptation',
  construction:'hazards/east/hazard-east-quebec-construction-season',
  gander:'hazards/east/hazard-east-out-of-gas-in-gander',
  pothole:'hazards/east/hazard-east-pothole-from-hell',
  montreal:'hazards/east/hazard-east-wrong-turn-in-montreal'
 }),
 ontario:Object.freeze({
  'still-ontario':'hazards/ontario/hazard-ontario-still-in-ontario',
  whiteout:'hazards/ontario/hazard-ontario-lake-superior-whiteout',
  blackfly:'hazards/ontario/hazard-ontario-blackfly-apocalypse',
  wawa:'hazards/ontario/hazard-ontario-wawa-goose-incident',
  traffic:'hazards/ontario/hazard-ontario-toronto-traffic-nightmare',
  flat:'hazards/ontario/hazard-ontario-flat-tire-near-thunder-bay',
  closed:'hazards/ontario/hazard-ontario-trans-canada-closed',
  convoy:'hazards/ontario/hazard-ontario-transport-truck-convoy'
 }),
 west:Object.freeze({
  mosquito:'hazards/west/hazard-west-manitoba-mosquito-air-force',
  'prairie-pothole':'hazards/west/hazard-west-saskatchewan-pothole',
  headwind:'hazards/west/hazard-west-prairie-headwind',
  hail:'hazards/west/hazard-west-alberta-hailstorm',
  cattle:'hazards/west/hazard-west-cattle-on-the-highway',
  'moose-jaw':'hazards/west/hazard-west-out-of-gas-near-moose-jaw',
  rogers:'hazards/west/hazard-west-rogers-pass-whiteout',
  washout:'hazards/west/hazard-west-bc-highway-washout'
 })
});
export const CHAOS_ART_REGISTRY=Object.freeze({mileage,fixes,upgrades,legendary,hazards});
const allPaths=[...Object.values(mileage),...Object.values(fixes),...Object.values(upgrades),
 ...Object.values(legendary),...Object.values(hazards).flatMap(region=>Object.values(region))];
export const CHAOS_CARD_ART_SOURCES=Object.freeze(allPaths.map(path=>CHAOS_ART_BASE.slice(1)+path+'.png'));
export const CHAOS_CARD_ART_OUTPUTS=Object.freeze(allPaths.map(path=>CHAOS_ART_BASE.slice(1)+path+'.webp'));
const url=path=>path?CHAOS_ART_BASE+path+'.webp':null;
export const chaosMileageArt=km=>url(Object.hasOwn(mileage,km)?mileage[km]:null);
export const chaosFixArt=id=>url(Object.hasOwn(fixes,id)?fixes[id]:null);
export const chaosUpgradeArt=id=>url(Object.hasOwn(upgrades,id)?upgrades[id]:null);
export const chaosLegendaryArt=id=>url(Object.hasOwn(legendary,id)?legendary[id]:null);
export const chaosHazardArt=(leg,id)=>{
 const table=Object.hasOwn(hazards,leg)?hazards[leg]:null;
 return url(table&&Object.hasOwn(table,id)?table[id]:null);
};
export function chaosCardArt(card,leg){
 if(!card||typeof card!=='object')return null;
 switch(card.type){
  case 'mileage':return chaosMileageArt(card.km);
  case 'fix':return chaosFixArt(card.id);
  case 'hazard':return chaosHazardArt(leg,card.id);
  default:return null;
 }
}
