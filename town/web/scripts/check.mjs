import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const required=['index.html','styles.css','app.js','runtime-config.json','runtime-config.example.json','security-headers.json','core/config.js','core/abi.js','core/wallet.js','core/authority.js','core/service.js','core/state.js'];
for(const p of required)readFileSync(new URL(p,root));
for(const p of ['app.js','core/config.js','core/abi.js','core/wallet.js','core/authority.js','core/service.js','core/state.js']){
  const r=spawnSync(process.execPath,['--check',new URL(p,root).pathname],{encoding:'utf8'});
  if(r.status!==0)throw Error('syntax check failed '+p+'\n'+r.stderr);
}
const c=JSON.parse(readFileSync(new URL('runtime-config.json',root),'utf8'));
if(c.site?.productionOrigin!=='https://town.420integrated.org')throw Error('production origin missing');
if(/apiKey|privateKey|credential|secret|password|authorization/i.test(JSON.stringify(c)))throw Error('runtime config contains secret-like field');
const h=readFileSync(new URL('index.html',root),'utf8');
for(const token of ['<main','aria-live','connect-wallet','discover-form','join-community','leave-community','post-form','thread-form','comment-form','report-form','moderate-form','admin-form','access-form','transaction-status','viewport'])if(!h.includes(token))throw Error('missing UI surface '+token);
const css=readFileSync(new URL('styles.css',root),'utf8');
if(!/@media/.test(css)||!/focus-visible/.test(css)||!/prefers-reduced-motion/.test(css))throw Error('accessibility/responsive stylesheet incomplete');
const app=readFileSync(new URL('app.js',root),'utf8');
if(/localStorage|sessionStorage/.test(app))throw Error('session token must not be persisted');
if(/innerHTML\s*=/.test(app))throw Error('dynamic innerHTML forbidden');
console.log('420Town web structural check PASS');
