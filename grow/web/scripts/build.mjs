import {mkdir,copyFile,readFile} from 'node:fs/promises';import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');const out=join(root,'dist');await mkdir(out,{recursive:true});
for(const name of ['index.html','styles.css','app.js','runtime-config.js','favicon.svg','brand-logo.svg','_headers','workspace.html','workspace.css','workspace.js']){const source=await readFile(join(root,name),'utf8');if(!source.trim())throw Error(name+' empty');await copyFile(join(root,name),join(out,name));}
console.log('420Grow static build: PASS');
