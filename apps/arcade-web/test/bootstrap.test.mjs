import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('html has accessible root, skip link, secure module entrypoint and viewport',()=>{
 const html=read('../index.html');
 assert.match(html,/href="#main"/);assert.match(html,/id="root"/);assert.match(html,/name="viewport"/);assert.match(html,/type="module"/);
 assert.match(read('../src/App.tsx'),/aria-live="polite"/);
 assert.match(read('../src/style.css'),/prefers-reduced-motion/);
});
test('frozen game scope is bound to actual React component',()=>{
 const src=read('../src/App.tsx');
 assert.match(src,/validateCatalog\(catalog.games,scope.scope.genesisGames\)/);
 assert.match(src,/registration!=='UNREGISTERED'/);
 assert.match(src,/walletRequiredForCore!==false/);
 assert.doesNotMatch(src,/dangerouslySetInnerHTML|eth_sendTransaction|registerGame\s*\(/);
});
