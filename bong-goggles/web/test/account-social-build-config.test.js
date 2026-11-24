import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withAccountSocialBuildFlags,resolveClassicBuildFlags,ACCOUNT_SOCIAL_BUILD_FLAG,CLASSIC_ROOMS_BUILD_FLAG,resolveChessBuildFlag} from '../scripts/account-social-build-config.mjs';
import {validateRuntimeConfig} from '../core/runtime-config.js';

const example=JSON.parse(await readFile(new URL('../runtime-config.example.json',import.meta.url),'utf8'));
const accountFlags=['accountSocial','accountMessaging','accountGames','accountXP'];
const withoutAccountFlags=features=>Object.fromEntries(
 Object.entries(features).filter(([name])=>!accountFlags.includes(name)&&name!=='accountMonetization'));

test('Pages account activation flag uses the exact documented variable',()=>{
 assert.equal(ACCOUNT_SOCIAL_BUILD_FLAG,'BG_ACCOUNT_SOCIAL_ACTIVATION');
});

test('BC-0.5 classic rooms require two explicit activation flags',()=>{
 assert.equal(CLASSIC_ROOMS_BUILD_FLAG,'BG_CLASSIC_ROOMS_ACTIVATION');
 for(const v of [undefined,'false'])assert.equal(withAccountSocialBuildFlags(example,'true',v).features.classicRooms,false);
 const enabled=withAccountSocialBuildFlags(example,'true','true');
 assert.equal(enabled.features.classicRooms,true);
 assert.equal(validateRuntimeConfig(enabled).features.classicRooms,true);
 for(const v of [undefined,'false'])assert.throws(()=>withAccountSocialBuildFlags(example,v,'true'),/require qualified account-social/);
 for(const bad of ['TRUE','1',false,' true',null])assert.throws(()=>withAccountSocialBuildFlags(example,'true',bad),/BG_CLASSIC_ROOMS_ACTIVATION/);
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

// BC-1.8: Pages production-only source activation leaves the independent
// opt-in parser unchanged and always respects explicit operator rollback.
test('BC-1.8 production Pages main activates Classic rooms and messages only with active 420ID',()=>{
 const set=(props)=>resolveClassicBuildFlags(props);
 assert.deepEqual(set({account:'true',pages:'1',branch:'main'}),{rooms:'true',communications:'true'});
 for(const p of [
  {account:'false',pages:'1',branch:'main'},
  {account:'true',pages:'1',branch:'feature/bc-1-8-release-activation-and-live-evidence'},
  {account:'true',pages:'0',branch:'main'},
  {account:'true',branch:'main'},
  {account:'true',pages:'1',branch:'preview'}
 ])assert.deepEqual(set(p),{rooms:undefined,communications:undefined});
 assert.deepEqual(set({account:'true',pages:'1',branch:'main',rooms:'false'}),
  {rooms:'false',communications:undefined});
 assert.deepEqual(set({account:'true',pages:'1',branch:'main',rooms:'true',communications:'false'}),
  {rooms:'true',communications:'false'});
 const enabled=set({account:'true',pages:'1',branch:'main'});
 assert.equal(withAccountSocialBuildFlags(example,'true',enabled.rooms,enabled.communications).features.classicCommunications,true);
 const disabled=set({account:'true',pages:'1',branch:'main',rooms:'false',communications:'false'});
 assert.equal(withAccountSocialBuildFlags(example,'true',disabled.rooms,disabled.communications).features.classicCommunications,false);
});

test('BC-3.8 owner-authorized Pages release remains explicit and rollback safe',()=>{
 const approved={account:'true',rooms:'true',communications:'true',pages:'1',branch:'main'};
 assert.equal(resolveChessBuildFlag(approved),'true');
 assert.equal(resolveChessBuildFlag({...approved,chess:'false'}),'false');
 for(const change of [{account:'false'},{rooms:'false'},{communications:'false'},{pages:'0'},{branch:'preview'}]){
  assert.equal(resolveChessBuildFlag({...approved,...change}),'false');
  assert.throws(()=>resolveChessBuildFlag({...approved,...change,chess:'true'}));
 }
 const config=withAccountSocialBuildFlags({...example,environment:'production'},'true','true','true','true');
 assert.equal(validateRuntimeConfig(config).features.chessRestricted,true);
 assert.equal(validateRuntimeConfig({...config,features:{...config.features,accountSocial:false}}).features.chessRestricted,false);
 assert.equal(validateRuntimeConfig({...config,features:{...config.features,classicCommunications:false}}).features.chessRestricted,false);
 assert.equal(config.features.accountMonetization,false);
});
