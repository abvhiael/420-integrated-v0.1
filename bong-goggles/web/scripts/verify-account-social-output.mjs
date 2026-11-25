// Verify the real Pages build output, not only the standalone config helper.
// Usage: node scripts/verify-account-social-output.mjs disabled|enabled
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRuntimeConfig} from '../core/runtime-config.js';
import {resolveClassicBuildFlags} from './account-social-build-config.mjs';

export function verifyAccountSocialOutput(source,generated,mode,env=process.env){
 if(mode!=='disabled'&&mode!=='enabled')throw Error('Expected disabled or enabled mode');
 const enabled=mode==='enabled';
 const flags=resolveClassicBuildFlags({account:env.BG_ACCOUNT_SOCIAL_ACTIVATION,
  rooms:env.BG_CLASSIC_ROOMS_ACTIVATION,
  communications:env.BG_CLASSIC_COMMUNICATIONS_ACTIVATION,
  pages:env.CF_PAGES,branch:env.CF_PAGES_BRANCH});
 const rooms=enabled&&flags.rooms==='true';
 const communications=rooms&&flags.communications==='true';
 // Independently calculate expected Chess output; never infer it from dist.
 const approved=enabled&&env.BG_ACCOUNT_SOCIAL_ACTIVATION==='true'&&rooms&&communications&&env.CF_PAGES==='1'&&env.CF_PAGES_BRANCH==='main';
 const rawChess=env.BG_CHESS_ACTIVATION;
 assert.ok(rawChess===undefined||rawChess==='true'||rawChess==='false','Invalid Chess activation flag');
 assert.ok(rawChess!=='true'||approved,'Chess activation outside approved main Pages configuration');
 const chess=approved&&rawChess!=='false';
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
   chessRestricted:chess,
   accountMonetization:false
  }
 };
 assert.deepEqual(generated,expected,'Built runtime config modified another feature or source field');
 const validated=validateRuntimeConfig(generated).features;
 assert.equal(validated.accountSocial,enabled);
 assert.equal(validated.classicRooms,rooms);
 assert.equal(validated.classicCommunications,communications);
 assert.equal(validated.chessRestricted,chess);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const root=resolve(import.meta.dirname,'..');
 const source=JSON.parse(await readFile(resolve(root,'runtime-config.example.json'),'utf8'));
 const generated=JSON.parse(await readFile(resolve(root,'dist/runtime-config.json'),'utf8'));
 verifyAccountSocialOutput(source,generated,process.argv[2]);
 console.log('Actual BongGoggles dist/runtime-config.json verified:',process.argv[2]);
}
