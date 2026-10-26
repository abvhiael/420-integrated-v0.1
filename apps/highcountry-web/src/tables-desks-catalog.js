// HC-ART-02-D: universal artwork and visual placement metadata, never inventory authority.
export const TABLES_DESKS_VERSION='hc-art-02d/assets-v1';
export const TABLES_DESKS_ROOT='/assets/cultivation/props/comfort-furniture/tables-desks/universal/';
// Logical footprints below are layout design metadata, not verified parcel collision rights.
export const TABLES_DESKS_DESIGNS=Object.freeze([
  {
    "id": "hc-prop-furniture-rustic-coffee-table",
    "name": "Rustic coffee table",
    "category": "table",
    "footprintTiles": {
      "columns": 2,
      "rows": 1
    },
    "clearance": "normal",
    "contentBounds": [
      120,
      549,
      903,
      960
    ],
    "sha256": "f3e79ee5279e0de5edc13a9fc2b0570f08888cdcc1530c4da56153c992853eee"
  },
  {
    "id": "hc-prop-furniture-round-coffee-table",
    "name": "Round coffee table",
    "category": "table",
    "footprintTiles": {
      "columns": 2,
      "rows": 2
    },
    "clearance": "normal",
    "contentBounds": [
      206,
      552,
      818,
      960
    ],
    "sha256": "b443b744c584da9931e4c46416629d821371b2a59a0a925280c2a789b22d4488"
  },
  {
    "id": "hc-prop-furniture-compact-end-table",
    "name": "Compact end table",
    "category": "table",
    "footprintTiles": {
      "columns": 1,
      "rows": 1
    },
    "clearance": "normal",
    "contentBounds": [
      312,
      565,
      712,
      960
    ],
    "sha256": "f418663a37ced76b87753b0e3d81e25d368384dd7d6232440a5020a3da43375a"
  },
  {
    "id": "hc-prop-furniture-narrow-console-table",
    "name": "Narrow console table",
    "category": "table",
    "footprintTiles": {
      "columns": 3,
      "rows": 1
    },
    "clearance": "drawer-access",
    "contentBounds": [
      157,
      557,
      867,
      960
    ],
    "sha256": "e589d7902a65f86a174c553311ae82e48e0bdb5a83990e887af550ed6f4dea19"
  },
  {
    "id": "hc-prop-furniture-storage-sideboard",
    "name": "Storage sideboard",
    "category": "storage",
    "footprintTiles": {
      "columns": 3,
      "rows": 1
    },
    "clearance": "door-and-drawer-access",
    "contentBounds": [
      127,
      538,
      897,
      960
    ],
    "sha256": "7549f7e9a81b57a19a4a3759fe0165f24f9589f9a7357c8c7ce8dd4cdfaaf02b"
  },
  {
    "id": "hc-prop-furniture-writing-desk",
    "name": "Writing desk",
    "category": "workspace",
    "footprintTiles": {
      "columns": 2,
      "rows": 1
    },
    "clearance": "chair-and-drawer-access",
    "contentBounds": [
      168,
      548,
      855,
      960
    ],
    "sha256": "ebdaca702862f9a38ffa33a1608a3e78c9391f644b962775c752b6ea5b972c15"
  },
  {
    "id": "hc-prop-furniture-corner-workstation",
    "name": "Corner workstation",
    "category": "workspace",
    "footprintTiles": {
      "columns": 3,
      "rows": 2
    },
    "clearance": "chair-and-shelf-access",
    "contentBounds": [
      80,
      535,
      943,
      960
    ],
    "sha256": "e503654ad9541bb2973f68e396bfe5dfaf98e9cebf897e816b693ed1bfb96d9d"
  },
  {
    "id": "hc-prop-furniture-growers-planning-desk",
    "name": "Grower’s planning desk",
    "category": "workspace",
    "footprintTiles": {
      "columns": 2,
      "rows": 2
    },
    "clearance": "chair-and-drawer-access",
    "contentBounds": [
      199,
      506,
      824,
      960
    ],
    "sha256": "59b289013acc7ebf7eab11068533e0c8719f51123d92fa0ff2a65973afe86b7a"
  },
  {
    "id": "hc-prop-furniture-communal-project-table",
    "name": "Communal project table",
    "category": "table",
    "footprintTiles": {
      "columns": 3,
      "rows": 2
    },
    "clearance": "all-sides-access",
    "contentBounds": [
      58,
      452,
      965,
      960
    ],
    "sha256": "d377f372905d6babd0fb9ab99ef369847b4863de60b430a4e79b77b5029ff75c"
  },
  {
    "id": "hc-prop-furniture-personal-secretary-desk",
    "name": "Personal secretary desk",
    "category": "workspace",
    "footprintTiles": {
      "columns": 2,
      "rows": 1
    },
    "clearance": "drop-front-and-chair-access",
    "contentBounds": [
      237,
      410,
      787,
      960
    ],
    "sha256": "1e9ee0ced9f703fce74088f73d56f3fd5e0d95ace82068c522cc967ef42928d8"
  }
].map(x=>Object.freeze({
 ...x,footprintTiles:Object.freeze(x.footprintTiles),contentBounds:Object.freeze(x.contentBounds),
 regions:Object.freeze(['emerald-coast','golden-prairie','red-mesa']),
 environments:Object.freeze(['indoor','greenhouse']),
 tags:Object.freeze(x.category==='workspace'?['table','workspace']:x.category==='table'?['table']:['storage']),
 assetStatus:'uploaded-main',marketStatus:'not-registered',
 sprite:Object.freeze({src:TABLES_DESKS_ROOT+x.id+'.png',alt:x.name+' furniture artwork',width:1024,height:1024}),
 // Export canvas has 64px transparent padding below ground contact: do not anchor to its bottom edge.
 placement:Object.freeze({tilePx:64,anchorX:.5,anchorY:960/1024,
  collision:'tile-occupancy',authority:'visual-only',depth:'ground-contact-y',clearance:x.clearance})
})));
export function tablesDesksDesign(id){
 const item=TABLES_DESKS_DESIGNS.find(x=>x.id===id);
 if(!item)throw Error('unknown-tables-desks-design');return item;
}
export function tablesDesksPlacement(id){
 const item=tablesDesksDesign(id);
 return Object.freeze({id:item.id,src:item.sprite.src,footprintTiles:item.footprintTiles,
  ...item.placement,sourceWidth:item.sprite.width,sourceHeight:item.sprite.height});
}
// Ground-contact coordinates and uniform canvas scaling preserve the source sheet's relative object sizes.
export function tablesDesksPlacementStyle(id,{x,y,scale=1}={}){
 const item=tablesDesksDesign(id);
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1920||y<0||y>1080)
  throw Error('invalid-furniture-coordinate');
 if(!Number.isFinite(scale)||scale<.5||scale>1.5)throw Error('invalid-furniture-scale');
 const size=384*scale;
 return Object.freeze({position:'absolute',left:(x/1920*100)+'%',top:(y/1080*100)+'%',
  width:(size/1920*100)+'%',height:(size/1080*100)+'%',
  transform:'translate(-50%, -93.75%)',zIndex:String(20000+Math.round(y)),objectFit:'contain'});
}
