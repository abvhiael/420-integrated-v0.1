import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHighCountryServer} from '../server.mjs';
test('offline HighCountry /missions serves app shell without affecting existing routes',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'hc-mission-route-'));
 await writeFile(join(dir,'index.html'),'<h1>Mission shell</h1>');
 const server=createHighCountryServer({config:{schema:'highcountry-web-runtime-v1',mode:'offline'},distRoot:dir});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
 for(const route of ['/missions','/marketplace','/skills','/seeds']){
  const response=await fetch('http://127.0.0.1:'+server.address().port+route);
  assert.equal(response.status,200,route);
  assert.match(await response.text(),/Mission shell/);
 }
});
