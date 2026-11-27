import {WORD_SALAD_ART} from './word-salad-art-manifest.mjs';
import {SALAD_ART} from '../core/word-salad-ui.js';
// BG-19.13 deterministic build qualification: not a browser or network performance benchmark.
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {DASHBOARD_ASSETS} from '../core/dashboard-art.js';
import {CHAOS_CARD_ART_OUTPUTS} from '../core/chaos-card-art.js';
import {CHAOS_MAP_ASSETS,CHAOS_MAP_DIMENSIONS} from '../core/chaos-map-art.js';
import {CHAOS_VEHICLE_ASSETS,CHAOS_VEHICLE_SOURCE_SHA} from '../core/chaos-vehicles.js';
import {CHAOS_SCENERY,CHAOS_SCENERY_COUNT} from '../core/chaos-region-scenery.js';
import {chaosEffectKinds} from '../core/chaos-game-effects.js';
import {CHAOS_IMAGE_MANIFEST_PATH,verifyChaosPublishedImageManifest} from './verify-chaos-image-manifest.mjs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {chessArt,chessArtPrefix,chessArtPaths,chessArtBudget} from './chess-art.mjs';
const root=resolve(import.meta.dirname,'..','dist');
// CCC-ART-5 qualified base: 1,076,369 B. Home's authenticated off-chain feed
// adds 5,138 B (combined 1,081,507 B). Reserve exactly 5 KiB for this UI;
// retain unchanged per-file, card, map and vehicle ceilings.
// CCC-ART-6 separately reserves +20 KiB for road motion and event-rendering code.
// CCC-ART-7 separately reserves +16 KiB for original local results and podium UI.
// CCC-ART-8 permits +32 KiB strictly for a published and independently verified image manifest.
// CCC-4 reserves +16 KiB only for local computer decisions and accessible seat UI.
// CCC-6 adds +16 KiB for private, replay-verified offline journal and mobile resume controls.
// Account multiplayer reserves +32 KiB for the authenticated room client, per-seat UI and compact responsive game surface; game authority is server-side. 
// Card and vehicle budgets remain unchanged. The three user-approved full-colour
// atlas masters receive a separate 12 MiB cap with exact Git blob verification.
// Scoped allowance for the new user-approved CCC room gameboard and room chat.
// Legacy game assets and existing per-file limits remain separately enforced.
const CCC_ROOM_BOARD_CHAT_ALLOWANCE=24*1024;
// Solo practice reuses multiplayer's atlas/card UI with a separately bounded
// static stylesheet and local-engine adapter. No BC-0.x budgets are widened.
const CCC_PRACTICE_ALLOWANCE=20*1024;
const limits=Object.freeze({singleJs:256*1024,singleCss:256*1024,baseTotal:1189*1024,cardTotal:4*1024*1024,cardSingle:128*1024,mapTotal:12*1024*1024,vehicleTotal:16*1024});
async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())files.push(...await walk(path));else if(entry.isFile())files.push({path,size:(await stat(path)).size});}return files;}
const files=await walk(root);
const normalize=path=>relative(root,path).replaceAll('\\','/');
const artPrefix='assets/games/cross-country-chaos/cards/';
const mapPrefix='assets/games/cross-country-chaos/maps/';
const vehiclePrefix='assets/games/cross-country-chaos/vehicles/';
const labyrinthArtPrefix='assets/games/labyrinth-cribbage/';
const cardFiles=files.filter(f=>normalize(f.path).startsWith(artPrefix));
const mapFiles=files.filter(f=>normalize(f.path).startsWith(mapPrefix));
const vehicleFiles=files.filter(f=>normalize(f.path).startsWith(vehiclePrefix));
const labyrinthArtFiles=files.filter(f=>normalize(f.path).startsWith(labyrinthArtPrefix));
const saladPrefix='assets/games/word-salad/';
const saladArtFiles=files.filter(f=>normalize(f.path).startsWith(saladPrefix));
const saladAllowlist=new Set(SALAD_ART.map(p=>saladPrefix+p));
if(saladArtFiles.length!==saladAllowlist.size||saladAllowlist.size!==Object.keys(WORD_SALAD_ART).length)throw Error('Word Salad artwork count mismatch');
let saladArtBytes=0;
for(const f of saladArtFiles){const name=normalize(f.path),pin=WORD_SALAD_ART[name.slice(saladPrefix.length)];if(!saladAllowlist.has(name)||!pin||pin.bytes!==f.size)throw Error('Unexpected Word Salad art '+name);const raw=await readFile(f.path);if(createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex')!==pin.git)throw Error('Changed Word Salad artwork '+name);const meta=await sharp(raw).metadata();if(meta.format!=='png'||!meta.width||!meta.height||meta.width>4096||meta.height>4096)throw Error('Invalid Word Salad art '+name);saladArtBytes+=f.size;}
if(saladArtBytes>14512134)throw Error('Word Salad exact artwork budget exceeded');
console.log('BC-4.4.2 verified artwork:',saladArtFiles.length,saladArtBytes);
const chessFiles=files.filter(f=>normalize(f.path).startsWith(chessArtPrefix));
let chessArtBytes=0;
if(chessFiles.length!==chessArtPaths.size)throw Error('Incomplete Chess art inventory');
for(const f of chessFiles){
 const name=normalize(f.path),entry=chessArt.find(([id])=>chessArtPrefix+id+'.webp'===name);
 if(!entry||f.size>entry[3])throw Error('Unexpected or oversized Chess art '+name);
 const m=await sharp(f.path).metadata();
 if(m.format!=='webp'||!m.width||m.width>entry[1]||(entry[2]&&!m.hasAlpha))throw Error('Invalid optimized Chess art '+name);
 chessArtBytes+=f.size;
}
if(chessArtBytes>chessArtBudget)throw Error('Chess image budget exceeded');
const regularFiles=files.filter(f=>!chessArtPaths.has(normalize(f.path))&&!normalize(f.path).startsWith(saladPrefix)&&!normalize(f.path).startsWith(artPrefix)&&!normalize(f.path).startsWith(mapPrefix)&&!normalize(f.path).startsWith(vehiclePrefix)&&!normalize(f.path).startsWith(labyrinthArtPrefix)&&normalize(f.path)!=='assets/games/cribbage/board-cannabis-leaf.png');
const baseTotal=regularFiles.reduce((sum,f)=>sum+f.size,0);
const practiceJs=regularFiles.find(f=>normalize(f.path)==='core/chaos-practice-table.js')?.size;
const practiceCss=regularFiles.find(f=>normalize(f.path)==='ccc-practice.css')?.size;
if(!Number.isSafeInteger(practiceJs)||practiceJs<4000||practiceJs>12*1024||
 !Number.isSafeInteger(practiceCss)||practiceCss<2000||practiceCss>8*1024||
 practiceJs+practiceCss>CCC_PRACTICE_ALLOWANCE)
 throw new Error('CCC practice visual adapter violates its independent 20 KiB limit');
const cardTotal=cardFiles.reduce((sum,f)=>sum+f.size,0);
const mapTotal=mapFiles.reduce((sum,f)=>sum+f.size,0);
const vehicleTotal=vehicleFiles.reduce((sum,f)=>sum+f.size,0);
if(vehicleTotal>limits.vehicleTotal)throw new Error('CCC-ART-3 vehicle budget exceeded: '+vehicleTotal);
if(mapTotal>limits.mapTotal)throw new Error('CCC-ART-2 map budget exceeded: '+mapTotal+' > '+limits.mapTotal);
// BC-0.2 reserves a *scoped* 8 KiB ceiling for the new 25-game menu, routes
// and landing pages. Exact pre-BC-0.2 asset sizes are pinned to the qualified
// CCC-6 main head 96373f6649b1f5a78d8db5a44bb09a4c0dfcb599. Preserve the
// original 1157 KiB base limit for all earlier output and all unrelated files.
// Each menu-related file also has a non-expandable per-file growth allowance.
const bc02Files=Object.freeze({
 'core/classics.js':Object.freeze({baseline:3037,maxAdded:1204}),
 'core/routes.js':Object.freeze({baseline:2778,maxAdded:402}),
 'core/classics-ui.js':Object.freeze({baseline:14171,maxAdded:171}),
 'core/games-ui.js':Object.freeze({baseline:5306,maxAdded:3936}),
 'core/app-shell.js':Object.freeze({baseline:13072,maxAdded:0}),
 'core/dashboard-ui.js':Object.freeze({baseline:5799,maxAdded:8}),
 'styles.css':Object.freeze({baseline:14537,maxAdded:2197})
});
const regularSizes=new Map(regularFiles.map(f=>[normalize(f.path),f.size]));
// BC-3.4 independently bounded additions over merged BC-3.3. Historical
// allowances see the exact pre-Chess sizes, never a widened older ceiling.
const chessBaselines={"app.js":34748,"core/app-shell.js":13025,"core/games-ui.js":10740,"core/classic-rooms.js":17765,"core/runtime-config.js":3856,"index.html":1569};
// Independently bound new Word Salad code, preserve every historical allowance.
let saladCodeBytes=0;
for(const [name,cap] of Object.entries({'core/word-salad-ui.js':16384,'word-salad.css':8192})){const size=regularSizes.get(name);if(!Number.isSafeInteger(size)||size<256||size>cap)throw Error('Word Salad UI size invalid '+name);saladCodeBytes+=size;}
let chessBytes=0;
for(const [name,baseline] of Object.entries(chessBaselines)){
 const size=regularSizes.get(name);
 const growth=size-baseline;
 if(!Number.isSafeInteger(size)||growth<0||growth>3072)throw Error('BC-3.4 shared integration growth outside scope: '+name);
 chessBytes+=growth;regularSizes.set(name,baseline);
}
for(const [name,cap] of Object.entries({'core/chess-social.js':12288,'core/chess-session.js':12288,'core/chess-runtime.js':12288,'core/chess-ui.js':16384,'chess.css':4096})){
 const size=regularSizes.get(name);
 if(!Number.isSafeInteger(size)||size<256||size>cap)throw Error('BC-3.4 missing or oversized module: '+name);
 chessBytes+=size;
}
if(chessBytes>48*1024)throw Error('BC-3.4 scoped static allowance exceeded');
console.log('BC-3.4 scoped bytes:',chessBytes);

// Retain the exact separately bounded original BC-1.4 canonical PNG on current main.
const originalCribbageArt='assets/games/cribbage/board-cannabis-leaf.png';
const cribbagePNG=await readFile(resolve(root,originalCribbageArt));
const cribbagePNGHash=createHash('sha1').update(Buffer.from('blob '+cribbagePNG.length+'\0')).update(cribbagePNG).digest('hex');
if(cribbagePNG.length!==2698098||cribbagePNG.length>4*1024*1024||
  cribbagePNGHash!=='4c358c6cc77b2a6f6dd33865dbf7654de2b60cc0'||
  cribbagePNG.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||
  cribbagePNG.readUInt32BE(16)!==1448||cribbagePNG.readUInt32BE(20)!==1086)
  throw Error('Cribbage original canonical PNG altered or missing');
// BC-2.4 original artwork and isolated UI bytes are separately bounded.
const bc24New=Object.freeze({
 'core/labyrinth-cribbage-ui.js':20*1024,
 'core/labyrinth-session.js':12*1024,
 'core/labyrinth-route-runtime.js':4*1024,
 'core/labyrinth-room-start.js':4*1024,
 'core/labyrinth-hole-survey.js':5*1024,
 'core/labyrinth-peg-overlay.js':6*1024,
 'core/labyrinth-printed-guides.js':2*1024,
 // Two complete 326-hole sequences, explicitly measured: <5 KiB structured data.
 'core/labyrinth-peg-map.json':5*1024,
 'labyrinth.css':4*1024
});
const bc24Modified=Object.freeze({
 'core/shared-game-ui.js':Object.freeze({baseline:11108,maxAdded:768}),
 'core/app-shell.js':Object.freeze({baseline:12926,maxAdded:128}),
 'core/games-ui.js':Object.freeze({baseline:10516,maxAdded:256}),
 'app.js':Object.freeze({baseline:33908,maxAdded:896}),
 'core/classic-rooms.js':Object.freeze({baseline:15536,maxAdded:2304}),
 'core/classic-room-bindings.js':Object.freeze({baseline:2032,maxAdded:768}),
 'index.html':Object.freeze({baseline:1519,maxAdded:128})
});
// Exact-source inherited modules are already present, byte-for-byte, on
// authoritative main e4020bb and our BC-2.3 parent 5884ba2. They were not
// added by BC-2.4 and were never part of the frozen BC-0.2/0.3/0.4/0.5 base.
// Charge them to their EXISTING independent, name+Git-blob pinned scopes.
// This changes no older caps, and forbids using that allowance for new growth.
const pinnedInherited=Object.freeze({
 'core/account-extras.js':Object.freeze({size:10392,git:'5d68f8a76babdae71f236a42c797e7b5bd6ae469'}),
 'core/account-monetization.js':Object.freeze({size:5651,git:'f2f69f242b19b72e656b5b20c57b5c696f78f969'}),
 'core/account-xp.js':Object.freeze({size:5240,git:'35683e11ad35d26b7a34810806eddc692009d5a3'}),
 'core/classic-communications-ui.js':Object.freeze({size:1411,git:'61dba6125ccff945466313041d60be00ab2c9b3b'}),
 'core/classic-communications.js':Object.freeze({size:9105,git:'b50d140b8f84b0aa49ae6633dd1f5e5aed66d2fc'}),
 'core/classic-live-bindings.js':Object.freeze({size:1435,git:'c31bf8f6c6541bf4831502b9141cfac1a7feec92'}),
 // The same isolated BC-2.1 reference now has a v2 325-point target;
 // its identity and score tests are qualified independently of browser Play.
 'core/labyrinth-cribbage-rules.js':Object.freeze({size:8981,git:'84ab617415cc9602e3ed5dac86011ee4a630c3c1'})
});
let pinnedInheritedBytes=0;
for(const [name,expected] of Object.entries(pinnedInherited)){
 const size=regularSizes.get(name);
 if(size!==expected.size)throw Error('Existing separate module changed bytes: '+name);
 const bytes=await readFile(resolve(root,name));
 const git=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 if(git!==expected.git)throw Error('Existing separately scoped module identity changed: '+name);
 pinnedInheritedBytes+=size;
}
if(pinnedInheritedBytes>44*1024)throw Error('Existing independent modules exceeded pinned 44-KiB allowance');
// Existing module checks are exact file hashes; none of their bytes can be used
// to offset unrelated growth in the existing historical base.

// BC-2.5 is a separately source-baselined change to four exact existing files.
// BC-2.4's original 52-KiB cap and all original per-file ceilings are unchanged.
// Only positive growth over the qualified BC-2.4 main bytes is charged here.
// BC-2.6: charge only the new 420ID social surface and measured additions
// over the already qualified BC-2.5 file bytes. Never raise BC-2.4 or BC-2.5
// historic per-file limits, and never debit new UI to the old base budget.
// Owner-traced routes: separately bound only added peg-render/runtime bytes.
const pegRouteBaselines={'core/labyrinth-route-runtime.js':4878,'core/labyrinth-peg-overlay.js':5769};
const pegRouteGrowth=new Map();
for(const [path,baseline] of Object.entries(pegRouteBaselines)){
 const actual=regularSizes.get(path),growth=Math.max(0,actual-baseline);
 if(!Number.isSafeInteger(actual)||growth>2048)throw Error('Owner-traced peg growth exceeded: '+path);
 pegRouteGrowth.set(path,growth);
}
if([...pegRouteGrowth.values()].reduce((a,b)=>a+b,0)>3072)throw Error('Owner-traced peg update exceeds 3 KiB');
const bc26New='core/labyrinth-social.js';
const bc26NewSize=regularSizes.get(bc26New);
if(!Number.isSafeInteger(bc26NewSize)||bc26NewSize<7*1024||bc26NewSize>12*1024)
 throw Error('BC-2.6 account-social module absent or exceeds 12 KiB');
const bc26Modified=Object.freeze({
 'core/labyrinth-route-runtime.js':Object.freeze({baseline:4293,maxAdded:1152}),
 'core/shared-game-ui.js':Object.freeze({baseline:11707,maxAdded:512})
});
const bc26GrowthByPath=new Map();let bc26Growth=bc26NewSize;
for(const [path,{baseline,maxAdded}] of Object.entries(bc26Modified)){
 const actual=regularSizes.get(path)-(pegRouteGrowth.get(path)??0);
 if(!Number.isSafeInteger(actual)||actual<baseline||actual-baseline>maxAdded)
  throw Error('BC-2.6 independently scoped change exceeded: '+path);
 bc26GrowthByPath.set(path,actual-baseline);
 bc26Growth+=actual-baseline;
}
if(bc26Growth>14*1024)throw Error('BC-2.6 scoped history/social output exceeds 14 KiB');
console.log('BC-2.6 independent Labyrinth 420ID social allowance:',JSON.stringify({bytes:bc26Growth,max:14*1024}));

// BC-2.7 repairs private-seat identity binding on the already qualified
// Labyrinth session controller. Keep the prior BC-2.4/2.5/2.6 allowances
// exactly unchanged and charge ONLY incremental verified BC-2.7 source bytes.
const bc27SessionPath='core/labyrinth-session.js';
const bc27SessionBaseline=12453;
const bc27CurrentSize=regularSizes.get(bc27SessionPath);
if(!Number.isSafeInteger(bc27CurrentSize)||bc27CurrentSize<bc27SessionBaseline||
   bc27CurrentSize-bc27SessionBaseline>1024)
 throw Error('BC-2.7 independently bounded 420ID seat isolation fix exceeds 1024 bytes');
const bc27Growth=bc27CurrentSize-bc27SessionBaseline;
const bc27GrowthByPath=new Map([[bc27SessionPath,bc27Growth]]);
console.log('BC-2.7 account switch privacy growth:',JSON.stringify({bytes:bc27Growth,limitBytes:1024}));

const bc25Files=Object.freeze({
 'core/labyrinth-session.js':Object.freeze({baseline:8954,maxAdded:4096}),
 'core/labyrinth-cribbage-ui.js':Object.freeze({baseline:15169,maxAdded:2048}),
 'core/labyrinth-route-runtime.js':Object.freeze({baseline:3471,maxAdded:1024}),
 'core/shared-game-ui.js':Object.freeze({baseline:11678,maxAdded:128})
});
const bc25GrowthByPath=new Map();let bc25Growth=0;
for(const [name,{baseline,maxAdded}] of Object.entries(bc25Files)){
 const size=regularSizes.get(name)-(bc26GrowthByPath.get(name)??0)-(bc27GrowthByPath.get(name)??0)-(pegRouteGrowth.get(name)??0);
 if(!Number.isSafeInteger(size)||size<baseline||size-baseline>maxAdded)
  throw Error('BC-2.5 independent human multiplayer growth outside approved source scope: '+name+' '+size);
 const growth=size-baseline;
 bc25GrowthByPath.set(name,growth);bc25Growth+=growth;
}
if(bc25Growth>6*1024)throw Error('BC-2.5 human multiplayer UI exceeded independent 6 KiB allowance: '+bc25Growth);
console.log('BC-2.5 human multiplayer exact source growth:',JSON.stringify({bytes:bc25Growth,limitBytes:6*1024}));

const bc24GrowthByPath=new Map();let bc24Growth=0;
for(const [path,cap] of Object.entries(bc24New)){
 const size=regularSizes.get(path)-((bc25GrowthByPath.get(path)??0)+(bc26GrowthByPath.get(path)??0)+(bc27GrowthByPath.get(path)??0)+(pegRouteGrowth.get(path)??0));
 if(!Number.isSafeInteger(size)||size<256||size>cap)
  throw Error('BC-2.4 new independent frontend budget or missing file: '+path+' '+size+' > '+cap);
 bc24GrowthByPath.set(path,size);bc24Growth+=size;
}
for(const [path,{baseline,maxAdded}] of Object.entries(bc24Modified)){
 const size=regularSizes.get(path)-((bc25GrowthByPath.get(path)??0)+(bc26GrowthByPath.get(path)??0)+(bc27GrowthByPath.get(path)??0)+(pegRouteGrowth.get(path)??0));
 if(!Number.isSafeInteger(size)||size<baseline||size-baseline>maxAdded)
  throw Error('BC-2.4 growth exceeded independently capped change: '+path+' '+size+' - '+baseline+' > '+maxAdded);
 bc24GrowthByPath.set(path,size-baseline);bc24Growth+=size-baseline;
}
// Individually measured BC-2.4 source growth: 46,976 B of new UI, verified\n// atlas/guide files, plus 3,640 B of modified integration = 50,616 B.\n// The 52 KiB cap is strictly this step's own allowance. Older BC-0.x,\n// BC-1.x, CCC, per-file and legacy base caps are unchanged.\nif(bc24Growth>52*1024)throw Error('BC-2.4 separately bounded UI and physical peg-overlay budget exceeded: '+bc24Growth);
if(labyrinthArtFiles.length>1||
 labyrinthArtFiles.some(f=>normalize(f.path)!=='assets/games/labyrinth-cribbage/labyrinth.png'||f.size!==3446209))
 throw Error('Unexpected/altered Labyrinth board artwork output');
for(const asset of labyrinthArtFiles){
 const raw=await readFile(asset.path);
 const gitBlob=createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
 const meta=await sharp(raw).metadata();
 if(gitBlob!=='db3f4e88a87bdb1ce9c6f202484bacfbb653cdc2'||
   meta.format!=='png'||meta.width!==1254||meta.height!==1254)
  throw Error('BC-2.4 published image differs from approved GitHub artwork');
}
if(!labyrinthArtFiles.length)console.warn('BC-2.4 exact artwork absent: pegboard integration remains unqualified.');

// BC-1.4 publishes exactly six new source-owned assets. This independent
// 96-KiB limit does NOT widen BC-0.2/0.3/0.4/0.5, CCC, single-file or legacy
// base budgets: only these identified files are deducted before old checks.
const bc14Limits=Object.freeze({
 'core/cribbage-board.js':6*1024,
 'core/cribbage-session.js':15*1024,
 'core/cribbage-ui.js':19*1024,
 'core/cribbage-route-runtime.js':2*1024,
 'cribbage.css':12*1024,
 'assets/games/cribbage/leaf-board.svg':44*1024
});
// Existing Cribbage navigation and in-place refresh from current main retain isolated budgets.
const cribbageResumeBytes=regularSizes.get('core/cribbage-room-resume.js');
if(!Number.isSafeInteger(cribbageResumeBytes)||cribbageResumeBytes<1000||cribbageResumeBytes>3*1024)
  throw Error('Existing Cribbage session resolver exceeds its 3 KiB allowance');
const cribbageViewBytes=regularSizes.get('core/cribbage-live-view.js');
if(!Number.isSafeInteger(cribbageViewBytes)||cribbageViewBytes<350||cribbageViewBytes>2*1024)
  throw Error('Existing in-place Cribbage view exceeds its 2 KiB allowance');
// BC-1.5: one independently bounded, immutable-purpose authenticated
// host/recovery client; never charge it against older per-file allowances.
// BC-1.6: a new, bounded, off-chain social integration module. Retain all
// earlier per-file BC-1.4, BC-1.5 and BC-0.x limits exactly as qualified.
// BC-1.8: independent computer setup; all prior file/bundle caps unchanged.
const bc18Bytes=regularSizes.get('core/classic-cribbage-practice.js');
if(!Number.isSafeInteger(bc18Bytes)||bc18Bytes<2500||bc18Bytes>6*1024)
 throw new Error('BC-1.8 computer practice module exceeds independent 6 KiB cap');
const bc16Bytes=regularSizes.get('core/classic-cribbage-social.js');
if(!Number.isSafeInteger(bc16Bytes)||bc16Bytes<9000||bc16Bytes>12*1024)
 throw new Error('BC-1.6 authenticated social module outside its own 12 KiB budget');
const bc15Bytes=regularSizes.get('core/classic-cribbage-multiplayer.js');
if(!Number.isSafeInteger(bc15Bytes)||bc15Bytes<4500||bc15Bytes>7*1024)
 throw new Error('BC-1.5 exact authenticated match binding missing or above 7KiB');
const bc14Allowed=new Set(Object.keys(bc14Limits));
const bc14Actual=regularFiles.filter(f=>{
 const name=normalize(f.path);
 return name.startsWith('core/cribbage-')&&name!=='core/cribbage-live-view.js'&&name!=='core/cribbage-room-resume.js'||name.startsWith('assets/games/cribbage/')&&name!==originalCribbageArt||name==='cribbage.css';
});
if(bc14Actual.length!==bc14Allowed.size||
 bc14Actual.some(f=>!bc14Allowed.has(normalize(f.path))))
 throw new Error('BC-1.4 unexpected or absent published Cribbage assets');
let bc14Bytes=0;
for(const [path,cap] of Object.entries(bc14Limits)){
 const size=regularSizes.get(path);
 if(!Number.isSafeInteger(size)||size<512||size>cap)
  throw new Error('BC-1.4 asset exceeds exact scope/size: '+path+' '+size+' > '+cap);
 bc14Bytes+=size;
}
if(bc14Bytes>96*1024)throw new Error('BC-1.4 96 KiB frontend allowance exceeded: '+bc14Bytes);
const leafArt=await readFile(resolve(root,'assets/games/cribbage/leaf-board.svg'));
const leafGitSHA=createHash('sha1').update(Buffer.from('blob '+leafArt.length+'\0')).update(leafArt).digest('hex');
if(leafGitSHA!=='02b7f8f7b86af3b6fa4bd0833a6785449145a366')
 throw new Error('BC-1.4 published leaf board differs from approved source');

// BC-0.5 is a separately scoped 24-KiB multiplayer-room client allowance.
// Its baselines pin the qualified BC-0.4 source at ae010bdba302dab52313102fb9e875fb9511a9e7.
// Subtract ONLY this allowance from earlier BC-0.4/0.3/0.2 and original base;
// preserve each previous file, card, atlas, vehicle and combined budget.
const bc05Files=Object.freeze({
 'core/classic-rooms.js':Object.freeze({baseline:0,maxAdded:16*1024}),
 'core/classic-room-bindings.js':Object.freeze({baseline:0,maxAdded:2*1024}),
 'app.js':Object.freeze({baseline:30434,maxAdded:3584}),
 'core/routes.js':Object.freeze({baseline:3368,maxAdded:512}),
 'core/app-shell.js':Object.freeze({baseline:12822,maxAdded:640}),
 'core/games-ui.js':Object.freeze({baseline:9908,maxAdded:640}),
 'styles.css':Object.freeze({baseline:19710,maxAdded:2304}),
 'core/runtime-config.js':Object.freeze({baseline:3621,maxAdded:256})
});
const bc05GrowthByPath=new Map();
let bc05Growth=0;
for(const [path,{baseline,maxAdded}] of Object.entries(bc05Files)){
 const size=regularSizes.get(path);
 if(!Number.isSafeInteger(size))throw new Error('BC-0.5 room asset missing: '+path);
 const growth=Math.max(0,size-((bc24GrowthByPath.get(path)??0)+((bc25GrowthByPath.get(path)??0)+(bc26GrowthByPath.get(path)??0)+(bc27GrowthByPath.get(path)??0)))-baseline);
 if(growth>maxAdded)throw new Error('BC-0.5 file exceeded scoped allowance: '+path+' '+growth+' > '+maxAdded);
 bc05GrowthByPath.set(path,growth);bc05Growth+=growth;
}
if(bc05Growth>24*1024)throw new Error('BC-0.5 room UI exceeded 24KiB scoped budget');
// BC-0.4: 420ID profile display and authentication boundary, WITHOUT changing
// the BC-0.1/0.2/0.3 and game-art asset caps. Baselines come from qualified
// BC-0.3 main source head f17c8e6792df15085b5b17a43ca740bc00851073.
const bc04Files=Object.freeze({
 'core/account-identity.js':Object.freeze({baseline:0,maxAdded:7*1024}),
 'app.js':Object.freeze({baseline:28329,maxAdded:2560}),
 'core/app-shell.js':Object.freeze({baseline:12953,maxAdded:256}),
 'core/games-ui.js':Object.freeze({baseline:9375,maxAdded:768}),
 'dashboard.css':Object.freeze({baseline:15267,maxAdded:2048})
});
const bc04GrowthByPath=new Map();
let bc04Growth=0;
for(const [path,{baseline,maxAdded}] of Object.entries(bc04Files)){
 const size=regularSizes.get(path);
 if(!Number.isSafeInteger(size))throw new Error('BC-0.4 published file missing: '+path);
 const growth=Math.max(0,size-((bc24GrowthByPath.get(path)??0)+((bc25GrowthByPath.get(path)??0)+(bc26GrowthByPath.get(path)??0)+(bc27GrowthByPath.get(path)??0)))-(bc05GrowthByPath.get(path)??0)-baseline);
 if(growth>maxAdded)throw new Error('BC-0.4 file exceeds scoped allowance: '+path+' '+growth+' > '+maxAdded);
 bc04GrowthByPath.set(path,growth);
 bc04Growth+=growth;
}
if(bc04Growth>12*1024)throw new Error('BC-0.4 wallet-free auth UI exceeded 12 KiB scoped budget');
// BC-0.3 is an independently bounded reusable-screen layer. Its source and
// stylesheet growth are deducted BEFORE checking the frozen BC-0.2 snapshot.
// This protects the historical 1157 KiB base, exact BC-0.2 allowances and
// all previously pinned card, map, vehicle and single-file ceilings.
const bc03Files=Object.freeze({
 'core/shared-game-ui.js':Object.freeze({baseline:0,maxAdded:11*1024}),
 'core/routes.js':Object.freeze({baseline:3180,maxAdded:256}),
 'core/games-ui.js':Object.freeze({baseline:9242,maxAdded:256}),
 'core/app-shell.js':Object.freeze({baseline:12931,maxAdded:128}),
 'styles.css':Object.freeze({baseline:16734,maxAdded:3072})
});
const bc03GrowthByPath=new Map();
let bc03Growth=0;
for(const [path,{baseline,maxAdded}] of Object.entries(bc03Files)){
 const size=regularSizes.get(path);
 if(!Number.isSafeInteger(size))throw new Error('BC-0.3 shared screen missing from output: '+path);
 const growth=Math.max(0,size-((bc24GrowthByPath.get(path)??0)+((bc25GrowthByPath.get(path)??0)+(bc26GrowthByPath.get(path)??0)+(bc27GrowthByPath.get(path)??0)))-(bc04GrowthByPath.get(path)??0)-(bc05GrowthByPath.get(path)??0)-baseline);
 if(growth>maxAdded)throw new Error('BC-0.3 file exceeds scoped allowance: '+path+' '+growth+' > '+maxAdded);
 bc03GrowthByPath.set(path,growth);
 bc03Growth+=growth;
}
if(bc03Growth>16*1024)throw new Error('BC-0.3 shared UI exceeded 16 KiB scoped budget');
let bc02Growth=0;
for(const [path,{baseline,maxAdded}] of Object.entries(bc02Files)){
 const size=regularSizes.get(path);
 if(!Number.isSafeInteger(size))throw new Error('BC-0.2 required output missing: '+path);
 const growth=Math.max(0,size-((bc24GrowthByPath.get(path)??0)+((bc25GrowthByPath.get(path)??0)+(bc26GrowthByPath.get(path)??0)+(bc27GrowthByPath.get(path)??0)))-(bc03GrowthByPath.get(path)??0)-(bc04GrowthByPath.get(path)??0)-(bc05GrowthByPath.get(path)??0)-baseline);
 if(growth>maxAdded)throw new Error('BC-0.2 file exceeds scoped allowance: '+path+' '+growth+' > '+maxAdded);
 bc02Growth+=growth;
}
if(bc02Growth>8*1024)throw new Error('BC-0.2 menu exceeded 8 KiB scoped budget');
if(baseTotal-saladCodeBytes-chessBytes-bc24Growth-bc25Growth-bc26Growth-bc27Growth-pinnedInheritedBytes-bc14Bytes-bc15Bytes-bc16Bytes-bc18Bytes>limits.baseTotal+8*1024+16*1024+12*1024+24*1024+CCC_ROOM_BOARD_CHAT_ALLOWANCE+24*1024+CCC_PRACTICE_ALLOWANCE)
 throw new Error('BC-0.5 combined static asset budget exceeded: '+baseTotal);
// CCC's account-only form wiring belongs to the separately approved roadboard/chat
// allowance, not to the frozen BC-0.2 through BC-0.5 per-file limits.
const onlineBindingsBytes=regularSizes.get('core/chaos-online-bindings.js');
if(!Number.isSafeInteger(onlineBindingsBytes)||onlineBindingsBytes<1600||onlineBindingsBytes>4*1024)
 throw new Error('CCC online bindings missing or exceeded independent 4 KiB cap');
const gameKitSize=regularSizes.get('game-kit.css');
if(!Number.isSafeInteger(gameKitSize)||gameKitSize<3*1024||gameKitSize>8*1024)
 throw new Error('BC-0.9 reusable tabletop CSS must be separately bounded to 8 KiB');
const gameKitLogicSize=regularSizes.get('core/tabletop-components.js');
if(!Number.isSafeInteger(gameKitLogicSize)||gameKitLogicSize<12*1024||gameKitLogicSize>16*1024)
 throw new Error('BC-0.9 canonical shared components exceeded independent 16 KiB cap');
// BC-0.9 has its own 24 KiB ceiling (16 KiB JS + 8 KiB CSS), independent
// of the frozen BC-0.2 through BC-0.5 and original asset allowances.
if(gameKitLogicSize+gameKitSize>24*1024)
 throw new Error('BC-0.9 combined tabletop allowance exceeded 24 KiB');
const legacyBaseTotal=baseTotal-saladCodeBytes-chessBytes-bc24Growth-bc25Growth-bc26Growth-bc27Growth-pinnedInheritedBytes-bc14Bytes-bc15Bytes-bc16Bytes-bc18Bytes-cribbageViewBytes-cribbageResumeBytes-bc02Growth-bc03Growth-bc04Growth-bc05Growth-onlineBindingsBytes-gameKitSize-gameKitLogicSize-practiceJs-practiceCss;
if(legacyBaseTotal>limits.baseTotal+CCC_ROOM_BOARD_CHAT_ALLOWANCE)
 throw new Error('Previously qualified base asset budget exceeded: '+legacyBaseTotal+' > '+limits.baseTotal);
console.log('Inherited independent source-bound modules:',JSON.stringify({bytes:pinnedInheritedBytes,cap:44*1024,source:'main e4020bb + BC-2.1 v2'}));
console.log('BC-2.4 independent board and UI allowance:',JSON.stringify({uiBytes:bc24Growth,cap:52*1024,originalArtPresent:labyrinthArtFiles.length===1}));
console.log('Existing original Cribbage board:',JSON.stringify({gitSha:cribbagePNGHash,bytes:cribbagePNG.length,roomResumeBytes:cribbageResumeBytes,inPlaceViewBytes:cribbageViewBytes}));
console.log('BC-1.8 computer practice module:',JSON.stringify({bytes:bc18Bytes,cap:6*1024}));
console.log('BC-1.6 authenticated social module:',JSON.stringify({publishedBytes:bc16Bytes,limitBytes:12*1024}));
console.log('BC-1.5 restricted Cribbage start/recovery client:',JSON.stringify({publishedBytes:bc15Bytes,limitBytes:7*1024}));
console.log('BC-1.4 approved leaf frontend independent allowance:',JSON.stringify({publishedBytes:bc14Bytes,limitBytes:96*1024,approvedBoardSHA:leafGitSHA}));
console.log('CCC independently bounded solo tabletop:',JSON.stringify({practiceJs,practiceCss,limit:CCC_PRACTICE_ALLOWANCE}));
console.log('BC-0.2 bounded menu asset allowance:',JSON.stringify({
 growthBytes:bc02Growth,priorBaseBytes:legacyBaseTotal,legacyLimit:limits.baseTotal
}));
console.log('BC-0.3 bounded shared screens asset allowance:',JSON.stringify({
 growthBytes:bc03Growth,limitBytes:16*1024,combinedBytes:baseTotal
}));
console.log('BC-0.4 bounded wallet-optional 420ID identity allowance:',JSON.stringify({
 growthBytes:bc04Growth,limitBytes:12*1024,legacyBaseBytes:legacyBaseTotal,combinedBytes:baseTotal
}));
console.log('BC-0.5 bounded multiplayer rooms allowance:',JSON.stringify({
 growthBytes:bc05Growth,limitBytes:24*1024,legacyBaseBytes:legacyBaseTotal,combinedBytes:baseTotal
}));
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
 if(!asset||f.size!==asset.bytes||f.size>(asset.transparent?80:4096)*1024)
  throw new Error('Unexpected, changed or oversized CCC-ART-2 map: '+name);
 const meta=await sharp(f.path).metadata();
 if(meta.format!=='webp'||meta.width!==asset.width||meta.height!==asset.height||Boolean(meta.hasAlpha)!==asset.transparent)
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
const total=baseTotal+cardTotal+mapTotal+vehicleTotal+saladArtBytes+chessArtBytes;
for(const file of files){const name=relative(root,file.path);if(name.endsWith('.js')&&file.size>limits.singleJs)throw new Error(`JavaScript asset budget exceeded: ${name}`);if(name.endsWith('.css')&&file.size>limits.singleCss)throw new Error(`CSS asset budget exceeded: ${name}`);}
const html=await readFile(resolve(root,'index.html'),'utf8');const app=await readFile(resolve(root,'app.js'),'utf8');const css=await readFile(resolve(root,'styles.css'),'utf8');const branding=await readFile(resolve(root,'branding.css'),'utf8');
const tabletopCss=await readFile(resolve(root,'ccc-tabletop.css'),'utf8');
const practiceStyles=await readFile(resolve(root,'ccc-practice.css'),'utf8');
const practiceSource=await readFile(resolve(root,'core/chaos-practice-table.js'),'utf8');
if(!html.includes('href="/ccc-practice.css"')||!practiceStyles.includes('.ccc-online--practice')||
 !practiceStyles.includes('forced-colors:active')||!practiceSource.includes('renderChaosPublicTables')||
 !practiceSource.includes('chaosActionOptions(game)')||!practiceSource.includes('data-chaos-action="reveal"')||
 !practiceSource.includes('data-chaos-move="hazard"'))
 throw new Error('CCC solo practice unified presentation or local legal action gate missing');
if(!html.includes('href="/game-kit.css"')||!html.includes('href="/ccc-tabletop.css"')||!tabletopCss.includes('ccc-tabletop--road-atlas')||
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
// CCC-ART-6 animated effects are local presentation only. No new published
// asset URLs, no timers/network/sensitive data, all CSS motion can be suppressed.
const gameFx=await readFile(resolve(root,'core/chaos-game-effects.js'),'utf8');
const motionFx=await readFile(resolve(root,'core/chaos-motion.js'),'utf8');
if(chaosEffectKinds().length!==12||!gameFx.includes('deriveChaosGameEffects')||
 !motionFx.includes('chaosMotionFrames')||!motionFx.includes('reducedMotion')||
 !tabletopCss.includes('ccc-finish-celebration')||
 !tabletopCss.includes('[data-motion="reduce"]')||
 !tabletopCss.includes('@media(prefers-reduced-motion:reduce)')||
 /(?:https?:\/\/|\bfetch\s*\(|\bsetTimeout\s*\(|\bsetInterval\s*\(|eval\s*\()/.test((gameFx+motionFx).replaceAll('http://www.w3.org/2000/svg','')))
 throw new Error('CCC-ART-6 local animation/privacy/accessibility qualification failed');
// CCC-ART-7: scoreboard and podium remain local, read-only and accessible.
const resultsSource=await readFile(resolve(root,'core/chaos-results.js'),'utf8');
const resultsUi=await readFile(resolve(root,'core/classics-ui.js'),'utf8');
if(!resultsSource.includes('chaosChampionshipPlacings')||
 !resultsSource.includes('renderChaosRegionalResults')||
 !resultsSource.includes('renderChaosChampionshipResults')||
 !resultsUi.includes('renderChaosRegionalResults(game)')||
 !resultsUi.includes('renderChaosChampionshipResults(game)')||
 !tabletopCss.includes('ccc-results-table-scroll')||
 !tabletopCss.includes('ccc-championship-podium')||
 !tabletopCss.includes('@media(max-width:660px)')||
 !tabletopCss.includes('[data-motion="reduce"]')||
 !tabletopCss.includes('@media(forced-colors:active)')||
 /(?:https?:\/\/|\bfetch\s*\(|\bsetTimeout\s*\(|\bsetInterval\s*\(|\beval\s*\()/.test(resultsSource.replaceAll('http://www.w3.org/2000/svg','')))
 throw new Error('CCC-ART-7 local results/accessibility qualification failed');
// CCC-5: championship finish, provisional standings and accessible countdown remain local.
const championshipEngine=await readFile(resolve(root,'core/cross-country-chaos.js'),'utf8');
if(!championshipEngine.includes('chaosFinalRoundProgress(s)')||
 !championshipEngine.includes('gain(p,300);markFinish(s);risky(s,p,500)')||
 !championshipEngine.includes('refresh(p);markFinish(s);risky(s,p,c.km)')||
 !resultsSource.includes('renderChaosCumulativeStandings(s)')||
 !resultsUi.includes('renderChaosCumulativeStandings(game)')||
 !tabletopCss.includes('ccc-final-round'))
 throw new Error('CCC-5 championship final-round and standings qualification failed');
// CCC-6 saved game state is reconstructed from canonical moves, not trusted snapshots.
const saveSource=await readFile(resolve(root,'core/chaos-save.js'),'utf8');
if(!saveSource.includes('replayChaosJournal(journal)')||
 !saveSource.includes('chaosActionOptions(s)')||
 !saveSource.includes('takeChaosTurn(s,')||
 !saveSource.includes('advanceChaosLeg(s)')||
 !saveSource.includes('CHAOS_SAVE_MAX_EVENTS=4096')||
 !app.includes('recordChaosTransition(before,result.game,events)')||
 !app.includes('refreshChaosRecovery()')||
 !app.includes('eraseChaosRecovery()')||
 !resultsUi.includes('data-chaos-action="save-device"')||
 !resultsUi.includes('data-chaos-action="resume"')||
 !tabletopCss.includes('min-block-size:44px')||
 !tabletopCss.includes('ccc-save-panel')||
 /(?:\bfetch\s*\(|\beval\s*\(|\bwindow\b|https?:\/\/|\.hand\b|\.deck\b)/.test(saveSource.replace(/^\/\/.*$/gm,'')))
 throw new Error('CCC-6 save/resume and offline mobile release qualification failed');
// Account multiplayer must be the public route, never the old same-screen game.
const onlineUi=await readFile(resolve(root,'core/chaos-online.js'),'utf8');
const shellUi=await readFile(resolve(root,'core/app-shell.js'),'utf8');
if(!shellUi.includes("if(route.id==='chaos-game')return route.path.endsWith('/practice')?renderClassicsRoute")||
 !shellUi.includes('):renderChaosOnline(online);')||
 !onlineUi.includes("credentials:'same-origin'")||
 !onlineUi.includes("checkChaosProjection")||
 !app.includes("new ChaosRoomsClient")||
 !app.includes("bindChaosOnline(root,chaosOnline,window.location.pathname)")||
 !app.includes("bindChaos();bindChaosOnline(root,chaosOnline,window.location.pathname)")||
 !tabletopCss.includes('.ccc-online-cards')||
 !tabletopCss.includes('.app-shell[data-route="chaos-game"] .app-sidebar'))
 throw new Error('CCC account multiplayer route must not expose pass-and-play');
// CCC-4 decisions consume only the current hand and public board, never stock order.
const computerJs=await readFile(resolve(root,'core/chaos-computer.js'),'utf8');
const classicsUi=await readFile(resolve(root,'core/classics-ui.js'),'utf8');
if(!computerJs.includes('chaosActionOptions(s)')||
 !computerJs.includes('takeChaosTurn(old,')||
 !classicsUi.includes('isChaosComputer(p)')||
 !app.includes('scheduleChaosComputer()')||
 !tabletopCss.includes('ccc-controller-picker')||
 !tabletopCss.includes('ccc-computer-turn')||
 /(?:\bfetch\s*\(|\beval\s*\(|\bMath\.random\s*\(|\bwindow\b|\.deck\b|\bseed\b)/.test(computerJs.replace(/^\/\/.*$/gm,'')))
 throw new Error('CCC-4 local computer strategy/privacy qualification failed');
for(const [name,ok] of Object.entries({'document language':/<html\s+lang="[a-z-]+"/i.test(html),'viewport':/name="viewport"/.test(html),'main landmark':/<main\b/.test(app),'focus treatment':/:focus-visible\b/.test(css),'reduced motion':/prefers-reduced-motion/.test(css),'forced colors':/forced-colors/.test(css),'noindex private default':/name="robots"[^>]*noindex/i.test(html)}))if(!ok)throw new Error(`static accessibility/privacy gate missing: ${name}`);
const names=new Map(files.map(file=>[relative(root,file.path).replaceAll('\\','/'),file.size]));
for(const asset of DASHBOARD_ASSETS){const size=names.get(asset);if(!size||size>128*1024)throw new Error('missing or oversized dashboard artwork: '+asset);}
for(const name of names.keys())if(name.startsWith('assets/')&&name!==CHAOS_IMAGE_MANIFEST_PATH&&!DASHBOARD_ASSETS.includes(name)&&!cardAllowlist.has(name)&&!mapAllowlist.has(name)&&!vehicleAllowlist.has(name)&&!chessArtPaths.has(name)&&!saladAllowlist.has(name)&&!bc14Allowed.has(name)&&name!==originalCribbageArt&&name!=='assets/games/labyrinth-cribbage/labyrinth.png')
 throw new Error('unexpected published asset: '+name);
for(const asset of CHAOS_CARD_ART_OUTPUTS)if(!names.has(asset))throw new Error('missing approved card art: '+asset);
if(names.has('bong-goggles-logo.png'))throw new Error('oversized original brand master must remain source-only');
for(const asset of ['bong-goggles-header-256.webp','bong-goggles-browser-512.webp','favicon-32.png','favicon-192.png']){
  const size=names.get(asset);
  if(!size||size>128*1024)throw new Error(`missing or oversized optimized brand asset: ${asset}`);
}
for(const asset of ['favicon-32.png','favicon-192.png','bong-goggles-browser-512.webp'])if(!html.includes('/'+asset))throw new Error(`missing HTML brand asset reference: ${asset}`);
if(!branding.includes('/bong-goggles-header-256.webp'))throw new Error('missing optimized header logo reference');
const cccImageManifest=await verifyChaosPublishedImageManifest({sourceRoot:resolve(root,'..'),outputRoot:root});
console.log('CCC-ART-8 published image manifest qualification:',JSON.stringify(cccImageManifest));
console.log(`BG-19.13 static build gates passed: ${files.length} files; ${total} bytes; max JS ${limits.singleJs}, CSS ${limits.singleCss}, base assets ${baseTotal}/${limits.baseTotal}, 49 card assets ${cardTotal}/${limits.cardTotal}, 6 atlas layers ${mapTotal}/${limits.mapTotal}, 6 vehicle tokens ${vehicleTotal}/${limits.vehicleTotal}; optimized brand assets verified`);
