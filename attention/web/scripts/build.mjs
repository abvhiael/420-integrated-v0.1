import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
for(const file of ['index.html','app.js','styles.css','runtime-config.json','security-headers.json','cannaseur-logo.png'])fs.copyFileSync(path.join(root,file),path.join(dist,file));
fs.cpSync(path.join(root,'core'),path.join(dist,'core'),{recursive:true});
fs.copyFileSync(path.join(dist,'index.html'),path.join(dist,'404.html'));
const headers=JSON.parse(fs.readFileSync(path.join(root,'security-headers.json'),'utf8')).headers;
fs.writeFileSync(path.join(dist,'_headers'),'/*\n'+Object.entries(headers).map(([k,v])=>`  ${k}: ${v}`).join('\n')+'\n/runtime-config.json\n  Cache-Control: no-store, max-age=0\n');
console.log('420Attention web build PASS');
