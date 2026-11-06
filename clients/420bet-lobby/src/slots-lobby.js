import {EMERALD_ASSETS} from './emerald-slots-assets.js';
import {BASE_REELS as EMERALD_REELS,visibleGrid} from './emerald-v2-strips.js';

// Slot-machine discovery only. Each machine keeps its own separate implementation.
export const SLOT_MACHINES=Object.freeze([
 Object.freeze({id:'emerald-harvest',title:'Emerald Harvest',subtitle:'1,024 Ways to Win',description:'Five reels, four rows, Wilds, Scatters and free-spin bonuses.',art:'/assets/420bet/slots-lobby/emerald-harvest-lobby-cabinet.png',status:'Practice available'}),
 Object.freeze({id:'mary-jane-sticky-wilds',title:"Mary Jane's Sticky Wilds",subtitle:'20 Lines · Gold Leaf Frames',description:'A boho Vegas slot with 10-spin frames, ×10 Buzz, and Sticky Wild Free Spins.',art:'/assets/420bet/slots-lobby/mary-janes-sticky-wilds-lobby-cabinet.png',status:'Practice available'}),
 Object.freeze({id:'dads-secret-stash',title:"Dad's Secret Stash",subtitle:'1,024 Ways · Suburban Chaos',description:'Gary and the family, mystery modifiers, locked respins, Fetch Wilds and the garage stash.',art:'/assets/420bet/dads-secret-stash/lobby-cabinet.png',status:'Practice available'}),
 Object.freeze({id:'cannabis-cowboy',title:'The Cannabis Cowboy',subtitle:'High Country Clusters · 6×8',description:'Cole Haze, his mountain ranch, growing harvest multipliers, smoke-ring wilds and road-trip bonuses.',art:'/assets/420bet/slots-lobby/cannabis-cowboy-lobby-cabinet.png',status:'Coming soon · Preview',preview:true}),
 Object.freeze({id:'sin-city-high-rollers',title:'Sin City High Rollers',subtitle:'Bobby Las Vegas · 1,024 Ways',description:'Five reels, Puff Puff Pass, Hotbox Respins and Chronic Sessions Free Spins.',art:'/assets/420bet/slots-lobby/sin-city-high-rollers-lobby-cabinet.png',status:'Practice available'})
]);
// A fixed, genuine 5×4 outcome from the Emerald Harvest reel strips is used
// for visual discovery. It never awards credits or runs a game round.
export const EMERALD_LOBBY_STOPS=Object.freeze([15,18,21,25,27]);
export const EMERALD_LOBBY_BOARD=Object.freeze(visibleGrid(EMERALD_REELS,EMERALD_LOBBY_STOPS));
export const EMERALD_LOBBY_NAMES=Object.freeze(['Bud','Grinder','Lighter','Bong','Chips','Wild','Scatter']);
export function createEmeraldLobbyPreview(doc=globalThis.document){
 const stage=doc.createElement('div');stage.className='slots-emerald-preview';stage.setAttribute('role','img');
 stage.setAttribute('aria-label','Emerald Harvest gameplay preview: five reels, four rows, cannabis-themed symbols and a Wild');
 const grid=doc.createElement('div');grid.className='slots-emerald-reel-grid';grid.setAttribute('aria-hidden','true');
 for(const symbol of EMERALD_LOBBY_BOARD){
  const cell=doc.createElement('span');cell.className='slots-emerald-symbol';
  const image=doc.createElement('img');image.src=EMERALD_ASSETS.symbols[symbol];image.alt='';image.loading='lazy';image.decoding='async';
  cell.append(image);grid.append(cell);
 }
 stage.append(grid);
 const frame=doc.createElement('img');frame.className='slots-emerald-cabinet';frame.src=EMERALD_ASSETS.cabinet;frame.alt='';frame.loading='eager';frame.decoding='async';
 stage.append(frame);
 return stage;
}
export const slotMachinePath=id=>'#game=slots&machine='+encodeURIComponent(id);
export function slotMachineFromHash(hash=''){
 const params=new URLSearchParams(String(hash).replace(/^#/,''));
 if(params.get('game')!=='slots')return null;
 return SLOT_MACHINES.find(machine=>machine.id===params.get('machine'))??null;
}
export function createSlotsLobby(doc=globalThis.document,onSelect=()=>{}){
 const root=doc.createElement('section');root.className='slots-lobby';root.dataset.view='slots-lobby';
 const intro=doc.createElement('header');intro.className='slots-lobby-intro';
 const eyebrow=doc.createElement('p');eyebrow.className='slots-lobby-eyebrow';eyebrow.textContent='420BET SLOT COLLECTION';
 const title=doc.createElement('h1');title.textContent='Slots Lobby';
 const note=doc.createElement('p');note.textContent='Choose your machine. Each slot has its own cabinet, rules and bonus features. Practice only — no real wagers or payouts.';
 intro.append(eyebrow,title,note);root.append(intro);
 const carousel=doc.createElement('div');carousel.className='slots-carousel';
 const prev=doc.createElement('button');prev.type='button';prev.className='slots-carousel-arrow';prev.textContent='‹';prev.setAttribute('aria-label','Previous slot cabinets');
 const next=doc.createElement('button');next.type='button';next.className='slots-carousel-arrow';next.textContent='›';next.setAttribute('aria-label','Next slot cabinets');
 const grid=doc.createElement('div');grid.className='slots-machine-grid';
 const cards=[];let offset=0;const pageSize=3;
 for(const machine of SLOT_MACHINES){
  const card=doc.createElement('article');card.className='slots-machine-card';
  const link=doc.createElement('a');link.className='slots-machine-link';link.href=slotMachinePath(machine.id);
  link.setAttribute('aria-label',(machine.preview?'Preview ':'Play ')+machine.title+(machine.preview?' — in development':' in practice mode'));
  const art=doc.createElement('div');art.className='slots-machine-art';
  const image=doc.createElement('img');
  image.src=machine.art;image.alt=machine.title+' slot cabinet';image.loading='eager';image.decoding='async';
  const artTitle=doc.createElement('span');artTitle.className='slots-machine-art-title';artTitle.textContent=machine.title;
  art.append(image,artTitle);
  const body=doc.createElement('div');body.className='slots-machine-body';
  const status=doc.createElement('small');status.className='slots-machine-status';status.textContent=machine.status;
  const heading=doc.createElement('h2');heading.textContent=machine.title;
  const subtitle=doc.createElement('strong');subtitle.textContent=machine.subtitle;
  const description=doc.createElement('p');description.textContent=machine.description;
  const play=doc.createElement('span');play.className='slots-machine-play';play.textContent=(machine.preview?'View Preview: ':'Enter ')+machine.title+' →';
  body.append(status,heading,subtitle,description,play);link.append(art,body);
  link.addEventListener('click',event=>{if(event.defaultPrevented||(event.button!==undefined&&event.button!==0)||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();onSelect(machine);});
  card.append(link);grid.append(card);cards.push(card);
 }
 function update(){
  const count=cards.length,visible=Math.min(pageSize,count),names=[];
  cards.forEach((card,i)=>{
   const position=(i-offset+count)%count;
   card.hidden=position>=visible;
   card.style.order=String(position);
   card.dataset.carouselPosition=String(position);
   if(position<visible)names[position]=SLOT_MACHINES[i].title;
  });
  prev.disabled=next.disabled=count<=pageSize;
  carousel.setAttribute('aria-label','Showing '+names.join(', ')+'; looping slot cabinet carousel');
 }
 prev.addEventListener('click',()=>{offset=(offset-1+cards.length)%cards.length;update();});
 next.addEventListener('click',()=>{offset=(offset+1)%cards.length;update();});
 carousel.append(prev,grid,next);root.append(carousel);update();return root;
}
