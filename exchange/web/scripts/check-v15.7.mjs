import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const file of [
 'core/limit-order-execution.js',
 'core/live-limit-order-qualification.js',
 'scripts/live-limit-order-qualify.mjs',
 'test/limit-order-execution.test.js',
 'v15.7-qualification.json',
])if(!fs.existsSync(path.join(root,file)))throw new Error(`V15.7 missing ${file}`);
const qualification=JSON.parse(fs.readFileSync(path.join(root,'v15.7-qualification.json'),'utf8'));
if(qualification.scope!=='LIVE_TESTNET_LIMIT_ORDER_SIGN_FILL_CANCEL'||qualification.operationalStatus!=='PENDING_LIVE_TESTNET_DRILL')throw new Error('V15.7 scope or operational status drift');
const core=fs.readFileSync(path.join(root,'core/live-limit-order-qualification.js'),'utf8');
for(const marker of ['signQualifiedLimitOrder','buildLimitOrderFillTransaction','buildLimitOrderCancelTransaction','preflightExchangeTransaction','inspectTransactionLifecycle','readLimitOrderState','FINALIZED'])if(!core.includes(marker))throw new Error(`V15.7 missing ${marker}`);
console.log('420Exchange V15.7 static qualification passed; live testnet drill pending');
