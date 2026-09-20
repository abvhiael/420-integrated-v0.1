import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const relative of ['core/browser-execution-controller.js','test/browser-execution-controller.test.js','core/canonical-execution-inputs.js','test/canonical-execution-inputs.test.js','core/reviewed-execution-bridge.js','test/reviewed-execution-bridge.test.js','browser-wallet-ui.js','read-only-swap-review-ui.js','core/quote-review-session.js','test/quote-review-session.test.js','test/read-only-swap-review-ui.test.js','v15.11-qualification.json']) {
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
// V14/V15 source consolidation and an acceptance *attempt* are not real-wallet/browser qualification.
// Preserve the read-only, null-evidence, and blocked-Genesis gates until independent evidence exists.
if(record.browserIntegrationStatus!=='V15_WALLET_SESSION_AUTHORITY_V14_READ_ONLY_BROWSER_ACCEPTANCE_PENDING'||
   record.repositoryStatus!=='IMPLEMENTED_PARTIAL_BROWSER_REVIEW_EXACT_HEAD_CI_REQUIRED'||
   record.operationalStatus!=='BLOCKED_UNVERIFIED_EXECUTABLE_QUOTE_DEPLOYMENT_AND_REAL_WALLET_MATRIX'||
   record.genesisReleaseStatus!=='BLOCKED'||
   record.browserEvidence!==null||record.liveTransactionEvidence!==null) {
 throw new Error('V15.11 must remain read-only, unqualified for browser execution and BLOCKED for Genesis without real evidence');
}
const walletUi=fs.readFileSync(path.join(root,'browser-wallet-ui.js'),'utf8');
for(const marker of ['browserExecutionReadiness','mountReadOnlySwapReview','stopImmediatePropagation','lockExecution']) {
 if(!walletUi.includes(marker))throw new Error(`V15.11 missing locked read-only browser binding: ${marker}`);
}
console.log('420Exchange V15.11 read-only wallet/review repository checks passed; browser execution and Genesis remain blocked');
