import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAppSessionClient,validateAppSession,mountAppSession,bootAppSession} from './client.mjs';

const app='420town',subject='12345678-1234-4123-8123-123456789abc';
const valid={authenticated:true,app,subject,financialAuthority:false,permissions:[]};
const response=(payload,status=200,ctype='application/json')=>({
 status,headers:{get:key=>key==='content-type'?ctype:null},json:async()=>payload
});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function dom(){
 const events=new Map();
 const elements=new Map();
 for(const key of ['status','login','logout','refresh']){
  elements.set(key,{hidden:false,textContent:'',attrs:{},events:new Map(),
   setAttribute(k,v){this.attrs[k]=v},
   addEventListener(type,fn){this.events.set(type,fn)},
   click(){this.events.get('click')?.()}});
 }
 return {root:{hidden:true,dataset:{app,enabled:'true'},
  querySelector:s=>elements.get(s.match(/\[data-420id-(.*?)\]/)?.[1])},
  elements,events,document:{visibilityState:'visible',
   addEventListener(type,callback){events.set(type,callback)}}};
}
test('AUTH-13 app status never conveys financial, wallet, paid, or other app authority',()=>{
 assert.deepEqual(validateAppSession({authenticated:false},app),{authenticated:false});
 assert.deepEqual(validateAppSession(valid,app),{authenticated:true,app,subject});
 for(const attack of [
  {...valid,app:'doobtube'},{...valid,subject:'0x'+'a'.repeat(40)},
  {...valid,subject:'not-uuid'},{...valid,financialAuthority:true},
  {...valid,permissions:['moderate']},{...valid,permissions:['wallet-sign']},
  {...valid,authenticated:'true'},{...valid,permissions:null},{...valid,subject:null},
 ]){
  assert.throws(()=>validateAppSession(attack,app));
 }
 assert.throws(()=>createAppSessionClient({app:'evil'}));
 assert.throws(()=>createAppSessionClient({app:'420media'}));
});
test('AUTH-13 browser uses only same-origin cookie-based no-store gateway requests',async()=>{
 const calls=[];
 const fetchImpl=async(url,init)=>{
  calls.push({url,init});
  return url.endsWith('/session')?response(valid):response({signedOut:true});
 };
 const client=createAppSessionClient({app,fetchImpl});
 assert.equal(client.loginPath,'/420id-api/auth/start');
 assert.equal((await client.session()).subject,subject);
 assert.equal(await client.logout(),true);
 assert.deepEqual(calls.map(x=>x.url),['/420id-api/auth/session','/420id-api/auth/logout']);
 assert.deepEqual(calls.map(x=>x.init.method),['GET','POST']);
 for(const {init} of calls){
  assert.equal(init.credentials,'same-origin');
  assert.equal(init.cache,'no-store');
  assert.equal(init.redirect,'error');
  assert.equal(init.headers.Accept,'application/json');
  assert.equal(init.body,undefined);
  assert.equal(init.headers.Authorization,undefined);
 }
});
test('AUTH-13 refuses cross-app, non-JSON and non-success session responses',async()=>{
 for(const x of [
  response({...valid,app:'420pay'}),response({...valid,financialAuthority:true}),
  response(valid,500),response(valid,200,'text/html')
 ]){
  const client=createAppSessionClient({app,fetchImpl:async()=>x});
  await assert.rejects(client.session());
 }
});
test('AUTH-13 no request is made when app integration is not approved',()=>{
 const {root}=dom();let count=0;
 const x=mountAppSession({root,app,enabled:false,origin:'https://town.420integrated.org',fetchImpl:async()=>{count++}});
 assert.equal(x.enabled,false);assert.equal(root.hidden,true);assert.equal(count,0);
 const y=mountAppSession({root,app,enabled:true,origin:'https://evil.org',fetchImpl:async()=>{count++}});
 assert.equal(y.enabled,false);assert.equal(root.hidden,true);assert.equal(count,0);
 const z=bootAppSession(null);assert.equal(z.enabled,false);
});
test('AUTH-13 late SSO status cannot repopulate UI after concurrent logout',async()=>{
 const {root,elements,document}=dom();
 const pending=[];
 const fetchImpl=(url,init)=>new Promise(resolve=>pending.push({url,init,resolve}));
 const mounted=mountAppSession({root,app,enabled:true,origin:'https://town.420integrated.org',visibilityDocument:document,fetchImpl});
 assert.equal(mounted.enabled,true);assert.equal(root.hidden,false);
 assert.equal(pending.length,1);
 assert.equal(elements.get('login').attrs.href,'/420id-api/auth/start');
 // Logout must be possible while a verification GET is still in flight.
 elements.get('logout').click();
 assert.equal(pending.length,2);
 assert.equal(pending[1].url,'/420id-api/auth/logout');
 pending[1].resolve(response({signedOut:true}));
 await flush();
 assert.match(elements.get('status').textContent,/Signed out of this app/);
 pending[0].resolve(response(valid));
 await flush();
 assert.match(elements.get('status').textContent,/Signed out of this app/);
 assert.equal(elements.get('logout').hidden,true);
 assert.equal(elements.get('login').hidden,false);
});
test('AUTH-13 hidden-tab invalidation clears private status before delayed reply',async()=>{
 const {root,elements,document,events}=dom();
 const pending=[];
 const fetchImpl=(url,init)=>new Promise(resolve=>pending.push({url,init,resolve}));
 mountAppSession({root,app,enabled:true,origin:'https://town.420integrated.org',visibilityDocument:document,fetchImpl});
 document.visibilityState='hidden';events.get('visibilitychange')();
 pending[0].resolve(response(valid));await flush();
 assert.equal(elements.get('logout').hidden,true);
 assert.doesNotMatch(elements.get('status').textContent,/Signed in to this app/);
});
test('420Wallet SSO client is the audited confidential app-only client; wallet session is not signing authority',async()=>{
 const wallet=await readFile(new URL('../../../wallet/web/420id-client.mjs',import.meta.url),'utf8');
 assert.equal(wallet,await readFile(new URL('./client.mjs',import.meta.url),'utf8'));
 const html=await readFile(new URL('../../../wallet/web/index.html',import.meta.url),'utf8');
 assert.match(html,/data-420id-enabled="false"/);
 assert.match(html,/src="\.\/420id-session-ui\.mjs"/);
 const app='420wallet';
 const validWallet={authenticated:true,app,subject,financialAuthority:false,permissions:[]};
 const client=createAppSessionClient({app,fetchImpl:async()=>response(validWallet)});
 assert.deepEqual(await client.session(),{authenticated:true,app,subject});
 for(const forged of [
   {...validWallet,app:'420pay'},
   {...validWallet,subject:'0x'+'0'.repeat(40)},
   {...validWallet,financialAuthority:true},
   {...validWallet,permissions:['governance-vote']},
 ]){
   assert.throws(()=>validateAppSession(forged,app));
 }
});

test('AUTH-13 every packaged web client is identical and starts disabled',async()=>{
 const expected=await readFile(new URL('./client.mjs',import.meta.url),'utf8');
 for(const dir of ['town','doobtube','mail','grow','pay','exchange','media']){
  const client=await readFile(new URL('../../../'+dir+'/web/420id-client.mjs',import.meta.url),'utf8');
  assert.equal(client,expected,dir+' has unreviewed browser client divergence');
  const html=await readFile(new URL('../../../'+dir+'/web/index.html',import.meta.url),'utf8');
  assert.match(html,new RegExp('data-420id-enabled="false"'));
  assert.match(html,new RegExp('src="./420id-client.mjs"'));
  assert.doesNotMatch(html,/data-420id-enabled="true"/);
 }
});
