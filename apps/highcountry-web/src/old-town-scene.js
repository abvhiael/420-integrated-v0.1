// OT-SCREEN-01: versioned, public, provisional visual geometry only.
export const TILE_WIDTH=64,TILE_HEIGHT=32,LOGICAL_CHUNK=16;
export const projectTile=(x,y)=>[(x-y)*TILE_WIDTH/2,(x+y)*TILE_HEIGHT/2];
export const sceneAnchor=(a)=>projectTile(...a.groundAnchorTiles);
export function depthSort(a,b){const aa=a.groundAnchorTiles,bb=b.groundAnchorTiles;return (aa[0]+aa[1])-(bb[0]+bb[1])||aa[1]-bb[1]||a.id.localeCompare(b.id);}
export function chunkOf(x,y){return [Math.floor(x/LOGICAL_CHUNK),Math.floor(y/LOGICAL_CHUNK)];}
export function geometryPath(geometry){
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
 return polygons.flatMap(poly=>poly.map(ring=>ring.map((p,i)=>{const [x,y]=projectTile(p[0],p[1]);return (i?'L':'M')+x+' '+y;}).join(' ')+' Z')).join(' ');
}
const NS='http://www.w3.org/2000/svg';
function svgElement(doc,name,attrs={}){const e=doc.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;}
function requireArray(v,n,label){if(!Array.isArray(v)||v.length!==n)throw Error('old-town-'+label+'-count');}
export function validateOldTownScene({sites,assets,geo,geometry,anchors}){
 if(sites.district!=='HC-EC-S01-D07'||assets.expectedCount!==20||geo.issuanceAuthorized!==false||geometry.properties.issuanceAuthorized!==false)throw Error('old-town-authority-mismatch');
 requireArray(sites.sites,59,'sites');requireArray(assets.assets,20,'assets');requireArray(anchors.anchors,20,'anchors');
 if(geo.lockedDesign.logicalChunk.join(',')!=='16,16')throw Error('old-town-chunk-contract');
 const ids=new Set(),siteById=new Map(sites.sites.map(s=>[s.id,s]));
 const assetById=new Map(assets.assets.map(a=>[a.id,a]));
 for(const a of anchors.anchors){
  const s=siteById.get(a.id),asset=assetById.get(a.id);
  if(!s||!asset||ids.has(a.id)||s.status==='vacant'||a.approval!=='PROVISIONAL_VISUAL_ONLY'||a.lot.join(',')!==s.rect.join(','))throw Error('old-town-invalid-anchor-'+a.id);
  if(a.groundAnchorTiles.join(',')!==[(s.rect[0]+s.rect[2])/2,s.rect[3]].join(','))throw Error('old-town-anchor-drift-'+a.id);
  ids.add(a.id);
 }
 if(ids.size!==20||sites.park?.block!=='B22'||sites.park.saleable!==false||ids.has('HL-05'))throw Error('old-town-spawn-drift');
 const blocks=geometry.features.filter(f=>f.properties.layer==='block');
 if(blocks.length!==24||geometry.features.filter(f=>f.properties.layer==='public_road_polygon').length!==1||geometry.features.filter(f=>f.properties.layer==='water_schematic').length!==1)throw Error('old-town-layer-drift');
 return anchors.anchors.map(a=>({...a,site:siteById.get(a.id),asset:assetById.get(a.id)})).sort(depthSort);
}
const occupied=id=>id.startsWith('HL-')?[11,14]:id.startsWith('CR-')?[17,17]:id.startsWith('WH-')?[22,22]:({'LM-01':[34,34],'LM-02':[45,45],'LM-03':[34,34],'LM-04':[34,34],'LM-05':[22,34]}[id]||null);
export async function mountOldTownScene({document,main,fetchImpl=fetch}){
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Loading canonical Old Town geometry and original Genesis PNGs…';main.append(status);
 const urls=['old-town-site-registry.json','old-town-genesis-assets.json','old-town-geo-authority-status.json','old-town-provisional-geometry.geojson','old-town-render-anchors.v1.json'].map(x=>'/assets/highcountry/maps/'+x);
 try{
  const data=await Promise.all(urls.map(async url=>{const r=await fetchImpl(url);if(!r.ok)throw Error('missing scene data: '+url);return r.json();}));
  const [sites,assets,geo,geometry,anchors]=data;
  const buildings=validateOldTownScene({sites,assets,geo,geometry,anchors});
  status.textContent='Old Town — provisional visual geography; no title issuance authorization. 20 Genesis buildings, 39 vacant private sites.';
  const wrap=document.createElement('div');wrap.className='old-town-scene';wrap.setAttribute('aria-label','Old Town provisional isometric neighbourhood map');
  const svg=svgElement(document,'svg',{viewBox:'-19100 -700 46000 24000',role:'img','aria-label':'Old Town isometric map of roads, water, 59 property sites, B22 park and 20 original buildings',preserveAspectRatio:'xMidYMid meet'});
  const ground=svgElement(document,'g',{'data-layer':'world'});
  const outline=svgElement(document,'path',{d:'M-19000 -700 H27000 V23000 H-19000 Z',fill:'#183a2d'});ground.append(outline);
  for(const f of geometry.features.filter(f=>f.properties.layer==='water_schematic'))ground.append(svgElement(document,'path',{d:geometryPath(f.geometry),fill:'#205c75','fill-rule':'evenodd'}));
  for(const f of geometry.features.filter(f=>f.properties.layer==='public_road_polygon'))ground.append(svgElement(document,'path',{d:geometryPath(f.geometry),fill:'#766c5b','fill-rule':'evenodd',stroke:'#ada18e','stroke-width':'7'}));
  for(const f of geometry.features.filter(f=>f.properties.layer==='block'))ground.append(svgElement(document,'path',{d:geometryPath(f.geometry),fill:'#426b47',stroke:'#81996e','stroke-width':'4'}));
  for(const s of sites.sites){const [x0,y0,x1,y1]=s.rect;const poly={type:'Polygon',coordinates:[[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]]};const p=svgElement(document,'path',{d:geometryPath(poly),fill:s.status==='vacant'?'#58865b':s.status==='permanent_public'?'#b3a678':'#8a9265',stroke:'#d3d5a3','stroke-width':'3','data-site-id':s.id});ground.append(p);}
  const park=sites.park.rect;ground.append(svgElement(document,'path',{d:geometryPath({type:'Polygon',coordinates:[[[park[0],park[1]],[park[2],park[1]],[park[2],park[3]],[park[0],park[3]],[park[0],park[1]]]]}),fill:'#348252',stroke:'#b4cc79','stroke-width':'7','data-public-park':'B22'}));
  const spriteLayer=svgElement(document,'g',{'data-layer':'canonical-genesis-sprites'});
  for(const a of buildings){
   const [x,y]=sceneAnchor(a),fp=occupied(a.id),w=(fp[0]+fp[1])*32;
   if(!fp||!a.asset.repoPath.startsWith('apps/highcountry-web/public/assets/highcountry/old-town/')||!a.asset.repoPath.endsWith('.png'))throw Error('old-town-asset-path');
   const group=svgElement(document,'g',{'data-site-id':a.id,'data-ground-anchor':a.groundAnchorTiles.join(','),'data-depth':a.groundAnchorTiles[0]+a.groundAnchorTiles[1]});
   const url='/'+a.asset.repoPath.replace('apps/highcountry-web/public/','');
   const image=svgElement(document,'image',{href:url,x:x-w/2,y:y-w,width:w,height:w,preserveAspectRatio:'xMidYMax meet','data-sha256':a.asset.sha256});
   // Use the actual PNG dimensions, never a guessed sprite aspect ratio. Retain full transparent padding.
   const ImageCtor=document.defaultView?.Image;
   if(ImageCtor){const source=new ImageCtor();source.onload=()=>{if(source.naturalWidth>0&&source.naturalHeight>0){const h=w*source.naturalHeight/source.naturalWidth;image.setAttribute('y',String(y-h));image.setAttribute('height',String(h));}};source.src=url;}
   const label=svgElement(document,'text',{x,y:y+110,'text-anchor':'middle',fill:'#faf4d9','font-size':'90',stroke:'#1b2b26','stroke-width':'12','paint-order':'stroke'});label.textContent=a.id;
   group.append(image,label);spriteLayer.append(group);
  }
  ground.append(spriteLayer);svg.append(ground);wrap.append(svg);main.append(wrap);
  const note=document.createElement('p');note.textContent='Original PNGs loaded separately. Footprint-based provisional visual sizing is not a certified sprite-foundation survey. Building access and interactive camera controls follow in OT-SCREEN-02/03.';main.append(note);
  return {buildings,svg};
 }catch(e){status.textContent='Old Town map unavailable: '+e.message;status.setAttribute('role','alert');return null;}
}
