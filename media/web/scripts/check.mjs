import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const required=[
  'index.html','styles.css','app.js','package.json','runtime-config.json','runtime-config.example.json',
  'security-headers.json','core/config.js','core/service.js','core/wallet.js','core/state.js'
];
for(const file of required)readFileSync(new URL(file,root));
for(const file of ['app.js','core/config.js','core/service.js','core/wallet.js','core/state.js']){
  const result=spawnSync(process.execPath,['--check',new URL(file,root).pathname],{encoding:'utf8'});
  if(result.status!==0)throw Error('syntax check failed '+file+'\n'+result.stderr);
}
const config=JSON.parse(readFileSync(new URL('runtime-config.json',root),'utf8'));
if(config.schema!=='420-media-web-runtime-v1')throw Error('runtime schema mismatch');
if(config.registry?.serviceId!=='420/service/media/v1')throw Error('Media service id mismatch');
if(config.site?.productionOrigin!==null)throw Error('production origin must remain unresolved');
if(config.api?.baseUrl!==null||config.network?.chainId!==null||config.network?.network!==null)throw Error('runtime must remain fail-closed before deployment');
if(/apiKey|privateKey|seedPhrase|mnemonic|secret|password|authorization/i.test(JSON.stringify(config)))throw Error('runtime config contains secret-like field');
const html=readFileSync(new URL('index.html',root),'utf8');
for(const token of [
  '<main','viewport','skip-link','aria-live','connect-wallet','library-grid','library-loading','library-empty','library-error',
  'player','upload-form','upload-file','upload-progress','retry-upload','livestream-panel','live-create-form','refresh-live',
  'start-live','stop-live','live-status','transaction-state','runtime-state','capability-state'
])if(!html.includes(token))throw Error('missing UI requirement '+token);
const css=readFileSync(new URL('styles.css',root),'utf8');
for(const token of ['@media','focus-visible','prefers-reduced-motion'])if(!css.includes(token))throw Error('accessibility/responsive CSS missing '+token);
const app=readFileSync(new URL('app.js',root),'utf8');
for(const token of ['loadLibrary','selectAsset','prepareUpload','retryUpload','pollReady','createLive','liveAction','connectWallet','featureEnabled'])if(!app.includes(token))throw Error('workflow missing '+token);
if(/localStorage|sessionStorage|indexedDB/.test(app))throw Error('authority/retry state must remain session-memory only');
if(/innerHTML\s*=/.test(app))throw Error('dynamic innerHTML forbidden');
console.log('420Media web structural check PASS');
