import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),errors=[];
const required=['index.html','styles.css','app.js','package.json','runtime-config.json','runtime-config.example.json','security-headers.json','README.md','core/config.js','core/service.js','core/wallet.js','scripts/build.mjs'];
for(const f of required)if(!fs.existsSync(path.join(root,f)))errors.push('missing '+f);
for(const f of ['app.js','core/config.js','core/service.js','core/wallet.js','scripts/build.mjs']){
  const result=spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8'});if(result.status!==0)errors.push('syntax check failed '+f+' '+result.stderr);
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const token of ['<main','aria-live','connect-wallet','campaign-list','consent-panel','reward-panel','sponsor-panel','transaction-review'])if(!html.includes(token))errors.push('UI requirement missing '+token);
const styles=fs.readFileSync(path.join(root,'styles.css'),'utf8');if(!/@media/.test(styles))errors.push('responsive stylesheet missing');
const service=fs.readFileSync(path.join(root,'core/service.js'),'utf8');
for(const token of ['campaigns(','account(','proof(','reward(','prepare(kind'])if(!service.includes(token))errors.push('service client missing '+token);
const wallet=fs.readFileSync(path.join(root,'core/wallet.js'),'utf8');
for(const token of ['WRONG_NETWORK','CANONICAL_REVIEW_REQUIRED','REVIEW_CHAIN_MISMATCH','UNEXPECTED_TRANSACTION_TARGET','eth_estimateGas','eth_sendTransaction','REORGED','REVERTED'])if(!wallet.includes(token))errors.push('wallet safety gate missing '+token);
const config=JSON.parse(fs.readFileSync(path.join(root,'runtime-config.json'),'utf8'));
if(config.registry.attentionTreasuryAddress!=='0x0000000000000000000000000000000000000421'||config.registry.campaignRegistryAddress!=='0x000000000000000000000000000000000000043b')errors.push('frozen Attention addresses drifted');
if(config.features.consentManagement||config.features.rewardClaims||config.features.sponsorCampaignManagement)errors.push('pretestnet mutation features must default OFF');
if(config.api.baseUrl!==null||config.network.chainId!==null)errors.push('pretestnet runtime must remain unresolved');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');if(/innerHTML\s*=/.test(app))errors.push('dynamic innerHTML forbidden');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}console.log('420Attention web structural check PASS');
