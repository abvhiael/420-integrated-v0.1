// HC-ART-01-A curated art registry. Display metadata only; no mint, ownership, or purchase authority.
// Sprite art is a 1024x1024 RGBA source canvas. Occupancy is logical 64px ground tiles, not sprite bounds.
export const SUPPORT_CATALOG_VERSION='hc-art-01a/v1';
export const SUPPORT_TILE_SIZE=64;
const SOURCE=[
  {
    "id": "hc-prop-support-stake-bamboo-single",
    "name": "Single bamboo stake",
    "anchor": "plant",
    "footprint": {
      "columns": 0,
      "rows": 0
    },
    "layering": "single",
    "environment": [
      "outdoor",
      "greenhouse",
      "indoor"
    ],
    "region": "universal",
    "files": {
      "sprite": "hc-prop-support-stake-bamboo-single.png"
    }
  },
  {
    "id": "hc-prop-support-stake-metal-single",
    "name": "Single metal stake",
    "anchor": "plant",
    "footprint": {
      "columns": 0,
      "rows": 0
    },
    "layering": "single",
    "environment": [
      "outdoor",
      "greenhouse",
      "indoor"
    ],
    "region": "universal",
    "files": {
      "sprite": "hc-prop-support-stake-metal-single.png"
    }
  },
  {
    "id": "hc-prop-support-stake-double-tie",
    "name": "Double stake with tie bar",
    "anchor": "plant",
    "footprint": {
      "columns": 0,
      "rows": 0
    },
    "layering": "single",
    "environment": [
      "outdoor",
      "greenhouse",
      "indoor"
    ],
    "region": "universal",
    "files": {
      "sprite": "hc-prop-support-stake-double-tie.png"
    }
  },
  {
    "id": "hc-prop-support-teepee-bamboo",
    "name": "Bamboo tripod teepee",
    "anchor": "ground",
    "footprint": {
      "columns": 1,
      "rows": 1
    },
    "layering": "split",
    "environment": [
      "outdoor",
      "greenhouse",
      "indoor"
    ],
    "region": "universal",
    "files": {
      "sprite": "hc-prop-support-teepee-bamboo.png",
      "back": "hc-prop-support-teepee-bamboo-back.png",
      "front": "hc-prop-support-teepee-bamboo-front.png"
    }
  },
  {
    "id": "hc-prop-support-stake-spiral",
    "name": "Spiral support stake",
    "anchor": "plant",
    "footprint": {
      "columns": 0,
      "rows": 0
    },
    "layering": "single",
    "environment": [
      "outdoor",
      "greenhouse",
      "indoor"
    ],
    "region": "universal",
    "files": {
      "sprite": "hc-prop-support-stake-spiral.png"
    }
  },
  {
    "id": "hc-prop-support-cage-tomato-small",
    "name": "Small tomato cage",
    "anchor": "container",
    "footprint": {
      "columns": 1,
      "rows": 1
    },
    "layering": "split",
    "environment": [
      "outdoor",
      "greenhouse",
      "indoor"
    ],
    "region": "universal",
    "files": {
      "sprite": "hc-prop-support-cage-tomato-small.png",
      "back": "hc-prop-support-cage-tomato-small-back.png",
      "front": "hc-prop-support-cage-tomato-small-front.png"
    }
  },
  {
    "id": "hc-prop-support-cage-tomato-tall",
    "name": "Tall tomato cage",
    "anchor": "container",
    "footprint": {
      "columns": 1,
      "rows": 1
    },
    "layering": "split",
    "environment": [
      "outdoor",
      "greenhouse",
      "indoor"
    ],
    "region": "universal",
    "files": {
      "sprite": "hc-prop-support-cage-tomato-tall.png",
      "back": "hc-prop-support-cage-tomato-tall-back.png",
      "front": "hc-prop-support-cage-tomato-tall-front.png"
    }
  },
  {
    "id": "hc-prop-support-cage-cone",
    "name": "Cone wire support",
    "anchor": "container",
    "footprint": {
      "columns": 1,
      "rows": 1
    },
    "layering": "split",
    "environment": [
      "outdoor",
      "greenhouse",
      "indoor"
    ],
    "region": "universal",
    "files": {
      "sprite": "hc-prop-support-cage-cone.png",
      "back": "hc-prop-support-cage-cone-back.png",
      "front": "hc-prop-support-cage-cone-front.png"
    }
  },
  {
    "id": "hc-prop-support-teepee-rustic-cedar-emerald-coast",
    "name": "Rustic cedar teepee",
    "anchor": "ground",
    "footprint": {
      "columns": 1,
      "rows": 1
    },
    "layering": "single",
    "environment": [
      "outdoor",
      "greenhouse",
      "indoor"
    ],
    "region": "emerald-coast",
    "files": {
      "sprite": "hc-prop-support-teepee-rustic-cedar-emerald-coast.png"
    }
  },
  {
    "id": "hc-prop-support-cage-tomato-tall-golden-prairie",
    "name": "Galvanized prairie cage",
    "anchor": "container",
    "footprint": {
      "columns": 1,
      "rows": 1
    },
    "layering": "single",
    "environment": [
      "outdoor",
      "greenhouse",
      "indoor"
    ],
    "region": "golden-prairie",
    "files": {
      "sprite": "hc-prop-support-cage-tomato-tall-golden-prairie.png"
    }
  },
  {
    "id": "hc-prop-support-cage-cone-rust-iron-red-mesa",
    "name": "Rust iron cone cage",
    "anchor": "container",
    "footprint": {
      "columns": 1,
      "rows": 1
    },
    "layering": "single",
    "environment": [
      "outdoor",
      "greenhouse",
      "indoor"
    ],
    "region": "red-mesa",
    "files": {
      "sprite": "hc-prop-support-cage-cone-rust-iron-red-mesa.png"
    }
  }
];
export const SUPPORT_CATALOG=Object.freeze(SOURCE.map(asset=>Object.freeze({...asset,footprint:Object.freeze(asset.footprint),environment:Object.freeze(asset.environment),files:Object.freeze(asset.files),
  paths:Object.freeze(Object.fromEntries(Object.entries(asset.files).map(([layer,file])=>[layer,'/assets/cultivation/props/trellises-supports/'+asset.region+'/'+file])))})));
export function supportAsset(id){const item=SUPPORT_CATALOG.find(x=>x.id===id);if(!item)throw Error('unknown-support-asset');return item;}
export function supportPlacement(id,{parentId=null}={}){const item=supportAsset(id);if(item.anchor!=='ground'&&(!parentId||typeof parentId!=='string'))throw Error('support-attachment-required');return Object.freeze({assetId:item.id,anchorType:item.anchor,parentId:item.anchor==='ground'?null:parentId,footprintTiles:item.anchor==='ground'?item.footprint:Object.freeze({columns:0,rows:0}),spriteAnchor:Object.freeze({x:.5,y:1}),layering:item.layering,tileSize:SUPPORT_TILE_SIZE});}
