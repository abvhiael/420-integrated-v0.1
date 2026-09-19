import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const relative of ['core/browser-execution-controller.js','test/browser-execution-controller.test.js','core/canonical-execution-inputs.js','test/canonical-execution-inputs.test.js','v15.11-qualification.json']) {
 if(!fs.existsSync(path.join(root,relative))) throw new Error(`V15.11 missing ${relative}`);
}
const code=fs.readFileSync(path.join(root,'core/browser-execution-controller.js'),'utf8');
for(const marker of ['assertExecutableRuntime','selectWalletProvider','verifyWalletSnapshot','preflightExchangeTransaction','submitPreflightedTransaction','signQualifiedLimitOrder','removeListener']) {
 if(!code.includes(marker)) throw new Error(`V15.11 controller missing ${marker}`);
}
const inputs=fs.readFileSync(path.join(root,'core/canonical-execution-inputs.js'),'utf8');
for(const marker of ['requireCanonicalContext','prepareCanonicalSwap','prepareCanonicalBridge','prepareCanonicalOrder','prepareCanonicalCancellation','FIXTURE_SOURCE','STALE_QUOTE']) {
 if(!inputs.includes(marker)) throw new Error(`V15.11 canonical input adapter missing ${marker}`);
}
const record=JSON.parse(fs.readFileSync(path.join(root,'v15.11-qualification.json'),'utf8'));
if(record.browserIntegrationStatus!=='BLOCKED_CANONICAL_CONTROLS_UNWIRED'||record.genesisReleaseStatus!=='BLOCKED'||record.browserEvidence!==null||record.liveTransactionEvidence!==null) {
 throw new Error('V15.11 must not claim executable browser or Genesis qualification without real evidence');
}
console.log('420Exchange V15.11 wallet/UI and canonical-input repository checks passed; live browser execution and Genesis remain blocked');
