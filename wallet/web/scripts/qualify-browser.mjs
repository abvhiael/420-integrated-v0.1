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
   if(await page.locator('#services-section a.app-card').count())failures.push(width+': unverified app launch links');
   await page.screenshot({path:resolve(artifacts,'wallet-'+width+'.png'),fullPage:true});
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   const axe=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
   const serious=axe.violations.filter(v=>['serious','critical'].includes(v.impact));
   for(const v of serious)failures.push(width+': '+v.id+' '+v.impact+' '+v.nodes.slice(0,4).map(n=>n.target.join(' ')).join(', '));
   console.log(JSON.stringify({width,info,focus,banner,axe:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))}));
  }catch(e){failures.push(width+': '+(e.stack||e));await page.screenshot({path:resolve(artifacts,'wallet-'+width+'-error.png'),fullPage:true}).catch(()=>{});}
  finally{await ctx.close();}
 }
}finally{
 await browser?.close();
 await new Promise(done=>server.close(done));
}
writeFileSync(resolve(artifacts,'results.json'),JSON.stringify({passed:!failures.length,failures},null,2)+'\n');
assert.deepEqual(failures,[],'W15.5 browser qualification failed');
