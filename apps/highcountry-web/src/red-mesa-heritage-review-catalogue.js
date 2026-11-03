// HC-ART-05-F: uploaded Red Mesa REVIEW art, not the approved canonical heritage roster.
// 420Corp-only infrastructure. Founder placement and game functions are deliberately unassigned.
const specs=[
 [
  "RM01",
  "Mesa Heritage Railway Station",
  "hc-structure-mesa-heritage-railway-station.png",
  6,
  5
 ],
 [
  "RM02",
  "Red Mesa Seed Registry",
  "hc-structure-red-mesa-seed-registry.png",
  5,
  4
 ],
 [
  "RM03",
  "Mesa Pioneers Monument",
  "hc-structure-mesa-pioneers-monument.png",
  4,
  4
 ],
 [
  "RM04",
  "Frontier Agricultural Museum",
  "hc-structure-frontier-agricultural-museum.png",
  6,
  5
 ],
 [
  "RM05",
  "Mesa Pioneer Schoolhouse",
  "hc-structure-mesa-pioneer-schoolhouse.png",
  5,
  4
 ],
 [
  "RM06",
  "Red Mesa Post & Telegraph Office",
  "hc-structure-red-mesa-post-telegraph-office.png",
  5,
  4
 ],
 [
  "RM07",
  "Mesa Flour Mill",
  "hc-structure-mesa-flour-mill.png",
  6,
  5
 ],
 [
  "RM08",
  "Mesa Land Surveyors Office",
  "hc-structure-mesa-land-surveyors-office.png",
  5,
  4
 ],
 [
  "RM09",
  "Mesa Water Tower",
  "hc-structure-mesa-water-tower.png",
  4,
  4
 ],
 [
  "RM10",
  "Mesa Agricultural Exhibition Pavilion",
  "hc-structure-mesa-agricultural-exhibition-pavilion.png",
  6,
  5
 ],
 [
  "RM11",
  "Mesa Railway Roundhouse Museum",
  "hc-structure-mesa-railway-roundhouse-museum.png",
  6,
  5
 ],
 [
  "RM12",
  "Mesa Seed Preservation Vault",
  "hc-structure-mesa-seed-preservation-vault.png",
  5,
  4
 ]
];
const freeze=Object.freeze;
export const redMesaHeritageReviewCatalogue=freeze(specs.map(([regionalId,name,filename,width,height])=>freeze({
 id:'hc-art-05-f-'+regionalId.toLowerCase(),regionalId,name,collection:'HC-ART-05-F',
 region:'red-mesa',assetUrl:'/assets/structures/hc-art-05-f/red-mesa/'+filename,
 assetStatus:'review-only-roster-mismatch',canonicalIdentityApproved:false,
 ownership:freeze({owner:'420Corp',transferable:false,playerOwned:false}),
 footprint:freeze({width,height,tileSizePx:64}),
 artworkCanvas:freeze({width:width*320,height:height*320}),
 placement:freeze({policy:'founder-selected-single-map-instance',assignedMap:null,assignedAnchor:null,
  maximumWorldInstances:1,region:'red-mesa',collisionStatus:'not-qualified',entranceStatus:'not-qualified',
  playerPlacementAllowed:false,automaticPlacementAllowed:false}),
 marketplace:freeze({category:'government-infrastructure',visibleInPlayerMarketplace:false,
  purchasable:false,tradable:false,price:null,currency:null,issuance:'420Corp-only'}),
 modifiers:freeze({status:'not-applicable',playerBonuses:freeze([]),gameFunction:null,
  activation:'disabled-until-founder-approval'})
})));
const byId=new Map(redMesaHeritageReviewCatalogue.map(x=>[x.id,x]));
export const getRedMesaHeritageReviewBuilding=id=>byId.get(id)??null;
// No user-supplied claim can grant authority to place, trade or activate review landmarks.
export const canPlayerPlaceRedMesaHeritage=()=>false;
