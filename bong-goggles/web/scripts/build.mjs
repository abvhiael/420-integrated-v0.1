import {cp,mkdir,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {DASHBOARD_ASSETS} from '../core/dashboard-art.js';
import {CHAOS_CARD_ART_SOURCES,CHAOS_CARD_ART_OUTPUTS} from '../core/chaos-card-art.js';
import {CHAOS_MAP_ASSETS} from '../core/chaos-map-art.js';
import {CHAOS_VEHICLE_ASSETS} from '../core/chaos-vehicles.js';
import {verifyChaosVehicleArt} from './verify-chaos-vehicle-art.mjs';
import {CHAOS_IMAGE_MANIFEST_PATH,createChaosImageManifest} from './verify-chaos-image-manifest.mjs';
import {verifyChaosMapArt} from './verify-chaos-map-art.mjs';
import sharp from 'sharp';
import {verifyChaosCardCatalog} from './verify-chaos-card-catalog.mjs';
import {validateRuntimeConfig} from '../core/runtime-config.js';
import {ACCOUNT_SOCIAL_BUILD_FLAG,CLASSIC_ROOMS_BUILD_FLAG,withAccountSocialBuildFlags} from './account-social-build-config.mjs';

const root=resolve(import.meta.dirname,'..');
const out=resolve(root,'dist');
const master=resolve(root,'bong-goggles-logo.png');
// Fail before build output if a card image, legend, region or declared identity was swapped.
const ccc2=await verifyChaosCardCatalog();
console.log('CCC-2 source and physical-deck qualification:',JSON.stringify(ccc2));
// Preserve CCC-ART-2 source hashes and alpha before publishing the staged web build.
const atlas=await verifyChaosMapArt();
console.log('CCC-ART-2 regional-map qualification:',JSON.stringify(atlas));
const vehicles=await verifyChaosVehicleArt();
console.log('CCC-ART-3 vehicle-art qualification:',JSON.stringify(vehicles));
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

const example=JSON.parse(await readFile(resolve(root,'runtime-config.example.json'),'utf8'));
const runtimeConfig=withAccountSocialBuildFlags(example,process.env[ACCOUNT_SOCIAL_BUILD_FLAG],process.env[CLASSIC_ROOMS_BUILD_FLAG]);
validateRuntimeConfig(runtimeConfig);

for(const item of ['index.html','app.js','styles.css','game-kit.css','settings.css','branding.css','feed-branding.css','dashboard.css','classics.css','ccc-tabletop.css','welcome-landscape.svg','core','_headers']){
  await cp(resolve(root,item),resolve(out,item),{recursive:true});
}
// Only approved dashboard assets and explicitly mapped optimized game cards are published.
// Uploaded source PNGs, manifests, and placeholder files are never shipped.
for(const asset of DASHBOARD_ASSETS){
  const source=resolve(root,asset),target=resolve(out,asset);
  const metadata=await sharp(source).metadata();
  if(metadata.format!=='webp'||!metadata.width||!metadata.height||(await stat(source)).size>128*1024)throw new Error('invalid dashboard artwork: '+asset);
  if(asset.startsWith('assets/apps/')&&!metadata.hasAlpha)throw new Error('app icon must preserve transparency: '+asset);
  await mkdir(dirname(target),{recursive:true});
  await cp(source,target);
}
if(CHAOS_CARD_ART_SOURCES.length!==49||CHAOS_CARD_ART_OUTPUTS.length!==49||
   new Set(CHAOS_CARD_ART_OUTPUTS).size!==49)throw new Error('Cross-Country Chaos card allowlist mismatch');
for(let i=0;i<CHAOS_CARD_ART_SOURCES.length;i++){
 const source=resolve(root,CHAOS_CARD_ART_SOURCES[i]);
 const target=resolve(out,CHAOS_CARD_ART_OUTPUTS[i]);
 const metadata=await sharp(source).metadata();
 if(metadata.format!=='png'||metadata.width!==640||metadata.height!==1080||!metadata.hasAlpha||
    (await stat(source)).size>2*1024*1024)throw new Error('Invalid Cross-Country Chaos card source: '+CHAOS_CARD_ART_SOURCES[i]);
 await mkdir(dirname(target),{recursive:true});
 await sharp(source).resize({width:480}).webp({quality:78,effort:6}).toFile(target);
 const optimized=await sharp(target).metadata();
 if(optimized.format!=='webp'||optimized.width!==480||optimized.height!==810||
    !optimized.hasAlpha||(await stat(target)).size>128*1024)
  throw new Error('Cross-Country Chaos card exceeded published asset budget: '+CHAOS_CARD_ART_OUTPUTS[i]);
}
// Copy only the six pinned, already-optimized WebP atlas layers. They are independent
// of the 49-card art budget and all live highway/vehicle SVG geometry.
for(const layer of CHAOS_MAP_ASSETS){
 const source=resolve(root,layer.path),destination=resolve(out,layer.path);
 await mkdir(dirname(destination),{recursive:true});
 await cp(source,destination);
}
// Copy only the pinned, self-contained vintage vehicle tokens after source validation.
for(const asset of CHAOS_VEHICLE_ASSETS){
 const target=resolve(out,asset);
 await mkdir(dirname(target),{recursive:true});
 await cp(resolve(root,asset),target);
}
// The exact approved PNG stays in the source tree as the master; do not publish
// its 1.5 MB original to the static site. All variants derive from that same file.
const variants=[
  {name:'bong-goggles-header-256.webp',width:256,format:'webp',options:{quality:86,effort:6}},
  {name:'bong-goggles-browser-512.webp',width:512,format:'webp',options:{quality:88,effort:6}},
  {name:'favicon-32.png',width:32,format:'png',options:{compressionLevel:9}},
  {name:'favicon-192.png',width:192,format:'png',options:{compressionLevel:9}},
];
for(const variant of variants){
  const path=resolve(out,variant.name);
  await sharp(master).resize(variant.width,variant.width,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).toFormat(variant.format,variant.options).toFile(path);
  if((await stat(path)).size>128*1024)throw new Error(`optimized branding asset exceeds 128 KiB: ${variant.name}`);
}
// CCC-ART-8: publish a manifest derived from approved PNG masters and actual WebP/SVG exports.
const imageManifest=await createChaosImageManifest({sourceRoot:root,outputRoot:out});
await writeFile(resolve(out,CHAOS_IMAGE_MANIFEST_PATH),JSON.stringify(imageManifest)+'\n');
// The build retains illustrative service origins from the example config.
// Off-chain account opt-in does not authorize a production or on-chain release.
await writeFile(resolve(out,'runtime-config.json'),JSON.stringify(runtimeConfig,null,2)+'\n');
console.log('Bong Goggles web build created dist/ (approved branding, 49 optimized game cards, 6 verified atlas layers and 6 vehicle tokens; accountSocial='+runtimeConfig.features.accountSocial+'; example service origins; NOT a release authorization)');
