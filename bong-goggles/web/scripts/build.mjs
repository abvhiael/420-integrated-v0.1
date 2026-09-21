import {cp,mkdir,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {validateRuntimeConfig} from '../core/runtime-config.js';

const root=resolve(import.meta.dirname,'..');
const out=resolve(root,'dist');
const master=resolve(root,'bong-goggles-logo.png');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

const example=JSON.parse(await readFile(resolve(root,'runtime-config.example.json'),'utf8'));
validateRuntimeConfig(example);

for(const item of ['index.html','app.js','styles.css','settings.css','branding.css','feed-branding.css','core','_headers']){
  await cp(resolve(root,item),resolve(out,item),{recursive:true});
}
// The exact approved PNG stays in the source tree as the master; do not publish
// its 1.5 MB original to the static site. All variants derive from that same file.
const variants=[
  {name:'bong-goggles-header-256.webp',width:256,format:'webp',options:{quality:86,effort:6}},
  {name:'bong-goggles-browser-512.webp',width:512,format:'webp',options:{quality:88,effort:6}},
  {name:'favicon-32.png',width:32,format:'png',options:{compressionLevel:9}},
  {name:'favicon-192.png',width:192,format:'png',options:{compressionLevel:9}},
];
for(const variant of variants){
  const path=resolve(out,variant.name);
  await sharp(master).resize(variant.width,variant.width,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).toFormat(variant.format,variant.options).toFile(path);
  if((await stat(path)).size>128*1024)throw new Error(`optimized branding asset exceeds 128 KiB: ${variant.name}`);
}
// Example config makes the ordinary CI artifact illustrative, NEVER a deployable candidate.
await writeFile(resolve(out,'runtime-config.json'),JSON.stringify(example,null,2)+'\n');
console.log('Bong Goggles web build created dist/ (optimized approved branding; example config; NOT a release artifact)');
