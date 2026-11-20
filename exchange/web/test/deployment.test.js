import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TOKEN_ICON_FILES } from '../core/token-icons.js';

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
  const artwork=['420exchange-logo.png','sidebar-botanical.png','header-botanical.png','market-card-botanical.png'].map(name=>'assets/'+name);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'branding.css'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'deployment-manifest.json'),'utf8'));
  assert.ok(html.includes('class="exchange-brand-logo" src="./assets/420exchange-logo.png"'));
  assert.doesNotMatch(html,/83898904-fde8-4614-89ae-478db91d5fad/);
  for(const asset of artwork){
    assert.deepEqual(fs.readFileSync(path.join(root,asset)),fs.readFileSync(path.join(root,'..',asset)));
    assert.ok(manifest.files.includes(asset),asset);
    assert.ok(manifest.cachePolicy.immutableAssets.includes(asset),asset);
    if(asset!==artwork[0])assert.ok(css.includes('url("./'+asset+'")'),asset);
  }
  assert.equal(TOKEN_ICON_FILES.length,13);
  for(const asset of TOKEN_ICON_FILES){
    assert.deepEqual(fs.readFileSync(path.join(root,asset)),fs.readFileSync(path.join(root,'..',asset)));
    assert.ok(manifest.files.includes(asset),asset);
    assert.ok(manifest.cachePolicy.immutableAssets.includes(asset),asset);
  }
  assert.ok(manifest.files.includes('core/token-icons.js'));
  assert.equal(fs.readFileSync(path.join(root,'404.html'),'utf8'),html);
});

test('real deployment mode fails closed when production variables are absent',()=>{
  const cwd=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
  assert.throws(()=>execFileSync(process.execPath,['scripts/build.mjs'],{
    cwd,
    env:{PATH:process.env.PATH,HOME:process.env.HOME},
    stdio:'pipe',
  }));
});
