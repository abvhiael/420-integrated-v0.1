import{rm,mkdir,copyFile,readFile,writeFile}from'node:fs/promises';import{resolve}from'node:path';
const root=resolve(import.meta.dirname,'..'),dist=resolve(root,'dist');await rm(dist,{recursive:true,force:true});await mkdir(resolve(dist,'core'),{recursive:true});
for(const p of ['compute-market-logo.png','favicon-32.png','favicon-192.png','index.html','styles.css','app.js','runtime-config.json','security-headers.json'])await copyFile(resolve(root,p),resolve(dist,p));
for(const p of ['config.js','read-api.js','job-api.js','handoff.js','participation.js','dashboard.js','controller.js','science.js'])await copyFile(resolve(root,'core',p),resolve(dist,'core',p));
const headers=JSON.parse(await readFile(resolve(root,'security-headers.json'),'utf8'));await writeFile(resolve(dist,'_headers'),'/*\n'+Object.entries(headers).map(([k,v])=>'  '+k+': '+v).join('\n')+'\n','utf8');
await writeFile(resolve(dist,'build-meta.json'),JSON.stringify({schemaVersion:'420-compute-web-build-v1',authority:'non-canonical-client',writeRuntime:'runtime-config-controlled'},null,2)+'\n','utf8');
console.log('420Compute web build complete');
