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
   await page.waitForFunction(()=>document.activeElement?.id==='erc20-wizard-title');
   const wizard=token.locator('#token-erc20-wizard');
   await wizard.getByLabel('Token name',{exact:true}).fill('Example 🌿');
   await wizard.getByLabel('Token symbol',{exact:true}).fill('EX');
   const supply=wizard.getByLabel('Initial supply (tokens)',{exact:true});
   await supply.fill('1.0000000000000000001');
   await wizard.getByRole('button',{name:'Prepare ERC20 draft'}).click();
   assert.match(await wizard.locator('#erc20-wizard-status').textContent(),/18 fractional digits/);
   assert.equal(await supply.getAttribute('aria-invalid'),'true');assert.equal(await supply.getAttribute('aria-errormessage'),'erc20-wizard-status');
   await page.waitForFunction(()=>document.activeElement?.id==='erc20-supply');assert.equal(await supply.inputValue(),'1.0000000000000000001');
   assert.equal(await wizard.getByLabel('Maximum supply (tokens)',{exact:true}).isVisible(),false);
   await supply.fill('9007199254740993.000000000000000001');assert.equal(await supply.getAttribute('aria-invalid'),null);
   await wizard.getByRole('button',{name:'Prepare ERC20 draft'}).focus();
   await page.keyboard.press('Enter');
   await wizard.getByRole('heading',{name:'Prepared draft — not submitted'}).waitFor();
   await page.waitForFunction(()=>document.activeElement?.textContent==='Prepared draft — not submitted' && document.activeElement?.tagName==='H5');
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
   assert.equal(await wizard.getByLabel('Maximum supply (tokens)',{exact:true}).getAttribute('aria-invalid'),'true');
   await wizard.getByLabel('Maximum supply (tokens)',{exact:true}).fill('200.5');
   await wizard.getByRole('button',{name:'Prepare ERC20 draft'}).click();
   await wizard.getByRole('heading',{name:'Prepared draft — not submitted'}).waitFor();
   assert.match(await wizard.locator('.token-erc20-preview').textContent(),/200500000000000000000/);
   // Reuse the actual mounted form review for each standard. No signing RPCs.
   async function exerciseFeeReview(w,standard){
     const panel=w.locator('.token-fee-review'),simulate=panel.getByRole('button',{name:'Simulate and review fees'}),
       authorize=panel.getByRole('button',{name:'Authorize reviewed creation'});
     assert.equal(await panel.isVisible(),true);assert.equal(await authorize.isDisabled(),true);
     await simulate.focus();await page.keyboard.press('Enter');
     await panel.locator('.token-fee-review-details').waitFor({state:'visible'});
     assert.match(await panel.textContent(),/42 native/);
     assert.match(await panel.textContent(),/0\.001048576 native/);
     assert.match(await panel.textContent(),/42\.001048576 native/);
     assert.equal(await authorize.isEnabled(),true);
     // Changed gas price requires a second deliberate approval.
     await page.evaluate(()=>{window.__tokenCatalogueFixture.control.gasPrice='0x77359400';});
     await authorize.click();
     await panel.getByText(/Review changed\. Inspect/).waitFor();
     assert.match(await panel.textContent(),/42\.002097152 native/);
     await authorize.focus();await page.keyboard.press('Enter');
     await panel.getByText(/Explicit authorization recorded/).waitFor();
     assert.equal(await authorize.isDisabled(),true);
     assert.match(await panel.textContent(),/No transaction signed or submitted/);
     const overflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
     assert.ok(overflow.scroll<=overflow.client+1,'Token fee review horizontal overflow');
     const axe=await page.evaluate(id=>window.axe.run(document.querySelector(id+' .token-fee-review'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}),'#token-'+standard.toLowerCase()+'-wizard');
     for(const v of axe.violations.filter(v=>['serious','critical'].includes(v.impact)))failures.push(width+': '+standard+' fee review '+v.id+' '+v.impact);
     await page.screenshot({path:resolve(artifacts,'fee-review-'+standard+'-'+width+'.png'),fullPage:true});
     await panel.getByRole('button',{name:'Cancel authorization'}).click();
     assert.equal(await authorize.isDisabled(),true);
     await page.evaluate(()=>{const f=window.__tokenCatalogueFixture;f.control.gasPrice='0x3b9aca00';f.control.simulationError='revert';});
     await simulate.click();await panel.getByText(/Simulation or fee review failed/).waitFor();
     assert.equal(await panel.locator('[role="status"]').getAttribute('data-state'),'error');assert.equal(await panel.locator('[role="status"]').getAttribute('aria-atomic'),'true');
     assert.match(await panel.locator('[role="status"]').textContent(),/simulate again/);assert.equal(await panel.getByRole('button',{name:'Submit authorized creation'}).isDisabled(),true);
     assert.equal(await authorize.isDisabled(),true);
     await page.evaluate(()=>{const f=window.__tokenCatalogueFixture;f.control.simulationError=null;
       if(f.calls.some(([m])=>/send|sign|requestAccounts/i.test(m)))throw Error('unexpected write or signing RPC');});
     console.log(JSON.stringify({width,standard,tokenFeeReview:'PASS',changedFeesRejected:true,explicitAuthorization:true,cancelled:true,
       simulationFailureRejected:true,keyboard:true,overflow,axe:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))}));
   }
   await exerciseFeeReview(wizard,'ERC20');
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
   assert.match(await nft.locator('#erc721-wizard-status').textContent(),/Executable URI/);assert.equal(await uri.getAttribute('aria-invalid'),'true');
   await page.waitForFunction(()=>document.activeElement?.id==='erc721-baseURI');
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
   await exerciseFeeReview(nft,'ERC721');
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
   assert.match(await multi.locator('#erc1155-wizard-status').textContent(),/Executable URI/);assert.equal(await multiURI.getAttribute('aria-invalid'),'true');
   await page.waitForFunction(()=>document.activeElement?.id==='erc1155-uri');
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
   await exerciseFeeReview(multi,'ERC1155');
   await page.evaluate(async()=>{const {enableTokenSubmissionFixture420}=await import('./test/token-connected-fixture.js');
     window.__tokenSubmissionFixture=enableTokenSubmissionFixture420(window.__tokenCatalogueFixture);
     window.__tokenSubmissionFixture.pending=true;});
   const creationPanel=multi.locator('.token-fee-review'),send=creationPanel.getByRole('button',{name:'Submit authorized creation'});
   assert.equal(await send.isDisabled(),true);
   await creationPanel.getByRole('button',{name:'Simulate and review fees'}).click();
   await creationPanel.locator('.token-fee-review-details').waitFor({state:'visible'});
   await creationPanel.getByRole('button',{name:'Authorize reviewed creation'}).click();
   await creationPanel.getByText(/Explicit authorization recorded/).waitFor();
   await send.focus();await page.keyboard.press('Enter');
   const tracking=token.getByRole('region',{name:'Token deployment transaction tracking'});
   await tracking.getByText('pending',{exact:true}).waitFor();assert.match(await tracking.textContent(),/waiting for canonical inclusion/);
   assert.equal(await send.isDisabled(),true);
   assert.equal(await tracking.getByText(/Deployed token:/).count(),0);
   await page.evaluate(()=>{window.__tokenSubmissionFixture.pending=false;});
   await tracking.getByRole('button',{name:'Check deployment confirmation'}).click();
   await tracking.getByText(/Canonical deployment confirmed/).waitFor();
   await tracking.getByText(/Deployed token:/).waitFor();
   await page.evaluate(()=>{window.__tokenSubmissionFixture.reorganized=true;});
   await tracking.getByRole('button',{name:'Check deployment confirmation'}).click();
   await tracking.getByText('reorganized',{exact:true}).waitFor();assert.match(await tracking.textContent(),/Prior confirmation is no longer established/);assert.equal(await page.evaluate(()=>document.activeElement?.id),'token-tracking-status');
   assert.equal(await tracking.getByText(/Deployed token:/).count(),0);
   await page.evaluate(()=>{window.__tokenSubmissionFixture.reorganized=false;});
   await tracking.getByRole('button',{name:'Check deployment confirmation'}).click();
   await tracking.getByText(/Canonical deployment confirmed/).waitFor();
   const trackingAxe=await page.evaluate(()=>window.axe.run(document.querySelector('[aria-label="Token deployment transaction tracking"]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   for(const v of trackingAxe.violations.filter(v=>['serious','critical'].includes(v.impact)))failures.push(width+': Token tracking '+v.id);
   await page.screenshot({path:resolve(artifacts,'token-tracking-'+width+'.png'),fullPage:true});
   console.log(JSON.stringify({width,tokenTracking:'PASS',pending:true,confirmed:true,reorg:true,keyboard:true,axe:trackingAxe.violations.length}));

   // Independent historical portfolio, no dependence on the in-memory send hash.
   await page.evaluate(async()=>{const {enableTokenPortfolioFixture420,portfolioRecord420}=await import('./test/token-connected-fixture.js');
     const {TOKEN_TEMPLATES_420}=await import('./core/token-sdk.js');
     const {account,addr}=await import('./test/token-test-fixture.js');
     const rows=Array.from({length:18},(_,i)=>portfolioRecord420(i,TOKEN_TEMPLATES_420[i%8],i===0||i===17?account:addr(99),i===17?addr(98):undefined));
     // Explicit creator/owner for unrelated rows and the retained first record.
     rows[0].owner=account;
     window.__tokenPortfolioFixture=enableTokenPortfolioFixture420(window.__tokenCatalogueFixture,rows);});
   const created=token.getByRole('region',{name:'Created-token portfolio'}),refreshCreated=created.getByRole('button',{name:'Refresh created tokens'});
   await refreshCreated.focus();await page.keyboard.press('Enter');
   await created.getByText(/1 of 2 created tokens/).waitFor();
   assert.match(await created.textContent(),/Partial scan/);assert.match(await created.textContent(),/Ownership transferred/);
   assert.match(await created.textContent(),/42 native/);
   await created.getByRole('button',{name:'Scan next deployment page'}).click();
   await created.getByText(/2 of 2 created tokens/).waitFor();assert.match(await created.textContent(),/Complete at snapshot/);
   assert.match(await created.textContent(),/Creator retains ownership/);
   const portfolioAxe=await page.evaluate(()=>window.axe.run(document.querySelector('[aria-label="Created-token portfolio"]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   const portfolioOverflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(portfolioOverflow.scroll<=portfolioOverflow.client+1,'Created-token portfolio overflow');
   for(const v of portfolioAxe.violations.filter(v=>['serious','critical'].includes(v.impact)))failures.push(width+': Token portfolio '+v.id);
   await page.screenshot({path:resolve(artifacts,'token-portfolio-'+width+'.png'),fullPage:true});
   await page.evaluate(()=>{window.__tokenPortfolioFixture.receiptUnavailable=true;});
   await refreshCreated.click();await created.getByText(/1 of 2 created tokens/).waitFor();assert.match(await created.textContent(),/Not independently verified/);
   await page.evaluate(()=>{window.__tokenPortfolioFixture.reorg=true;});
   await created.getByRole('button',{name:'Scan next deployment page'}).click();await created.getByText(/Portfolio unavailable/).waitFor();
   assert.equal(await created.locator('article').count(),0);assert.match(await created.textContent(),/Refresh created tokens to start a new verified snapshot/);assert.equal(await created.locator('.token-fee-review-status[data-state="error"]').count(),1);
   await page.evaluate(()=>{window.__tokenPortfolioFixture.reorg=false;window.__tokenPortfolioFixture.receiptUnavailable=false;});
   console.log(JSON.stringify({width,tokenPortfolio:'PASS',partial:true,complete:true,transferred:true,recordOnly:true,reorg:true,keyboard:true,overflow:portfolioOverflow,axe:portfolioAxe.violations.length}));
   // Exercise real mounted owner/holder management from the reconstructed portfolio.
   await refreshCreated.click();await created.getByText(/1 of 2 created tokens/).waitFor();
   await created.getByRole('button',{name:'Scan next deployment page'}).click();await created.getByText(/2 of 2 created tokens/).waitFor();
   await page.evaluate(async()=>{const {enableTokenManagementFixture420}=await import('./test/token-connected-fixture.js');
     const {account,addr,abi}=await import('./test/token-test-fixture.js'),{tokenHashText420,tokenReadCall420}=await import('./core/token-sdk.js');
     const pc=window.__tokenPortfolioFixture,mc=enableTokenManagementFixture420(window.__tokenCatalogueFixture,pc),row=pc.rows[0],to=addr(90);
     mc.expect(row,tokenReadCall420('transfer(address,uint256)',['address','uint256'],[to,1]),[{topics:[tokenHashText420('Transfer(address,address,uint256)'),abi(account),abi(to)],data:abi(1)}],true);
     window.__tokenManagementFixture=mc;window.__tokenManagementTo=to;});
   await created.getByRole('button',{name:/Manage ERC20_FIXED/}).click();
   const management=created.getByRole('region',{name:'Template-specific token management'});
   const action=management.getByLabel('Management action');
   assert.equal(await action.locator('option[value="mint"]').count(),0);
   await action.selectOption('transfer');await management.getByLabel('Recipient / new owner / delegate address',{exact:true}).fill(await page.evaluate(()=>window.__tokenManagementTo));
   await management.getByLabel('Amount (tokens for ERC20; integer units for ERC1155)',{exact:true}).fill('0.000000000000000001');
   const sim=management.getByRole('button',{name:'Simulate management action'}),auth=management.getByRole('button',{name:'Authorize management action'}),sendManagement=management.getByRole('button',{name:'Submit management action'});
   assert.equal(await sendManagement.isDisabled(),true);
   await sim.focus();await page.keyboard.press('Enter');await management.getByText(/Simulation passed; not submitted/).waitFor();assert.match(await management.textContent(),/0 native/);
   await auth.click();await management.getByText(/Explicit management authorization recorded/).waitFor();
   assert.equal(await sendManagement.isEnabled(),true);
   const managementAxe=await page.evaluate(()=>window.axe.run(document.querySelector('[aria-label="Template-specific token management"]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   const managementOverflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(managementOverflow.scroll<=managementOverflow.client+1,'Token management overflow');
   for(const v of managementAxe.violations.filter(v=>['serious','critical'].includes(v.impact)))failures.push(width+': Token management '+v.id);
   await page.screenshot({path:resolve(artifacts,'token-management-'+width+'.png'),fullPage:true});
   await sendManagement.click();await tracking.getByText(/Canonical management transaction confirmed/).waitFor();
   assert.equal(await management.isVisible(),false);
   console.log(JSON.stringify({width,tokenManagement:'PASS',fixedMintBlocked:true,explicitAuthorization:true,confirmed:true,keyboard:true,axe:managementAxe.violations.length,overflow:managementOverflow}));
   // Permission inspection + acknowledgement + revocation through actual Wallet UI.
   await refreshCreated.click();await created.getByText(/1 of 2 created tokens/).waitFor();
   await created.getByRole('button',{name:'Scan next deployment page'}).click();await created.getByText(/2 of 2 created tokens/).waitFor();
   await page.evaluate(async()=>{const {account,addr,abi}=await import('./test/token-test-fixture.js'),{tokenHashText420,tokenReadCall420}=await import('./core/token-sdk.js');
     const mc=window.__tokenManagementFixture,row=window.__tokenPortfolioFixture.rows[0],spender=addr(91);
     mc.allowance=2n**256n-1n;mc.expect(row,tokenReadCall420('approve(address,uint256)',['address','uint256'],[spender,0]),[{topics:[tokenHashText420('Approval(address,address,uint256)'),abi(account),abi(spender)],data:abi(0)}],true);
     window.__tokenPermissionSpender=spender;});
   await created.getByRole('button',{name:/Manage ERC20_FIXED/}).click();
   const permissions=management.getByRole('region',{name:'Ownership and permission security'});
   const permissionAddress=permissions.getByLabel('Permission lookup address (optional)');
   await permissionAddress.fill('0x123');await permissions.getByRole('button',{name:'Check current permissions'}).click();
   await permissions.getByText(/Permissions unavailable/).waitFor();assert.match(await permissions.locator('[role="status"]').textContent(),/Check the address or token ID/);assert.equal(await permissions.locator('[role="status"]').getAttribute('data-state'),'error');assert.equal(await permissionAddress.inputValue(),'0x123');
   await permissionAddress.fill(await page.evaluate(()=>window.__tokenPermissionSpender));await permissions.getByRole('button',{name:'Check current permissions'}).click();
   await permissions.getByText('Unlimited (uint256 max)',{exact:true}).waitFor();
   await permissions.getByRole('button',{name:'Revoke ERC20 allowance'}).click();
   assert.equal(await action.inputValue(),'approve');assert.equal(await management.getByLabel('Amount (tokens for ERC20; integer units for ERC1155)',{exact:true}).inputValue(),'0');
   assert.equal(await sendManagement.isDisabled(),true);
   await sim.click();await management.getByText(/Simulation passed; not submitted/).waitFor();
   assert.match(await management.textContent(),/already signed permits are not cancelled/);
   await auth.click();await management.getByText(/Explicit management authorization recorded/).waitFor();
   // Changing the action revokes the previous authorization and requires a fresh review.
   await action.selectOption('transferOwnership');assert.equal(await sendManagement.isDisabled(),true);
   await page.evaluate(async()=>{const {account,abi,addr}=await import('./test/token-test-fixture.js'),{tokenHashText420,tokenReadCall420}=await import('./core/token-sdk.js');
     const mc=window.__tokenManagementFixture,row=window.__tokenPortfolioFixture.rows[0],to=addr(90);
     mc.expect(row,tokenReadCall420('transferOwnership(address)',['address'],[to]),[{topics:[tokenHashText420('OwnershipTransferred(address,address)'),abi(account),abi(to)],data:'0x'}],false);});
   await management.getByLabel('Recipient / new owner / delegate address',{exact:true}).fill(await page.evaluate(()=>window.__tokenManagementTo));
   await sim.click();await management.getByText(/Simulation passed; not submitted/).waitFor();
   const ack=management.getByLabel(/Type TRANSFER OWNERSHIP to acknowledge/);
   assert.equal(await auth.isDisabled(),true);await ack.fill('TRANSFER');assert.equal(await auth.isDisabled(),true);
   await ack.fill('TRANSFER OWNERSHIP');assert.equal(await auth.isEnabled(),true);
   const securityAxe=await page.evaluate(()=>window.axe.run(document.querySelector('[aria-label="Template-specific token management"]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   const securityOverflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(securityOverflow.scroll<=securityOverflow.client+1,'Token ownership/permission overflow');
   for(const v of securityAxe.violations.filter(v=>['serious','critical'].includes(v.impact)))failures.push(width+': Token security '+v.id);
   await page.screenshot({path:resolve(artifacts,'token-security-'+width+'.png'),fullPage:true});
   await auth.click();await management.getByText(/Explicit management authorization recorded/).waitFor();
   await management.getByRole('button',{name:'Cancel management action'}).click();
   assert.equal(await management.isVisible(),false);await page.waitForFunction(()=>document.activeElement?.matches('button[data-manage-token]'));
   console.log(JSON.stringify({width,tokenSecurity:'PASS',unlimitedLookup:true,revocationPrepared:true,cancelled:true,typedAcknowledgement:true,axe:securityAxe.violations.length,overflow:securityOverflow}));
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
   assert.match(await token.locator('.token-catalogue-selection').textContent(),/Selection unavailable/);
   // Runtime failure is explicit and recoverable, never interpreted as approval.
   await page.evaluate(()=>{window.__tokenCatalogueFixture.tokenControl.chain='0x1';});
   await token.getByRole('button',{name:'Refresh availability'}).click();await token.locator('#token-catalogue-status[data-state="error"]').waitFor();
   assert.match(await token.locator('#token-catalogue-status').textContent(),/Check the connected network/);assert.equal(await token.locator('button[data-template]:disabled').count(),8);
   await page.evaluate(()=>{window.__tokenCatalogueFixture.tokenControl.chain='0x1a4';});
   await token.getByRole('button',{name:'Refresh availability'}).click();await token.locator('#token-catalogue-status[data-state="success"]').waitFor();assert.equal(await token.locator('button[data-template]:enabled').count(),7);
   const layout=await token.evaluate(el=>{
     const visible=n=>n.getClientRects().length>0&&getComputedStyle(n).visibility!=='hidden';
     const controls=[...el.querySelectorAll('button,input,select')].filter(visible);
     return {controls:controls.length,undersized:controls.filter(n=>n.getBoundingClientRect().height<43.9).map(n=>n.textContent||n.name),live:[...el.querySelectorAll('[role="status"]')].filter(visible).every(n=>n.getAttribute('aria-atomic')==='true'),client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth};
   });
   assert.ok(layout.controls>=9);assert.deepEqual(layout.undersized,[]);assert.equal(layout.live,true);assert.ok(layout.scroll<=layout.client+1);
   // Test explicitly visible focus and 200% zoom at desktop; preserve exact visible text.
   await token.locator('summary').focus();await page.keyboard.press('Tab');
   const focusStyle=await page.evaluate(()=>{const n=document.activeElement,s=getComputedStyle(n);return {inToken:!!n.closest('#token-template-catalogue'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth)};});
   assert.ok(focusStyle.inToken&&focusStyle.outline!=='none'&&focusStyle.width>=2,'Visible keyboard focus required');
   if(width===1440){await page.evaluate(()=>{document.documentElement.style.zoom='2';});const zoom=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(zoom.scroll<=zoom.client+1,'200% zoom horizontal overflow');await page.screenshot({path:resolve(artifacts,'token-zoom-200.png'),fullPage:true});await page.evaluate(()=>{document.documentElement.style.zoom='';});}
   const catalogueOverflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(catalogueOverflow.scroll<=catalogueOverflow.client+1,'open Token catalogue horizontal overflow');
   const tokenAxe=await page.evaluate(()=>window.axe.run(document.querySelector('#token-template-catalogue'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   for(const v of tokenAxe.violations.filter(v=>['serious','critical'].includes(v.impact)))failures.push(width+': Token catalogue '+v.id+' '+v.impact);
   assert.equal(tokenAxe.violations.length,0,'Token accessibility violations: '+tokenAxe.violations.map(v=>v.id).join(', '));
   await page.screenshot({path:resolve(artifacts,'token-catalogue-'+width+'.png'),fullPage:true});
   await token.locator('button[data-template="ERC20_MINTABLE"]').focus();
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
   assert.equal(await token.locator('.token-fee-review:visible').count(),0);
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'token-catalogue-status');
   console.log(JSON.stringify({width,tokenAccessibility:'PASS',fieldErrors:true,focusRestoration:true,actionableErrors:true,networkRecovery:true,disabledUnavailable:true,liveRegions:true,controlHeight44:true,keyboardFocus:true,zoom200:width===1440,axe:tokenAxe.violations.length,overflow:layout}));
   // ARB-PRE-04: exercise the actual mounted Arbitration screen at every responsive
   // viewport. RPC is deterministic, while user interaction uses the real DOM.
   const arbitration=page.locator('#arbitration-management-panel');
   assert.equal(await arbitration.count(),1,'Arbitration Wallet panel must be mounted');
   assert.equal(await arbitration.getByRole('button',{name:'Simulate and review opening case'}).isDisabled(),true,
     'Arbitration cannot submit without verified service');
   await page.evaluate(async()=>{
     const {arbitrationAppFixture420}=await import('./test/arbitration-app-fixture.js');
     const f=arbitrationAppFixture420();
     window.__arbitrationBrowserFixture=f;
     window.ethereum={
       request:({method,params})=>f.provider.request(method,params||[]),
       on:(name,callback)=>f.provider.on(name,callback),
       removeListener:(name,callback)=>f.provider.removeListener(name,callback)
     };
     window.confirm=()=>true;
     document.dispatchEvent(new CustomEvent('wallet:verification-state',{detail:{
       config:{network:{chainId:'0x1a4'},arbitration:{...f.release,domains:f.domains}},
       controller:f.account,network:{chainMismatch:false},phase:'ready'
     }}));
   });
   await arbitration.getByRole('button',{name:'Verify Arbitration'}).click();
   await page.waitForFunction(()=>document.querySelector('#arbitration-runtime-state')?.textContent==='Verified',
     null,{timeout:15000});
   assert.match(await arbitration.locator('#arbitration-router').textContent(),/^0x[0-9a-f]{40}$/);
   const caseButton=arbitration.locator('#arbitration-case-list button').first();
   await caseButton.focus();await page.keyboard.press('Enter');
   await arbitration.locator('#arbitration-case-details dd').first().waitFor({state:'visible'});
   assert.match(await arbitration.locator('#arbitration-case-details').textContent(),/Claimant/);
   await arbitration.getByRole('button',{name:'Submit evidence'}).click();
   await arbitration.locator('#arbitration-evidence-form input[name="evidenceHash"]').fill('0x'+(950).toString(16).padStart(64,'0'));
   await arbitration.getByRole('button',{name:'Simulate and review evidence'}).click();
   await arbitration.getByRole('heading',{name:'Review Wallet transaction'}).waitFor();
   assert.match(await arbitration.locator('#arbitration-review-details').textContent(),/Estimated network cost/);
   await arbitration.getByRole('button',{name:'Confirm review and request Wallet approval'}).click();
   await page.waitForFunction(()=>document.querySelector('#arbitration-tx-status')?.textContent?.includes('Pending canonical confirmation'),
     null,{timeout:10000});
   assert.equal(await page.evaluate(()=>window.__arbitrationBrowserFixture.state.sendCount),1);
   await page.evaluate(()=>window.__arbitrationBrowserFixture.submitReceipt());
   await arbitration.getByRole('button',{name:'Check canonical receipt'}).click();
   await page.waitForFunction(()=>document.querySelector('#arbitration-tx-status')?.textContent?.includes('Canonically confirmed'),
     null,{timeout:10000});
   const layout=await page.evaluate(()=>({client:document.documentElement.clientWidth,
     scroll:document.documentElement.scrollWidth}));
   assert.ok(layout.scroll<=layout.client+1,'Arbitration panel horizontal overflow');
   const arbAxe=await page.evaluate(()=>window.axe.run(document.querySelector('#arbitration-management-panel'),
     {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   assert.equal(arbAxe.violations.length,0,'Arbitration accessibility violations: '+
     arbAxe.violations.map(v=>v.id).join(', '));
   await page.screenshot({path:resolve(artifacts,'arbitration-'+width+'.png'),fullPage:true});
   console.log(JSON.stringify({width,arbitration:'PASS',canonicalCase:true,reviewedEvidence:true,
     walletSubmittedOnlyAfterApproval:true,canonicalReceipt:true,axeViolations:arbAxe.violations.length,layout}));
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
