// Seven-leaflet cannabis palmate silhouette, drawn as SVG rather than a Unicode emoji.
export function cannabisHitIcon(doc){
 const ns='http://www.w3.org/2000/svg';
 const svg=doc.createElementNS(ns,'svg');
 svg.setAttribute('class','nk-cannabis-hit');
 svg.setAttribute('viewBox','0 0 64 64');
 svg.setAttribute('width','23');
 svg.setAttribute('height','23');
 svg.setAttribute('aria-hidden','true');
 svg.setAttribute('focusable','false');
 const stem=doc.createElementNS(ns,'path');
 stem.setAttribute('d','M32 56 L32 35');
 stem.setAttribute('fill','none');stem.setAttribute('stroke','currentColor');stem.setAttribute('stroke-width','2.4');svg.append(stem);
 // Each long, finely pointed leaflet grows out of the same central junction.
 const leaves=[[-64,24],[-44,32],[-24,39],[0,52],[24,39],[44,32],[64,24]];
 for(const [angle,len] of leaves){
  const leaf=doc.createElementNS(ns,'path');
  const width=len*.20;
  leaf.setAttribute('d',`M32 35 Q${32-width} ${35-len*.42} 32 ${35-len} Q${32+width} ${35-len*.42} 32 35 Z`);
  leaf.setAttribute('transform',`rotate(${angle} 32 35)`);
  leaf.setAttribute('fill','currentColor');
  leaf.setAttribute('stroke','#164514');leaf.setAttribute('stroke-width','.65');
  svg.append(leaf);
 }
 return svg;
}
