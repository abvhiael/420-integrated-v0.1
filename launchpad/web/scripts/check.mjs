import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');const errors=[];
for(const f of ['index.html','app.js','showcase.js','sample-catalog.js','styles.css','artwork.css','runtime-config.json','core/config.js','core/service.js','core/wallet.js','core/creator.js'])if(!fs.existsSync(path.join(root,f)))errors.push('missing '+f);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),service=fs.readFileSync(path.join(root,'core/service.js'),'utf8'),wallet=fs.readFileSync(path.join(root,'core/wallet.js'),'utf8');
for(const token of ['campaign-grid','participant-state','creator-form','creator-studio','creator-prepared','creator-report-output','creator-submit','review-gate','aria-live'])if(!html.includes(token))errors.push('UI requirement missing '+token);
for(const token of ['runtime()','campaigns(','participant(','prepare(','creatorRequest('])if(!service.includes(token))errors.push('service client missing '+token);
for(const token of ['WRONG_NETWORK','CANONICAL_ADDRESSES_UNRESOLVED','CANONICAL_REVIEW_REQUIRED','UNEXPECTED_TRANSACTION_TARGET'])if(!wallet.includes(token))errors.push('wallet gate missing '+token);
if(!app.includes('new CreatorStudio(')||!service.includes('creatorSubmit('))errors.push('signed creator governance boundary missing');
if(/innerHTML\s*=\s*[^'"]/.test(app))errors.push('dynamic innerHTML assignment detected');
const showcase=fs.readFileSync(path.join(root,'showcase.js'),'utf8');
const samples=fs.readFileSync(path.join(root,'sample-catalog.js'),'utf8');
for(const token of ['view-home','view-discover','view-campaign','view-overview','view-creator','view-dashboard','view-live','FICTIONAL EXAMPLE','contributions disabled'])if(!html.includes(token))errors.push('showcase requirement missing '+token);
for(const token of ['examples','parseRoute','filterExamples'])if(!samples.includes(token))errors.push('sample isolation helper missing '+token);
if(/eth_sendTransaction|creatorSubmit|fetch\(|localStorage/.test(showcase)||/eth_sendTransaction|fetch\(/.test(samples))errors.push('sample-only showcase must not submit or fetch data');
if(!html.includes('src="./showcase.js"'))errors.push('showcase module not loaded');

const canonicalAssets=[
'hero-launch.webp','wallpaper-moonlit-hills.webp',
'border-botanical-left.png','border-botanical-right.png','rocket-420integrated.png',
'campaign-greenroots.webp','campaign-aeroleaf.webp','campaign-justice-fund.webp',
'campaign-innovation-hub.webp','campaign-sunridge.webp'];
const artworkCss=fs.readFileSync(path.join(root,'artwork.css'),'utf8');
for(const filename of canonicalAssets){
  const assetPath=path.join(root,'assets',filename);
  if(!fs.existsSync(assetPath)){errors.push('missing artwork '+filename);continue;}
  const bytes=fs.readFileSync(assetPath);
  if(bytes.length<1000||bytes.length>16000000)errors.push('artwork outside safe size bounds '+filename);
  if(filename.endsWith('.webp')&&
    !(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'))
    errors.push('invalid WebP '+filename);
  if(filename.endsWith('.png')&&
    !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    errors.push('invalid PNG '+filename);
  if(!artworkCss.includes('./assets/'+filename))errors.push('unreferenced canonical artwork '+filename);
}
if(!html.includes('href="./artwork.css"'))errors.push('artwork stylesheet is not loaded');
if(html.includes('HERO ARTWORK SLOT')||html.includes('CAMPAIGN IMAGE PLACEHOLDER')||
  html.includes('CAMPAIGN ARTWORK SLOT')||showcase.includes('CAMPAIGN ARTWORK SLOT'))
  errors.push('obsolete artwork placeholders remain');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}console.log('420Launchpad web check PASS');
