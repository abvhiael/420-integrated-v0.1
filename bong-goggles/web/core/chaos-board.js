// CCC-3: Schematic Trans-Canada-inspired highway boards and public tabletop.
// Pure, server-independent renderer: the authoritative rules remain in cross-country-chaos.js.
import {LEGS} from './cross-country-chaos.js';
import {chaosCardArt} from './chaos-card-art.js';
import {escapeHtml as esc} from './design-system.js';
import {chaosRegionArt} from './chaos-visual-style.js';
import {chaosMapArt} from './chaos-map-art.js';
import {CHAOS_VEHICLE_COLORS,chaosVehicle,chaosVehicleHeading} from './chaos-vehicles.js';
import {renderChaosTableFeedback} from './chaos-table-art.js';

// Keep the current hand visible only while the same human driver continues their turn.
// A new seat or completed stage always returns to the privacy handoff screen.
export function keepChaosHandRevealed(before,after,wasRevealed){
 return Boolean(wasRevealed&&before?.phase==='playing'&&after?.phase==='playing'&&
  before.turn===after.turn&&before.leg===after.leg&&
  before.players?.[before.turn]?.id===after.players?.[after.turn]?.id);
}
const WIDTH=960,HEIGHT=415,FINISH=2500;
const VEHICLE_COLORS=CHAOS_VEHICLE_COLORS;
const ROUTES=Object.freeze({
 east:Object.freeze({
  landscape:'maritime',title:'Atlantic shorelines, ferry crossing and the St. Lawrence',
  points:[[57,305],[118,287],[160,206],[222,238],[263,319],[309,326],[366,260],[451,287],[530,237],[635,270],[732,205],[834,230],[917,161]],
  stops:[{name:"St. John's",at:0},{name:'Gander',at:.18},{name:'Port aux Basques',at:.35},
   {name:'North Sydney',at:.43},{name:'Fredericton',at:.67},{name:'Montréal',at:1}]
 }),
 ontario:Object.freeze({
  landscape:'lakes',title:'Northern forests, the Great Lakes and long Ontario highways',
  points:[[57,286],[142,300],[207,223],[301,252],[380,176],[470,202],[553,245],[628,174],[714,208],[803,151],[917,170]],
  stops:[{name:'Montréal',at:0},{name:'Ottawa',at:.13},{name:'North Bay',at:.3},
   {name:'Sault Ste. Marie',at:.48},{name:'Wawa',at:.63},{name:'Thunder Bay',at:.79},{name:'Kenora',at:1}]
 }),
 west:Object.freeze({
  landscape:'prairie',title:'Prairie grain elevators, foothills and Rocky Mountain passes',
  points:[[57,272],[142,269],[229,230],[322,258],[409,222],[482,268],[551,209],[618,227],[693,155],[776,193],[842,252],[917,277]],
  stops:[{name:'Kenora',at:0},{name:'Winnipeg',at:.15},{name:'Regina',at:.37},
   {name:'Calgary',at:.57},{name:'Banff',at:.7},{name:'Rogers Pass',at:.8},{name:'Vancouver',at:1}]
 })
});

