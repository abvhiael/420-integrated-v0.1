import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('keyboard and assistive-technology navigation landmarks retained',()=>{
 for(const token of ['href="#main"','aria-label="Primary navigation"','aria-expanded="false"','aria-live="polite"','tabindex="-1"'])assert.ok(html.includes(token),token);
 for(const token of ['event.key !== "Escape"','menu.focus()','focusAfterNavigation','root.focus()','aria-expanded", "false"'])assert.ok(app.includes(token),token);
 assert.match(css,/:focus-visible/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/@media\(max-width:650px\)/);
});
test('offline transitions invalidate pending authorization and reconnect requires fresh session',()=>{
 assert.ok(app.includes('window.addEventListener("offline"'));
 assert.ok(app.includes('window.addEventListener("online"'));
 assert.ok(app.includes('requestNumber++'));
 assert.ok(app.includes('session = null;'));
 assert.ok(app.includes('if (!connectivityAvailable'));
 assert.ok(app.includes('void refresh()'));
 assert.ok(app.includes('Access remains blocked until reconnection'));
});

test('device permission is optional, denied access remains recoverable',async()=>{
 const {createPickupController}=await import('../pickup-controller.mjs');
 let calls=0;
 const controller=createPickupController({geolocate:async()=>{calls++;throw Error('denied')}});
 assert.equal(calls,0);
 await assert.rejects(controller.requestLocationPermission(),e=>e.code==='LOCATION_UNAVAILABLE');
 assert.equal(calls,1);assert.equal(controller.permission(),false);
 controller.set('pickup',{label:'Manual pickup',source:'manual',clarification:'Main entrance'});
});
test('reconnect ordering invalidates authorization completed after network loss',()=>{
 const disconnect=app.indexOf('window.addEventListener("offline"');
 const invalidation=app.indexOf('requestNumber++',disconnect);
 const sessionClear=app.indexOf('session = null;',disconnect);
 const reconnect=app.indexOf('window.addEventListener("online"');
 const revalidate=app.indexOf('void refresh()',reconnect);
 assert.ok(disconnect>=0&&invalidation>disconnect&&sessionClear>disconnect);
 assert.ok(reconnect>disconnect&&revalidate>reconnect);
 assert.ok(app.includes('token !== requestNumber || !connectivityAvailable'));
 assert.ok(app.indexOf('focusAfterNavigation = true;\n  void refresh();')>0);
});
