import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const required=[
  'core/guarded-swap-orchestrator.js',
  'test/pre06-guarded-swap-orchestrator.test.js',
  'core/wallet-execution.js',
  'core/browser-execution-controller.js',
  'core/transaction-lifecycle.js',
];
for(const relative of required){
  if(!fs.existsSync(path.join(root,relative)))throw new Error(`PRE-06 missing ${relative}`);
}

const orchestrator=fs.readFileSync(path.join(root,'core/guarded-swap-orchestrator.js'),'utf8');
for(const marker of [
  'TRUSTED_EXECUTION_QUOTE','isVerifiedQuoteEvidence','beginBoundSwapReview','confirmBoundSwapReview',
  'AUTHORIZATION_CONFIRMATION_REQUIRED','preflightExchangeTransaction','submitPreflightedTransaction',
  'PREPARED','AWAITING_CONFIRMATION','SUBMITTED','PENDING','CONFIRMED','REVERTED','REPLACED','DROPPED','REORGED',
  'INDEXER_DELAYED','INDEXER_CONFLICTING','LIFECYCLE_TIMEOUT','transactionFingerprint',
]){
  if(!orchestrator.includes(marker))throw new Error(`PRE-06 orchestrator missing ${marker}`);
}
const wallet=fs.readFileSync(path.join(root,'core/wallet-execution.js'),'utf8');
for(const marker of ['DEFAULT_SUBMISSION_GATE','LIVE_SUBMISSION_DISABLED','PRE06_MOCK','LIVE_TESTNET_QUALIFICATION','STALE_NONCE']){
  if(!wallet.includes(marker))throw new Error(`PRE-06 wallet gate missing ${marker}`);
}
if(!wallet.includes("enabled:false,mode:'DISABLED'"))throw new Error('PRE-06 wallet submission gate must default OFF');

const controller=fs.readFileSync(path.join(root,'core/browser-execution-controller.js'),'utf8');
for(const marker of ['subscribeInvalidation','invalidationListeners','submissionGate']){
  if(!controller.includes(marker))throw new Error(`PRE-06 controller missing ${marker}`);
}

const runtime=JSON.parse(fs.readFileSync(path.join(root,'runtime-config.json'),'utf8'));
if(runtime.execution?.swapSubmission!=='DISABLED_PRETESTNET')throw new Error('PRE-06 runtime must explicitly keep swap submission disabled pre-testnet');

const test=fs.readFileSync(path.join(root,'test/pre06-guarded-swap-orchestrator.test.js'),'utf8');
for(const marker of ['USER_REJECTED','STALE_NONCE','REPLACED','REORGED','INDEXER_DELAYED','INDEXER_CONFLICTING','LIFECYCLE_TIMEOUT','0x6000']){
  if(!test.includes(marker))throw new Error(`PRE-06 adversarial test missing ${marker}`);
}
console.log('420Exchange PRE-06 guarded swap orchestration static checks passed; live submission defaults OFF');
