import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve('packages/420-gaming-sdk');
const dir=mkdtempSync(join(tmpdir(),'gaming-independent-'));
try {
 const installed=join(dir,'node_modules','@420','gaming-sdk');
 cpSync(root,installed,{recursive:true,filter:p=>!p.includes('/node_modules/')});
 writeFileSync(join(dir,'package.json'),JSON.stringify({name:'independent-game-fixture',private:true,type:'module',scripts:{build:'node ./build.mjs'}}));
 writeFileSync(join(dir,'build.mjs'),`
import assert from 'node:assert/strict';
import {createOfflineGamingAdapter420,createGameConnection420,GAMING_GAME_IDS,GAMING_SDK_COMPAT_VERSION} from '@420/gaming-sdk';
assert.equal(GAMING_SDK_COMPAT_VERSION,'0.1.0');
const id=GAMING_GAME_IDS.budtender;
const game={score:42,turn:2};
const adapter=createOfflineGamingAdapter420({gameId:id});
const connection=createGameConnection420({gameId:id,adapter});
assert.equal(await connection.connect(),'guest');
assert.equal(await connection.getEntitlement({profileId:'guest',entitlementId:'missing'}),null);
assert.equal((await connection.submitRewardClaim({gameId:id,profileId:'guest',claimId:'x',evidenceHash:'0x'+'1'.repeat(64),network:'testnet'})).status,'unavailable');
assert.deepEqual(game,{score:42,turn:2});
console.log('PASS independent game fixture builds and runs solely from node_modules/@420/gaming-sdk');
`);
 const output=execFileSync('npm',['run','build','--offline','--ignore-scripts'],{cwd:dir,encoding:'utf8'});
 assert.match(output,/PASS independent game fixture/);
 console.log(output.trim());
}finally{rmSync(dir,{recursive:true,force:true});}
