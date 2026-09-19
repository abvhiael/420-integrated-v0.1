import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const dist=path.join(root,'dist');
const sha=process.env.GITHUB_SHA || process.env.EXCHANGE_BUILD_SHA || 'local';
const builtAt=process.env.EXCHANGE_BUILD_TIME || new Date(0).toISOString();
const qualification=process.env.EXCHANGE_DEPLOYMENT_MODE==='qualification';

function requiredEnv(name){
  const value=process.env[name];
  if(!value && !qualification) throw new Error(`missing production deployment variable: ${name}`);
  return value || null;
}
function clean(){ fs.rmSync(dist,{recursive:true,force:true}); fs.mkdirSync(dist,{recursive:true}); }
function copy(relative){
  const source=path.join(root,relative), target=path.join(dist,relative);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(source,target);
}
function copyDir(relative){
  const source=path.join(root,relative),target=path.join(dist,relative);
  fs.cpSync(source,target,{recursive:true});
}
function assertHttps(value,label,{ws=false}={}){
  if(!value) return;
  const u=new URL(value);
  const protocols=ws?['https:','wss:']:['https:'];
  if(!protocols.includes(u.protocol)||u.username||u.password) throw new Error(`invalid ${label}`);
}

clean();
for(const file of ['index.html','app.js','styles.css','branding.css']) copy(file);
copyDir('core');
copyDir('fixtures');
copyDir('assets');

// Preserve the approved artwork as an asset and integrate it into the built shell.
// Keep the original index.html untouched to avoid changing runtime templates or route hooks.
const logo='assets/83898904-fde8-4614-89ae-478db91d5fad.jpg';
if(!fs.existsSync(path.join(dist,logo))) throw new Error(`approved 420Exchange logo missing: ${logo}`);
const indexPath=path.join(dist,'index.html');
let html=fs.readFileSync(indexPath,'utf8');
const oldBrand='<span class="brand-mark">420</span>\n        <span><strong>Exchange</strong><small>Integrated</small></span>';
if(!html.includes(oldBrand)) throw new Error('Exchange brand insertion point changed; review shell before deploying');
html=html.replace(oldBrand,`<img class="exchange-brand-logo" src="./${logo}" alt="420Exchange — Cannabis. Powers Progress" width="400" height="400" />\n        <span class="exchange-brand-label">420 Integrated · Exchange</span>`);
const styleAnchor='<link rel="stylesheet" href="./styles.css" />';
if(!html.includes(styleAnchor)) throw new Error('Exchange stylesheet insertion point changed');
html=html.replace(styleAnchor,`${styleAnchor}\n  <link rel="stylesheet" href="./branding.css" />`);
fs.writeFileSync(indexPath,html);

const template=JSON.parse(fs.readFileSync(path.join(root,'runtime-config.json'),'utf8'));
const runtime={
  ...template,
  network:{
    ...template.network,
    chainId:requiredEnv('EXCHANGE_CHAIN_ID'),
    rpcUrl:requiredEnv('EXCHANGE_RPC_URL'),
    explorerUrl:requiredEnv('EXCHANGE_EXPLORER_URL'),
  },
  api:{
    ...template.api,
    baseUrl:requiredEnv('EXCHANGE_API_BASE_URL'),
    streamUrl:requiredEnv('EXCHANGE_STREAM_URL'),
    marketSubjects:(process.env.EXCHANGE_MARKET_SUBJECTS||'').split(',').map(x=>x.trim()).filter(Boolean),
  }
};
if(qualification){
  runtime.network.chainId=runtime.network.chainId||'0x1a4';
  runtime.network.rpcUrl=runtime.network.rpcUrl||'https://rpc.example.invalid';
  runtime.network.explorerUrl=runtime.network.explorerUrl||'https://explorer.example.invalid';
  runtime.api.baseUrl=runtime.api.baseUrl||'https://api.example.invalid/exchange';
  runtime.api.streamUrl=runtime.api.streamUrl||'wss://api.example.invalid/exchange/stream';
}
assertHttps(runtime.network.rpcUrl,'RPC URL');
assertHttps(runtime.network.explorerUrl,'Explorer URL');
assertHttps(runtime.api.baseUrl,'API base URL');
assertHttps(runtime.api.streamUrl,'stream URL',{ws:true});
if(runtime.network.chainId && !/^0x[0-9a-fA-F]+$/.test(runtime.network.chainId)) throw new Error('invalid deployment chain ID');

fs.writeFileSync(path.join(dist,'runtime-config.json'),JSON.stringify(runtime,null,2)+'\n');
fs.writeFileSync(path.join(dist,'CNAME'),'exchange.420integrated.org\n');
fs.copyFileSync(path.join(dist,'index.html'),path.join(dist,'404.html'));

const headers=JSON.parse(fs.readFileSync(path.join(root,'security-headers.json'),'utf8'));
const headerLines=['/*',...Object.entries(headers).map(([k,v])=>`  ${k}: ${v}`),''];
fs.writeFileSync(path.join(dist,'_headers'),headerLines.join('\n'));

const buildMeta={
  schema:'420-exchange-build-v14.13',
  sourceSha:sha,
  builtAt,
  productionOrigin:'https://exchange.420integrated.org',
  clientSchema:'14.0',
  runtimeConfigured:Boolean(runtime.network.chainId&&runtime.network.rpcUrl&&runtime.api.baseUrl&&runtime.api.streamUrl),
};
fs.writeFileSync(path.join(dist,'build-meta.json'),JSON.stringify(buildMeta,null,2)+'\n');

const immutable=['app.js','styles.css'];
const manifest={
  schema:'420-exchange-deployment-artifact-v14.13',
  sourceSha:sha,
  files:fs.readdirSync(dist,{recursive:true}).filter(x=>fs.statSync(path.join(dist,x)).isFile()).sort(),
  cachePolicy:{
    html:'no-cache',
    runtimeConfig:'no-store',
    buildMetadata:'no-cache',
    immutableAssets:immutable,
  }
};
fs.writeFileSync(path.join(dist,'deployment-manifest.json'),JSON.stringify(manifest,null,2)+'\n');

console.log(`420Exchange deployment artifact built at ${dist}`);
