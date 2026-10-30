// HC-ART-05-E Red Mesa visual catalogue. No client-side issuance, bonus grants or collision authority.
const specs=[
 ['RM01','adobe-desert-hammam','Adobe Desert Hammam',6,5,'thermal-recovery','worker_recovery','wellness_satisfaction'],
 ['RM02','sandstone-cliffside-retreat','Sandstone Cliffside Retreat',6,5,'desert-respite','guest_retreat_appeal','heat_comfort'],
 ['RM03','mesa-stargazers-courtyard',"Mesa Stargazer's Courtyard",5,4,'celestial-observation','astronomy_discovery_activity','nighttime_visitor_appeal'],
 ['RM04','desert-oasis-bathing-pavilion','Desert Oasis Bathing Pavilion',6,5,'oasis-wellness','leisure_satisfaction','social_comfort'],
 ['RM05','red-mesa-amphitheatre-house','Red Mesa Amphitheatre House',6,5,'canyon-performances','approved_entertainment_event_rewards','community_morale'],
 ['RM06','desert-labyrinth-sanctuary','Desert Labyrinth Sanctuary',5,4,'mindful-reflection','meditation_activity_rewards','sanctuary_prestige']
];
const frozen=o=>Object.freeze(o);
export const redMesaLeisureCatalogue=frozen(specs.map(([id,slug,name,width,height,ability,primary,secondary])=>
 frozen({
  id:'hc-art-05-e-'+id.toLowerCase(),regionalId:id,name,collection:'HC-ART-05-E',region:'red-mesa',
  category:'leisure-retreat',assetUrl:'/assets/structures/hc-art-05-e/red-mesa/hc-structure-'+slug+'.png',
  footprint:frozen({width,height,tileSizePx:64}),artworkCanvas:frozen({width:width*320,height:height*320}),
  placement:frozen({layer:'structure',surface:'outdoor_ground',requiresGroundAnchor:true,
   clickableBuilding:true,regionRestriction:'red-mesa',collisionMaskStatus:'pending-qualified-geometry',
   placementWithoutCollisionMask:'deny',requiresAuthoritativeOwnership:true,
   requiresServerAuthorization:true}),
  marketplace:frozen({category:'regional-leisure-buildings',currency:'BUDS',price:null,
   inventoryPolicy:'authenticated-server-owned',listingStatus:'catalogue-only',
   noClientPurchaseOrIssuance:true}),
  bonuses:frozen({ability,primary:frozen({key:primary,amount:null}),secondary:frozen({key:secondary,amount:null}),
   activeOnlyWhen:'server-verified-owned-placed-and-activated',stacking:'one-effective-bonus-per-type',
   directHarvestYield:false,geneticRarity:false,strainQuality:false,craftModifiers:false,
   directTokenRewards:false,serverAuthorityRequired:true})
 })));
const byId=new Map(redMesaLeisureCatalogue.map(x=>[x.id,x]));
export function getRedMesaLeisureBuilding(id){return byId.get(id)??null;}
export function canPlaceRedMesaLeisureBuilding({id,owned=false,serverAuthorized=false,region,
 hasGroundAnchor=false,collisionMaskQualified=false,
 overlapsExisting=true}={}){
 return byId.has(id)&&owned===true&&serverAuthorized===true&&region==='red-mesa'&&
 hasGroundAnchor===true&&collisionMaskQualified===true&&overlapsExisting===false;
}
