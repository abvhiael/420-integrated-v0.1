import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const checker=new URL('../../../scripts/commerce/check-patch.mjs',import.meta.url).pathname;
function history(t){const dir=mkdtempSync(join(tmpdir(),'com4-patch-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const git=(...args)=>execFileSync('git',['-c','commit.gpgsign=false','-c','user.name=Commerce test','-c','user.email=commerce@example.invalid',...args],{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();git('init','-b','main');writeFileSync(join(dir,'base.txt'),'base\n');git('add','.');git('commit','-m','base');git('switch','-c','audit');writeFileSync(join(dir,'app.txt'),'valid app\n');git('add','.');git('commit','-m','app');git('switch','main');writeFileSync(join(dir,'inherited.txt'),'existing main whitespace  \n');git('add','.');git('commit','-m','main evidence');const base=git('rev-parse','HEAD');git('switch','audit');git('merge','--no-ff','--no-edit','main');git('remote','add','origin',dir);return {dir,git,base,run:env=>spawnSync(process.execPath,[checker],{cwd:dir,encoding:'utf8',env:{...process.env,COMMERCE_PATCH_BASE:'',...env}})};}
test('reconciled merge checks entire app diff against imported main and exact PR base, without inheriting old whitespace',t=>{const f=history(t);assert.equal(f.run().status,0);assert.equal(f.run({COMMERCE_PATCH_BASE:f.base}).status,0);});
test('ordinary commit and accumulated PR patch both reject new app whitespace; malformed base cannot silently pass',t=>{const f=history(t);writeFileSync(join(f.dir,'app.txt'),'bad app whitespace  \n');f.git('add','.');f.git('commit','-m','bad app');assert.notEqual(f.run().status,0);assert.notEqual(f.run({COMMERCE_PATCH_BASE:f.base}).status,0);assert.notEqual(f.run({COMMERCE_PATCH_BASE:'untrusted'}).status,0);});
