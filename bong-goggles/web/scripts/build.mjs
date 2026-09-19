import {cp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateRuntimeConfig} from '../core/runtime-config.js';

const root=resolve(import.meta.dirname,'..');
const out=resolve(root,'dist');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

const example=JSON.parse(await readFile(resolve(root,'runtime-config.example.json'),'utf8'));
validateRuntimeConfig(example);

for(const item of ['index.html','app.js','styles.css','settings.css','core']){
  await cp(resolve(root,item),resolve(out,item),{recursive:true});
}
await writeFile(resolve(out,'runtime-config.json'),JSON.stringify(example,null,2)+'\n');
console.log('Bong Goggles web build created dist/');
