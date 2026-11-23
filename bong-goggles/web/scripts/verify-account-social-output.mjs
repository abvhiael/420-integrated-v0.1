// Verify the real Pages build output, not only the standalone config helper.
// Usage: node scripts/verify-account-social-output.mjs disabled|enabled
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateRuntimeConfig} from '../core/runtime-config.js';
import {resolveClassicBuildFlags} from './account-social-build-config.mjs';

const mode=process.argv[2];
if(mode!=='disabled'&&mode!=='enabled')throw Error('Expected disabled or enabled mode');
const root=resolve(import.meta.dirname,'..');
const source=JSON.parse(await readFile(resolve(root,'runtime-config.example.json'),'utf8'));
const generated=JSON.parse(await readFile(resolve(root,'dist/runtime-config.json'),'utf8'));
const enabled=mode==='enabled';
const flags=resolveClassicBuildFlags({account:process.env.BG_ACCOUNT_SOCIAL_ACTIVATION,
 rooms:process.env.BG_CLASSIC_ROOMS_ACTIVATION,
 communications:process.env.BG_CLASSIC_COMMUNICATIONS_ACTIVATION,
 pages:process.env.CF_PAGES,branch:process.env.CF_PAGES_BRANCH});
const rooms=enabled&&flags.rooms==='true';
const communications=rooms&&flags.communications==='true';
const expected={
 ...source,
 features:{
  ...source.features,
  accountSocial:enabled,
  accountMessaging:enabled,
  accountGames:enabled,
  accountXP:enabled,
  classicRooms:rooms,
  classicCommunications:communications,
  accountMonetization:false
 }
};
assert.deepEqual(generated,expected,'Built runtime config modified another feature or source field');
assert.equal(validateRuntimeConfig(generated).features.accountSocial,enabled);
assert.equal(validateRuntimeConfig(generated).features.classicRooms,rooms);
assert.equal(validateRuntimeConfig(generated).features.classicCommunications,communications);
console.log('Actual BongGoggles dist/runtime-config.json verified:',mode);
