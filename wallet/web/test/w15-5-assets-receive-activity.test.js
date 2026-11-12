import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getCanonicalReceiveAddress420 } from '../core/receive.js';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../ui-v1.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../wallet-shell.css', import.meta.url), 'utf8');
const address = '0x'+'a'.repeat(40);
const config = {smartAccount:{smartAccount:address,deployed:true,expectedChainId:'0x420'},network:{healthy:true,chainId:'0x420',chainMismatch:false},expectedChainId:'0x420'};
test('Receive only exposes valid deployed Smart Account on exact expected network',()=>{
 assert.equal(getCanonicalReceiveAddress420(config),address);
 assert.equal(getCanonicalReceiveAddress420({...config,smartAccount:{...config.smartAccount,deployed:false}}),null);
 assert.equal(getCanonicalReceiveAddress420({...config,smartAccount:{...config.smartAccount,smartAccount:'0x'+'0'.repeat(40)}}),null);
 assert.equal(getCanonicalReceiveAddress420({...config,network:{...config.network,chainId:'0x421'}}),null);
 assert.equal(getCanonicalReceiveAddress420({...config,network:{...config.network,chainMismatch:true}}),null);
 assert.equal(getCanonicalReceiveAddress420({...config,network:{...config.network,healthy:false}}),null);
 assert.equal(getCanonicalReceiveAddress420({...config,expectedChainId:null}),null);
 assert.equal(getCanonicalReceiveAddress420({...config,smartAccount:null}),null);
 assert.equal(getCanonicalReceiveAddress420({...config,smartAccount:{...config.smartAccount,expectedChainId:'nonsense'}}),null);
});
test('Assets, Receive and Activity are separate anchored views without replacing existing wallet controls',()=>{
 for(const id of ['wallet-assets','wallet-receive','wallet-activity','portfolio','receive-address','copy-receive-address','send-preview','send-recipient','send-amount','send-asset','execute-target','execute-value','execute-data','simulate-execution','send-execution','activity-list','activity-filter']) assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/data-copy-source="#receive-address"/);
 assert.match(html,/copy-receive-address" data-copy-source="#receive-address" disabled/);
 assert.match(html,/wallet-advanced-execution/);
 assert.match(html,/No private history storage/);
});
test('Guided send continues through canonical simulation and explicit execution handlers',()=>{
 assert.match(ui,/buildSendExecution/);
 assert.match(ui,/dispatchEvent\(new Event\('input'/);
 assert.match(app,/prepareSmartAccountExecution/);
 assert.match(app,/sendSmartAccountExecution/);
 assert.match(app,/confirmSmartAccountExecution/);
 assert.match(app,/canonical: true/);
 assert.match(app,/getCanonicalReceiveAddress420/);
 assert.match(css,/wallet-receive-grid/);
 assert.match(css,/wallet-activity-toolbar/);
});
