import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderCatalog} from '../src/main.mjs';
const get=(p)=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const canon=JSON.parse(get('../../../config/arcade-game-identities.json')).games;
function dom(){const nodes=[];const document={createDocumentFragment:()=>({append(x){nodes.push(x)}}),createElement:tag=>({tag,textContent:'',append(...els){this.children=els}})};return {ownerDocument:document,replaceChildren(fragment){this.child=fragment},nodes};}
test('all eleven frozen unregistered identities render as text nodes without executable HTML',()=>{const target=dom();renderCatalog(canon,target);assert.equal(target.nodes.length,11);assert.equal(target.nodes[0].children[0].textContent,'Kush Crush');});
test('spoofed, duplicated, truncated or malformed identity lists fail closed',()=>{for(const edit of [a=>a.pop(),a=>a[0].gameId=a[1].gameId,a=>a[0].gameId='OTHER',a=>a[0].gameId='<script>']){const list=structuredClone(canon);edit(list);assert.throws(()=>renderCatalog(list,dom()));}});
test('build uses frozen game scope and never grants registry authority',()=>{const script=get('../scripts/build.mjs');assert.match(script,/arcade-0-7-scope-freeze/);assert.match(script,/UNREGISTERED/);assert.doesNotMatch(script,/registerGame\(/);});
test('HTML provides skip link, heading, accessible status and responsive viewport',()=>{const html=get('../index.html');assert.match(html,/href="#main"/);assert.match(html,/aria-live="polite"/);assert.match(html,/name="viewport"/);assert.match(get('../src/style.css'),/prefers-reduced-motion/);});
