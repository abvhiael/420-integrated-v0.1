// CCC-ART-3 source gate: six original, transparent, self-contained vector tokens.
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {CHAOS_VEHICLE_ASSETS,CHAOS_VEHICLE_SOURCE_SHA} from '../core/chaos-vehicles.js';
const root=resolve(import.meta.dirname,'..'),dir='assets/games/cross-country-chaos/vehicles/';
export async function verifyChaosVehicleArt(){
 if(CHAOS_VEHICLE_ASSETS.length!==6||new Set(CHAOS_VEHICLE_ASSETS).size!==6)
  throw Error('CCC-ART-3 vehicle allowlist must contain six unique tokens.');
 const listed=(await readdir(resolve(root,dir))).filter(x=>x.endsWith('.svg')).sort();
 const expected=CHAOS_VEHICLE_ASSETS.map(p=>p.slice(dir.length)).sort();
 if(listed.join('|')!==expected.join('|'))throw Error('Unapproved or missing vehicle SVG.');
 let bytes=0;
 for(const path of CHAOS_VEHICLE_ASSETS){
  if(!path.startsWith(dir)||!/^assets\/games\/cross-country-chaos\/vehicles\/[a-z-]+\.svg$/.test(path))
   throw Error('Unsafe vehicle asset path.');
  const source=await readFile(resolve(root,path),'utf8');
  const size=Buffer.byteLength(source);
  if(size<800||size>2048||!source.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="64" viewBox="0 0 100 64">')||
     !source.endsWith('</svg>')||!source.includes('<path ')||
     /<\s*(script|foreignObject|image|use|style|animate|set)\b|\bon[a-z]+\s*=|\bhref\s*=|url\(|@import|data:|javascript:|<\?xml|<!DOCTYPE/i.test(source))
   throw Error('Unsafe, incomplete or oversized vehicle illustration: '+path);
  const id=path.slice(dir.length,-4);
  const actual=createHash('sha1').update(Buffer.from('blob '+size+'\0')).update(Buffer.from(source)).digest('hex');
  if(actual!==CHAOS_VEHICLE_SOURCE_SHA[id])throw Error('Vehicle SVG source digest changed: '+path);
  bytes+=size;
 }
 if(bytes>16*1024)throw Error('Vehicle artwork budget exceeded.');
 return {tokens:6,bytes,transparent:true,orientation:'eight-way live vector'};
}
