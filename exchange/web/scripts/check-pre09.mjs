import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const f of ['core/bridge-lifecycle.js','test/pre09-bridge-lifecycle.test.js'])if(!fs.existsSync(path.join(root,f)))throw new Error('PRE-09 missing '+f);
const lifecycle=fs.readFileSync(path.join(root,'core/bridge-lifecycle.js'),'utf8');
for(const marker of [
  '420-exchange-bridge-manifest-v1','sourceAdapterId','destinationAdapterId','verifierConfigHash','manifestFingerprint',
  'SOURCE_SUBMITTED','SOURCE_FINALIZED','PROOF_PENDING','PROOF_AVAILABLE','PROOF_VERIFIED','DESTINATION_SUBMITTED','DESTINATION_FINALIZED','SETTLED',
  'PAUSED','EXPIRED','PROOF_INVALIDATED','SOURCE_REORGED','DESTINATION_REORGED','REFUND_PENDING','REFUNDED','RETRYABLE',
  'beneficiary','replayDomain','createProofProviderAdapter','reconcileBridgeProjection','INDEXER_DELAYED','INDEXER_CONFLICTING'
])if(!lifecycle.includes(marker))throw new Error('PRE-09 lifecycle missing '+marker);
if(/eth_sendTransaction|LIVE_TESTNET_QUALIFICATION/.test(lifecycle))throw new Error('PRE-09 offline lifecycle must not contain live submission authority');
const runtime=JSON.parse(fs.readFileSync(path.join(root,'runtime-config.json'),'utf8'));
if(runtime.execution?.bridgeSubmission!=='DISABLED_PRETESTNET'||runtime.execution?.bridgeProofAcceptance!=='DISABLED_PRETESTNET')throw new Error('PRE-09 bridge live gates must default OFF');
const tests=fs.readFileSync(path.join(root,'test/pre09-bridge-lifecycle.test.js'),'utf8');
for(const marker of ['two-chain mock E2E','replay domain','wrong beneficiary','source and destination reorgs','refund and recovery','INDEXER_CONFLICTING'])if(!tests.includes(marker))throw new Error('PRE-09 qualification coverage missing '+marker);
console.log('420Exchange PRE-09 bridge lifecycle static checks passed; live submission/proof acceptance default OFF');
