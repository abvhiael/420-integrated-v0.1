import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {securityPanelAvailability420,securityIdentityLabel420} from '../core/security-centre.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../wallet-shell.css',import.meta.url),'utf8');
test('Security Centre retains canonical Wallet Core hooks',()=>{
 for(const id of ['security-centre','capability-panel','inspect-capability','revoke-capability','capability-grant-id','session-panel','enable-session-key','revoke-session-key','create-session-grant','gas-sponsor-panel','create-sponsor-grant','security-connected-apps'])
 assert.ok(html.includes('id="'+id+'"'),id);
 for(const module of ['ui-v1.js','session-execution-ui.js','passkey-ui.js','wallet-shell.js','security-centre.js']) assert.ok(html.includes('src="./'+module+'"'),module);
});
test('Connected apps are not confused with on-chain permissions',()=>{
 assert.match(html,/does not currently provide an authoritative inventory/);
 assert.match(html,/Disconnecting a website does not revoke its separate on-chain capability grant/);
});
test('Availability labels do not assert verification',()=>{
 assert.deepEqual(securityPanelAvailability420(false,true),{label:'Unavailable',state:'unavailable'});
 assert.deepEqual(securityPanelAvailability420(true,true),{label:'Unavailable',state:'unavailable'});
 assert.deepEqual(securityPanelAvailability420(true,false),{label:'Controls available',state:'available'});
 assert.equal(securityIdentityLabel420('—','Not verified'),'Not verified');
 assert.equal(securityIdentityLabel420('0x123','Not verified'),'0x123');
});
test('All feature cards have guarded navigation and responsive styling',()=>{
 for(const t of ['#capability-panel','#session-panel','#passkey-panel','#recovery-panel']) assert.ok(html.includes('data-scroll-target="'+t+'"'),t);
 assert.match(html,/aria-labelledby="security-centre-heading"/);
 assert.match(css,/max-width: 760px/);
});
