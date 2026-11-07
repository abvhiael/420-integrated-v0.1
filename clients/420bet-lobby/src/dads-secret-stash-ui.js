import {newGame,spin,evaluate,makeBonusPreview,BONUS_PREVIEW_TYPES,SYMBOLS,MAX_WIN_MULTIPLIER,MOW_PAYOUT_FACTOR} from './dads-secret-stash-engine.js';
import {DSS_SYMBOL_ART,DSS_SYMBOL_LABELS,DSS_CAST_ART,DSS_TRANSITION_ART,DSS_FEATURE_ART,DSS_BACKGROUND_ART,DSS_LARRY_ART} from './dads-secret-stash-assets.js';
const GLYPHS={gary:'😎',jen:'👩',tyler:'🎧',emma:'💜',keller:'📋',bud:'🐕',jar:'🫙',bong:'⚗️',pizza:'🍕',lighter:'🔥',papers:'📜',A:'A',K:'K',Q:'Q',J:'J','10':'10',wild:'🌿',scatter:'☮',stash:'📦',mower:'🚜'};
const FEATURE_TITLES={jen:"OH SHIT, SHE'S HOME!",family:'FAMILY CHAOS!',keller:'HOA INSPECTION!',bud:'GOOD BOY BONUS!',free:'FIVE MINUTES OF PEACE!',stash:"DAD'S SECRET STASH!",mow:'MOW THE LAWN!'};
// Allow the 450ms slide-in to complete, then hold the character for over a full second.
export const DSS_BONUS_PRESENTATION=Object.freeze({characterMs:1600,resultMs:1200,comicActionMs:1500});
const COMIC_ACTION_DETAILS=Object.freeze({
 'PANIC WILDS':'Random symbols transform into WILDS!',
 'GARAGE CLEANUP':'Low symbols are upgraded to premium symbols!',
 'CAUGHT RED-HANDED':'A surprise win multiplier kicks in!',
 'LOW SYMBOL UPGRADE':'Low symbols become premium symbols!',
 'WILD GRAFFITI':'Two symbols turn into WILDS!',
 'SCATTER SCRAMBLE':'Extra SCATTERS land — three or more unlock FREE SPINS!',
 'GARAGE MAYHEM':'Low symbols change into surprise premium symbols!',
 'FETCH WILD!':'Bud fetches three WILDS for the reels!',
 'HOA INSPECTION':'Five locked respins — premium symbols stay put!'
});
export function comicActionCopy(event){
 const title=event.type==='keller'?'HOA INSPECTION!':(event.label??FEATURE_TITLES[event.type]??'BONUS ACTION').toUpperCase().replace(/!*$/,'!');
 const detail=event.awardedFreeSpins?
  event.scatterCount+' SCATTERS! FIVE MINUTES OF PEACE FREE SPINS UNLOCKED!':
  (COMIC_ACTION_DETAILS[event.label]??COMIC_ACTION_DETAILS[event.type==='keller'?'HOA INSPECTION':event.label]??'BONUS FEATURE ACTIVATED!');
 return {title,detail};
}
const FEATURE_PERSON={jen:'JEN',family:'TYLER & EMMA',keller:'MR. KELLER',bud:'BUD',free:'GARY',stash:'GARY',mow:'GARY'};
function el(doc,tag,cls,txt){const x=doc.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x;}
export function createDadsSecretStash(doc=globalThis.document,options={}){
 const rng=options.rng??Math.random,setTimer=options.setTimeout??setTimeout,clearTimer=options.clearTimeout??clearTimeout;
 let state=newGame(),previewPriorState=null,destroyed=false,busy=false,auto=false,autoLeft=0,currentTimer=null,events=[],eventIndex=0,spinTick=0;
 const root=el(doc,'section','dss-game');root.dataset.practiceGame='dads-secret-stash';
 const shell=el(doc,'div','dss-shell'),hero=el(doc,'header','dss-header');
 const logo=el(doc,'img','dss-logo');logo.src='/assets/420bet/dads-secret-stash/dads_secret_stash_title_bar.png';logo.alt="Dad's Secret Stash — Dad reclining with a joint beside the neon-green and orange title";
 const alternative=el(doc,'div','dss-title-composite');
 const dadPortrait=el(doc,'img','dss-title-dad');dadPortrait.src='/assets/420bet/dads-secret-stash/characters/gary_main.png';dadPortrait.alt='';
 const wordmark=el(doc,'div','dss-title-wordmark');
 for(const [word,cls] of [["DAD'S",'dss-word-dad'],['SECRET','dss-word-secret'],['STASH','dss-word-stash']])wordmark.append(el(doc,'span',cls,word));
 alternative.append(dadPortrait,wordmark);alternative.hidden=true;
 logo.addEventListener('error',()=>{logo.hidden=true;alternative.hidden=false;});
 hero.append(logo,alternative,el(doc,'p','dss-tag','SUBURBAN SURVIVAL. ONE JOINT AT A TIME.'));
 const scene=el(doc,'div','dss-scene'),reels=el(doc,'div','dss-reels');reels.setAttribute('aria-label','Five reels, four rows');
 const reelEls=Array.from({length:5},(_,i)=>{const column=el(doc,'div','dss-reel');column.dataset.reel=String(i);reels.append(column);return column;});
 const cells=Array.from({length:20},(_,i)=>{
  const cell=el(doc,'div','dss-cell'),image=el(doc,'img','dss-symbol-image'),face=el(doc,'span','dss-symbol-fallback');
  image.alt='';image.decoding='async';image.draggable=false;
  image.addEventListener('load',()=>{image.hidden=false;face.hidden=true;});
  image.addEventListener('error',()=>{image.hidden=true;face.hidden=false;});
  cell.append(image,face);reelEls[Math.floor(i/4)].append(cell);return {cell,image,face};
 });
 // The slot uses 1,024 ways, not fixed paylines. Trace a representative
 // symbol-matched route and spotlight every contributing symbol.
 const winTrace=el(doc,'div','dss-win-trace');winTrace.hidden=true;
 const winSvg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
 winSvg.setAttribute('class','dss-win-svg');
 winSvg.setAttribute('viewBox','0 0 500 400');
 winSvg.setAttribute('preserveAspectRatio','none');
 winSvg.setAttribute('aria-hidden','true');
 const winWayLabel=el(doc,'div','dss-win-label');
 winTrace.append(winSvg,winWayLabel);
 reels.append(winTrace);
 const larryPanel=el(doc,'aside','dss-larry-panel');
 const larry=el(doc,'img','dss-larry');
 const larryDescriptions=Object.freeze({
  main:'Larry sitting in his garage recliner, enjoying a joint',
  stash:'Larry excitedly pointing toward his secret stash prizes',
  free:'Larry relaxing in his recliner with headphones',
  mow:'Larry mowing the suburban lawn'
 });
 const setLarryMode=(mode='main')=>{
  const next=Object.hasOwn(DSS_LARRY_ART,mode)?mode:'main';
  larryPanel.dataset.mode=next;
  const url=DSS_LARRY_ART[next];
  if(larry.getAttribute('src')!==url)larry.src=url;
  larry.alt=larryDescriptions[next];
 };
 larry.addEventListener('error',()=>{if(larryPanel.dataset.mode!=='main')setLarryMode('main');});
 setLarryMode('main');larry.draggable=false;
 const larryCaption=el(doc,'div','dss-larry-caption','JUST FIVE MORE MINUTES…');
 larryPanel.append(larry,larryCaption);
 const featurePanel=el(doc,'aside','dss-feature-panel');
 const featureHeader=el(doc,'div','dss-feature-header','GARAGE FEATURES');
 const modeTitle=el(doc,'strong','dss-feature-name','DAD’S SECRET STASH');
 const modeDetail=el(doc,'p','dss-feature-detail','Find three stash crates to open the stash!');
 const featureCounter=el(doc,'div','dss-feature-counter','5 REELS · 1,024 WAYS');
 const featureBanner=el(doc,'img','dss-feature-banner');featureBanner.src='/assets/420bet/dads-secret-stash/overlays/hold_and_win.png';featureBanner.alt='Dad’s Secret Stash Hold & Win';
 const featureList=el(doc,'div','dss-feature-list');
 for(const [label,description] of [['SECRET STASH','3 stash crates → Hold & Win'],['FIVE MINUTES OF PEACE','3 scatters → Free Spins'],['MOW THE LAWN','3 lawnmowers → 5 Cascades'],['SURPRISE VISITORS','Jen · Kids · HOA · Bud']]){
  const item=el(doc,'div','dss-feature-item');
  item.append(el(doc,'b','',label),el(doc,'span','',description));featureList.append(item);
 }
 featurePanel.append(featureHeader,featureBanner,modeTitle,modeDetail,featureCounter,featureList);
 const status=el(doc,'div','dss-status','Practice only — simulated credits, no wallet or wagers');
 const message=el(doc,'p','dss-message',state.message),controls=el(doc,'div','dss-controls');
 const balance=el(doc,'span','dss-stat'),betLabel=el(doc,'span','dss-stat'),winLabel=el(doc,'span','dss-stat'),round=el(doc,'span','dss-stat');
 function btn(txt,fn,cls=''){const b=el(doc,'button','dss-button '+cls,txt);b.type='button';b.addEventListener('click',fn);return b;}
 const lower=btn('− BET',()=>{state.bet=Math.max(1,state.bet-1);refresh();}),higher=btn('+ BET',()=>{state.bet=Math.min(50,state.bet+1);refresh();});
 const play=btn('SPIN',()=>start(),'dss-spin'),autoBtn=btn('AUTO ×10',()=>{if(auto){auto=false;autoLeft=0;autoBtn.textContent='AUTO ×10';return;}auto=true;autoLeft=10;autoBtn.textContent='STOP AUTO';if(!busy)start();}),info=btn('INFO',()=>{infoPanel.hidden=!infoPanel.hidden;});
 controls.append(balance,lower,betLabel,higher,play,winLabel,round,autoBtn,info);
 // TEMPORARY BONUS QA PANEL. This is intentionally practice-only and removable
 // as a single panel/function once bonus presentation qualification is done.
 const previewPanel=el(doc,'section','dss-preview-panel');
 previewPanel.setAttribute('aria-label','Temporary bonus testing controls');
 const previewDescription=el(doc,'span','dss-preview-note','TEST BONUS · PRACTICE DEMO ONLY — no credits awarded');
 const previewSelect=el(doc,'select','dss-preview-select');
 previewSelect.setAttribute('aria-label','Choose bonus to preview');
 const previewNames={
  stash:'SECRET STASH · HOLD & WIN',free:'FIVE MINUTES OF PEACE · FREE SPINS',
  mow:'MOW THE LAWN · CASCADES',jen:"JEN · OH SHIT, SHE'S HOME!",
  family:'FAMILY CHAOS · RANDOM EFFECT', 'family-graffiti':'FAMILY CHAOS · WILD GRAFFITI',
  keller:'HOA INSPECTION · LOCKED RESPINS',bud:'BUD · FETCH WILD'
 };
 for(const type of BONUS_PREVIEW_TYPES){
  const option=el(doc,'option','',previewNames[type]);option.value=type;previewSelect.append(option);
 }
 // Keep the selected option explicit so practice QA works with minimal DOM
 // environments as well as ordinary browser select/change interactions.
 previewSelect.addEventListener('change',()=>{
  const selected=previewSelect.value;
  for(const option of previewSelect.querySelectorAll('option')){
   if(option.value===selected)option.setAttribute('selected','');
   else option.removeAttribute('selected');
  }
 });
  const previewButton=btn('▶ TEST SELECTED BONUS',()=>startBonusPreview(),'dss-preview-button');
 previewPanel.append(previewDescription,previewSelect,previewButton);
 const infoPanel=el(doc,'section','dss-info');infoPanel.hidden=true;infoPanel.append(el(doc,'h2','',"How to play — Dad's Secret Stash"),el(doc,'p','', 'Practice-only 5×4 reels, 1,024 ways. Matching paying symbols from the left on 3–5 consecutive reels win. Gary Wild substitutes for paying symbols. Each qualifying cast event independently triggers with 25% probability.'),el(doc,'p','',"3+ Jen: random mystery modifier. Tyler + Emma: random Family Chaos. 3+ Mr. Keller: 5 locked-premium respins. 3+ Bud: Fetch Wild. 3+ Scatters: Five Minutes of Peace free spins. 3+ Stash: crate prizes. 3+ Mowers: 5 cascading lawnmower rounds. The simulated return is NOT calibrated or certified. Maximum per round: "+MAX_WIN_MULTIPLIER+"× stake."),btn('CLOSE',()=>{infoPanel.hidden=true;}));
 const overlay=el(doc,'div','dss-overlay');overlay.hidden=true;
 const backdrop=el(doc,'img','dss-transition-backdrop');backdrop.alt='';backdrop.hidden=true;
 const bubble=el(doc,'div','dss-bubble');bubble.hidden=true;
 const portrait=el(doc,'div','dss-portrait');const nameTag=el(doc,'span','dss-cast-name');
 const titleArt=el(doc,'img','dss-feature-title-art');titleArt.alt='';titleArt.hidden=true;
 const headline=el(doc,'h2','dss-announcement');
 const announcement=el(doc,'div','dss-announcement-stack');announcement.append(titleArt,headline);
 portrait.append(nameTag);
 // Full-screen comic action reveal belongs INSIDE the existing overlay, so the
 // reel board remains obscured until the action card completes its 1.5s hold.
 const comicCard=el(doc,'div','dss-comic-action');
 comicCard.hidden=true;comicCard.setAttribute('role','status');
 comicCard.setAttribute('aria-live','polite');
 const comicBurst=el(doc,'div','dss-comic-burst');
 const comicTitle=el(doc,'strong','dss-comic-title');
 const comicDetail=el(doc,'span','dss-comic-detail');
 comicBurst.append(comicTitle,comicDetail);comicCard.append(comicBurst);
 overlay.append(backdrop,bubble,announcement,portrait,comicCard);
 function loadArt(img,url){if(!url){img.hidden=true;return;}img.hidden=false;img.src=url;img.addEventListener('error',()=>{img.hidden=true;},{once:true});}
 function showCast(type){
   for(const old of [...portrait.querySelectorAll('img')])old.remove();
   const art=DSS_CAST_ART[type]??DSS_CAST_ART.stash;
   for(const url of art){const image=el(doc,'img','dss-cast-image');image.src=url;image.alt='';
    image.addEventListener('error',()=>{image.hidden=true;});portrait.insertBefore(image,nameTag);}
   nameTag.textContent=FEATURE_PERSON[type]??'GARY';
   // Feature screens already show Larry in his actual scene sprite. Do not
   // float a cropped sitting portrait without the chair during transitions.
   const scenery=['free','stash','mow'].includes(type);
   portrait.hidden=scenery;overlay.dataset.scene=type;
   portrait.dataset.character=type;portrait.classList.toggle('dss-cast-pair',art.length>1);
   loadArt(backdrop,DSS_TRANSITION_ART[type]);loadArt(titleArt,DSS_FEATURE_ART[type]);
 }
 function showScene(type='main'){
 const sceneMode=Object.hasOwn(DSS_BACKGROUND_ART,type)?type:'main';
 scene.dataset.mode=sceneMode;shell.dataset.mode=sceneMode;
 setLarryMode(sceneMode);
 shell.style.setProperty('--dss-active-wallpaper',`url("${DSS_BACKGROUND_ART[sceneMode]}")`);
}
 showScene();
 const holdWin=el(doc,'section','dss-hold-win');holdWin.hidden=true;
 holdWin.setAttribute('aria-label','Secret Stash Hold and Win prize board');
 const holdHeading=el(doc,'header','dss-hold-heading','DAD’S SECRET STASH · HOLD & WIN');
 const holdCount=el(doc,'div','dss-hold-count','RESPINS REMAINING: 3');
 const holdTiles=el(doc,'div','dss-hold-tiles');
 // Reusable stylized seven-leaflet cannabis silhouette for every unfilled tile.
 // Never use emoji placeholders, which vary by platform and look like blobs.
 const svgNS='http://www.w3.org/2000/svg';
 // One centered silhouette assembled from seven DISTINCT, sharply pointed
 // serrated leaflets. Every tip is spatially separated, unlike the previous
 // overlapping/rotated blade graphic that resembled a Brussels sprout.
 const CANNABIS_LEAFLET_PATHS=[
 "M50.0,79.0 L48.5,77.0 L46.9,75.2 L44.9,74.2 L43.6,71.9 L41.8,70.3 L39.4,70.1 L38.2,67.5 L36.4,66.3 L33.7,66.6 L32.5,64.1 L30.4,63.1 L27.6,63.7 L26.2,61.5 L24.1,60.9 L21.3,61.4 L19.6,59.9 L17.3,59.5 L14.6,59.7 L12.5,59.0 L10.0,59.0 L10.0,59.0 L11.5,61.0 L13.4,62.3 L14.7,64.5 L16.4,66.1 L18.7,66.6 L19.9,69.1 L21.8,70.5 L24.4,70.3 L25.6,72.9 L27.5,73.9 L30.3,73.4 L31.6,75.7 L33.8,76.5 L36.6,75.9 L38.2,77.7 L40.4,78.1 L43.1,77.8 L45.1,78.8 L47.5,79.0 L50.0,79.0 Z",
 "M50.0,79.0 L49.0,75.9 L47.8,73.0 L45.7,71.0 L45.0,67.6 L43.5,65.0 L40.7,63.7 L40.3,60.0 L38.5,57.7 L35.1,57.0 L34.6,53.4 L32.5,51.4 L28.8,51.0 L28.0,47.7 L25.6,46.0 L21.9,45.6 L20.4,43.0 L17.8,41.5 L14.4,40.8 L12.1,39.0 L9.0,38.0 L9.0,38.0 L10.0,41.1 L11.8,43.4 L12.5,46.8 L14.0,49.4 L16.6,50.9 L17.0,54.6 L18.7,57.0 L22.0,57.8 L22.4,61.5 L24.4,63.6 L28.0,64.1 L28.7,67.5 L31.0,69.3 L34.7,69.7 L36.0,72.5 L38.6,74.0 L42.0,74.7 L44.0,76.8 L46.9,78.0 L50.0,79.0 Z",
 "M50.0,79.0 L50.2,75.2 L50.1,71.5 L48.8,68.3 L49.5,64.3 L49.0,60.8 L46.5,58.0 L47.6,53.9 L46.7,50.5 L43.4,48.1 L44.4,44.0 L43.0,40.8 L39.4,38.6 L39.8,34.7 L38.0,31.7 L34.4,29.4 L33.9,25.9 L31.7,23.1 L28.5,20.6 L26.8,17.6 L24.0,15.0 L24.0,15.0 L23.8,18.8 L24.7,22.2 L24.1,26.1 L24.5,29.7 L26.6,32.6 L25.6,36.7 L26.4,40.1 L29.4,42.6 L28.4,46.8 L29.6,50.0 L33.2,52.3 L32.5,56.3 L34.2,59.3 L37.9,61.6 L38.0,65.2 L40.1,68.1 L43.4,70.5 L44.7,73.7 L47.2,76.4 L50.0,79.0 Z",
 "M50.0,79.0 L52.1,75.3 L53.7,71.5 L53.6,67.8 L56.4,64.0 L57.4,60.3 L55.8,56.5 L59.1,52.8 L59.6,49.0 L56.9,45.3 L60.0,41.5 L59.9,37.8 L56.7,34.0 L59.1,30.3 L58.4,26.5 L55.2,22.8 L56.4,19.0 L55.1,15.3 L52.6,11.5 L52.1,7.8 L50.0,4.0 L50.0,4.0 L47.9,7.8 L47.4,11.5 L44.9,15.3 L43.6,19.0 L44.8,22.8 L41.6,26.5 L40.9,30.3 L43.3,34.0 L40.1,37.8 L40.0,41.5 L43.1,45.3 L40.4,49.0 L40.9,52.8 L44.2,56.5 L42.6,60.3 L43.6,64.0 L46.4,67.8 L46.3,71.5 L47.9,75.3 L50.0,79.0 Z",
 "M50.0,79.0 L52.8,76.4 L55.3,73.7 L56.6,70.5 L59.9,68.1 L62.0,65.2 L62.1,61.6 L65.8,59.3 L67.5,56.3 L66.8,52.3 L70.4,50.0 L71.6,46.8 L70.6,42.6 L73.6,40.1 L74.4,36.7 L73.4,32.6 L75.5,29.7 L75.9,26.1 L75.3,22.2 L76.2,18.8 L76.0,15.0 L76.0,15.0 L73.2,17.6 L71.5,20.6 L68.3,23.1 L66.1,25.9 L65.6,29.4 L62.0,31.7 L60.2,34.7 L60.6,38.6 L57.0,40.8 L55.6,44.0 L56.6,48.1 L53.3,50.5 L52.4,53.9 L53.5,58.0 L51.0,60.8 L50.5,64.3 L51.2,68.3 L49.9,71.5 L49.8,75.2 L50.0,79.0 Z",
 "M50.0,79.0 L53.1,78.0 L56.0,76.8 L58.0,74.7 L61.4,74.0 L64.0,72.5 L65.3,69.7 L69.0,69.3 L71.3,67.5 L72.0,64.1 L75.6,63.6 L77.6,61.5 L78.0,57.8 L81.3,57.0 L83.0,54.6 L83.4,50.9 L86.0,49.4 L87.5,46.8 L88.2,43.4 L90.0,41.1 L91.0,38.0 L91.0,38.0 L87.9,39.0 L85.6,40.8 L82.2,41.5 L79.6,43.0 L78.1,45.6 L74.4,46.0 L72.0,47.7 L71.2,51.0 L67.5,51.4 L65.4,53.4 L64.9,57.0 L61.5,57.7 L59.7,60.0 L59.3,63.7 L56.5,65.0 L55.0,67.6 L54.3,71.0 L52.2,73.0 L51.0,75.9 L50.0,79.0 Z",
 "M50.0,79.0 L52.5,79.0 L54.9,78.8 L56.9,77.8 L59.6,78.1 L61.8,77.7 L63.4,75.9 L66.2,76.5 L68.4,75.7 L69.7,73.4 L72.5,73.9 L74.4,72.9 L75.6,70.3 L78.2,70.5 L80.1,69.1 L81.3,66.6 L83.6,66.1 L85.3,64.5 L86.6,62.3 L88.5,61.0 L90.0,59.0 L90.0,59.0 L87.5,59.0 L85.4,59.7 L82.7,59.5 L80.4,59.9 L78.7,61.4 L75.9,60.9 L73.8,61.5 L72.4,63.7 L69.6,63.1 L67.5,64.1 L66.3,66.6 L63.6,66.3 L61.8,67.5 L60.6,70.1 L58.2,70.3 L56.4,71.9 L55.1,74.2 L53.1,75.2 L51.5,77.0 L50.0,79.0 Z"
];
 function cannabisLeaf(){
  const svg=doc.createElementNS(svgNS,'svg');
  svg.setAttribute('class','dss-cannabis-leaf');
  svg.setAttribute('viewBox','0 0 100 100');
  svg.setAttribute('aria-hidden','true');
  const stem=doc.createElementNS(svgNS,'path');
  stem.setAttribute('d','M50 77 Q50 87 50 96');
  stem.setAttribute('class','dss-leaf-stem');
  svg.append(stem);
  for(const d of CANNABIS_LEAFLET_PATHS){
   const leaflet=doc.createElementNS(svgNS,'path');
   leaflet.setAttribute('d',d);
   leaflet.setAttribute('class','dss-leaf-blade');
   svg.append(leaflet);
  }
  return svg;
 }
 const holdCells=Array.from({length:20},()=>{
  const tile=el(doc,'div','dss-hold-cell'),leaf=cannabisLeaf(),value=el(doc,'span','dss-hold-value');
  tile.append(leaf,value);holdTiles.append(tile);return {tile,leaf,value};
 });
 const holdTotal=el(doc,'div','dss-hold-total','COLLECTING STASH PRIZES…');
 const bonusHeader=el(doc,'div','dss-bonus-hud');bonusHeader.hidden=true;
 const bonusMode=el(doc,'strong','dss-bonus-mode'),bonusProgress=el(doc,'strong','dss-bonus-progress'),bonusMult=el(doc,'strong','dss-bonus-mult');
 bonusHeader.append(bonusMode,bonusProgress,bonusMult);
 const modifierAction=el(doc,'div','dss-modifier-action');modifierAction.hidden=true;
 const modifierActionTitle=el(doc,'strong','dss-modifier-title');
 const modifierActionDetail=el(doc,'span','dss-modifier-detail');
 modifierAction.append(modifierActionTitle,modifierActionDetail);
 const resultScreen=el(doc,'section','dss-feature-result');resultScreen.hidden=true;
 const resultTitle=el(doc,'h2','dss-feature-result-title'),resultAmount=el(doc,'strong','dss-feature-result-amount'),resultDetail=el(doc,'p','dss-feature-result-detail');
 resultScreen.append(resultTitle,resultAmount,resultDetail);
 holdWin.append(holdHeading,holdCount,holdTiles,holdTotal);
 scene.append(larryPanel,reels,holdWin,featurePanel,overlay,resultScreen);hero.append(bonusHeader,modifierAction);shell.append(hero,scene,status,message,controls,previewPanel,infoPanel);root.append(shell);
 const money=n=>Number(n).toFixed(2);
 function setCell(i,s){
 const cell=cells[i];cell.cell.dataset.symbol=s;cell.cell.title=DSS_SYMBOL_LABELS[s]??s;
 cell.cell.setAttribute('aria-label',DSS_SYMBOL_LABELS[s]??s);
 cell.face.textContent=GLYPHS[s]??s;
 if(cell.image.getAttribute('src')===DSS_SYMBOL_ART[s])return;
 cell.face.hidden=false;cell.image.hidden=true;cell.image.src=DSS_SYMBOL_ART[s]??'';
}
 function showGrid(grid){grid.forEach((s,i)=>setCell(i,s));}
 function clearWinTrace(){
  winTrace.hidden=true;
  winSvg.replaceChildren();
  winWayLabel.textContent='';
  cells.forEach(({cell})=>cell.classList.remove('dss-paying-symbol'));
 }
 function showWinningWays(grid,winData,done){
  const wins=(winData?.wins??[]).filter(win=>win.amount>0&&win.matched>=3);
  if(!wins.length){clearWinTrace();done();return;}
  let displayed=0;
  const show=()=>{
   if(displayed>=wins.length){
    clearWinTrace();done();return;
   }
   const win=wins[displayed++];
   const indices=[],route=[];
   for(let reel=0;reel<win.matched;reel++){
    const options=[];
    for(let row=0;row<4;row++){
     const i=reel*4+row;
     if(grid[i]===win.symbol||grid[i]==='wild')options.push(i);
    }
    if(!options.length)throw Error('Win display mismatch: '+win.symbol);
    indices.push(...options);
    // The actual win can contain many ways; choose the first displayed route.
    const index=options[0],row=index%4;
    route.push((50+reel*100)+','+(50+row*100));
   }
   // Run the neon trace across the full physical five-reel playfield, even
   // when the award is for 3 or 4 consecutive matching reels. The bright
   // path follows true paying symbols, then continues at the last winning
   // row to the right edge; only actual contributing cells are highlighted.
   const firstY=route[0].split(',')[1],lastY=route[route.length-1].split(',')[1];
   route.unshift('0,'+firstY);
   for(let reel=win.matched;reel<5;reel++){
    route.push((50+reel*100)+','+lastY);
   }
   route.push('500,'+lastY);
   winSvg.replaceChildren();
   const addPath=(cls)=>{
    const path=doc.createElementNS('http://www.w3.org/2000/svg','polyline');
    path.setAttribute('class',cls);
    path.setAttribute('points',route.join(' '));
    winSvg.append(path);
   };
   addPath('dss-win-glow');addPath('dss-win-line');
   const hits=new Set(indices);
   cells.forEach(({cell},i)=>cell.classList.toggle('dss-paying-symbol',hits.has(i)));
   winWayLabel.textContent=win.symbol.toUpperCase()+' · '+win.matched+' REELS · '+win.ways+
    (win.ways===1?' WAY':' WAYS')+' · '+money(win.amount*state.last.stake)+' CREDITS';
   winTrace.hidden=false;
   status.textContent='WINNING WAYS: '+winWayLabel.textContent;
   schedule(show,1500);
  };
  show();
 }
 // Visual cycling never uses the outcome RNG or changes the already-resolved result.
 // Each of the five reel columns runs together; reel stops are exactly 500ms apart.
 function animateSpin(finalGrid){
  const stopTicks=[20,30,40,50,60]; // 50ms ticks: 1000, 1500, 2000, 2500, 3000ms
  spinTick=0;
  reelEls.forEach(reel=>{reel.classList.remove('dss-stopping');reel.classList.add('dss-spinning');});
  const tick=()=>{
   if(destroyed)return;
   spinTick++;
   for(let reel=0;reel<5;reel++){
    if(spinTick>stopTicks[reel])continue;
    if(spinTick===stopTicks[reel]){
     for(let row=0;row<4;row++)setCell(reel*4+row,finalGrid[reel*4+row]);
     reelEls[reel].classList.remove('dss-spinning');
     reelEls[reel].classList.add('dss-stopping');
    }else{
     for(let row=0;row<4;row++)setCell(reel*4+row,SYMBOLS[(spinTick*3+reel*7+row*5)%SYMBOLS.length]);
    }
   }
   if(spinTick<stopTicks[4])schedule(tick,50);
   else{
    reelEls.forEach(reel=>reel.classList.remove('dss-stopping'));
    status.textContent='REELS STOPPED — SIMULATED RESULT';
    schedule(()=>showWinningWays(finalGrid,state.last.base,nextEvent),150);
   }
  };
  schedule(tick,50);
 }
 function setFeature(type='main',detail='',counter=''){
 const labels={main:"DAD'S SECRET STASH",free:'FIVE MINUTES OF PEACE',stash:'HOLD & WIN',mow:'MOW THE LAWN',keller:'HOA INSPECTION',jen:"OH SHIT, SHE'S HOME!",family:'FAMILY CHAOS',bud:'GOOD BOY BONUS'};
 modeTitle.textContent=labels[type]??labels.main;
 modeDetail.textContent=detail||'Three matching bonus symbols unlock the garage features.';
 featureCounter.textContent=counter||'5 REELS · 1,024 WAYS';
 const banner=DSS_FEATURE_ART[type]??(type==='main'?DSS_FEATURE_ART.stash:null);
 featureBanner.hidden=!banner;if(banner)featureBanner.src=banner;
 featurePanel.dataset.feature=type;
}
 function refresh(){balance.textContent='BALANCE '+money(state.balance);betLabel.textContent='BET '+money(state.bet);winLabel.textContent='WIN '+money(state.last?.win??0);round.textContent='SPINS '+state.rounds;message.textContent=state.message;lower.disabled=busy;higher.disabled=busy;play.disabled=busy||state.balance<state.bet;autoBtn.disabled=state.balance<state.bet&&!busy;previewSelect.disabled=busy||auto;previewButton.disabled=busy||auto||state.mode!=='practice';}
 function schedule(fn,ms){currentTimer=setTimer(()=>{currentTimer=null;if(!destroyed)fn();},ms);}
 function showComicAction(event,done){
  const {title,detail}=comicActionCopy(event);
  comicTitle.textContent=title;
  comicDetail.textContent=detail;
  comicCard.dataset.feature=event.type;
  comicCard.dataset.action=event.label??event.type;
  comicCard.hidden=false;
  overlay.classList.add('dss-comic-active');
  // Keep the existing overlay fully visible so underlying reels are concealed.
  overlay.hidden=false;
  status.textContent='COMIC ACTION REVEAL: '+title;
  schedule(()=>{
   comicCard.hidden=true;
   overlay.classList.remove('dss-comic-active');
   done();
  },DSS_BONUS_PRESENTATION.comicActionMs);
 }
 function finish(){busy=false;if(previewPriorState){state=previewPriorState;previewPriorState=null;}clearWinTrace();overlay.hidden=true;comicCard.hidden=true;overlay.classList.remove('dss-comic-active');modifierAction.hidden=true;resultScreen.hidden=true;bonusHeader.hidden=true;scene.removeAttribute('data-bonus');cells.forEach(({cell})=>cell.classList.remove('dss-sticky','dss-locked','dss-new-lock','dss-clearing','dss-dropping','dss-win-flash','dss-transforming','dss-transformed'));holdWin.hidden=true;reels.hidden=false;showGrid(state.last?.grid??Array(20).fill('jar'));showScene('main');setFeature('main',state.last?.message??'Watch for 3 scatters, stash crates or lawnmowers.','5 REELS · 1,024 WAYS');refresh();status.textContent='Practice only — simulated credits, no wallet or wagers';if(auto&&autoLeft>0&&state.balance>=state.bet){autoLeft--;schedule(start,400);}else{auto=false;autoLeft=0;autoBtn.textContent='AUTO ×10';}}
 function showFeatureResult(event,done){
  const title=FEATURE_TITLES[event.type]??event.label??'FEATURE COMPLETE';
  resultTitle.textContent=title;
  resultAmount.textContent=previewPriorState?'DEMO · '+money(event.units*state.last.stake)+' POTENTIAL CREDITS':money(event.units*state.last.stake)+' PRACTICE CREDITS';
  resultDetail.textContent=event.type==='stash'?event.filled+' STASH PRIZES COLLECTED':
   event.type==='free'?event.spins+' FREE SPINS PLAYED':
   event.type==='keller'?event.spins+' HOA RESPINS COMPLETED':
   event.type==='mow'?event.boards.length+' CASCADES COMPLETED':
   'BONUS MODIFIER APPLIED';
  resultScreen.hidden=false;resultScreen.dataset.feature=event.type;
  status.textContent='FEATURE RESULT — '+title;
  schedule(()=>{resultScreen.hidden=true;done();},2200);
 }
 function showBonusHud(type,progress,extra=''){
  bonusHeader.hidden=false;scene.dataset.bonus=type;
  bonusMode.textContent=FEATURE_TITLES[type]??type.toUpperCase();
  bonusProgress.textContent=progress;
  bonusMult.textContent=extra;
 }
 function animateBonusGrid(entry,type,done){
  const grid=entry.grid;
  if(type==='mow'){
   const removed=entry.removed??[];
   if(entry.before)showGrid(entry.before);
   removed.forEach(i=>cells[i].cell.classList.add('dss-clearing'));
   schedule(()=>{
    showGrid(grid);
    removed.forEach(i=>{cells[i].cell.classList.remove('dss-clearing');cells[i].cell.classList.add('dss-dropping');});
    schedule(()=>{removed.forEach(i=>cells[i].cell.classList.remove('dss-dropping'));done();},500);
   },500);
   return;
  }
  if(type==='free'){
   // The free-spin reel animation shares the main game's 50ms clock and
   // 1.0/1.5/2.0/2.5/3.0-second stagger. Only previously sticky Wilds
   // remain stationary; all other positions visibly roll until their reel stops.
   // Use deterministic display symbols, never the payout RNG.
   const locked=new Set(entry.previous??[]);
   for(const i of locked)setCell(i,'wild');
   const stopTicks=[20,30,40,50,60];
   let tickNumber=0;
   reelEls.forEach(reel=>{
    reel.classList.remove('dss-stopping');
    reel.classList.add('dss-spinning','dss-free-spinning');
   });
   const tick=()=>{
    tickNumber++;
    for(let reel=0;reel<5;reel++){
     if(tickNumber>stopTicks[reel])continue;
     if(tickNumber===stopTicks[reel]){
      for(let row=0;row<4;row++){
       const i=reel*4+row;
       setCell(i,grid[i]);
       cells[i].cell.classList.toggle('dss-sticky',(entry.sticky??[]).includes(i));
       cells[i].cell.classList.toggle('dss-win-flash',(entry.newWilds??[]).includes(i));
      }
      reelEls[reel].classList.remove('dss-spinning','dss-free-spinning');
      reelEls[reel].classList.add('dss-stopping');
      reelEls[reel].dataset.freeStop=String(tickNumber*50);
     }else{
      for(let row=0;row<4;row++){
       const i=reel*4+row;
       if(!locked.has(i))setCell(i,SYMBOLS[(tickNumber*3+reel*7+row*5)%SYMBOLS.length]);
      }
     }
    }
    if(tickNumber<stopTicks[4]){schedule(tick,50);return;}
    reelEls.forEach(reel=>reel.classList.remove('dss-stopping'));
    status.textContent='FREE SPIN REELS STOPPED — '+(entry.newWilds??[]).length+' NEW STICKY WILDS';
    schedule(()=>{
     cells.forEach(({cell})=>cell.classList.remove('dss-win-flash'));
     done();
    },680);
   };
   schedule(tick,50);
   return;
  }
  // During free spins and HOA inspection, temporarily cycle only non-locked
  // positions, then snap to the predetermined engine result. Never reroll wins.
  const fixed=new Set(type==='free'?(entry.previous??[]):(entry.locked??[]).filter(i=>!(entry.newLocks??[]).includes(i)));
  let ticks=0;
  const tick=()=>{
   ticks++;
   for(let i=0;i<20;i++)if(!fixed.has(i))setCell(i,SYMBOLS[(ticks*7+i*3)%SYMBOLS.length]);
   if(ticks<6){schedule(tick,85);return;}
   showGrid(grid);
   const highlights=type==='free'?(entry.sticky??[]):(entry.locked??[]);
   cells.forEach(({cell},i)=>{
    cell.classList.toggle('dss-sticky',type==='free'&&highlights.includes(i));
    cell.classList.toggle('dss-locked',type==='keller'&&highlights.includes(i));
    cell.classList.toggle('dss-new-lock',type==='keller'&&(entry.newLocks??[]).includes(i));
    cell.classList.toggle('dss-win-flash',entry.units>0&&(type==='free'?highlights.includes(i):(entry.newLocks??[]).includes(i)));
   });
   schedule(()=>{
    cells.forEach(({cell})=>cell.classList.remove('dss-new-lock','dss-win-flash'));
    done();
   },680);
  };
  tick();
 }
 function playStashBonus(event){
  reels.hidden=true;holdWin.hidden=false;showBonusHud('stash','3 RESPINS','LOCK PRIZES');
  const steps=event.steps??[];let index=0;
  const apply=(snapshot,lockedBefore=null,stoppedReel=null)=>{
   holdCells.forEach(({tile,leaf,value},i)=>{
    if(stoppedReel!==null&&i%5!==stoppedReel)return;
    const prize=snapshot.board[i],newly=snapshot.newIndices.includes(i);
    tile.classList.toggle('dss-hold-locked',prize!==null);
    tile.classList.toggle('dss-hold-new',newly);
    tile.classList.remove('dss-hold-cycling');
    leaf.hidden=prize!==null;
    value.textContent=prize===null?'':prize.toFixed(2)+'×';
   });
   if(stoppedReel!==null)return;
   holdCount.textContent='RESPINS REMAINING: '+snapshot.remaining;
   showBonusHud('stash','RESPIN '+snapshot.number,'REMAINING '+snapshot.remaining);
   holdTotal.textContent=snapshot.kind==='start'?snapshot.board.filter(v=>v!==null).length+' STASH PRIZES LOCKED — FIND MORE!':
    snapshot.newIndices.length?'NEW STASH FOUND! RESPINS RESET TO 3':'NO NEW PRIZE — RESPINS COUNT DOWN';
   setFeature('stash','Locked prizes stay on the board as respins continue.',
    'RESPINS '+snapshot.remaining+' · PRIZES '+snapshot.board.filter(v=>v!==null).length+'/20');
   status.textContent='HOLD & WIN · RESPIN '+snapshot.number+' · '+snapshot.remaining+' REMAINING';
  };
  const advance=()=>{
   if(index>=steps.length){
    holdCount.textContent=event.completed?'FULL STASH!':'HOLD & WIN COMPLETE';
    holdTotal.textContent=(previewPriorState?'DEMO TOTAL (NOT AWARDED): ':'TOTAL STASH WIN: ')+money(event.units*state.last.stake)+' PRACTICE CREDITS';
    setFeature('stash',event.filled+' prizes collected','TOTAL '+event.units.toFixed(2)+'× BET');
    status.textContent='SECRET STASH BONUS FINISHED';
    showFeatureResult(event,()=>{holdWin.hidden=true;reels.hidden=false;bonusHeader.hidden=true;nextEvent();});
    return;
   }
   const snapshot=steps[index++];
   if(snapshot.kind==='start'){apply(snapshot);schedule(advance,850);return;}
   // All five columns visually spin together. Reel 1 stops at 1.0 sec,
   // reel 2 at 1.5 sec, continuing to reel 5 at 3.0 sec, exactly as base play.
   const previous=steps[index-2]?.board??Array(20).fill(null);
   for(const {tile} of holdCells)tile.classList.remove('dss-hold-new');
   for(let i=0;i<20;i++){
    const {tile,leaf,value}=holdCells[i];
    if(previous[i]!==null)continue; // Prize remains locked across respins.
    tile.classList.add('dss-hold-cycling');
    leaf.hidden=false;value.textContent='';
   }
   let tick=0;
   const spinTick=()=>{
    tick++;
    for(let reel=0;reel<5;reel++){
     if(tick>20+reel*10)continue;
     if(tick===20+reel*10){
      apply(snapshot,previous,reel);
      holdTiles.dataset.lastStoppedReel=String(reel+1);
     }else{
      for(let row=0;row<4;row++){
       const i=row*5+reel,{value}=holdCells[i];
       // Visual spin is the moving leaf and streaked tile backdrop. Do not
       // flicker question marks over the moving symbol artwork.
       if(previous[i]===null)value.textContent='';
      }
     }
    }
    if(tick<60){schedule(spinTick,50);return;}
    apply(snapshot);
    schedule(advance,850);
   };
   schedule(spinTick,50);
  };
  advance();
 }
 function animateCastModifier(event){
  // Base reel result must be shown before applying a modifier. The already
  // calculated event.grid and event.units are authoritative; animations do not
  // roll randomness or award chips independently.
  const original=state.last.grid;
  const final=event.grid??original;
  const changed=final.map((symbol,i)=>symbol!==original[i]?i:-1).filter(i=>i>=0);
  showGrid(original);
  modifierAction.hidden=false;
  modifierAction.dataset.type=event.type;
  modifierAction.dataset.outcome=event.label??'';
  modifierActionTitle.textContent=event.label??FEATURE_TITLES[event.type]??'MYSTERY MODIFIER';
  modifierActionDetail.textContent=changed.length?
   changed.length+' REEL SYMBOL'+(changed.length===1?'':'S')+' CHANGING':
   (event.multiplier??1)>1?'×'+event.multiplier+' WIN MULTIPLIER':'REEL EFFECT ACTIVATED';
  setFeature(event.type,'WATCH THE REELS TRANSFORM',modifierActionTitle.textContent);
  showBonusHud(event.type,'MYSTERY MODIFIER',event.label??'');
  // Give the player a clear view of the original grid and what will happen.
  schedule(()=>{
   const reveal=(index)=>{
    if(index>=changed.length){
     showGrid(final);
     const transformed=new Set(changed);
     cells.forEach(({cell},i)=>cell.classList.toggle('dss-transformed',transformed.has(i)));
     modifierActionDetail.textContent=event.awardedFreeSpins?
      event.scatterCount+' SCATTERS — FREE SPINS UNLOCKED!':
      (event.multiplier??1)>1?'×'+event.multiplier+' MULTIPLIER APPLIED':
      changed.length+' SYMBOL'+(changed.length===1?'':'S')+' TRANSFORMED';
     if(event.awardedFreeSpins){
      cells.forEach(({cell},i)=>cell.classList.toggle('dss-trigger-scatter',final[i]==='scatter'));
      status.textContent=event.scatterCount+' SCATTERS — FIVE MINUTES OF PEACE FREE SPINS AWARDED!';
     }else status.textContent='FEATURE APPLIED: '+modifierActionTitle.textContent;
     // Show how transformed positions form winning routes before results.
     schedule(()=>showWinningWays(final,evaluate(final),()=>{
      modifierAction.hidden=true;bonusHeader.hidden=true;
      showFeatureResult(event,()=>{
       cells.forEach(({cell})=>cell.classList.remove('dss-transforming','dss-transformed'));
       nextEvent();
      });
     }),1400);
     return;
    }
    const i=changed[index],cell=cells[i].cell;
    cell.classList.add('dss-transforming');
    modifierActionDetail.textContent='TRANSFORMING '+(index+1)+' OF '+changed.length;
    schedule(()=>{
     setCell(i,final[i]);
     cell.classList.remove('dss-transforming');
     cell.classList.add('dss-transformed');
     schedule(()=>reveal(index+1),220);
    },260);
   };
   reveal(0);
  },650);
 }
 function playFeatureSteps(event){
  if(['jen','family','bud'].includes(event.type)){animateCastModifier(event);return;}
  if(event.type==='stash'){playStashBonus(event);return;}
  const boards=event.boards??[];
  if(!boards.length){
   if(event.grid)showGrid(event.grid);
   setFeature(event.type,event.label??'Feature awarded','AWARD '+Number(event.units??0).toFixed(2)+'× BET');
   showFeatureResult(event,nextEvent);return;
  }
  let step=0,accumulated=0;
  const begin=()=>{
   if(event.type!=='mow'||!event.initialGrid){advance();return;}
   showBonusHud('mow','CLEARING LAWNMOWERS','THEN 5 CASCADES');
   setFeature('mow','Replacing lawnmowers before the first cascade','5 CASCADES');
   const indices=event.mowerIndices??[];
   indices.forEach(i=>cells[i].cell.classList.add('dss-mower-replacing'));
   status.textContent='REPLACING TRIGGERING LAWNMOWERS';
   schedule(()=>{
    showGrid(event.initialGrid);
    indices.forEach(i=>{
     cells[i].cell.classList.remove('dss-mower-replacing');
     cells[i].cell.classList.add('dss-dropping');
    });
    schedule(()=>{
     indices.forEach(i=>cells[i].cell.classList.remove('dss-dropping'));
     advance();
    },550);
   },180);
  };
  const advance=()=>{
   if(step>=boards.length){
    showFeatureResult(event,()=>{
     bonusHeader.hidden=true;cells.forEach(({cell})=>cell.classList.remove('dss-sticky','dss-locked'));
     nextEvent();
    });return;
   }
   const entry=boards[step],which=step+1;
   showBonusHud(event.type,
    event.type==='free'?'FREE SPIN '+which+' OF '+boards.length:
    event.type==='keller'?'INSPECTION RESPIN '+which+' OF '+boards.length:
    'CASCADE '+which+' OF '+boards.length,
    event.type==='free'?'×'+entry.mult+' MULTIPLIER':'');
   const detail=event.type==='free'?'Sticky Wilds remain on the reels':
    event.type==='mow'?'Cut symbols disappear and new symbols tumble down':'Premium symbols lock for remaining respins';
   setFeature(event.type,detail,'SPIN '+which+' / '+boards.length);
   animateBonusGrid(entry,event.type,()=>{
    accumulated+=entry.units;
    status.textContent='FEATURE WIN '+money(entry.units*state.last.stake)+' · TOTAL '+money(accumulated*state.last.stake)+' PRACTICE CREDITS';
    const winEvaluation=evaluate(entry.grid);
    const displayEvaluation=event.type==='mow'?
     {...winEvaluation,wins:winEvaluation.wins.map(win=>({...win,amount:win.amount*MOW_PAYOUT_FACTOR}))}:
     winEvaluation;
    showWinningWays(entry.grid,displayEvaluation,()=>{step++;schedule(advance,500);});
   });
  };
  begin();
 }
 function nextEvent(){
  if(destroyed)return;
  clearWinTrace();
  cells.forEach(x=>x.cell.classList.remove('dss-locked','dss-trigger-scatter'));
  if(eventIndex>=events.length){finish();return;}
  const event=events[eventIndex++];
  comicCard.hidden=true;overlay.classList.remove('dss-comic-active');
  overlay.hidden=false;bubble.hidden=true;headline.textContent=FEATURE_TITLES[event.type]??event.label;
  showCast(event.type);showScene(['free','stash','mow'].includes(event.type)?event.type:'main');
  setFeature(event.type,'BONUS STARTING…',event.label??'');
  overlay.classList.remove('dss-enter');void overlay.offsetWidth;overlay.classList.add('dss-enter');
  schedule(()=>{
   bubble.textContent=event.type==='keller'?event.spins+' LOCKED RESPINS':event.type==='bud'?'FETCH WILD!':event.label;
   bubble.hidden=false;status.textContent='BONUS ANNOUNCEMENT: '+(event.label??event.type).toUpperCase();
   schedule(()=>{
    const play=()=>{
     overlay.hidden=true;
     status.textContent='FEATURE PLAYING: '+(event.label??event.type).toUpperCase();
     playFeatureSteps(event);
    };
    if(['family','jen','bud','keller'].includes(event.type)){
     showComicAction(event,play);
    }else play();
   },DSS_BONUS_PRESENTATION.resultMs);
  },DSS_BONUS_PRESENTATION.characterMs);
 }
 function startBonusPreview(){
  if(destroyed||busy||auto||state.mode!=='practice')return;
  const selected=[...previewSelect.querySelectorAll('option')].find(x=>x.hasAttribute('selected'))?.value||previewSelect.value||previewSelect.querySelector('option')?.value;
  const {grid,event}=makeBonusPreview(selected,rng);
  clearWinTrace();
  previewPriorState=state;
  // UI needs a stake and a base grid for display; this temporary snapshot
  // never goes through spin() and does not update rounds/history/balance.
  state={...state,last:{grid,base:evaluate(grid),events:[event],stake:state.bet,win:0}};
  events=[event];eventIndex=0;busy=true;
  showGrid(grid);refresh();
  status.textContent='BONUS TEST PREVIEW — NO CREDITS AWARDED';
  nextEvent();
 }
 function start(){if(destroyed||busy||previewPriorState)return;clearWinTrace();if(state.balance<state.bet){state.message='Insufficient practice credits — reset to continue.';refresh();return;}busy=true;refresh();status.textContent='SIMULATED SPIN — NO TRANSACTION';state=spin(state,rng);events=state.last.events;eventIndex=0;setFeature('main','Reels spinning…','GOOD LUCK!');animateSpin(state.last.grid);}
 const reset=btn('RESET PRACTICE CREDITS',()=>{if(busy)return;state=newGame();previewPriorState=null;clearWinTrace();modifierAction.hidden=true;resultScreen.hidden=true;bonusHeader.hidden=true;showScene('main');setFeature('main','Watch for 3 bonus symbols.');showGrid(Array(20).fill('jar'));refresh();});controls.append(reset);
 root.stopAnimation=()=>{destroyed=true;auto=false;if(currentTimer!==null)clearTimer(currentTimer);currentTimer=null;reelEls.forEach(reel=>reel.classList.remove('dss-spinning','dss-stopping','dss-free-spinning'));};
 root.getState=()=>state;
 showGrid(Array(20).fill('jar'));setFeature('main','3 Stash crates unlock Hold & Win.');refresh();return root;
}
