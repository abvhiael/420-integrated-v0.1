// HC-ART-02-B verified universal greenhouse artwork, browsable but never a mintable SKU.
export const GREENHOUSE_LOUNGE_VERSION='hc-art-02b/assets-v1';
export const GREENHOUSE_LOUNGE_ROOT='/assets/cultivation/props/comfort-furniture/greenhouse-lounge/universal/';
export const GREENHOUSE_LOUNGE_DESIGNS=Object.freeze([
  {
    "id": "hc-prop-furniture-papasan-chair",
    "name": "Papasan chair",
    "role": "signature comfort",
    "footprintTiles": {
      "columns": 2,
      "rows": 2
    },
    "environment": "greenhouse",
    "regions": [
      "emerald-coast",
      "golden-prairie",
      "red-mesa"
    ],
    "anchor": "floor-bottom-center",
    "assetStatus": "uploaded-main",
    "marketStatus": "not-registered",
    "category": "greenhouse-seating",
    "tags": [
      "seating",
      "greenhouse-seating"
    ]
  },
  {
    "id": "hc-prop-furniture-wicker-egg-chair",
    "name": "Freestanding wicker egg chair",
    "role": "premium lounge",
    "footprintTiles": {
      "columns": 2,
      "rows": 2
    },
    "environment": "greenhouse",
    "regions": [
      "emerald-coast",
      "golden-prairie",
      "red-mesa"
    ],
    "anchor": "floor-bottom-center",
    "assetStatus": "uploaded-main",
    "marketStatus": "not-registered",
    "category": "greenhouse-seating",
    "tags": [
      "seating",
      "greenhouse-seating"
    ]
  },
  {
    "id": "hc-prop-furniture-double-hanging-egg-chair",
    "name": "Double hanging egg chair",
    "role": "luxury",
    "footprintTiles": {
      "columns": 3,
      "rows": 2
    },
    "environment": "greenhouse",
    "regions": [
      "emerald-coast",
      "golden-prairie",
      "red-mesa"
    ],
    "anchor": "floor-bottom-center",
    "assetStatus": "uploaded-main",
    "marketStatus": "not-registered",
    "category": "greenhouse-seating",
    "tags": [
      "seating",
      "greenhouse-seating"
    ]
  },
  {
    "id": "hc-prop-furniture-wicker-loveseat",
    "name": "Wicker loveseat",
    "role": "natural furniture",
    "footprintTiles": {
      "columns": 2,
      "rows": 1
    },
    "environment": "greenhouse",
    "regions": [
      "emerald-coast",
      "golden-prairie",
      "red-mesa"
    ],
    "anchor": "floor-bottom-center",
    "assetStatus": "uploaded-main",
    "marketStatus": "not-registered",
    "category": "greenhouse-seating",
    "tags": [
      "seating",
      "greenhouse-seating"
    ]
  },
  {
    "id": "hc-prop-furniture-rattan-armchair",
    "name": "Rattan armchair",
    "role": "botanical seating",
    "footprintTiles": {
      "columns": 1,
      "rows": 1
    },
    "environment": "greenhouse",
    "regions": [
      "emerald-coast",
      "golden-prairie",
      "red-mesa"
    ],
    "anchor": "floor-bottom-center",
    "assetStatus": "uploaded-main",
    "marketStatus": "not-registered",
    "category": "greenhouse-seating",
    "tags": [
      "seating",
      "greenhouse-seating"
    ]
  },
  {
    "id": "hc-prop-furniture-folding-teak-chair",
    "name": "Folding teak garden chair",
    "role": "practical seating",
    "footprintTiles": {
      "columns": 1,
      "rows": 1
    },
    "environment": "greenhouse",
    "regions": [
      "emerald-coast",
      "golden-prairie",
      "red-mesa"
    ],
    "anchor": "floor-bottom-center",
    "assetStatus": "uploaded-main",
    "marketStatus": "not-registered",
    "category": "greenhouse-seating",
    "tags": [
      "seating",
      "greenhouse-seating"
    ]
  },
  {
    "id": "hc-prop-furniture-cedar-garden-bench",
    "name": "Cedar garden bench",
    "role": "cedar bench",
    "footprintTiles": {
      "columns": 2,
      "rows": 1
    },
    "environment": "greenhouse",
    "regions": [
      "emerald-coast",
      "golden-prairie",
      "red-mesa"
    ],
    "anchor": "floor-bottom-center",
    "assetStatus": "uploaded-main",
    "marketStatus": "not-registered",
    "category": "greenhouse-seating",
    "tags": [
      "seating",
      "greenhouse-seating"
    ]
  },
  {
    "id": "hc-prop-furniture-greenhouse-reading-chair",
    "name": "Greenhouse reading chair",
    "role": "quiet retreat",
    "footprintTiles": {
      "columns": 1,
      "rows": 1
    },
    "environment": "greenhouse",
    "regions": [
      "emerald-coast",
      "golden-prairie",
      "red-mesa"
    ],
    "anchor": "floor-bottom-center",
    "assetStatus": "uploaded-main",
    "marketStatus": "not-registered",
    "category": "greenhouse-seating",
    "tags": [
      "seating",
      "greenhouse-seating"
    ]
  },
  {
    "id": "hc-prop-furniture-hammock-chair-stand",
    "name": "Hammock chair with stand",
    "role": "relaxation",
    "footprintTiles": {
      "columns": 2,
      "rows": 2
    },
    "environment": "greenhouse",
    "regions": [
      "emerald-coast",
      "golden-prairie",
      "red-mesa"
    ],
    "anchor": "floor-bottom-center",
    "assetStatus": "uploaded-main",
    "marketStatus": "not-registered",
    "category": "greenhouse-seating",
    "tags": [
      "seating",
      "greenhouse-seating"
    ]
  },
  {
    "id": "hc-prop-furniture-wicker-footstool",
    "name": "Small wicker footstool",
    "role": "seating accessory",
    "footprintTiles": {
      "columns": 1,
      "rows": 1
    },
    "environment": "greenhouse",
    "regions": [
      "emerald-coast",
      "golden-prairie",
      "red-mesa"
    ],
    "anchor": "floor-bottom-center",
    "assetStatus": "uploaded-main",
    "marketStatus": "not-registered",
    "category": "comfort-accessory",
    "tags": [
      "comfort-accessory"
    ]
  }
].map(x=>Object.freeze({...x,footprintTiles:Object.freeze(x.footprintTiles),regions:Object.freeze(x.regions),tags:Object.freeze(x.tags),sprite:Object.freeze({src:GREENHOUSE_LOUNGE_ROOT+x.id+'.png',alt:x.name+' greenhouse furniture artwork'}),placement:Object.freeze({tilePx:64,anchorX:.5,anchorY:1,collision:'tile-occupancy',depth:'ground-contact-y',clearance:x.id.includes('egg-chair')||x.id.includes('hammock-chair')?'swing-clearance-check':'normal'})})));
export function greenhouseLoungeDesign(id){const item=GREENHOUSE_LOUNGE_DESIGNS.find(x=>x.id===id);if(!item)throw Error('unknown-greenhouse-lounge-design');return item;}
export function greenhouseLoungePlacement(id){const item=greenhouseLoungeDesign(id);return Object.freeze({id:item.id,src:item.sprite.src,footprintTiles:item.footprintTiles,anchorX:.5,anchorY:1,tilePx:64,collision:'tile-occupancy',depth:'ground-contact-y',clearance:item.placement.clearance});}
