import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const f of [
 'src/indexer-source.mjs','src/projection-store.mjs','src/projection.mjs','src/service.mjs','src/http.mjs','src/startup.mjs','src/start.mjs',
 'config/catalogue.example.json','config/local.example.json','test/contract.test.js','test/projection.test.js','test/startup.test.js','test/faults.test.js'
])if(!fs.existsSync(path.join(root,f)))throw new Error('PRE-10 missing '+f);
const http=fs.readFileSync(path.join(root,'src/http.mjs'),'utf8');
for(const m of ['v13\\/markets','/v13/history','x-420-api-major','x-420-api-minor','/health','/ready'])if(!http.includes(m))throw new Error('PRE-10 HTTP missing '+m);
const projection=fs.readFileSync(path.join(root,'src/projection.mjs'),'utf8');
for(const m of ['420Indexer/v1','authoritative:false','recordId','replacedBy','freshness','finality','encodeCursor','beneficiary conflict','fee conflict'])if(!projection.includes(m))throw new Error('PRE-10 projection missing '+m);
const startup=fs.readFileSync(path.join(root,'src/startup.mjs'),'utf8');
for(const m of ['IndexerHttpProjectionSource','RpcHealthSource','FileProjectionStore','loadCatalogue','server.close','SIGTERM','SIGINT'])if(!startup.includes(m))throw new Error('PRE-10 startup missing '+m);
const catalogue=JSON.parse(fs.readFileSync(path.join(root,'config/catalogue.example.json'),'utf8'));
for(const group of ['markets','assets','routes'])if(!Array.isArray(catalogue[group])||catalogue[group].length===0||catalogue[group].some(m=>!String(m.qualification).startsWith('DISPLAY_ONLY')))throw new Error('PRE-10 '+group+' catalogue must be explicit display-only');
console.log('420Exchange PRE-10 read API/startup static checks passed');
