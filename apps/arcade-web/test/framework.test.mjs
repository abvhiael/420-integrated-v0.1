import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('React and TypeScript entrypoint renders frozen unregistered roster',()=>{
 const source=read('../src/main.tsx');
 for(const str of ["createRoot","catalog.games","scope.scope.genesisGames","UNREGISTERED","StrictMode","aria-labelledby","game.gameId"])assert.ok(source.includes(str),str);
 assert.doesNotMatch(source,/registerGame\s*\(|eth_sendTransaction|dangerouslySetInnerHTML/);
});
test('React/Vite compile and production policy are constrained',()=>{
 const pkg=JSON.parse(read('../package.json'));
 assert.equal(pkg.dependencies.react,'19.1.0');assert.equal(pkg.devDependencies.typescript,'5.8.3');
 assert.equal(pkg.scripts.typecheck,'tsc --noEmit');assert.equal(pkg.scripts.build,'vite build');
 const vite=read('../vite.config.ts');assert.match(vite,/emptyOutDir:true/);assert.match(vite,/target:'es2022'/);
});
