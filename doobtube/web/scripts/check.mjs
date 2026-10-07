import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const required=['index.html','app.js','styles.css','doobtube-logo.webp','package.json','runtime-config.json','runtime-config.example.json','security-headers.json','core/config.js','core/service.js','core/wallet.js','core/routes.js','core/state.js'];
for(const f of required)readFileSync(new URL(f,root));
for(const f of ['app.js','core/config.js','core/service.js','core/wallet.js','core/routes.js','core/state.js']){
 const r=spawnSync(process.execPath,['--check',new URL(f,root).pathname],{encoding:'utf8'});if(r.status!==0)throw Error('syntax check failed '+f+'\n'+r.stderr);
}
const cfg=JSON.parse(readFileSync(new URL('runtime-config.json',root),'utf8'));
if(cfg.schema!=='doobtube-web-runtime-v1')throw Error('runtime schema mismatch');
if(cfg.site?.productionOrigin!==null)throw Error('production origin must remain unresolved');
if(cfg.network?.chainId!==null||cfg.network?.network!==null)throw Error('network must remain fail-closed');
for(const key of ['doobtube','media','search','notifications'])if(cfg.services?.[key]?.baseUrl!==null)throw Error(key+' runtime endpoint must remain unresolved');
if(cfg.services.media.serviceId!=='420/service/media/v1'||cfg.services.search.serviceId!=='420/service/search/v1'||cfg.services.notifications.serviceId!=='420/service/notifications/v1')throw Error('canonical service id drift');
if(/privateKey|seedPhrase|mnemonic|apiKey|authorizationToken|rawSecret|password/i.test(JSON.stringify(cfg)))throw Error('secret-like runtime config forbidden');
const html=readFileSync(new URL('index.html',root),'utf8');
for(const t of ['viewport','skip','aria-live','doobtube-logo.webp','brand-logo','hero-logo','footer-logo','connect-wallet','data-view="home"','data-view="search"','data-view="watch"','data-view="creator"','data-view="library"','data-view="upload"','data-view="live"','data-view="subscriptions"','data-view="moderation"','data-view="data"','data-view="status"','player','upload-form','retry-upload','live-form','report-form','appeal-form'])if(!html.includes(t))throw Error('missing UI requirement '+t);
const css=readFileSync(new URL('styles.css',root),'utf8');for(const t of ['@media','focus-visible','prefers-reduced-motion'])if(!css.includes(t))throw Error('missing accessibility CSS '+t);
const app=readFileSync(new URL('app.js',root),'utf8');
for(const t of ['loadFeed','search','loadAsset','renderCreator','loadLibrary','prepareUpload','retryUpload','createLive','liveAction','subscribeCreator','report','appeal','renderStatus'])if(!app.includes(t))throw Error('missing workflow '+t);
if(/localStorage|sessionStorage|indexedDB/.test(app))throw Error('authority-sensitive state must not be browser-persistent');
if(/innerHTML\s*=/.test(app))throw Error('dynamic innerHTML forbidden');
console.log('DoobTube web structural check PASS');
