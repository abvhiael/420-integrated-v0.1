import {EMERALD_ASSETS} from './emerald-slots-assets.js';
import {BASE_REELS as EMERALD_REELS,visibleGrid} from './emerald-v2-strips.js';

// Slot-machine discovery only. Each machine keeps its own separate implementation.
export const SLOT_MACHINES=Object.freeze([
 Object.freeze({id:'emerald-harvest',title:'Emerald Harvest',subtitle:'1,024 Ways to Win',description:'Five reels, four rows, Wilds, Scatters and free-spin bonuses.',art:EMERALD_ASSETS.cabinet,status:'Practice available'}),
 Object.freeze({id:'mary-jane-sticky-wilds',title:"Mary Jane's Sticky Wilds",subtitle:'20 Lines · Gold Leaf Frames',description:'A boho Vegas slot with 10-spin frames, ×10 Buzz, and Sticky Wild Free Spins.',art:'/assets/420bet/mary-jane/mj-concept-cabinet.webp',status:'Practice available'})
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
 const grid=doc.createElement('div');grid.className='slots-machine-grid';
 for(const machine of SLOT_MACHINES){
  const card=doc.createElement('article');card.className='slots-machine-card';
  const link=doc.createElement('a');link.className='slots-machine-link';link.href=slotMachinePath(machine.id);
  link.setAttribute('aria-label','Play '+machine.title+' in practice mode');
  const art=doc.createElement('div');art.className='slots-machine-art';
  const image=machine.id==='emerald-harvest'?createEmeraldLobbyPreview(doc):doc.createElement('img');
  if(machine.id!=='emerald-harvest'){image.src=machine.art;image.alt=machine.title+' slot cabinet';image.loading='eager';image.decoding='async';}
  const artTitle=doc.createElement('span');artTitle.className='slots-machine-art-title';artTitle.textContent=machine.title;
  art.append(image,artTitle);
  const body=doc.createElement('div');body.className='slots-machine-body';
  const status=doc.createElement('small');status.className='slots-machine-status';status.textContent=machine.status;
  const heading=doc.createElement('h2');heading.textContent=machine.title;
  const subtitle=doc.createElement('strong');subtitle.textContent=machine.subtitle;
  const description=doc.createElement('p');description.textContent=machine.description;
  const play=doc.createElement('span');play.className='slots-machine-play';play.textContent='Enter '+machine.title+' →';
  body.append(status,heading,subtitle,description,play);link.append(art,body);
  link.addEventListener('click',event=>{if(event.defaultPrevented||(event.button!==undefined&&event.button!==0)||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();onSelect(machine);});
  card.append(link);grid.append(card);
 }
 root.append(grid);return root;
}
