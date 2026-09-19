import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const relative of ['core/wallet-compatibility.js','test/wallet-compatibility.test.js','v15.9-qualification.json']){
 if(!fs.existsSync(path.join(root,relative))) throw new Error(`V15.9 required file missing: ${relative}`);
}
const source=fs.readFileSync(path.join(root,'core/wallet-compatibility.js'),'utf8');
for(const marker of ['discoverWalletProviders','selectWalletProvider','verifyWalletSnapshot','inspectWalletCompatibility','WALLET_SELECTION_REQUIRED']){
 if(!source.includes(marker)) throw new Error(`V15.9 implementation missing marker: ${marker}`);
}
const record=JSON.parse(fs.readFileSync(path.join(root,'v15.9-qualification.json'),'utf8'));
if(record.scope!=='WALLET_BROWSER_EXECUTION_COMPATIBILITY'||record.operationalStatus!=='PENDING_REAL_BROWSER_WALLET_MATRIX') throw new Error('V15.9 status must not claim a live browser matrix');
if(record.browserIntegrationStatus!=='PENDING_PROVIDER_SELECTION_UI_AND_LIVE_EXECUTION_WIRING') throw new Error('V15.9 browser integration status drift');
if(!record.browserMatrix?.length||record.browserMatrix.some(row=>row.status!=='NOT_RUN')) throw new Error('V15.9 real browser matrix cannot be claimed from repository CI');
console.log('420Exchange V15.9 static compatibility qualification passed; real-browser integration and drill pending');
