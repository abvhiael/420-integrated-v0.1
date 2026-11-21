// CCC-ART-5: original vintage Canadian road-atlas vignettes. Pure, decorative SVG.
// Coordinates refer to the frozen 960x415 backdrop; gameplay is never consulted.
const shared='<path d="M-45 19Q0 25 45 19" fill="none" stroke="#dfce98" stroke-width="1.7" stroke-dasharray="3 6" opacity=".6"/>';
const ferry='<g stroke="#274b49" stroke-width="2.1" stroke-linejoin="round">'+
 '<path d="M-42 8q24-6 45 0t42 0" fill="none" stroke="#a8dad4" stroke-width="2.8"/>'+
 '<path d="M-42 16q24-6 45 0t42 0" fill="none" stroke="#d4ebd4" stroke-width="1.7"/>'+
 '<path d="M-38 -9H35L22 6H-23Z" fill="#be7157"/>'+
 '<path d="M-26 -9V-26H17V-9" fill="#ead9a7"/>'+
 '<path d="M-15 -26V-36H7V-26" fill="#f4e9c8"/>'+
 '<path d="M-9 -36V-44H-3V-36" fill="#a46e5b"/>'+
 '<path d="M-19 -20h9v7h-9zm14 0h9v7h-9zm14 0h5v7H9Z" fill="#638c93" stroke="#557172" stroke-width="1"/>'+
 '<path d="M-23 -6H22" stroke="#fff4cd" stroke-width="2"/>'+
 '<path d="M-5 -49q-7-6 2-11m6 13q8-7 0-12" fill="none" stroke="#e8ddc3" stroke-width="2"/></g>';
const moose='<g stroke="#4e4734" stroke-linejoin="round" stroke-linecap="round">'+
 '<path d="M-17-21q-12-9-12-23-12 0-13-8 12-4 24 3l8 13 5 12" fill="#b68b59" stroke-width="2"/>'+
 '<path d="M3-24q18-10 17-24 13-4 16-11-17-5-29 5L-1-31" fill="#b68b59" stroke-width="2"/>'+
 '<path d="M-30-14q13-22 43-8 12 6 15 17l-12 12-37-2-16-6Z" fill="#815738" stroke-width="2.4"/>'+
 '<path d="M13-10q16-8 22 2l-4 21-17 0-9-11Z" fill="#966b44" stroke-width="2.4"/>'+
 '<path d="M20 6l8 1-1 7-8-1Z" fill="#cfaa74" stroke-width="1.3"/>'+
 '<path d="M-22 0l1 22m13-21 1 21m26-14-2 16m10-16 4 16" fill="none" stroke="#624b36" stroke-width="5"/>'+
 '<circle cx="24" cy="-1" r="1.8" fill="#281e15" stroke="none"/>'+
 '<path d="M-36 -5l-7 5" stroke="#624b36" stroke-width="3"/></g>';
const forest='<g stroke="#30584e" stroke-linejoin="round" stroke-width="1.3">'+
 '<path d="M-50 16q45-10 100 0v11H-50Z" fill="#5d8773" stroke="none"/>'+
 '<path d="M-45 13v12m21-18v18m28-11v11m20-16v16m23-13v13" stroke="#b3a27a" stroke-width="3"/>'+
 '<path d="M-45-45l-17 42h34zm21-19L-44-9H-4zm27 15L-16 1h38zm22-26L1-9h48zm21 36L28 4h36Z" fill="#386a59"/>'+
 '<path d="M-45-31l-10 28h20zm21-24L-35-15h22zM3-37L-9-3h24zm22-25L8-15h35zm21 35L34 1h25Z" fill="#6d9b7b" stroke="none"/>'+
 '<path d="M-67 23q60-7 130 0" fill="none" stroke="#dfcc9e" stroke-width="2"/></g>';
const goose='<g stroke="#45564b" stroke-width="2.2" stroke-linejoin="round">'+
 '<path d="M-35 11h70v10h-70Z" fill="#bcad86"/>'+
 '<path d="M-25 8q-12-32 19-39 7-2 12-20 3-13 15-10l10 8-9 8-6-4q-4 24-5 27 16 10 15 20-19 19-42 3Z" fill="#e0d8bc"/>'+
 '<path d="M-15-17q-6-18 10-23 12-4 19 1Q4-22 2-4L-12 2Z" fill="#8ea4a2"/>'+
 '<path d="M-17-15l22 10m-20-20L9-12" fill="none" stroke="#f1e7c8" stroke-width="2"/>'+
 '<path d="M26-54 43-48 26-44Z" fill="#d79c4e"/>'+
 '<circle cx="24" cy="-57" r="2" fill="#192e2b" stroke="none"/>'+
 '<path d="M-7 9v6m13-7v8" stroke="#b27a46" stroke-width="3"/></g>';
const elevators='<g stroke="#6c664a" stroke-width="1.7" stroke-linejoin="round">'+
 '<path d="M-55 19H56v9H-55Z" fill="#8a805b" stroke="none"/>'+
 '<path d="M-47-23h21v43h-21Z" fill="#bd985c"/>'+
 '<path d="M-50-23-37-42-23-23Z" fill="#e4c987"/>'+
 '<path d="M-16-48H13V20H-16Z" fill="#d4a85f"/>'+
 '<path d="M-20-48-2-65 17-48Z" fill="#f0dba3"/>'+
 '<path d="M20-20h28v40H20Z" fill="#b68c5c"/>'+
 '<path d="M17-20 34-36 50-20Z" fill="#e6ca92"/>'+
 '<path d="M-6-42h10v11H-6Zm2 31h9V20h-9ZM28-15h9v10h-9Z" fill="#6e8a7e"/>'+
 '<path d="M-36-18v32M-8-39v48M28-4v13" fill="none" stroke="#f2d89c" stroke-width="2"/>'+
 '<path d="M12-35q12-2 13 18" fill="none" stroke="#7f6949" stroke-width="2"/></g>';
