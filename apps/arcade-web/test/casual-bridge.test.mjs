import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('React renderer integration is actual createRoot bridge, not stub implementation',()=>{
 const source=fs.readFileSync(new URL('../src/casualAdapter.tsx',import.meta.url),'utf8');
 for(const needle of ["createRoot(container)","root.render(","root.unmount()","signal.aborted","disposed"])assert.ok(source.includes(needle),needle);
 assert.doesNotMatch(source,/signingKey|window\.ethereum|dangerouslySetInnerHTML/);
});
