// BG-19.13 deterministic build qualification: not a browser or network performance benchmark.
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {DASHBOARD_ASSETS} from '../core/dashboard-art.js';
import {CHAOS_CARD_ART_OUTPUTS} from '../core/chaos-card-art.js';
import {CHAOS_MAP_ASSETS,CHAOS_MAP_DIMENSIONS} from '../core/chaos-map-art.js';
import {CHAOS_VEHICLE_ASSETS,CHAOS_VEHICLE_SOURCE_SHA} from '../core/chaos-vehicles.js';
import {CHAOS_SCENERY,CHAOS_SCENERY_COUNT} from '../core/chaos-region-scenery.js';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..','dist');
// CCC-ART-5 qualified base: 1,076,369 B. Home's authenticated off-chain feed
// adds 5,138 B (combined 1,081,507 B). Reserve exactly 5 KiB for this UI;
// retain unchanged per-file, card, map and vehicle ceilings.
const limits=Object.freeze({singleJs:256*1024,singleCss:256*1024,baseTotal:1057*1024,cardTotal:4*1024*1024,cardSingle:128*1024,mapTotal:780*1024,vehicleTotal:16*1024});
async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())files.push(...await walk(path));else if(entry.isFile())files.push({path,size:(await stat(path)).size});}return files;}
const files=await walk(root);
const normalize=path=>relative(root,path).replaceAll('\\','/');
const artPrefix='assets/games/cross-country-chaos/cards/';
const mapPrefix='assets/games/cross-country-chaos/maps/';
const vehiclePrefix='assets/games/cross-country-chaos/vehicles/';
const cardFiles=files.filter(f=>normalize(f.path).startsWith(artPrefix));
const mapFiles=files.filter(f=>normalize(f.path).startsWith(mapPrefix));
const vehicleFiles=files.filter(f=>normalize(f.path).startsWith(vehiclePrefix));
const regularFiles=files.filter(f=>!normalize(f.path).startsWith(artPrefix)&&!normalize(f.path).startsWith(mapPrefix)&&!normalize(f.path).startsWith(vehiclePrefix));
const baseTotal=regularFiles.reduce((sum,f)=>sum+f.size,0);
const cardTotal=cardFiles.reduce((sum,f)=>sum+f.size,0);
const mapTotal=mapFiles.reduce((sum,f)=>sum+f.size,0);
const vehicleTotal=vehicleFiles.reduce((sum,f)=>sum+f.size,0);
if(vehicleTotal>limits.vehicleTotal)throw new Error('CCC-ART-3 vehicle budget exceeded: '+vehicleTotal);
if(mapTotal>limits.mapTotal)throw new Error('CCC-ART-2 map budget exceeded: '+mapTotal+' > '+limits.mapTotal);
if(baseTotal>limits.baseTotal)throw new Error(`base static asset budget exceeded: ${baseTotal} > ${limits.baseTotal}`);
if(cardTotal>limits.cardTotal)throw new Error(`Cross-Country Chaos card budget exceeded: ${cardTotal} > ${limits.cardTotal}`);
if(CHAOS_CARD_ART_OUTPUTS.length!==49||new Set(CHAOS_CARD_ART_OUTPUTS).size!==49)
 throw new Error('Invalid card asset allowlist');
const cardAllowlist=new Set(CHAOS_CARD_ART_OUTPUTS);
for(const f of cardFiles){
 const name=normalize(f.path);
 if(!cardAllowlist.has(name)||f.size<1024||f.size>limits.cardSingle)
  throw new Error('Unexpected or oversized Cross-Country Chaos artwork: '+name);
}
if(cardFiles.length!==cardAllowlist.size)throw new Error('Incomplete Cross-Country Chaos artwork output');
const mapAllowlist=new Map(CHAOS_MAP_ASSETS.map(asset=>[asset.path,asset]));
if(mapAllowlist.size!==6||mapFiles.length!==6)throw new Error('Incomplete or duplicate regional atlas output');
for(const f of mapFiles){
 const name=normalize(f.path),asset=mapAllowlist.get(name);
 if(!asset||f.size!==asset.bytes||f.size>(asset.transparent?80:180)*1024)
  throw new Error('Unexpected, changed or oversized CCC-ART-2 map: '+name);
 const meta=await sharp(f.path).metadata();
 if(meta.format!=='webp'||meta.width!==CHAOS_MAP_DIMENSIONS.width||
   meta.height!==CHAOS_MAP_DIMENSIONS.height||Boolean(meta.hasAlpha)!==asset.transparent)
  throw new Error('Invalid output map dimensions or alpha: '+name);
}
const vehicleAllowlist=new Set(CHAOS_VEHICLE_ASSETS);
if(vehicleAllowlist.size!==6||vehicleFiles.length!==6)throw new Error('CCC-ART-3 vehicle output count mismatch');
for(const f of vehicleFiles){
 const name=normalize(f.path),id=name.slice(vehiclePrefix.length,-4);
 if(!vehicleAllowlist.has(name)||f.size<800||f.size>2048)throw new Error('Invalid published vehicle token: '+name);
 const raw=await readFile(f.path);
 const gitSha=createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex');
 if(gitSha!==CHAOS_VEHICLE_SOURCE_SHA[id])throw new Error('Published vehicle token differs from approved source: '+name);
}
const total=baseTotal+cardTotal+mapTotal+vehicleTotal;
for(const file of files){const name=relative(root,file.path);if(name.endsWith('.js')&&file.size>limits.singleJs)throw new Error(`JavaScript asset budget exceeded: ${name}`);if(name.endsWith('.css')&&file.size>limits.singleCss)throw new Error(`CSS asset budget exceeded: ${name}`);}
const html=await readFile(resolve(root,'index.html'),'utf8');const app=await readFile(resolve(root,'app.js'),'utf8');const css=await readFile(resolve(root,'styles.css'),'utf8');const branding=await readFile(resolve(root,'branding.css'),'utf8');
const tabletopCss=await readFile(resolve(root,'ccc-tabletop.css'),'utf8');
if(!html.includes('href="/ccc-tabletop.css"')||!tabletopCss.includes('ccc-tabletop--road-atlas')||
  !tabletopCss.includes('prefers-reduced-motion:reduce')||!tabletopCss.includes('forced-colors:active')||
  tabletopCss.includes('@import')||tabletopCss.includes('https://')||tabletopCss.includes('http://'))
 throw new Error('Missing or unsafe CCC-ART-4 tabletop stylesheet');
