import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildWalletVerificationModel420} from '../core/network-verification.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('status never infers contract deployment or verification from a configured address',()=>{
 const address='0x'+'a'.repeat(40);
 const m=buildWalletVerificationModel420({controller:address,config:{network:{chainId:'0x420'},smartAccount:{factoryAddress:address},deployment:{entryPointAddress:address,capabilityRegistryAddress:address},manifest:{url:'https://example.test/manifest'}},network:{healthy:true,chainId:'0x420',chainMismatch:false}});
 assert.equal(m.network.label,'RPC reachable · chain matched');
 for(const key of ['factory','entrypoint','registry']){assert.equal(m[key].label,'Address configured');assert.match(m[key].detail,/not established/);}
 assert.equal(m.services.label,'Manifest configured');
 assert.equal(m.account.label,'Not discovered');
});
test('wrong chain is a warning, disconnected and missing deployment are explicit',()=>{
 const wrong=buildWalletVerificationModel420({controller:'0xabc',config:{network:{chainId:'0x420'}},network:{healthy:true,chainId:'0x421',chainMismatch:true}});
 assert.equal(wrong.banner.state,'warning');
 assert.equal(wrong.network.label,'Wrong network');
 const missing=buildWalletVerificationModel420({config:{network:{chainId:null}}});
 assert.equal(missing.banner.label,'Deployment unconfigured');
 assert.equal(missing.factory.label,'Not configured');
 assert.equal(missing.services.label,'Manifest unavailable');
 const disconnected=buildWalletVerificationModel420({config:{network:{chainId:'0x420'}}});
 assert.equal(disconnected.banner.state,'disconnected');
 const loading=buildWalletVerificationModel420({phase:'loading'});
 assert.equal(loading.banner.state,'loading');
 const failed=buildWalletVerificationModel420({phase:'failure',error:'RPC failure'});
 assert.equal(failed.banner.state,'failure');
});
test('UI preserves existing core controls and verified ecosystem service resolver',()=>{
 const html=read('index.html'),app=read('app.js'),apps=read('apps-page.js');
 for(const id of ['connect','smart-account','network','rpc-status','send-execution','simulate-execution','capability-panel','security-centre','services-section','network-verification','verification-banner','verification-factory','verification-entrypoint','verification-registry','verification-services']) assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/src=".\/network-verification.js"/);
 assert.match(app,/confirmSmartAccountExecution/);
 assert.match(app,/wallet:verification-state/);
 assert.match(app,/loadConfig\(\)\.then\(\(\) => \{/);
 assert.match(app,/publishWalletVerificationState420\('failure',error.message\)/);
 assert.match(apps,/resolveServices\(await manifestResponse.json\(\), APP_SERVICES\)/);
 assert.match(apps,/data-category-jump/);
});
