import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withAccountSocialBuildFlags,ACCOUNT_SOCIAL_BUILD_FLAG} from '../scripts/account-social-build-config.mjs';
import {validateRuntimeConfig} from '../core/runtime-config.js';

const example=JSON.parse(await readFile(new URL('../runtime-config.example.json',import.meta.url),'utf8'));
const accountFlags=['accountSocial','accountMessaging','accountGames','accountXP'];
const withoutAccountFlags=features=>Object.fromEntries(
 Object.entries(features).filter(([name])=>!accountFlags.includes(name)&&name!=='accountMonetization'));

test('Pages account activation flag uses the exact documented variable',()=>{
 assert.equal(ACCOUNT_SOCIAL_BUILD_FLAG,'BG_ACCOUNT_SOCIAL_ACTIVATION');
});

test('unset and explicit false keep wallet-free features disabled and preserve complete config',()=>{
 for(const setting of [undefined,'false']){
  const value=withAccountSocialBuildFlags(example,setting);
  assert.deepEqual(value,example);
  assert.notEqual(value,example);
  assert.notEqual(value.features,example.features);
  assert.equal(validateRuntimeConfig(value).appOrigin,example.appOrigin);
  assert.equal(value.features.accountMonetization,false);
 }
});

test('opt-in true changes only four wallet-free account flags, never monetization or other features',()=>{
 const before=JSON.stringify(example);
 const value=withAccountSocialBuildFlags(example,'true');
 for(const flag of accountFlags)assert.equal(value.features[flag],true,flag);
 assert.equal(value.features.accountMonetization,false);
 assert.deepEqual(withoutAccountFlags(value.features),withoutAccountFlags(example.features));
 const {features:baseFeatures,...baseProperties}=example;
 const {features:enabledFeatures,...enabledProperties}=value;
 assert.deepEqual(enabledProperties,baseProperties);
 assert.deepEqual(Object.keys(enabledFeatures).sort(),Object.keys(baseFeatures).sort());
 assert.equal(validateRuntimeConfig(value).appOrigin,example.appOrigin);
 assert.equal(JSON.stringify(example),before,'source fixture mutated');
 assert.equal(JSON.parse(JSON.stringify(value)).features.accountXP,true,'config JSON serialization lost flag');
});

test('build activation is strict and rejects ambiguous, empty, non-string and unsafe values',()=>{
 for(const value of ['',null,true,false,1,'1','TRUE','False',' true','true ','0','yes','on','TRUE\n']){
  assert.throws(()=>withAccountSocialBuildFlags(example,value),/BG_ACCOUNT_SOCIAL_ACTIVATION/,String(value));
 }
});

test('build refuses incomplete or malformed runtime configuration',()=>{
 for(const value of [null,{},[],{features:null},{features:[]},{features:'enabled'}]){
  assert.throws(()=>withAccountSocialBuildFlags(value,'true'),/Full BongGoggles runtime config/);
 }
});