// CCC-ART-5 only introduces eight local inline-vector illustrations; no
// remotely fetched art or changed card/map/vehicle asset manifest is permitted.
const scenicSource=await readFile(resolve(root,'core/chaos-region-scenery.js'),'utf8');
const scenicBoard=await readFile(resolve(root,'core/chaos-board.js'),'utf8');
if(CHAOS_SCENERY_COUNT!==8||Object.keys(CHAOS_SCENERY).sort().join(',')!=='east,ontario,west'||
  !Object.values(CHAOS_SCENERY).every(group=>Object.isFrozen(group))||
  !scenicBoard.includes('renderChaosScenery(region)')||
  !tabletopCss.includes('.ccc-illustrated-scenery{display:none}')||
  Buffer.byteLength(scenicSource,'utf8')>12*1024||
  /<script|<foreignObject|https?:\/\/|@import/.test(scenicSource))
 throw new Error('CCC-ART-5 inline scenery qualification failed');
for(const [name,ok] of Object.entries({'document language':/<html\s+lang="[a-z-]+"/i.test(html),'viewport':/name="viewport"/.test(html),'main landmark':/<main\b/.test(app),'focus treatment':/:focus-visible\b/.test(css),'reduced motion':/prefers-reduced-motion/.test(css),'forced colors':/forced-colors/.test(css),'noindex private default':/name="robots"[^>]*noindex/i.test(html)}))if(!ok)throw new Error(`static accessibility/privacy gate missing: ${name}`);
const names=new Map(files.map(file=>[relative(root,file.path).replaceAll('\\','/'),file.size]));
for(const asset of DASHBOARD_ASSETS){const size=names.get(asset);if(!size||size>128*1024)throw new Error('missing or oversized dashboard artwork: '+asset);}
for(const name of names.keys())if(name.startsWith('assets/')&&!DASHBOARD_ASSETS.includes(name)&&!cardAllowlist.has(name)&&!mapAllowlist.has(name)&&!vehicleAllowlist.has(name))
 throw new Error('unexpected published asset: '+name);
for(const asset of CHAOS_CARD_ART_OUTPUTS)if(!names.has(asset))throw new Error('missing approved card art: '+asset);
if(names.has('bong-goggles-logo.png'))throw new Error('oversized original brand master must remain source-only');
for(const asset of ['bong-goggles-header-256.webp','bong-goggles-browser-512.webp','favicon-32.png','favicon-192.png']){
  const size=names.get(asset);
  if(!size||size>128*1024)throw new Error(`missing or oversized optimized brand asset: ${asset}`);
}
for(const asset of ['favicon-32.png','favicon-192.png','bong-goggles-browser-512.webp'])if(!html.includes('/'+asset))throw new Error(`missing HTML brand asset reference: ${asset}`);
if(!branding.includes('/bong-goggles-header-256.webp'))throw new Error('missing optimized header logo reference');
console.log(`BG-19.13 static build gates passed: ${files.length} files; ${total} bytes; max JS ${limits.singleJs}, CSS ${limits.singleCss}, base assets ${baseTotal}/${limits.baseTotal}, 49 card assets ${cardTotal}/${limits.cardTotal}, 6 atlas layers ${mapTotal}/${limits.mapTotal}, 6 vehicle tokens ${vehicleTotal}/${limits.vehicleTotal}; optimized brand assets verified`);
