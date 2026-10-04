import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const required=['index.html','styles.css','app.js','runtime-config.json','runtime-config.example.json','security-headers.json','core/config.js','core/abi.js','core/wallet.js','core/read-api.js','core/transactions.js','core/controller.js'];
for(const p of required)readFileSync(new URL(p,root));
for(const p of ['app.js','core/config.js','core/abi.js','core/wallet.js','core/read-api.js','core/transactions.js','core/controller.js']){
  const result=spawnSync(process.execPath,['--check',new URL(p,root).pathname],{encoding:'utf8'});
  if(result.status!==0)throw new Error('syntax check failed for '+p+'\n'+result.stderr);
}
const config=JSON.parse(readFileSync(new URL('runtime-config.json',root),'utf8'));
if(config.site?.productionOrigin!=='https://ai.420integrated.org')throw Error('production origin missing');
const serialized=JSON.stringify(config);
if(/apiKey|privateKey|credential|secret|password|authorization/i.test(serialized))throw Error('browser runtime config contains privileged secret field');
const html=readFileSync(new URL('index.html',root),'utf8');
for(const token of ['<main','aria-live','id="connect-wallet"','id="model-list"','id="job-detail"','viewport'])if(!html.includes(token))throw Error('missing client surface '+token);
const styles=readFileSync(new URL('styles.css',root),'utf8');
if(!/@media/.test(styles))throw Error('responsive stylesheet missing');
const app=readFileSync(new URL('app.js',root),'utf8');
if(app.includes('innerHTML'))throw Error('browser client must not use innerHTML for indexed/review data');
console.log('420AI client structural check PASSED');
