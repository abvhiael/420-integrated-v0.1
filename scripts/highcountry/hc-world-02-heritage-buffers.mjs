import { readFileSync,writeFileSync } from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');const read=s=>JSON.parse(readFileSync(path.join(root,s),'utf8'));
const atlas=read('deployments/highcountry/hc-world-county-atlases.draft.v1.json');
const world=read('deployments/highcountry/hc-world-founding-spec.v1.json');
export function generateHeritageBuffers(){
 const sites=[];const used=new Set();
 for(const h of world.heritage){
  const region=atlas.regions.find(r=>r.regionId===h.regionId);if(!region)throw Error('missing region');
  const anchor=region.namedAnchors[h.canonicalOrigin];if(!anchor)throw Error('missing archive-origin municipality: '+h.canonicalOrigin);
  const digest=createHash('sha256').update(h.fragmentId+':'+h.siteName).digest();
  // Stable plot reservation around canonical origin, pending physical survey.
  let index=digest.readUInt16BE(0)%81,point;
  for(let attempts=0;attempts<81;attempts++){
   const i=(index+attempts)%81,dx=(i%9-4)*56,dy=(Math.floor(i/9)-4)*56;
   const x=anchor[0]+dx,y=anchor[1]+dy,key=region.code+':'+x+':'+y;
   if(x<0||y<0||x+32>atlas.canvas[0]||y+32>atlas.canvas[1]||used.has(key))continue;
   used.add(key);point=[x,y,x+32,y+32];break;
  }
  if(!point)throw Error('no unique landmark buffer');
  sites.push({id:'HC-SITE-'+h.fragmentId,regionId:h.regionId,founderId:h.founderId,fragmentId:h.fragmentId,objectiveId:h.objectiveId,canonicalSiteName:h.siteName,originSettlement:h.canonicalOrigin,bounds:point,bufferStatus:'DRAFT_PROTECTED_RESERVATION_NOT_FIELD_SURVEYED',sourceArchiveId:h.id});
 }
 return {schema:'HC.WORLD.HERITAGE.BUFFER.DRAFT.V1',status:'DRAFT_PENDING_OWNER_TERRAIN_APPROVAL',siteCount:sites.length,sites};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const out=process.argv[2]||'/tmp/hc-world-02-heritage-buffers.json';writeFileSync(out,JSON.stringify(generateHeritageBuffers(),null,2));console.log(out)}