const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const round=n=>Math.round(n*100)/100;
export function chaosRoutePosition(region,km){
 const points=ROUTES[region]?.points;
 if(!points||!Number.isFinite(km))throw new Error('Unknown highway region or invalid mileage.');
 const segments=points.slice(1).map((p,i)=>length(points[i],p));
 const total=segments.reduce((sum,x)=>sum+x,0);
 let remaining=total*Math.max(0,Math.min(FINISH,km))/FINISH;
 for(let i=0;i<segments.length;i++){
  if(remaining<=segments[i]||i===segments.length-1){
   const [ax,ay]=points[i],[bx,by]=points[i+1],ratio=Math.min(1,remaining/segments[i]);
   return Object.freeze({x:round(ax+(bx-ax)*ratio),y:round(ay+(by-ay)*ratio),
    angle:round(Math.atan2(by-ay,bx-ax)*180/Math.PI),progress:Math.max(0,Math.min(1,km/FINISH))});
  }
  remaining-=segments[i];
 }
 throw new Error('Invalid highway geometry.');
}
const art=(card,region)=>card?chaosCardArt(card,region):null;
const image=(card,region,css='')=>{
 const src=art(card,region);
 return src?'<img class="ccc-card-image '+esc(css)+'" src="'+esc(src)+
  '" width="480" height="810" alt="" loading="lazy" decoding="async">':'';
};
const cardLabel=c=>c.type==='mileage'?c.km+' km':c.name;
const landscape=region=>{
 if(region==='east')return '<path d="M0 285 Q120 205 226 284 T448 308 L470 415 H0Z" fill="#245c5b" opacity=".65"/>'+
  '<path d="M0 350 Q150 330 230 372 T475 345" fill="none" stroke="#8be1dd" stroke-width="2" opacity=".4"/>'+
  '<path d="M274 350 Q315 385 355 337" fill="none" stroke="#dce9db" stroke-width="2" stroke-dasharray="5 7"/>'+
  '<text x="286" y="389" class="ccc-map-landmark">FERRY</text>'+
  '<g fill="#4c906c" opacity=".78"><path d="M42 232L58 174 74 232Z"/><path d="M88 234L111 170 134 234Z"/><path d="M707 334L729 275 752 334Z"/></g>';
 if(region==='ontario')return '<g fill="#285e76" opacity=".8"><ellipse cx="295" cy="328" rx="172" ry="62"/><ellipse cx="675" cy="303" rx="145" ry="70"/></g>'+
  '<g fill="#517a58" opacity=".8"><path d="M85 247l18-62 18 62zM117 244l19-70 20 70zM362 138l24-83 25 83zM417 161l24-80 25 80zM778 329l19-70 22 70z"/></g>'+
  '<text x="298" y="354" class="ccc-map-landmark">LAKE HURON</text>'+
  '<text x="615" y="333" class="ccc-map-landmark">LAKE SUPERIOR</text>';
 return '<path d="M500 254 L572 143 611 204 676 102 719 157 777 91 824 170 865 132 960 224 960 415 500 415Z" fill="#526d65" opacity=".9"/>'+
  '<path d="M572 143L594 174 611 204 676 102 705 139 719 157 777 91 799 130 824 170" fill="none" stroke="#d4e6d8" stroke-width="5" opacity=".65"/>'+
  '<g fill="#b5a46a"><path d="M0 328h474v87H0z" opacity=".32"/><path d="M244 302h11v-49h14v49h10v-33h11v33h13v16h-59z"/></g>'+
  '<g stroke="#b7db8f" stroke-width="3"><path d="M58 352v-39m14 39v-30m14 30v-42m14 42v-27m14 27v-33"/></g>'+
  '<text x="310" y="357" class="ccc-map-landmark">PRAIRIES</text>'+
  '<text x="726" y="81" class="ccc-map-landmark">ROCKIES</text>';
};
function roadCoordinates(region){return ROUTES[region].points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ');}
function markers(region){
 return ROUTES[region].stops.map((stop,i)=>{
  const pos=chaosRoutePosition(region,stop.at*FINISH);
  const labelY=pos.y+(i%2?-21:31);
  const anchor=i===0?'start':i===ROUTES[region].stops.length-1?'end':'middle';
  return '<g class="ccc-map-stop"><circle cx="'+pos.x+'" cy="'+pos.y+'" r="6"/>'+
   '<text x="'+pos.x+'" y="'+labelY+'" text-anchor="'+anchor+'">'+esc(stop.name)+'</text></g>';
 }).join('');
}
function vehicle(player,region,seat,count){
 const pos=chaosRoutePosition(region,player.km);
 const lane=(seat-(count-1)/2)*15;
 const rad=pos.angle*Math.PI/180;
 const x=round(pos.x-Math.sin(rad)*lane),y=round(pos.y+Math.cos(rad)*lane);
 const token=chaosVehicle(player.vehicle,seat),color=VEHICLE_COLORS[seat];
 const label=player.name+' — '+token.name+' — '+player.km.toLocaleString('en-CA')+' of 2,500 km';
 return '<g class="ccc-map-vehicle ccc-map-vehicle--'+seat+'" transform="translate('+x+' '+y+')">'+
  '<title>'+esc(label)+'</title><g class="ccc-vehicle-direction" data-heading="'+chaosVehicleHeading(pos.angle)+'" transform="rotate('+pos.angle+')">'+
  '<ellipse class="ccc-vehicle-ground-shadow" cx="2" cy="4" rx="23" ry="13" fill="#0d211d" opacity=".54"/>'+
  '<ellipse class="ccc-vehicle-seat-halo" cx="0" cy="0" rx="25" ry="18" fill="'+color+'" fill-opacity=".26" stroke="'+color+'" stroke-width="2.5"/>'+
  '<rect class="ccc-vehicle-fallback" x="-19" y="-11" width="38" height="22" rx="8" fill="'+color+'" stroke="#132d24" stroke-width="2"/>'+
  '<image class="ccc-vehicle-art" href="'+token.src+'" x="-25" y="-16" width="50" height="32" preserveAspectRatio="xMidYMid meet" pointer-events="none" aria-hidden="true"/>'+
  '</g><circle class="ccc-vehicle-number-disc" cx="0" cy="-26" r="12" fill="#17332a" stroke="'+color+'" stroke-width="2.5"/>'+
  '<text class="ccc-map-seat" x="0" y="-21" text-anchor="middle">'+(seat+1)+'</text></g>';
}
export function renderChaosHighway(game){
 const leg=LEGS[game.leg],region=leg?.id;
 if(!region||!ROUTES[region])throw new Error('Invalid Cross-Country Chaos regional board.');
 const route=roadCoordinates(region);
 const caption=ROUTES[region].title;
 const artDirection=chaosRegionArt(region);
 const mapLayers=chaosMapArt(region);
 return '<section class="ccc-highway ccc-highway--'+region+'" aria-label="'+esc(leg.name)+' highway progress">'+
  '<div class="ccc-highway-head"><div class="ccc-wayfinding-sign" aria-label="Region: '+esc(artDirection.shield)+'"><span class="ccc-wayfinding-maple" aria-hidden="true">✦</span><span>'+esc(artDirection.sign)+'</span></div><div class="ccc-highway-titles"><h3>Trans-Canada Road Trip · Stage '+(game.leg+1)+'/3</h3><p>'+esc(artDirection.caption)+'</p></div>'+
  '<span>0–2,500 game km · schematic, not to scale</span></div>'+
  '<svg class="ccc-highway-svg" viewBox="0 0 '+WIDTH+' '+HEIGHT+'" role="img" aria-label="'+esc(leg.name)+': '+esc(caption)+'">'+
  '<title>'+esc(leg.name)+' — '+esc(caption)+'</title>'+
  '<rect x="0" y="0" width="'+WIDTH+'" height="'+HEIGHT+'" class="ccc-highway-canvas"/>'+
  '<path d="M0 107 Q260 -25 480 95 T960 63 L960 0 H0Z" fill="#41634d" opacity=".65"/>'+
  landscape(region)+
  // Both atlas layers are scenery only, below the unchanged live vector highway.
  // The old SVG scenery is retained as a fallback if artwork does not load.
  '<image class="ccc-map-underlay" href="'+mapLayers.underlay.url+'" width="'+WIDTH+'" height="'+HEIGHT+'" preserveAspectRatio="xMidYMid meet" pointer-events="none" aria-hidden="true"/>'+
  '<image class="ccc-map-foreground" href="'+mapLayers.foreground.url+'" width="'+WIDTH+'" height="'+HEIGHT+'" preserveAspectRatio="xMidYMid meet" pointer-events="none" aria-hidden="true"/>'+
  '<path class="ccc-highway-shadow" d="'+route+'"/>'+
  '<path class="ccc-highway-road" d="'+route+'"/>'+
  '<path class="ccc-highway-centre" d="'+route+'"/>'+
  markers(region)+game.players.map((p,i)=>vehicle(p,region,i,game.players.length)).join('')+
  '</svg><div class="ccc-road-legend">'+game.players.map((p,i)=>
   '<span class="ccc-road-driver"><i aria-hidden="true" style="--ccc-car-color:'+VEHICLE_COLORS[i]+'"></i>'+
    '<strong>'+esc(p.name)+'</strong><small>'+esc(chaosVehicle(p.vehicle,i).name)+'</small> '+p.km.toLocaleString('en-CA')+' km</span>').join('')+'</div></section>';
}
const mileageStacks=(p,region)=>{
 const amounts=[...new Set(p.played.map(c=>c.km))].sort((a,b)=>b-a);
 if(!amounts.length)return '<p class="ccc-empty-area">No mileage driven yet</p>';
 return '<div class="ccc-public-miles">'+amounts.map(km=>{
  const qty=p.played.filter(c=>c.km===km).length;
  return '<figure class="ccc-mileage-card-stack" data-stack-count="'+qty+'" aria-label="'+qty+' played '+km+' kilometre cards">'+
   '<span class="ccc-mileage-stack-paper" aria-hidden="true"></span>'+image({type:'mileage',km},region)+
   '<figcaption>'+km+' km × '+qty+'</figcaption></figure>';
 }).join('')+'</div>';
};
function seatMat(p,region,i,current,feedback=null){
 const status=p.status;
 const upgrades=p.upgrades.map(u=>{
  const used=p.used.includes(u.id);
  return '<figure class="ccc-mini-card ccc-mini-card--equipped ccc-mini-card--'+(used?'used':'ready')+'">'+
    image(u,region)+'<figcaption>'+esc(u.name)+' · '+(used?'Used':'Ready')+'</figcaption>'+
    '<span class="ccc-power-stamp ccc-power-stamp--'+(used?'used':'ready')+'">'+(used?'USED':'READY')+'</span></figure>';
 }).join('');
 const hazard=status?'<figure class="ccc-mini-card ccc-mini-card--hazard ccc-hazard--'+esc(status.kind||'block')+'">'+
  image(status,region)+'<figcaption>'+esc(status.name)+'</figcaption>'+
  '<span class="ccc-hazard-ribbon">'+esc(status.kind==='detour'?'DETOUR':status.kind==='slow'?'SLOW':'STOP')+'</span></figure>':
  '<div class="ccc-hazard-clear"><span class="ccc-clear-stamp" aria-hidden="true">✓</span><p class="ccc-empty-area">Clear highway</p></div>';
 return '<section class="ccc-seat-mat'+(current===p.id?' ccc-seat-mat--active':'')+'" aria-label="'+esc(p.name)+' public playing area">'+
  '<header><span class="ccc-seat-chip" style="--ccc-car-color:'+VEHICLE_COLORS[i]+'">Car '+(i+1)+' · '+esc(chaosVehicle(p.vehicle,i).name)+'</span>'+
  '<h4>'+esc(p.name)+'</h4><strong>'+p.km.toLocaleString('en-CA')+' km</strong></header>'+
  renderChaosTableFeedback(feedback,p.id)+
  '<div class="ccc-seat-areas"><section aria-label="Mileage stacks" class="ccc-art-zone ccc-art-zone--mileage">'+
  '<h5>Mileage · highest first</h5>'+mileageStacks(p,region)+'</section>'+
  '<section aria-label="Active hazards" class="ccc-art-zone ccc-art-zone--hazard"><h5>Road conditions</h5>'+
  '<div class="ccc-hazard-slot" data-slot="hazard">'+hazard+'</div>'+
  ((p.detourLoss||p.slowLoss)?'<p class="ccc-losses">Detours −'+p.detourLoss+' km · Slowdowns −'+p.slowLoss+' km</p>':'')+
  '</section><section aria-label="Installed upgrades" class="ccc-art-zone ccc-art-zone--power"><h5>Vehicle equipment · upgrades</h5>'+
  (upgrades?'<div class="ccc-mini-card-row ccc-power-rack">'+upgrades+'</div>':
  '<div class="ccc-power-rack ccc-power-rack--empty"><p class="ccc-empty-area">None equipped</p></div>')+
  (p.shield?'<p class="ccc-shield"><span class="ccc-shield-emblem" aria-hidden="true">✦</span>Legendary hazard shields: '+p.shield+'</p>':'')+
  '</section></div></section>';
}
export function renderChaosTable(game,{revealed=false,feedback=null}={}){
 const region=LEGS[game.leg]?.id;
 if(!region)throw new Error('Invalid tabletop stage.');
 const top=game.discard.at(-1);
 const used=game.spent.slice(-5).reverse();
 const canDraw=Boolean(revealed&&game.phase==='playing'&&game.step==='draw');
 const stockOpen=canDraw?'<button type="button" class="ccc-stock ccc-pile-control" data-chaos-action="draw" data-choice="deck" aria-label="Draw two face-down regional cards">':'<div class="ccc-stock">';
 const discardOpen=canDraw&&top?'<button type="button" class="ccc-discard-public ccc-pile-control" data-chaos-action="draw" data-choice="discard" aria-label="Take the top discard and draw one face-down card">':'<div class="ccc-discard-public">';
 return '<div class="ccc-tabletop ccc-tabletop--road-atlas" data-region="'+region+'">'+renderChaosHighway(game)+
  '<section class="ccc-table-piles" aria-label="Regional decks and played cards">'+
  stockOpen+'<span class="ccc-stock-back" aria-hidden="true"><span class="ccc-stock-symbol">✦</span><span>CCC</span><span>ROAD TRIP</span></span>'+
  '<strong>Regional draw deck</strong><small>'+game.deck.length+' face-down cards</small>'+(canDraw?'<span class="ccc-pile-instruction">Tap to draw two</span>':'')+
  (canDraw?'</button>':'</div>')+
  discardOpen+'<span class="ccc-pile-face">'+(top?image(top,region):'<span>Empty discard</span>')+'</span>'+
  '<strong>Face-up discard</strong><small>'+game.discard.length+' cards'+(top?' · '+esc(cardLabel(top)):'')+'</small>'+
  (canDraw&&top?'<span class="ccc-pile-instruction">Take this + draw one</span>':'')+
  (canDraw&&top?'</button>':'</div>')+
  '<div class="ccc-used-area"><strong>Recently played cards</strong><div class="ccc-mini-card-row ccc-spent-tray">'+
  (used.length?used.map(c=>'<figure class="ccc-mini-card ccc-spent-card">'+image(c,region)+
   '<figcaption>'+esc(cardLabel(c))+'</figcaption></figure>').join(''):'<span class="ccc-empty-area">No used cards yet</span>')+
  '</div></div></section>'+
  '<section class="ccc-player-table" aria-label="All drivers public card layouts">'+
  game.players.map((p,i)=>seatMat(p,region,i,game.phase==='playing'?game.players[game.turn].id:-1,feedback)).join('')+
  '</section></div>';
}
