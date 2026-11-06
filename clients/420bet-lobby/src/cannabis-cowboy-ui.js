// Cannabis Cowboy M2: nontransactional visual shell. M3 owns the outcome engine.
export const COWBOY_ART=Object.freeze({
  lobby:'/assets/420bet/slots-lobby/cannabis-cowboy-lobby-cabinet.png'
});
export const COWBOY_ASSET_ROOT='/assets/420bet/cannabis-cowboy/';
export const COWBOY_SYMBOL_ART=Object.freeze([
 'cannabis-cowboy-cannabis-bud.png',
 'cannabis-cowboy-mason-jar.png',
 'cannabis-cowboy-guitar.png',
 'cannabis-cowboy-vinyl-record.png',
 'cannabis-cowboy-boots.png',
 'cannabis-cowboy-lucky-horseshoe.png',
 'cannabis-cowboy-rolling-papers.png',
 'cannabis-cowboy-cole-haze.png',
 'cannabis-cowboy-smoke-ring-wild.png',
 'cannabis-cowboy-tour-bus-scatter.png',
 'cannabis-cowboy-route-420-road-trip.png'
]);
export const COWBOY_BONUS_ART=COWBOY_ASSET_ROOT+'cannabis-cowboy-compass-bonus.png';
export function cowboySymbolImage(doc,id){
 const symbol=COWBOY_SYMBOLS[id];if(!symbol)throw Error('Invalid Cowboy symbol');
 const image=doc.createElement('img');image.className='cc-symbol-image';
 image.src=COWBOY_ASSET_ROOT+COWBOY_SYMBOL_ART[id];
 image.alt='';image.setAttribute('aria-hidden','true');image.draggable=false;
 return image;
}
export const COWBOY_LAYOUT=Object.freeze({columns:6,rows:8,positions:48});
export const COWBOY_SYMBOLS=Object.freeze([
  Object.freeze({name:'Premium Bud',glyph:'🌿',kind:'bud'}),
  Object.freeze({name:'Mason Jar',glyph:'🫙',kind:'jar'}),
  Object.freeze({name:'Guitar',glyph:'🎸',kind:'guitar'}),
  Object.freeze({name:'Vinyl Record',glyph:'💿',kind:'vinyl'}),
  Object.freeze({name:'Cowboy Boots',glyph:'👢',kind:'boots'}),
  Object.freeze({name:'Horseshoe',glyph:'♧',kind:'horseshoe'}),
  Object.freeze({name:'Rolling Papers',glyph:'▤',kind:'papers'}),
  Object.freeze({name:'Cole Haze',glyph:'🤠',kind:'cole'}),
  Object.freeze({name:'Smoke Ring Wild',glyph:'◎',kind:'smoke-wild'}),
  Object.freeze({name:'Tour Bus Scatter',glyph:'🚌',kind:'scatter'}),
  Object.freeze({name:'Road Trip Ticket',glyph:'🎫',kind:'road-ticket'})
]);
// Deliberately fixed presentation, never a random outcome or representation of a paid spin.
export const COWBOY_PREVIEW_GRID=Object.freeze([
  1,4,7,3,0,5,
  2,0,1,4,6,3,
  5,0,0,0,1,4,
  3,4,0,0,0,6,
  7,0,1,0,5,2,
  4,3,1,0,7,5,
  6,5,4,3,1,0,
  1,7,6,2,4,3
]);
function el(doc,tag,klass='',text){
 const n=doc.createElement(tag);if(klass)n.className=klass;
 if(text!==undefined)n.textContent=text;return n;
}
function panel(doc,header,lines,extraClass=''){
 const section=el(doc,'section','cc-panel '+extraClass);
 section.append(el(doc,'h3','cc-panel-title',header));
 for(const line of lines)section.append(el(doc,'p','cc-panel-line',line));
 return section;
}
function readonlyButton(doc,label,klass=''){
 const b=el(doc,'button','cc-control '+klass,label);
 b.type='button';b.disabled=true;b.title='Available after the game engine is implemented in M3';
 return b;
}
export function createCannabisCowboyShell(doc=globalThis.document){
 const root=el(doc,'section','cc-game');root.dataset.view='cannabis-cowboy';
 root.dataset.mode='visual-preview';root.setAttribute('aria-label','Cannabis Cowboy High Country Clusters 6 by 8 game screen');
 const scene=el(doc,'div','cc-ranch-wallpaper');scene.setAttribute('aria-hidden','true');
 const header=el(doc,'header','cc-title-banner');
 const eyebrow=el(doc,'span','cc-eyebrow','420BET · SLOT #4 · VISUAL PREVIEW');
 const heading=el(doc,'h1','cc-game-title','The Cannabis Cowboy');
 const sub=el(doc,'div','cc-game-subtitle','HIGH COUNTRY CLUSTERS');
 header.append(eyebrow,heading,sub);
 const cabinet=el(doc,'div','cc-stage');
 const left=el(doc,'aside','cc-left-rail');
 const portrait=el(doc,'div','cc-portrait');
 const approved=el(doc,'img','cc-approved-cabinet');
 approved.src=COWBOY_ART.lobby;approved.alt='Approved Cannabis Cowboy cabinet concept featuring Cole Haze with long silver hair, guitar, and mountain ranch';
 approved.loading='eager';approved.decoding='async';
 portrait.append(approved,el(doc,'span','cc-portrait-label','COLE HAZE'));
 left.append(portrait,panel(doc,'CLUSTER PAYS',['5+ matching adjacent symbols','Vertical and horizontal neighbors'], 'cc-feature-panel'));
 left.append(panel(doc,'GROWING HARVEST',['×2 · ×4 · ×8 · ×16 · ×32','Multipliers persist during free spins'], 'cc-feature-panel'));
 const center=el(doc,'main','cc-middle');
 const boardHeader=el(doc,'div','cc-board-header');
 boardHeader.append(el(doc,'span','','6 × 8 CLUSTER GRID'),el(doc,'span','cc-board-readonly','DISPLAY PREVIEW'));
 const grid=el(doc,'div','cc-symbol-grid');
 grid.setAttribute('role','group');
 grid.setAttribute('aria-label','Six-column, eight-row Cannabis Cowboy symbol grid; active clusters are traced with neon lines');
 COWBOY_PREVIEW_GRID.forEach((index,i)=>{
  const symbol=COWBOY_SYMBOLS[index];
  const cell=el(doc,'div','cc-cell cc-symbol-'+symbol.kind);
  cell.dataset.position=String(i);
  cell.dataset.symbol=symbol.kind;
  cell.append(cowboySymbolImage(doc,index));
  grid.append(cell);
 });
 const bottom=el(doc,'div','cc-board-foot','THE HARVEST BEGINS IN M3');
 center.append(boardHeader,grid,bottom);
 const right=el(doc,'aside','cc-right-rail');
 right.append(panel(doc,'ENDLESS HARVEST',['3 SCATTERS  →  8 FREE SPINS','4 SCATTERS  →  12 FREE SPINS','5 SCATTERS  →  16 FREE SPINS','6+ SCATTERS → 20 FREE SPINS'],'cc-feature-panel'));
 right.append(panel(doc,'SMOKE RING WILDS',['Growing emerald wild multipliers','Sticky during the free spins'],'cc-feature-panel'));
 right.append(panel(doc,'ON THE ROAD AGAIN',['3 Road Trip Tickets · five stops','Pick a guitar case at each stop'],'cc-feature-panel'));
 const paytable=el(doc,'section','cc-panel cc-paytable');
 paytable.append(el(doc,'h3','cc-panel-title','CLUSTER PAYTABLE'));
 const help=el(doc,'p','cc-paytable-caption','Prize multiples of wager · 5+ connected symbols');
 paytable.append(help);
 const payoutTable=el(doc,'table','cc-paytable-table');
 const headerRow=el(doc,'tr');for(const label of ['SYMBOL','5','7','10','15','20+'])headerRow.append(el(doc,'th','',label));
 const thead=el(doc,'thead');thead.append(headerRow);payoutTable.append(thead);
 const tbody=el(doc,'tbody');payoutTable.append(tbody);paytable.append(payoutTable);
 right.append(paytable);
 cabinet.append(left,center,right);
 const controls=el(doc,'div','cc-console');
 controls.setAttribute('aria-label','Preview-only control console');
 controls.append(readonlyButton(doc,'☰','cc-menu'));
 const bet=el(doc,'div','cc-readout');bet.append(el(doc,'span','','BET'),el(doc,'strong','','$4.00'));
 controls.append(readonlyButton(doc,'−','cc-minus'),bet,readonlyButton(doc,'+','cc-plus'));
 controls.append(readonlyButton(doc,'▶','cc-spin'));
 const preview=el(doc,'div','cc-bonus-test');
 const previewLabel=el(doc,'label','','TEST BONUS');
 const previewSelect=el(doc,'select','cc-bonus-select');
 previewSelect.setAttribute('aria-label','Choose a bonus to test');
 for(const [value,label] of [['free','Endless Harvest'],['road','On the Road Again']]){
  const option=el(doc,'option','',label);option.value=value;previewSelect.append(option);
 }
 previewLabel.append(previewSelect);
 const previewButton=el(doc,'button','cc-bonus-preview-button','▶ TEST BONUS');
 previewButton.type='button';previewButton.disabled=true;preview.append(previewLabel,previewButton);
 controls.append(preview);
 const bal=el(doc,'div','cc-readout');bal.append(el(doc,'span','','BALANCE'),el(doc,'strong','','—'));
 controls.append(bal);
 const win=el(doc,'div','cc-readout');win.append(el(doc,'span','','WIN'),el(doc,'strong','','—'));
 controls.append(win);
 const info=el(doc,'button','cc-control cc-info','i');info.type='button';info.setAttribute('aria-label','View preview information');
 const dialog=el(doc,'div','cc-info-panel');dialog.hidden=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Cannabis Cowboy preview information');
 dialog.append(el(doc,'h2','','High Country Clusters'),el(doc,'p','','This is the M2 visual shell only. The grid is a fixed example, not a game outcome; no spin, bets, credits, awards or wallet operations are available.'));
 const dismiss=el(doc,'button','cc-dismiss','Close');dismiss.type='button';
 info.addEventListener('click',()=>{dialog.hidden=false;dismiss.focus?.();});
 dismiss.addEventListener('click',()=>{dialog.hidden=true;info.focus?.();});
 dialog.append(dismiss);controls.append(info,readonlyButton(doc,'AUTO','cc-auto'));
 const notice=el(doc,'p','cc-practice-notice','VISUAL PREVIEW ONLY · NO REAL OR PRACTICE WAGERING · M3 WILL ENABLE THE GAME ENGINE');
 root.append(scene,header,cabinet,controls,notice,dialog);
 return root;
}
