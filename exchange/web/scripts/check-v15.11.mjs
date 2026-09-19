import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const relative of ['core/browser-execution-controller.js','test/browser-execution-controller.test.js','v15.11-qualification.json']) {
 if(!fs.existsSync(path.join(root,relative))) throw new Error(`V15.11 missing ${relative}`);
}
const code=fs.readFileSync(path.join(root,'core/browser-execution-controller.js'),'utf8');
for(const marker of ['assertExecutableRuntime','selectWalletProvider','verifyWalletSnapshot','preflightExchangeTransaction','submitPreflightedTransaction','signQualifiedLimitOrder','removeListener']) {
 if(!code.includes(marker)) throw new Error(`V15.11 controller missing ${marker}`);
}
const record=JSON.parse(fs.readFileSync(path.join(root,'v15.11-qualification.json'),'utf8'));
if(record.browserIntegrationStatus!=='BLOCKED_APP_JS_NOT_WIRED'||record.genesisReleaseStatus!=='BLOCKED'||record.browserEvidence!==null||record.liveTransactionEvidence!==null) {
 throw new Error('V15.11 must not claim browser or Genesis qualification without real evidence');
}
console.log('420Exchange V15.11 controller repository checks passed; browser UI and operational closeout remain blocked');
