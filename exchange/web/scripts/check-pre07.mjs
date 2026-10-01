import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const f of [
  'core/limit-order-identity.js','core/order-publication-client.js','core/limit-order-publication-controller.js',
  'test/pre07-limit-order-publication.test.js','test/order-publication-client.test.js'
])if(!fs.existsSync(path.join(root,f)))throw new Error('PRE-07 missing '+f);
const controller=fs.readFileSync(path.join(root,'core/limit-order-publication-controller.js'),'utf8');
for(const marker of ['prepared','signed','published','accepted','partially-filled','filled','cancel-pending','cancelled','expired','rejected','SIGNED_ORDER_MISMATCH','subscribeInvalidation'])if(!controller.includes(marker))throw new Error('PRE-07 controller missing '+marker);
if(/provider\.request\s*\(\s*\{\s*method\s*:\s*['"]eth_signTypedData_v4['"]/.test(controller))throw new Error('PRE-07 browser publication controller must not invoke wallet signing');
const client=fs.readFileSync(path.join(root,'core/order-publication-client.js'),'utf8');
for(const marker of ['same-origin HTTPS','420/service/exchange-orders/v1','PROVENANCE_INVALID','ORDER_HASH_MISMATCH','DISABLED_PRETESTNET'])if(!client.includes(marker))throw new Error('PRE-07 client missing '+marker);
const runtime=JSON.parse(fs.readFileSync(path.join(root,'runtime-config.json'),'utf8'));
if(runtime.execution?.orderSigning!=='DISABLED_PRETESTNET'||runtime.execution?.orderPublication!=='DISABLED_PRETESTNET')throw new Error('PRE-07 order signing/publication gates must default OFF');
console.log('420Exchange PRE-07 browser publication static checks passed; signing/publication default OFF');
