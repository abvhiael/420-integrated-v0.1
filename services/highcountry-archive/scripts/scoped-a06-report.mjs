import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildScopedA06Manifest} from '../src/scoped-a06.mjs';
const root=resolve(process.argv[2]||'.');
const manifest=await buildScopedA06Manifest(root);
const output=process.argv[3];
if(output)await writeFile(resolve(output),JSON.stringify(manifest,null,2)+'\\n');
console.log(JSON.stringify({status:manifest.status,totals:manifest.totals,fullA06Qualified:false}));
if(manifest.totals.invalid>0)process.exitCode=1;