const potholes='<g stroke-linejoin="round" stroke-linecap="round">'+
 '<path d="M-54 0 49-21 54 25-54 31Z" fill="#877965" stroke="#c7b08b" stroke-width="2"/>'+
 '<path d="M-47 9 45-10" stroke="#f8df9c" stroke-width="2" stroke-dasharray="10 9"/>'+
 '<ellipse cx="-22" cy="18" rx="13" ry="6" fill="#3e403a" stroke="#b9a88c" stroke-width="1.8"/>'+
 '<ellipse cx="19" cy="8" rx="17" ry="8" fill="#3f423e" stroke="#b9a88c" stroke-width="1.8"/>'+
 '<ellipse cx="44" cy="18" rx="7" ry="3.2" fill="#39423e" stroke="#b9a88c" stroke-width="1.2"/>'+
 '<path d="M-26 17h11M13 5l14 2" stroke="#617a76" stroke-width="1.3"/>'+
 '<path d="M-51-15V-46" stroke="#7b6141" stroke-width="3"/>'+
 '<path d="m-51-46 15 13-15 13-15-13Z" fill="#efd37e" stroke="#6a5c3f" stroke-width="2"/>'+
 '<text x="-51" y="-28" text-anchor="middle" font-size="11" font-weight="900" fill="#54442a">!</text></g>';
const mountains='<g stroke-linejoin="round" stroke-width="1.5">'+
 '<path d="M-74 20-48-18-29-4 4-67 23-31 48-57 78 20Z" fill="#56746e" stroke="#344f4c"/>'+
 '<path d="M-46-15-31-2-23 0-48-18ZM4-67 23-31 8-39 2-27-9-38ZM48-57 63-18 51-25 43-18 36-28Z" fill="#eee9d4" stroke="none"/>'+
 '<path d="M-75 17q22-16 41-4t39 0 37-5 39 11v11H-75Z" fill="#6b8b70" stroke="none"/>'+
 '<path d="M-62 20-54 7l7 13M-20 19-12 3-4 20M57 20l9-16 9 16" fill="#3d6757" stroke="#315144"/></g>';
const pass='<g stroke-linejoin="round" stroke-linecap="round">'+
 '<path d="M-58-40 0-52 27-32 57-44 57 26H-58Z" fill="#657771" stroke="#465c57" stroke-width="2"/>'+
 '<path d="M-52-36 1-45 27-26 51-39" fill="none" stroke="#d8d6bf" stroke-width="4"/>'+
 '<path d="M-57 8Q-6-24 33 0T61 15" fill="none" stroke="#d0bb88" stroke-width="13"/>'+
 '<path d="M-57 8Q-6-24 33 0T61 15" fill="none" stroke="#636b5d" stroke-width="8"/>'+
 '<path d="M-57 8Q-6-24 33 0T61 15" fill="none" stroke="#f6e5ac" stroke-width="1.5" stroke-dasharray="5 7"/>'+
 '<path d="M-29-23v-33" stroke="#5c5644" stroke-width="2.5"/>'+
 '<rect x="-45" y="-56" width="33" height="16" rx="3" fill="#2f6949" stroke="#ede9d5" stroke-width="2"/>'+
 '<text x="-28.5" y="-45" text-anchor="middle" fill="#fff4cc" font-size="9" font-weight="800" stroke="none">PASS</text>'+
 '<path d="M43-8 53-29 63-8Z" fill="#dce6d9" stroke="#587265" stroke-width="1.5"/></g>';
const art=Object.freeze({ferry,moose,forest,goose,elevators,potholes,mountains,pass});
const feature=(id,label,x,y,scale)=>Object.freeze({id,label,x,y,scale});
export const CHAOS_SCENERY=Object.freeze({
 east:Object.freeze([feature('ferry','Atlantic ferry',400,368,.85),feature('moose','Eastern moose',521,115,.92)]),
 ontario:Object.freeze([feature('forest','Northern Ontario forest',337,97,1.03),feature('goose','Wawa Goose',583,108,.98)]),
 west:Object.freeze([feature('elevators','Prairie grain elevators',280,344,.98),
  feature('potholes','Saskatchewan potholes',432,352,.80),
  feature('mountains','Rocky Mountains',701,88,.86),
  feature('pass','Rocky Mountain pass',827,343,.90)])
});
export const CHAOS_SCENERY_COUNT=Object.values(CHAOS_SCENERY).reduce((n,features)=>n+features.length,0);
export function chaosSceneryFeatures(region){
 return Object.hasOwn(CHAOS_SCENERY,region)?CHAOS_SCENERY[region]:null;
}
export function renderChaosScenery(region){
 const features=chaosSceneryFeatures(region);
 if(!features)return '';
 return '<g class="ccc-illustrated-scenery" aria-hidden="true" pointer-events="none">'+
  features.map(f=>'<g class="ccc-scenery-vignette ccc-scenery--'+f.id+'" data-scenery="'+f.id+
   '" transform="translate('+f.x+' '+f.y+') scale('+f.scale+')">'+
   '<ellipse cx="0" cy="22" rx="55" ry="10" fill="#14291f" opacity=".19"/>'+
   '<g class="ccc-scenery-illustration">'+art[f.id]+'</g>'+shared+
   '<text class="ccc-scenery-label" x="0" y="39" text-anchor="middle">'+f.label+'</text></g>').join('')+'</g>';
}
