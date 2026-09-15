import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
test('420-status exposes view and check without mutation commands',async()=>{const cli=await readFile(resolve(process.cwd(),'bin/420-status.mjs'),'utf8');assert.match(cli,/command==='view'/);assert.match(cli,/command==='check'/);assert.match(cli,/createStatusAggregator420/);assert.doesNotMatch(cli,/sign|sendRawTransaction|finalize|authorize/);});
test('package publishes 420-status binary',async()=>{const pkg=JSON.parse(await readFile(resolve(process.cwd(),'package.json'),'utf8'));assert.equal(pkg.bin['420-status'],'./bin/420-status.mjs');});
