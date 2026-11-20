import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const require=createRequire(import.meta.url);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const artifacts=resolve(root,'browser-qualification-artifacts');
mkdirSync(artifacts,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=createServer((req,res)=>{
 let path;
 try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const file=resolve(root,'.'+(path==='/'?'/index.html':path));
 if(!file.startsWith(root+sep)||!existsSync(file)){res.writeHead(404).end();return;}
 res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});
 createReadStream(file).pipe(res);
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const failures=[];
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const width of [1440,1024,768,390,320]){
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await ctx.newPage();
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle',timeout:60000});
   const info=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   if(info.scroll>info.client+1)failures.push(width+': page horizontal overflow '+JSON.stringify(info));
   const nav=page.locator('#wallet-section-nav [data-scroll-target="#security-centre"]');
   await nav.focus();
   await page.keyboard.press('Enter');
   const focus=await page.evaluate(()=>document.activeElement?.id);
   if(focus!=='security-centre')failures.push(width+': keyboard destination focus '+focus);
   await page.waitForFunction(()=>document.querySelector('#verification-banner-title')?.textContent !== 'Checking wallet state',null,{timeout:12000});
   const banner=await page.locator('#verification-banner-title').textContent();
   if(!/unconfigured|disconnected|not verified|check failed/i.test(banner||''))failures.push(width+': unverified chain banner '+banner);
   if(!await page.locator('#copy-receive-address').isDisabled())failures.push(width+': Receive enabled without deployment');
   if(await page.locator('#featured-apps a.app-card, #services a.app-card').count())failures.push(width+': unverified app launch links');
   const payCard=page.locator('#services article.app-card').filter({has:page.getByText('420 Pay',{exact:true})});
   if(!await payCard.getByText('Genesis approved',{exact:true}).isVisible() ||
      !await payCard.getByRole('link',{name:'Wallet connection help'}).isVisible() ||
      await page.locator('#services-section a[href^="https://pay.420integrated.org"]').count()){
    failures.push(width+': staged Pay entry must offer connection help without a launch link');
   }
   await page.screenshot({path:resolve(artifacts,'wallet-'+width+'.png'),fullPage:true});
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   const axe=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   const serious=axe.violations.filter(v=>['serious','critical'].includes(v.impact));
   for(const v of serious)failures.push(width+': '+v.id+' '+v.impact+' '+v.nodes.slice(0,4).map(n=>n.target.join(' ')).join(', '));
   console.log(JSON.stringify({width,info,focus,banner,axe:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))}));
   // Exercise the actual mounted Token catalogue with the same deterministic connected
   // Wallet RPC fixture used by the discovery tests. Production config remains unbound.
   const token=page.locator('#token-template-catalogue');
   const browse=page.getByRole('button',{name:'Browse Token templates'});
   await browse.click();
   await token.locator('summary').waitFor({state:'visible'});
   assert.equal(await token.evaluate(e=>e.open),true);
   assert.equal(await token.locator('.token-template-card').count(),8);
   assert.equal(await token.locator('button[data-template]:disabled').count(),8);
   assert.equal(await token.locator('[data-availability="unknown"]').count(),8);
   assert.match(await token.locator('#token-catalogue-status').textContent(),/Release not configured/);
   assert.equal(await token.getByRole('button',{name:'Refresh availability'}).isDisabled(),true);
   assert.equal(await page.locator('#services .token-integrated a[href]').count(),0);
   await page.evaluate(async()=>{
     const {connected}=await import('./test/token-connected-fixture.js');
     const {walletTokenDiscovery420}=await import('./core/token-discovery.js');
     const {controller}=await import('./test/token-test-fixture.js');
     const f=connected();
     window.__tokenCatalogueFixture=f;
     await walletTokenDiscovery420.refresh({provider:f.provider,config:f.config,controller,smartAccount:f.selected});
   });
   await token.locator('[data-availability="enabled"]').first().waitFor();
   assert.equal(await token.locator('[data-availability="enabled"]').count(),8);
   assert.match(await token.locator('#token-catalogue-status').textContent(),/8 of 8 enabled/);
   const choose=token.locator('button[data-template="ERC20_FIXED"]');
   await choose.focus();
   await page.keyboard.press('Enter');
   await token.locator('button[data-template="ERC20_FIXED"][aria-pressed="true"]').waitFor();
   assert.match(await token.locator('.token-catalogue-selection').textContent(),/Selected ERC20_FIXED/);
   const wizard=token.locator('#token-erc20-wizard');
   await wizard.getByLabel('Token name',{exact:true}).fill('Example 🌿');
   await wizard.getByLabel('Token symbol',{exact:true}).fill('EX');
   const supply=wizard.getByLabel('Initial supply (tokens)',{exact:true});
   await supply.fill('1.0000000000000000001');
   await wizard.getByRole('button',{name:'Prepare ERC20 draft'}).click();
   assert.match(await wizard.locator('#erc20-wizard-status').textContent(),/18 fractional digits/);
   assert.equal(await wizard.getByLabel('Maximum supply (tokens)',{exact:true}).isVisible(),false);
   await supply.fill('9007199254740993.000000000000000001');
   await wizard.getByRole('button',{name:'Prepare ERC20 draft'}).focus();
   await page.keyboard.press('Enter');
   await wizard.getByRole('heading',{name:'Prepared draft — not submitted'}).waitFor();
   assert.match(await wizard.locator('.token-erc20-preview').textContent(),/9007199254740993000000000000000001/);
   assert.match(await wizard.locator('.token-erc20-preview').textContent(),/42 native/);
   assert.match(await wizard.locator('#erc20-wizard-status').textContent(),/No transaction simulated, signed or submitted/);
   await wizard.getByLabel('Token symbol',{exact:true}).fill('EDIT');
   assert.equal(await wizard.locator('.token-erc20-preview').isVisible(),false);
   const capChoose=token.locator('button[data-template="ERC20_CAPPED"]');
   await capChoose.click();
   await token.locator('button[data-template="ERC20_CAPPED"][aria-pressed="true"]').waitFor();
   assert.equal(await wizard.getByLabel('Token name',{exact:true}).inputValue(),'');
   await wizard.getByLabel('Token name',{exact:true}).fill('Capped token');
   await wizard.getByLabel('Token symbol',{exact:true}).fill('CAP');
   await supply.fill('100.25');
   await wizard.getByLabel('Maximum supply (tokens)',{exact:true}).fill('100');
   await wizard.getByRole('button',{name:'Prepare ERC20 draft'}).click();
   assert.match(await wizard.locator('#erc20-wizard-status').textContent(),/invalid cap/);
   await wizard.getByLabel('Maximum supply (tokens)',{exact:true}).fill('200.5');
   await wizard.getByRole('button',{name:'Prepare ERC20 draft'}).click();
   await wizard.getByRole('heading',{name:'Prepared draft — not submitted'}).waitFor();
   assert.match(await wizard.locator('.token-erc20-preview').textContent(),/200500000000000000000/);
   const wizardOverflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(wizardOverflow.scroll<=wizardOverflow.client+1,'ERC20 wizard horizontal overflow');
   const wizardAxe=await page.evaluate(()=>window.axe.run(document.querySelector('#token-erc20-wizard'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   for(const v of wizardAxe.violations.filter(v=>['serious','critical'].includes(v.impact)))failures.push(width+': ERC20 wizard '+v.id+' '+v.impact);
   await page.screenshot({path:resolve(artifacts,'erc20-wizard-'+width+'.png'),fullPage:true});
   // ERC721 uses the same real Wallet catalogue and discovery fixture, not a separate test UI.
   const nft=token.locator('#token-erc721-wizard');
   assert.equal(await nft.locator('form').isVisible(),false);
   const nftChoose=token.locator('button[data-template="ERC721_COLLECTION"]');
   await nftChoose.click();
   await token.locator('button[data-template="ERC721_COLLECTION"][aria-pressed="true"]').waitFor();
   assert.equal(await wizard.locator('form').isVisible(),false);
   assert.equal(await wizard.locator('.token-erc20-preview').isVisible(),false);
   await nft.getByLabel('Collection name',{exact:true}).fill('Collection 🌿');
   await nft.getByLabel('Collection symbol',{exact:true}).fill('NFT');
   const uri=nft.getByLabel('Collection base URI',{exact:true});
   await uri.fill('javascript:alert(1)');
   await nft.getByRole('button',{name:'Prepare ERC721 draft'}).click();
   assert.match(await nft.locator('#erc721-wizard-status').textContent(),/Executable URI/);
   await uri.fill('ipfs://bafyexample/{id}.json');
   await nft.getByRole('button',{name:'Prepare ERC721 draft'}).focus();
   await page.keyboard.press('Enter');
   await nft.getByRole('heading',{name:'Prepared collection draft — not submitted'}).waitFor();
   assert.match(await nft.locator('.token-erc721-preview').textContent(),/ipfs:\/\/bafyexample\/\{id\}\.json/);
   assert.match(await nft.locator('.token-erc721-preview').textContent(),/0 — minting is separate/);
   assert.match(await nft.locator('.token-erc721-preview').textContent(),/does not append the ID/);
   assert.match(await nft.locator('.token-erc721-preview').textContent(),/42 native/);
   assert.equal(await nft.locator('.token-erc721-preview a, .token-erc721-preview img, .token-erc721-preview iframe').count(),0);
   await uri.fill('');
   assert.equal(await nft.locator('.token-erc721-preview').isVisible(),false);
   await nft.getByRole('button',{name:'Prepare ERC721 draft'}).click();
   await nft.getByRole('heading',{name:'Prepared collection draft — not submitted'}).waitFor();
   assert.match(await nft.locator('.token-erc721-preview').textContent(),/Empty base URI/);
   const nftOverflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(nftOverflow.scroll<=nftOverflow.client+1,'ERC721 wizard horizontal overflow');
   const nftAxe=await page.evaluate(()=>window.axe.run(document.querySelector('#token-erc721-wizard'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   for(const v of nftAxe.violations.filter(v=>['serious','critical'].includes(v.impact)))failures.push(width+': ERC721 wizard '+v.id+' '+v.impact);
   await page.screenshot({path:resolve(artifacts,'erc721-wizard-'+width+'.png'),fullPage:true});
   await page.evaluate(async()=>{
     const {TOKEN_TEMPLATES_420}=await import('./core/token-sdk.js');
     window.__tokenCatalogueFixture.enable(TOKEN_TEMPLATES_420.find(p=>p.key==='ERC721_COLLECTION'),false);
   });
   await nft.getByRole('button',{name:'Prepare ERC721 draft'}).click();
   await token.locator('button[data-template="ERC721_COLLECTION"]:disabled').waitFor();
   await nft.locator('.token-erc721-preview').waitFor({state:'hidden'});
   assert.match(await nft.locator('#erc721-wizard-status').textContent(),/changed/);
   await page.evaluate(async()=>{
     const {TOKEN_TEMPLATES_420}=await import('./core/token-sdk.js');
     window.__tokenCatalogueFixture.enable(TOKEN_TEMPLATES_420.find(p=>p.key==='ERC721_COLLECTION'),true);
   });
   await token.getByRole('button',{name:'Refresh availability'}).click();
   await token.locator('button[data-template="ERC721_COLLECTION"]:enabled').waitFor();
   console.log(JSON.stringify({width,erc721Wizard:'PASS',exactURI:true,emptyURI:true,invalidURIRejected:true,zeroInitialSupply:true,
     draftInvalidated:true,governanceDisabled:true,keyboard:true,nftOverflow,axe:nftAxe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))}));
   const multi=token.locator('#token-erc1155-wizard');
   assert.equal(await multi.locator('form').isVisible(),false);
   const multiChoose=token.locator('button[data-template="ERC1155_MULTI"]');
   await multiChoose.click();
   await token.locator('button[data-template="ERC1155_MULTI"][aria-pressed="true"]').waitFor();
   assert.equal(await nft.locator('form').isVisible(),false);
   assert.equal(await wizard.locator('form').isVisible(),false);
   const multiURI=multi.getByLabel('Multi-token metadata URI',{exact:true});
   assert.equal(await multi.locator('input').count(),2);
   await multiURI.fill('javascript:alert(1)');
   await multi.getByRole('button',{name:'Prepare ERC1155 draft'}).click();
   assert.match(await multi.locator('#erc1155-wizard-status').textContent(),/Executable URI/);
   await multiURI.fill('ipfs://bafyexample/{id}.json');
   await multi.getByRole('button',{name:'Prepare ERC1155 draft'}).focus();
   await page.keyboard.press('Enter');
   await multi.getByRole('heading',{name:'Prepared multi-token draft — not submitted'}).waitFor();
   const multiPreview=multi.locator('.token-erc1155-preview');
   assert.ok((await multiPreview.textContent()).includes('ipfs://bafyexample/{id}.json'));
   assert.ok((await multiPreview.textContent()).includes('ipfs://bafyexample/'+'1'.padStart(64,'0')+'.json'));
   assert.match(await multiPreview.textContent(),/0 — minting is separate/);
   assert.match(await multiPreview.textContent(),/42 native/);
   assert.equal(await multiPreview.locator('a,img,iframe').count(),0);
   await multiURI.fill('https://example.org/shared.json');
   assert.equal(await multiPreview.isVisible(),false);
   await multi.getByRole('button',{name:'Prepare ERC1155 draft'}).click();
   await multi.getByRole('heading',{name:'Prepared multi-token draft — not submitted'}).waitFor();
   assert.match(await multiPreview.textContent(),/No \{id\} placeholder/);
   await multiURI.fill('');
   await multi.getByRole('button',{name:'Prepare ERC1155 draft'}).click();
   await multi.getByRole('heading',{name:'Prepared multi-token draft — not submitted'}).waitFor();
   assert.match(await multiPreview.textContent(),/Empty URI/);
   const multiOverflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(multiOverflow.scroll<=multiOverflow.client+1,'ERC1155 wizard horizontal overflow');
   const multiAxe=await page.evaluate(()=>window.axe.run(document.querySelector('#token-erc1155-wizard'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   for(const v of multiAxe.violations.filter(v=>['serious','critical'].includes(v.impact)))failures.push(width+': ERC1155 wizard '+v.id+' '+v.impact);
   await page.screenshot({path:resolve(artifacts,'erc1155-wizard-'+width+'.png'),fullPage:true});
   await page.evaluate(async()=>{
     const {TOKEN_TEMPLATES_420}=await import('./core/token-sdk.js');
     window.__tokenCatalogueFixture.enable(TOKEN_TEMPLATES_420.find(p=>p.key==='ERC1155_MULTI'),false);
   });
   await multi.getByRole('button',{name:'Prepare ERC1155 draft'}).click();
   await token.locator('button[data-template="ERC1155_MULTI"]:disabled').waitFor();
   await multiPreview.waitFor({state:'hidden'});
   assert.match(await multi.locator('#erc1155-wizard-status').textContent(),/changed/);
   await page.evaluate(async()=>{
     const {TOKEN_TEMPLATES_420}=await import('./core/token-sdk.js');
     window.__tokenCatalogueFixture.enable(TOKEN_TEMPLATES_420.find(p=>p.key==='ERC1155_MULTI'),true);
   });
   await token.getByRole('button',{name:'Refresh availability'}).click();
   await token.locator('button[data-template="ERC1155_MULTI"]:enabled').waitFor();
   console.log(JSON.stringify({width,erc1155Wizard:'PASS',exactURI:true,clientSubstitution:true,emptyURI:true,sharedURI:true,
     invalidURIRejected:true,zeroInitialBalances:true,draftInvalidated:true,governanceDisabled:true,keyboard:true,multiOverflow,
     axe:multiAxe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))}));
   // Re-select fixed so the retained 5.3 stale-selection test still exercises the same profile.
   await choose.click();
   await token.locator('button[data-template="ERC20_FIXED"][aria-pressed="true"]').waitFor();
   assert.equal(await wizard.locator('.token-erc20-preview').isVisible(),false);
   assert.equal(await nft.locator('form').isVisible(),false);
   assert.equal(await multi.locator('form').isVisible(),false);
   console.log(JSON.stringify({width,erc20Wizard:'PASS',exactAmount:true,invalidPrecisionRejected:true,capRejected:true,
     draftInvalidated:true,keyboard:true,wizardOverflow,axe:wizardAxe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))}));

   await page.evaluate(async()=>{
     const {TOKEN_TEMPLATES_420}=await import('./core/token-sdk.js');
     window.__tokenCatalogueFixture.enable(TOKEN_TEMPLATES_420[0],false);
   });
   // Availability goes stale between display and selection; the new selection must reverify.
   await choose.click();
   await token.locator('article[data-availability="disabled"]').waitFor();
   assert.equal(await choose.isDisabled(),true);
   assert.equal(await token.locator('button[aria-pressed="true"]').count(),0);
   assert.match(await token.locator('#token-catalogue-status').textContent(),/7 of 8 enabled/);
   const catalogueOverflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(catalogueOverflow.scroll<=catalogueOverflow.client+1,'open Token catalogue horizontal overflow');
   const tokenAxe=await page.evaluate(()=>window.axe.run(document.querySelector('#token-template-catalogue'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   for(const v of tokenAxe.violations.filter(v=>['serious','critical'].includes(v.impact)))failures.push(width+': Token catalogue '+v.id+' '+v.impact);
   await page.screenshot({path:resolve(artifacts,'token-catalogue-'+width+'.png'),fullPage:true});
   await page.evaluate(async()=>{
     const {walletTokenDiscovery420}=await import('./core/token-discovery.js');
     walletTokenDiscovery420.invalidate();
   });
   assert.equal(await token.locator('button[data-template]:disabled').count(),8);
   assert.equal(await token.locator('[data-availability="unknown"]').count(),8);
   assert.match(await token.locator('#token-catalogue-status').textContent(),/Connect your Wallet/);
   assert.equal(await wizard.locator('form').isVisible(),false);
   assert.equal(await wizard.locator('.token-erc20-preview').isVisible(),false);
   assert.equal(await nft.locator('form').isVisible(),false);
   assert.equal(await nft.locator('.token-erc721-preview').isVisible(),false);
   assert.equal(await multi.locator('form').isVisible(),false);
   assert.equal(await multiPreview.isVisible(),false);
   console.log(JSON.stringify({width,tokenCatalogue:'PASS',profiles:8,verified:8,governanceDisabled:1,
     staleSelectionRejected:true,disconnectInvalidated:true,catalogueOverflow,axe:tokenAxe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))}));

  }catch(e){failures.push(width+': '+(e.stack||e));await page.screenshot({path:resolve(artifacts,'wallet-'+width+'-error.png'),fullPage:true}).catch(()=>{});}
  finally{await ctx.close();}
 }
}finally{
 await browser?.close();
 await new Promise(done=>server.close(done));
}
writeFileSync(resolve(artifacts,'results.json'),JSON.stringify({passed:!failures.length,failures},null,2)+'\n');
assert.deepEqual(failures,[],'W15.5 browser qualification failed');
