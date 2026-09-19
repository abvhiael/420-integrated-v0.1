import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('production artifact build emits domain, fallback, headers, runtime and build metadata',()=>{
  execFileSync(process.execPath,['scripts/build.mjs'],{
    cwd:path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),
    env:{...process.env,EXCHANGE_DEPLOYMENT_MODE:'qualification',GITHUB_SHA:'test-sha',EXCHANGE_BUILD_TIME:'2026-09-18T00:00:00.000Z'},
    stdio:'pipe',
  });
  const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..','dist');
  for(const file of ['index.html','404.html','CNAME','_headers','runtime-config.json','build-meta.json','deployment-manifest.json']){
    assert.equal(fs.existsSync(path.join(root,file)),true,file);
  }
  assert.equal(fs.readFileSync(path.join(root,'CNAME'),'utf8').trim(),'exchange.420integrated.org');
  const meta=JSON.parse(fs.readFileSync(path.join(root,'build-meta.json'),'utf8'));
  assert.equal(meta.sourceSha,'test-sha');
  assert.equal(meta.productionOrigin,'https://exchange.420integrated.org');
  const runtime=JSON.parse(fs.readFileSync(path.join(root,'runtime-config.json'),'utf8'));
  assert.equal(runtime.network.chainId,'0x1a4');
  assert.match(runtime.api.streamUrl,/^wss:/);
});

test('real deployment mode fails closed when production variables are absent',()=>{
  const cwd=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
  assert.throws(()=>execFileSync(process.execPath,['scripts/build.mjs'],{
    cwd,
    env:{PATH:process.env.PATH,HOME:process.env.HOME},
    stdio:'pipe',
  }));
});
