import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');const dist=join(root,'dist');
await mkdir(dist,{recursive:true});await cp(join(root,'public'),dist,{recursive:true,force:true});await mkdir(join(dist,'src'),{recursive:true});
for(const name of ['app.js','runtime.js','main.js','guest.js','cloud.js'])await writeFile(join(dist,'src',name),await readFile(join(root,'src',name),'utf8'));
console.log('High Country static bundle built without substituting runtime values');
