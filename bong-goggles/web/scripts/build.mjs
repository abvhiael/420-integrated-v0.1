import {SALAD_ART} from '../core/word-salad-ui.js';
import {cp,mkdir,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {DASHBOARD_ASSETS} from '../core/dashboard-art.js';
import {CHAOS_CARD_ART_SOURCES,CHAOS_CARD_ART_OUTPUTS} from '../core/chaos-card-art.js';
import {CHAOS_MAP_ASSETS} from '../core/chaos-map-art.js';
import {CHAOS_VEHICLE_ASSETS} from '../core/chaos-vehicles.js';
import {verifyChaosVehicleArt} from './verify-chaos-vehicle-art.mjs';
import {CHAOS_IMAGE_MANIFEST_PATH,createChaosImageManifest} from './verify-chaos-image-manifest.mjs';
import {verifyChaosMapArt} from './verify-chaos-map-art.mjs';
import sharp from 'sharp';
import {chessArt,chessArtPrefix,chessArtBudget} from './chess-art.mjs';
import {LABYRINTH_HOLE_CENTERS} from '../core/labyrinth-hole-survey.js';
import {verifyChaosCardCatalog} from './verify-chaos-card-catalog.mjs';
import {validateRuntimeConfig} from '../core/runtime-config.js';
import {ACCOUNT_SOCIAL_BUILD_FLAG,CLASSIC_ROOMS_BUILD_FLAG,CLASSIC_COMMUNICATIONS_BUILD_FLAG,withAccountSocialBuildFlags,resolveClassicBuildFlags} from './account-social-build-config.mjs';

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
const accountFlag=process.env[ACCOUNT_SOCIAL_BUILD_FLAG];
const flags=resolveClassicBuildFlags({account:accountFlag,rooms:process.env[CLASSIC_ROOMS_BUILD_FLAG],
 communications:process.env[CLASSIC_COMMUNICATIONS_BUILD_FLAG],pages:process.env.CF_PAGES,
 branch:process.env.CF_PAGES_BRANCH});
const runtimeConfig=withAccountSocialBuildFlags(example,accountFlag,flags.rooms,flags.communications);
// BC-3 release: main Pages only by default; explicit false is an operator rollback.
const chessFlag=process.env.BG_CHESS_ACTIVATION;
if(chessFlag!==undefined&&!['true','false'].includes(chessFlag))throw Error('BG_CHESS_ACTIVATION must be exactly true or false');
const chessOn=chessFlag==='true'||(chessFlag===undefined&&process.env.CF_PAGES==='1'&&process.env.CF_PAGES_BRANCH==='main'&&runtimeConfig.features.classicCommunications);
if(chessOn&&!runtimeConfig.features.classicCommunications)throw Error('Chess requires authenticated Classic rooms and communications');
runtimeConfig.features.chessRestricted=Boolean(chessOn);
const saladFlag=process.env.BG_WORD_SALAD_ACTIVATION;
if(saladFlag!==undefined&&!['true','false'].includes(saladFlag))throw Error('Invalid BG_WORD_SALAD_ACTIVATION');
const saladOn=saladFlag==='true'||(saladFlag===undefined&&process.env.CF_PAGES==='1'&&process.env.CF_PAGES_BRANCH==='main'&&runtimeConfig.features.classicCommunications);
if(saladOn&&!runtimeConfig.features.classicCommunications)throw Error('Word Salad requires authenticated Classic rooms and communications');
runtimeConfig.features.wordSaladProduction=Boolean(saladOn);
validateRuntimeConfig(runtimeConfig);

for(const item of ['index.html','app.js','styles.css','game-kit.css','classic-communications.css','settings.css','branding.css','feed-branding.css','dashboard.css','classics.css','ccc-tabletop.css','ccc-practice.css','cribbage.css','labyrinth.css','chess.css','word-salad.css','welcome-landscape.svg','core','_headers']){
  await cp(resolve(root,item),resolve(out,item),{recursive:true});
}
// Word Salad: publish only explicit, validated approved PNG artwork.
for(const asset of SALAD_ART){
 const relative='assets/games/word-salad/'+asset;
 const source=resolve(root,relative),target=resolve(out,relative);
 const meta=await sharp(source).metadata();
 if(meta.format!=='png'||!meta.width||!meta.height||meta.width>4096||meta.height>4096||(await stat(source)).size>8*1024*1024)throw Error('Invalid Word Salad artwork: '+relative);
 await mkdir(dirname(target),{recursive:true});await cp(source,target);
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
// Publish only the approved Chess art, not raw uploads or placeholder files.
let chessArtBytes=0;
for(const [name,width,transparent,cap] of chessArt){
 const source=resolve(root,chessArtPrefix+name+'.png'),target=resolve(out,chessArtPrefix+name+'.webp');
 const meta=await sharp(source).metadata();
 if(meta.format!=='png'||!meta.width||!meta.height||(transparent&&!meta.hasAlpha))throw Error('Invalid Chess artwork '+name);
 await mkdir(dirname(target),{recursive:true});
 await sharp(source).resize({width,withoutEnlargement:true}).webp({quality:80,effort:6}).toFile(target);
 const size=(await stat(target)).size;
 if(size>cap)throw Error('Chess art exceeds file budget '+name);
 chessArtBytes+=size;
}
if(chessArtBytes>chessArtBudget)throw Error('Chess art exceeds independent image budget');
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
// BC-1.4: publish only the creator-approved, self-contained leaf board.
// Its embedded optimized WebP is source-owned; no remote images are trusted.
const cribbageLeafRelative='assets/games/cribbage/leaf-board.svg';
const cribbageLeafSource=resolve(root,cribbageLeafRelative);
const cribbageLeaf=await readFile(cribbageLeafSource,'utf8');
const embeddedArt=cribbageLeaf.match(/data:image\/webp;base64,([A-Za-z0-9+/]+=*)/);
if(!cribbageLeaf.startsWith('<svg ')||!cribbageLeaf.includes('viewBox="0 0 1448 1086"')||
   !cribbageLeaf.trimEnd().endsWith('</svg>')||!embeddedArt||
   embeddedArt[1].length<12000||embeddedArt[1].length>90000||
   cribbageLeaf.includes('<script')||cribbageLeaf.includes('https:')||
   (await stat(cribbageLeafSource)).size>100*1024)
 throw Error('Invalid approved Cribbage gameboard asset');
await mkdir(dirname(resolve(out,cribbageLeafRelative)),{recursive:true});
await cp(cribbageLeafSource,resolve(out,cribbageLeafRelative));
// BC-2.4 original-board publication: never substitute or recompress the
// exact player-supplied PNG, and never widen the frozen BC-1.4 leaf allowance.
// Source is optional until this separate source-art upload is complete;
// an absent original MUST NOT be treated as board qualification.
const labyrinthOriginal='assets/games/labyrinth-cribbage/labyrinth.png';
const labyrinthOriginalPath=resolve(root,labyrinthOriginal);
let labyrinthOriginalPresent=false;
try{
 const bytes=await readFile(labyrinthOriginalPath);
 const image=await sharp(bytes).metadata();
 // GitHub's committed user-approved artwork may use different PNG encoding
 // from the source used to identify the hole centers. Pin the exact uploaded
 // Git blob, not the earlier source's PNG-byte SHA-256.
 const gitBlob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(gitBlob!=='db3f4e88a87bdb1ce9c6f202484bacfbb653cdc2'||
    image.format!=='png'||image.width!==1254||image.height!==1254)
   throw Error('BC-2.4 user-approved GitHub board blob/dimensions mismatch');
 // Validate the *pixel geometry*, not the PNG encoding: the independently
 // surveyed 652 dark circles must still occupy the approved coordinates.
 const {data:grey,info:geometry}=await sharp(bytes).removeAlpha().greyscale()
   .raw().toBuffer({resolveWithObject:true});
 if(geometry.channels!==1||LABYRINTH_HOLE_CENTERS.length!==652||
    LABYRINTH_HOLE_CENTERS.some(({x,y})=>grey[y*geometry.width+x]>75))
   throw Error('BC-2.4 uploaded board does not align with the 652 surveyed holes');
 const target=resolve(out,labyrinthOriginal);
 await mkdir(dirname(target),{recursive:true});
 await cp(labyrinthOriginalPath,target);
 labyrinthOriginalPresent=true;
}catch(e){
 if(e?.code!=='ENOENT')throw e;
 console.warn('BC-2.4 original wood-board PNG is not installed; public Play remains disabled, no alternate image published.');
}


// The player's original uploaded board is the one and only displayed art.
// Pin it to the committed Git blob and copy its actual bytes without edits.
const exactBoard='assets/games/cribbage/board-cannabis-leaf.png';
const canonical=await readFile(resolve(root,exactBoard));
const canonicalSha=createHash('sha1').update(Buffer.from('blob '+canonical.length+'\0')).update(canonical).digest('hex');
if(canonical.length!==2698098||canonicalSha!=='4c358c6cc77b2a6f6dd33865dbf7654de2b60cc0'||
 canonical.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||
 canonical.readUInt32BE(16)!==1448||canonical.readUInt32BE(20)!==1086)
 throw Error('Supplied Cribbage board is missing or altered');
await cp(resolve(root,exactBoard),resolve(out,exactBoard));
const wallpaper='assets/games/cribbage/cribbage-play-wallpaper-casino-lounge';
const wallpaperPNG=await readFile(resolve(root,wallpaper+'.png'));
if(createHash('sha1').update(Buffer.from('blob '+wallpaperPNG.length+'\0')).update(wallpaperPNG).digest('hex')!=='7b2d71add6878a505d8cfc9da3dc4fd77cb1e7d2')throw Error('Cribbage wallpaper differs from approved upload');
await sharp(wallpaperPNG).resize({width:1920,withoutEnlargement:true}).webp({quality:82}).toFile(resolve(out,wallpaper+'.webp'));

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
console.log('BC-2.4 original board published:',labyrinthOriginalPresent);
console.log('Bong Goggles web build created dist/ (approved branding, 49 optimized game cards, 6 verified atlas layers and 6 vehicle tokens; accountSocial='+runtimeConfig.features.accountSocial+'; example service origins; NOT a release authorization)');
