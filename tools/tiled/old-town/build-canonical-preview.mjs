// Generate a Tiled image collection from the ORIGINAL, verified Old Town PNGs.
// Run from repository root: node tools/tiled/old-town/build-canonical-preview.mjs
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=dirname(fileURLToPath(import.meta.url));
const root=resolve(folder,'../../..');
const read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const assets=await read('deployments/highcountry/old-town-genesis-assets.json');
const sites=await read('deployments/highcountry/old-town-site-registry.json');
const map=JSON.parse(await readFile(resolve(folder,'port-alder-old-town-review.tmj'),'utf8'));
if(assets.assets.length!==20||sites.sites.length!==59)throw Error('canonical asset/site census changed; review required');
const byId=new Map(sites.sites.map(s=>[s.id,s]));
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const props=o=>Object.entries(o).map(([name,value])=>({name,type:typeof value==='boolean'?'bool':typeof value==='number'?'int':'string',value}));
let tiles='',objects=[],nextId=map.nextobjectid;
for(const [i,a] of assets.assets.entries()){
 const site=byId.get(a.siteId);if(!site)throw Error('missing canonical site: '+a.siteId);
 const file=resolve(root,a.repoPath);
 const bytes=await readFile(file);
 const sha=createHash('sha256').update(bytes).digest('hex');
 if(sha!==a.sha256)throw Error('canonical PNG checksum mismatch: '+a.id);
 if(bytes.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('not a PNG: '+a.id);
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(!width||!height||width>16384||height>16384)throw Error('invalid PNG dimensions: '+a.id);
 const src=relative(folder,file).replaceAll('\\','/');
 tiles+=`  <tile id="${i}"><image source="${esc(src)}" width="${width}" height="${height}"/></tile>\n`;
 const [x0,y0,x1,y1]=site.rect;
 // Visual review only: projected rectangle center; never a foundation or ground-contact anchor.
 // Fit only the image's original CANVAS to a conservative property-relative preview size.
 const availableWidth=(x1-x0)*32;
 const w=Math.max(1,Math.round(availableWidth*.72));
 const h=Math.max(1,Math.round(w*height/width));
 objects.push({id:nextId++,name:a.id+' — UNQUALIFIED ART PREVIEW',type:'HC.OLD_TOWN.ART_PREVIEW_ONLY',visible:true,rotation:0,gid:i+1,
  x:Math.round((x0+x1)*16),y:Math.round((y0+y1)*16),width:w,height:h,
  properties:props({site_id:a.siteId,asset_id:a.id,canonical_repo_path:a.repoPath,canonical_sha256:sha,source_width_px:width,source_height_px:height,
   foundation_verified:false,placement_qualified:false,preview_canvas_fit_only:true})});
}
const tileset='<?xml version="1.0" encoding="UTF-8"?>\n<tileset version="1.10" tiledversion="1.11.2" name="HighCountry Old Town canonical originals" tilewidth="0" tileheight="0" tilecount="20" columns="0">\n'+tiles+'</tileset>\n';
await writeFile(resolve(folder,'old-town-canonical-originals.tsx'),tileset,'utf8');
map.tilesets=[{firstgid:1,source:'old-town-canonical-originals.tsx'}];
map.layers=map.layers.filter(l=>l.name!=='Canonical artwork — PREVIEW ONLY');
map.layers.push({id:Math.max(...map.layers.map(l=>l.id))+1,name:'Canonical artwork — PREVIEW ONLY',type:'objectgroup',draworder:'topdown',visible:true,opacity:1,x:0,y:0,objects});
map.nextlayerid=Math.max(...map.layers.map(l=>l.id))+1;
map.nextobjectid=nextId;
map.properties=[...map.properties.filter(p=>!['canonicalArtPreview','foundationQualified'].includes(p.name)),...props({canonicalArtPreview:true,foundationQualified:false})];
await writeFile(resolve(folder,'port-alder-old-town-art-preview.tmj'),JSON.stringify(map,null,2)+'\n');
console.log('Generated 20 hash-verified canonical image tiles and 20 non-authoritative image objects.');
