import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const f of ['core/limit-order-cancellation-controller.js','test/pre08-limit-order-cancellation.test.js'])if(!fs.existsSync(path.join(root,f)))throw new Error('PRE-08 missing '+f);
const controller=fs.readFileSync(path.join(root,'core/limit-order-cancellation-controller.js'),'utf8');
for(const marker of [
  'OFFCHAIN_WITHDRAWAL','HASH','NONCE','remainingSellAmountRaw','RACING_FILL','DUPLICATE_CANCEL','MAKER_MISMATCH',
  'REJECTED','REVERTED','REPLACED','REORGED','INDEXER_CONFLICTING','submitPreflightedTransaction','readLimitOrderState'
])if(!controller.includes(marker))throw new Error('PRE-08 cancellation controller missing '+marker);
const runtime=JSON.parse(fs.readFileSync(path.join(root,'runtime-config.json'),'utf8'));
if(runtime.execution?.orderWithdrawal!=='DISABLED_PRETESTNET'||runtime.execution?.orderCancellation!=='DISABLED_PRETESTNET')throw new Error('PRE-08 withdrawal/cancellation gates must default OFF');
const wallet=fs.readFileSync(path.join(root,'core/wallet-execution.js'),'utf8');
if(!wallet.includes("'PRE08_MOCK'"))throw new Error('PRE-08 explicit mock submission capability missing');
console.log('420Exchange PRE-08 cancellation static checks passed; live withdrawal/cancellation default OFF');
