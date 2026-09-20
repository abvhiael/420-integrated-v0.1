import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const v15=readFileSync(new URL('../browser-wallet-ui.js',import.meta.url),'utf8');

test('PRE-02 legacy V14 display app does not create or own a wallet session',()=>{
  for(const forbidden of [
    /\bnew\s+WalletController\s*\(/,
    /\bnew\s+WalletSession\s*\(/,
    /\bstate\.wallet(?:Controller|Session)\b/,
    /\bconnectOrSwitchWallet\b/,
    /\bglobalThis\.ethereum\b/,
    /\beth_requestAccounts\b/,
    /\bwallet_switchEthereumChain\b/,
  ]) assert.doesNotMatch(app,forbidden);
  assert.match(v15,/mountWalletUI/);
  assert.match(v15,/\.connect\s*\(/);
});

test('PRE-02 V14 cannot prepare or enable execution from display-only data',()=>{
  for(const forbidden of [
    /\breviewSigningRequest\b/,
    /\bbuildSigningRequest\b/,
    /\bsigningGate\b/,
    /\bstate\.signingRequest\b/,
    /\beth_sendTransaction\b/,
    /\beth_signTypedData_v4\b/,
    /\bcanSubmitSwap\b/,
    /\bcanSubmitBridge\b/,
    /\bcanCancelOrder\b/,
    /\bsubmit\.disabled\s*=\s*!/,
    /\bcancel\.disabled\s*=\s*!/,
  ]) assert.doesNotMatch(app,forbidden);
  assert.match(app,/const submit=fragment\.querySelector\('#swap-submit'\);submit\.disabled=true/);
  assert.match(app,/const submit=fragment\.querySelector\('#bridge-submit'\);submit\.disabled=true/);
  assert.match(app,/cancel\.disabled=true/);
  assert.match(app,/sign\.disabled=true/);
  assert.match(app,/target\.closest\('#connect,#swap-submit,#order-sign,#bridge-submit,\[data-cancel-order\]'\)/);
});
