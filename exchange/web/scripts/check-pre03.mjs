import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const relative of [
 'core/read-only-swap-entry.js','read-only-swap-review-ui.js',
 'test/read-only-swap-entry.test.js','test/read-only-swap-review-ui.test.js',
 'runtime-config.json'
]){
 if(!fs.existsSync(path.join(root,relative)))throw new Error('PRE-03 missing '+relative);
}
const entry=fs.readFileSync(path.join(root,'core/read-only-swap-entry.js'),'utf8');
for(const marker of ['REVIEW_CATALOGUE_SCHEMA','QUALIFIED_CONFIG','METADATA_ONLY','parseDisplayUnits','normalizeReviewCatalogue','buildMetadataSwapReviewRequest','assertCandidateMatchesEntry','DUPLICATE_ASSET','ROUTE_TOO_LARGE']){
 if(!entry.includes(marker))throw new Error('PRE-03 entry model missing '+marker);
}
const ui=fs.readFileSync(path.join(root,'read-only-swap-review-ui.js'),'utf8');
for(const marker of ['Qualified market','Minimum net output','Canonical request:','Router / spender','Transaction fingerprint','Inspect full route identifiers','producer authenticity not established','invalidateExecution']){
 if(!ui.includes(marker))throw new Error('PRE-03 review UI missing '+marker);
}
for(const forbidden of ['tokenIn\',\'Input token address','tokenOut\',\'Output token address','Input amount (integer raw units)','Minimum output (integer raw units)']){
 if(ui.includes(forbidden))throw new Error('PRE-03 raw developer entry still present: '+forbidden);
}
const runtime=JSON.parse(fs.readFileSync(path.join(root,'runtime-config.json'),'utf8'));
if(runtime.reviewCatalogue?.schema!=='420-exchange-review-catalogue-v1'||runtime.reviewCatalogue?.qualification!=='UNRESOLVED'||runtime.reviewCatalogue?.assets?.length!==0||runtime.reviewCatalogue?.markets?.length!==0){
 throw new Error('checked-in PRE-03 catalogue must remain explicitly unresolved without fabricated live metadata');
}
if(/eth_sendTransaction|eth_signTypedData_v4/.test(ui))throw new Error('PRE-03 read-only UI must not contain wallet execution methods');
console.log('420Exchange PRE-03 metadata-driven read-only review checks passed');
