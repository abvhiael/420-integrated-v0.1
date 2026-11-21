// BG-19.13 deterministic build qualification: not a browser or network performance benchmark.
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {DASHBOARD_ASSETS} from '../core/dashboard-art.js';
import {CHAOS_CARD_ART_OUTPUTS} from '../core/chaos-card-art.js';
import {CHAOS_MAP_ASSETS,CHAOS_MAP_DIMENSIONS} from '../core/chaos-map-art.js';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..','dist');
const limits=Object.freeze({singleJs:256*1024,singleCss:256*1024,baseTotal:1024*1024,cardTotal:4*1024*1024,cardSingle:128*1024,mapTotal:780*1024});
async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())files.push(...await walk(path));else if(entry.isFile())files.push({path,size:(await stat(path)).size});}return files;}
const files=await walk(root);
const normalize=path=>relative(root,path).replaceAll('\\','/');
const artPrefix='assets/games/cross-country-chaos/cards/';
const mapPrefix='assets/games/cross-country-chaos/maps/';
const cardFiles=files.filter(f=>normalize(f.path).startsWith(artPrefix));
const mapFiles=files.filter(f=>normalize(f.path).startsWith(mapPrefix));
const regularFiles=files.filter(f=>!normalize(f.path).startsWith(artPrefix)&&!normalize(f.path).startsWith(mapPrefix));
const baseTotal=regularFiles.reduce((sum,f)=>sum+f.size,0);
const cardTotal=cardFiles.reduce((sum,f)=>sum+f.size,0);
const mapTotal=mapFiles.reduce((sum,f)=>sum+f.size,0);
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
const total=baseTotal+cardTotal+mapTotal;
for(const file of files){const name=relative(root,file.path);if(name.endsWith('.js')&&file.size>limits.singleJs)throw new Error(`JavaScript asset budget exceeded: ${name}`);if(name.endsWith('.css')&&file.size>limits.singleCss)throw new Error(`CSS asset budget exceeded: ${name}`);}
const html=await readFile(resolve(root,'index.html'),'utf8');const app=await readFile(resolve(root,'app.js'),'utf8');const css=await readFile(resolve(root,'styles.css'),'utf8');const branding=await readFile(resolve(root,'branding.css'),'utf8');
for(const [name,ok] of Object.entries({'document language':/<html\s+lang="[a-z-]+"/i.test(html),'viewport':/name="viewport"/.test(html),'main landmark':/<main\b/.test(app),'focus treatment':/:focus-visible\b/.test(css),'reduced motion':/prefers-reduced-motion/.test(css),'forced colors':/forced-colors/.test(css),'noindex private default':/name="robots"[^>]*noindex/i.test(html)}))if(!ok)throw new Error(`static accessibility/privacy gate missing: ${name}`);
const names=new Map(files.map(file=>[relative(root,file.path).replaceAll('\\','/'),file.size]));
for(const asset of DASHBOARD_ASSETS){const size=names.get(asset);if(!size||size>128*1024)throw new Error('missing or oversized dashboard artwork: '+asset);}
for(const name of names.keys())if(name.startsWith('assets/')&&!DASHBOARD_ASSETS.includes(name)&&!cardAllowlist.has(name)&&!mapAllowlist.has(name))
 throw new Error('unexpected published asset: '+name);
for(const asset of CHAOS_CARD_ART_OUTPUTS)if(!names.has(asset))throw new Error('missing approved card art: '+asset);
if(names.has('bong-goggles-logo.png'))throw new Error('oversized original brand master must remain source-only');
for(const asset of ['bong-goggles-header-256.webp','bong-goggles-browser-512.webp','favicon-32.png','favicon-192.png']){
  const size=names.get(asset);
  if(!size||size>128*1024)throw new Error(`missing or oversized optimized brand asset: ${asset}`);
}
for(const asset of ['favicon-32.png','favicon-192.png','bong-goggles-browser-512.webp'])if(!html.includes('/'+asset))throw new Error(`missing HTML brand asset reference: ${asset}`);
if(!branding.includes('/bong-goggles-header-256.webp'))throw new Error('missing optimized header logo reference');
console.log(`BG-19.13 static build gates passed: ${files.length} files; ${total} bytes; max JS ${limits.singleJs}, CSS ${limits.singleCss}, base assets ${baseTotal}/${limits.baseTotal}, 49 card assets ${cardTotal}/${limits.cardTotal}, 6 atlas layers ${mapTotal}/${limits.mapTotal}; optimized brand assets verified`);
