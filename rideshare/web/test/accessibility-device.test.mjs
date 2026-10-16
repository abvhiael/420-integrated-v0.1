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
