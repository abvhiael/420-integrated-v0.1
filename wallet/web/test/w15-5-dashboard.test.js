import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectNativeAccountBalance420 } from '../core/dashboard.js';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../wallet-shell.css', import.meta.url), 'utf8');
const tokenCss = readFileSync(new URL('../design-tokens.css', import.meta.url), 'utf8');
test('W15.5 preserves canonical Wallet Core binding ids and entry scripts', () => {
  for (const id of ['connect','smart-account','owner-line','network','rpc-status','create-account','account','owner','block','portfolio','execution-panel','send-asset','send-recipient','send-amount','execute-target','execute-value','execute-data','execute-simulation','send-execution','capability-panel','session-panel','services','activity-list','status']) {
    assert.match(html, new RegExp('id="' + id + '"'), id);
  }
  for (const script of ['app.js','ui-v1.js','recovery-ui.js','passkey-ui.js']) {
    if (script === 'recovery-ui.js') continue; // Imported by ui-v1.js
    assert.ok(html.includes(script), script);
  }
});
test('W15.5 dashboard and responsive shell expose accessible anchors and tokens', () => {
  for (const id of ['overview','wallet-assets','wallet-activity','dashboard-native-balance','dashboard-controller-balance','dashboard-account-state','wallet-main']) assert.ok(html.includes('id="' + id + '"'), id);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /data-scroll-target="#execution-panel"/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(css, /max-width: 640px/);
  for (const color of ['--wallet-canvas','--wallet-accent','--wallet-border','--wallet-text-secondary']) assert.ok(tokenCss.includes(color), color);
});
const controller='0x'+'1'.repeat(40), smart='0x'+'2'.repeat(40);
const data={native:[{address:controller,raw:90n,decimals:18,symbol:'420'},{address:smart,raw:7n,decimals:18,symbol:'420'}]};
test('W15.5 native balance selector keeps controller and Smart Account distinct', () => {
  assert.equal(selectNativeAccountBalance420(data,smart).raw,7n);
  assert.equal(selectNativeAccountBalance420(data,controller).raw,90n);
  assert.equal(selectNativeAccountBalance420(data,'0x'+'3'.repeat(40)),null);
  assert.equal(selectNativeAccountBalance420(data,null),null);
});
test('W15.5 native balance selector fails closed on duplicate/invalid chain data', () => {
  assert.equal(selectNativeAccountBalance420({native:[...data.native,data.native[1]]},smart),null);
  assert.equal(selectNativeAccountBalance420({native:[{address:smart,raw:'7',decimals:18,symbol:'420'}]},smart),null);
});
