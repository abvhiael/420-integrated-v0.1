import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const f of ['src/canonical.js','src/order-store.js','src/http.js','test/publication.test.js','test/http.test.js'])if(!fs.existsSync(path.join(root,f)))throw new Error('PRE-07 missing '+f);
const store=fs.readFileSync(path.join(root,'src/order-store.js'),'utf8');
for(const marker of ['signed','published','accepted','partially-filled','filled','cancel-pending','cancelled','expired','rejected','SIGNER_MISMATCH','CONFLICTING_FILL_DATA','STALE_PROJECTION'])if(!store.includes(marker))throw new Error('PRE-07 store missing '+marker);
const canonical=fs.readFileSync(path.join(root,'src/canonical.js'),'utf8');
for(const marker of ['420Exchange Limit Orders','EIP712Domain','hashOrder','orderDigest','uint128','uint64'])if(!canonical.includes(marker))throw new Error('PRE-07 canonical missing '+marker);
console.log('420Exchange PRE-07 order-service static checks passed');
