import {readFile,mkdir,stat,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {CHECKERS_ART} from './checkers-art-manifest.mjs';
export const prefix='assets/games/checkers/';
export const paths=new Set(Object.keys(CHECKERS_ART).map(p=>prefix+p.replace(/\.png$/,'.webp')));
const hash=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
export async function publishCheckersArt(root,out){
 const report=[];
 for(const [name,pin] of Object.entries(CHECKERS_ART)){
  const bytes=await readFile(resolve(root,prefix+name));
  if(bytes.length!==pin.bytes||hash(bytes)!==pin.git)throw Error('Checkers master identity: '+name);
  const image=sharp(bytes,{failOn:'warning'}),m=await image.metadata();
  if(m.format!=='png'||!m.width||!m.height||m.width>4096||m.height>4096||(pin.dimensions&&[m.width,m.height].join()!==pin.dimensions.join())||(pin.alpha&&!m.hasAlpha))throw Error('Checkers master metadata: '+name+' '+JSON.stringify(m));
  const stats=await image.stats();
  if(pin.alpha&&(stats.channels.at(-1).min!==0||stats.channels.at(-1).max===0))throw Error('Checkers master alpha: '+name);
  const target=resolve(out,prefix+name.replace(/\.png$/,'.webp'));
  await mkdir(dirname(target),{recursive:true});
  await sharp(bytes,{failOn:'warning'}).resize({width:pin.width,withoutEnlargement:true}).webp({quality:85,alphaQuality:100,effort:6}).toFile(target);
  const size=(await stat(target)).size;
  if(size>pin.bytes||size>512*1024)throw Error('Checkers output budget: '+name);
  report.push({name,width:m.width,height:m.height,alpha:m.hasAlpha,sourceBytes:bytes.length,outputBytes:size});
 }
 console.log('CK-1.1 decoded master inventory:',JSON.stringify(report));
 return report;
}
export async function verifyCheckersArt(out,files){
 const actual=files.filter(p=>p.startsWith(prefix));
 if(actual.length!==paths.size||actual.some(p=>!paths.has(p)))throw Error('Checkers publication allowlist mismatch');
 let total=0;
 for(const [name,pin] of Object.entries(CHECKERS_ART)){
  const path=resolve(out,prefix+name.replace(/\.png$/,'.webp'));
  const image=sharp(path,{failOn:'warning'}),m=await image.metadata(),s=await image.stats();
  if(m.format!=='webp'||!m.width||!m.height||m.width>pin.width||(pin.alpha&&(!m.hasAlpha||s.channels.at(-1).min!==0||s.channels.at(-1).max===0)))throw Error('Checkers output integrity: '+name);
  if(pin.dimensions&&Math.abs(m.height-m.width*pin.dimensions[1]/pin.dimensions[0])>1)throw Error('Checkers output aspect: '+name);
  const bytes=(await stat(path)).size;
  if(bytes>pin.bytes||bytes>512*1024)throw Error('Checkers output budget: '+name);
  total+=bytes;
 }
 if(total>5*1024*1024)throw Error('Checkers independent 5 MiB budget exceeded');
 console.log('CK-1.1 verified optimized artwork:',actual.length,total);
}
