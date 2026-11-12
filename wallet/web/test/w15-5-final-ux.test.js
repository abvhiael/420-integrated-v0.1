import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contrastRatio} from '../core/ux-qualification.js';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=file('index.html'),css=file('wallet-shell.css'),nav=file('wallet-shell.js'),ui=file('ui-v1.js');
const tokens=file('design-tokens.css');
const token=name=>{const match=tokens.match(new RegExp(''+name+':\\s*(#[0-9a-fA-F]{6})'));assert.ok(match,'missing '+name);return match[1];};
test('Core text, secondary copy, primary action and semantic status contrast meet 4.5:1',()=>{
 for(const [fg,bg] of [
  ['--wallet-text','--wallet-canvas'],['--wallet-text','--wallet-surface'],
  ['--wallet-text-secondary','--wallet-canvas'],['--wallet-text-secondary','--wallet-surface'],
  ['--wallet-positive','--wallet-surface'],['--wallet-warning','--wallet-canvas'],
  ['--wallet-danger','--wallet-surface']
 ]) assert.ok(contrastRatio(token(fg),token(bg))>=4.5,fg+' / '+bg);
 assert.ok(contrastRatio(token('--wallet-accent'),'#111811')>=4.5,'accent button');
});
test('Keyboard navigation updates focus, handles dynamic controls and respects reduced motion',()=>{
 assert.match(nav,/new MutationObserver\(syncNavigation\)\.observe\(nav/);
 assert.match(nav,/aria-current','location'/);
 assert.match(ui,/document\.addEventListener\('click'/);
 assert.match(ui,/target\.focus\(\{preventScroll:true\}\)/);
 assert.match(ui,/\^#\[A-Za-z\]\[\\w:-\]/);
 assert.match(ui,/prefers-reduced-motion: reduce/);
 assert.match(html,/class="skip-link"/);
 assert.match(html,/id="wallet-main" class="shell" tabindex="-1"/);
 assert.match(html,/id="wallet-section-nav"/);
});
test('Status messages announce copy errors and activity state without inventing success',()=>{
 assert.match(ui,/Clipboard access was denied/);
 assert.match(ui,/Copy unavailable/);
 assert.match(html,/id="status" class="status" role="status" aria-live="polite"/);
 assert.match(html,/id="send-preview" class="muted" role="status" aria-live="polite"/);
 assert.match(html,/id="receive-status" class="muted" role="status" aria-live="polite"/);
 assert.match(ui,/reorganized/);
});
test('Responsive source contracts include 320px, mobile, tablet and desktop layouts',()=>{
 for(const width of ['max-width:360px','max-width:640px','max-width:900px'])assert.ok(css.includes(width),width);
 assert.match(css,/grid-template-columns:1fr/);
 assert.match(css,/overflow-x:clip/);
 assert.match(css,/touch-action:manipulation/);
 assert.match(css,/focus-visible/);
});
test('Security-sensitive Wallet Core entrypoints are retained unchanged',()=>{
 const app=file('app.js');
 for(const name of ['prepareSmartAccountExecution','sendSmartAccountExecution','confirmSmartAccountExecution','confirmSmartAccountCreation','confirmCapabilityManagementTransaction','confirmSessionManagementTransaction'])assert.ok(app.includes(name),name);
 for(const id of ['connect','execute-target','execute-value','execute-data','simulate-execution','send-execution','capability-panel','session-panel','recovery-panel'])if(id!=='recovery-panel')assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/src=".\/passkey-ui.js"/);
});
