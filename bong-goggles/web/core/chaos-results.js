// CCC-ART-7: read-only views of canonical CCC-1 stage and championship results.
import {LEGS,chaosLeaders} from './cross-country-chaos.js';
import {CHAOS_VEHICLE_COLORS,chaosVehicle} from './chaos-vehicles.js';
import {escapeHtml as esc} from './design-system.js';
const fmt=n=>Number(n).toLocaleString('en-CA');
const west=(s,p)=>s.results[2]?.standings.find(r=>r.id===p.id)?.banked||0;
const graphic=()=>'<svg class="ccc-result-trophy" viewBox="0 0 175 155" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">'+
 '<path d="M49 20H126V56C126 85 111 102 87 102S49 85 49 56Z" fill="#f6cd71" stroke="#fff0bc" stroke-width="4"/>'+
 '<path d="M49 29H27V47C27 67 39 76 58 76M126 29H149V47C149 67 137 76 117 76" fill="none" stroke="#ccaa65" stroke-width="10"/>'+
 '<path d="M87 103V128M57 141H119M68 130H108" fill="none" stroke="#f6cd71" stroke-width="11" stroke-linecap="round"/>'+
 '<path d="M87 38L94 51L108 53L98 63L100 76L87 69L74 76L77 63L66 53L80 51Z" fill="#20523b"/>'+
 '<path d="M17 11L28 24M158 11L147 24M87 3V16M14 89L30 84M162 89L146 84" stroke="#f6cd71" stroke-width="3"/>'+
 '</svg>';
const flag=()=>'<svg class="ccc-result-flag" viewBox="0 0 144 94" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">'+
 '<path d="M6 89V5" stroke="#f6cd71" stroke-width="6"/>'+
 '<path d="M12 9Q40 3 72 9T137 9V69Q102 61 74 68T12 68Z" fill="#f6efd7" stroke="#e4c784" stroke-width="2"/>'+
 '<path d="M12 10H43V39H12ZM74 10H105V39H74ZM43 39H74V67H43ZM105 39H137V67H105Z" fill="#1b4936"/>'+
 '</svg>';
const car=(p,i)=>'<span class="ccc-results-ride" style="--ccc-seat-color:'+CHAOS_VEHICLE_COLORS[i]+'">'+
 '<img src="'+esc(chaosVehicle(p.vehicle,i).src)+'" width="100" height="64" alt="" loading="lazy">'+
 '<small>Car '+(i+1)+'</small></span>';
const bar=n=>'<span class="ccc-results-meter" aria-hidden="true"><span style="width:'+Math.max(0,Math.min(100,Math.round(Number(n)/2500*100)))+'%"></span></span>';
export function renderChaosStageScoreboard(s,r){
 if(!LEGS[r?.leg])return '';
 return '<section class="ccc-standings ccc-results-scorecard" aria-label="'+esc(LEGS[r.leg].name)+' mileage results">'+
 '<h4>'+esc(LEGS[r.leg].name)+' — mileage scoreboard</h4>'+
 '<div class="ccc-results-table-scroll" role="region" tabindex="0" aria-label="Stage '+(r.leg+1)+' score table">'+
 '<table class="ccc-results-table"><caption>Stage '+(r.leg+1)+' of 3 · 2,500 km target</caption>'+
 '<thead><tr><th scope="col">Place</th><th scope="col">Driver</th><th scope="col">Effective km</th><th scope="col">Raw km</th><th scope="col">Banked km</th><th scope="col">Championship total</th></tr></thead><tbody>'+
 r.standings.map(row=>{const i=s.players.findIndex(p=>p.id===row.id);if(i<0)return '';
 return '<tr class="'+(row.winner?'ccc-result-winner':'')+'"><td>'+row.place+(row.winner?' ★':'')+'</td>'+
 '<th scope="row"><span class="ccc-results-driver">'+car(s.players[i],i)+esc(row.name)+'</span></th>'+
 '<td>'+fmt(row.km)+' km'+bar(row.km)+'</td><td>'+fmt(row.rawKm)+' km</td>'+
 '<td><strong>'+fmt(row.banked)+' km</strong></td><td>'+fmt(row.total)+' km</td></tr>';}).join('')+
 '</tbody></table></div><p class="ccc-results-note">Winners bank 2,500 km. Other drivers bank up to 2,500 km of effective mileage. Stage places use effective km, then raw km; exact ties share a win.</p></section>';
}
export function renderChaosRegionalResults(s){
 if(s?.phase!=='between')return '';
 const r=s.results?.at(-1);if(!r||r.leg!==s.leg)return '';
 const winners=r.standings.filter(p=>p.winner);
 return '<section class="ccc-results-screen ccc-results-screen--regional" aria-labelledby="ccc-regional-title">'+
 '<header class="ccc-results-banner"><div><p class="ccc-results-overline">STAGE '+(r.leg+1)+'/3 · CHECKERED FLAG</p>'+
 '<h3 id="ccc-regional-title">Regional finish line!</h3><p>'+esc(LEGS[r.leg].from)+' → '+esc(LEGS[r.leg].to)+'</p>'+
 '<p class="ccc-results-winner-label">'+(winners.length===1?'Stage winner':'Joint stage winners')+'</p>'+
 '<p class="ccc-results-winner-names">'+winners.map(p=>esc(p.name)).join(' &amp; ')+'</p>'+
 '<p>Winning driver'+(winners.length===1?'':'s')+' banked 2,500 championship km.</p></div>'+
 '<div class="ccc-results-emblem">'+flag()+graphic()+'</div></header>'+
 '<div class="ccc-results-victors">'+winners.map(p=>{const i=s.players.findIndex(q=>q.id===p.id);return i<0?'':
 '<figure class="ccc-results-victor">'+car(s.players[i],i)+'<figcaption>'+esc(p.name)+
 '<small>Stage '+(r.leg+1)+' winner · 2,500 km banked</small></figcaption></figure>';}).join('')+'</div>'+
 renderChaosStageScoreboard(s,r)+'</section>';
}
export function chaosChampionshipPlacings(s){
 if(s?.phase!=='finished'||s.results?.length!==3)return Object.freeze([]);
 const ordered=chaosLeaders(s);
 return Object.freeze(ordered.map(p=>{
  const w=west(s,p),above=ordered.filter(q=>q.score>p.score||
   (q.score===p.score&&q.wins>p.wins)||
   (q.score===p.score&&q.wins===p.wins&&west(s,q)>w)).length;
  return Object.freeze({id:p.id,name:p.name,score:p.score,wins:p.wins,westKm:w,
   seat:s.players.findIndex(q=>q.id===p.id),place:above+1,winner:above===0});
 }));
}
export function renderChaosChampionshipResults(s){
 const ranked=chaosChampionshipPlacings(s);if(!ranked.length)return '';
 const winners=ranked.filter(p=>p.winner);
 return '<section class="ccc-results-screen ccc-results-screen--championship" aria-labelledby="ccc-final-title">'+
 '<header class="ccc-results-banner ccc-results-banner--final"><div>'+
 '<p class="ccc-results-overline">ST. JOHN’S → VANCOUVER · FINAL FLAG</p>'+
 '<h3 id="ccc-final-title">Coast-to-coast championship complete</h3>'+
 '<p class="ccc-results-winner-label">'+(winners.length===1?'Grand champion':'Joint grand champions')+'</p>'+
 '<p class="ccc-results-winner-names">'+winners.map(p=>esc(p.name)).join(' &amp; ')+'</p>'+
 '<p>'+fmt(winners[0].score)+' championship km across three regions.</p></div>'+
 '<div class="ccc-results-emblem">'+flag()+graphic()+'</div></header>'+
 '<h4>Championship podium</h4><ol class="ccc-championship-podium" aria-label="Final championship podium">'+
 ranked.filter(p=>p.place<=3).map(p=>'<li class="ccc-podium-place ccc-podium-place--'+p.place+(p.winner?' ccc-podium-place--champion':'')+'">'+
 '<span class="ccc-podium-medal" aria-hidden="true">'+(p.place===1?'★':p.place===2?'◆':'●')+'</span>'+
 car(s.players[p.seat],p.seat)+'<strong>'+esc(p.name)+'</strong>'+
 '<span>Place '+p.place+(p.winner?' · Champion':'')+'</span>'+
 '<span>'+fmt(p.score)+' championship km</span>'+
 '<small>'+p.wins+' stage win'+(p.wins===1?'':'s')+'</small>'+
 '<span class="ccc-podium-plinth" aria-hidden="true">'+p.place+'</span></li>').join('')+'</ol>'+
 '<section class="ccc-standings ccc-results-scorecard" aria-label="Final championship standings">'+
 '<h4>Final mileage scoreboard</h4><div class="ccc-results-table-scroll" role="region" tabindex="0" aria-label="Championship standings table">'+
 '<table class="ccc-results-table"><caption>Three-stage championship · maximum 7,500 km banked</caption>'+
 '<thead><tr><th scope="col">Place</th><th scope="col">Driver</th><th scope="col">Championship km</th><th scope="col">Stage wins</th><th scope="col">West stage banked</th></tr></thead><tbody>'+
 ranked.map(p=>'<tr class="'+(p.winner?'ccc-result-winner':'')+'"><td>'+p.place+'</td>'+
 '<th scope="row"><span class="ccc-results-driver">'+car(s.players[p.seat],p.seat)+esc(p.name)+(p.winner?' ★':'')+'</span></th>'+
 '<td><strong>'+fmt(p.score)+' km</strong>'+bar(p.score/3)+'</td>'+
 '<td>'+p.wins+'</td><td>'+fmt(p.westKm)+' km</td></tr>').join('')+'</tbody></table></div>'+
 '<p class="ccc-results-note">Ranked by banked championship kilometres, then stage wins, then Western-stage banked km. Exact ties are joint champions; seat order is display-only.</p>'+
 '</section></section>';
}
export function renderChaosResultsHistory(s){
 if(!s?.results||s.results.length<2)return '';
 const records=s.phase==='between'?s.results.slice(0,-1):s.results;
 return '<details class="ccc-results-history"><summary>View '+records.length+' completed regional scoreboard'+(records.length===1?'':'s')+'</summary>'+
 records.map(r=>renderChaosStageScoreboard(s,r)).join('')+'</details>';
}
