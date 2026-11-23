// ARB-PRE-04: full browser-to-Anvil arbitration case lifecycle against real Solidity.
// Uses ephemeral canonical Registry code at its frozen local predeploy namespace;
// releases are local-only and never published as production or testnet addresses.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createReadStream,readFileSync,existsSync,mkdirSync} from 'node:fs';
import {dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {JsonRpcProvider,ContractFactory,Contract,AbiCoder,keccak256,id} from 'ethers';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const contracts=resolve(root,'../../contracts');
const artifacts=resolve(root,'browser-qualification-artifacts');
mkdirSync(artifacts,{recursive:true});
const registryAddress='0x0000000000000000000000000000000000000434';
const timelock='0x0000000000000000000000000000000000000429';
const domain=id('420/arbitration/domain/local-wallet-lifecycle/v1');
const origin=id('420/component/local-wallet-origin/v1');
const serviceId=id('420/service/arbitration/v1');
const componentId=id('420/component/arbitration/v1');
const metadataHash=id('local arbitration metadata');
const manifestHash=id('local arbitration manifest');
const interfaceHash=id('local arbitration interface');
const rpcUrl='http://127.0.0.1:8754';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const anvil=spawn('anvil',['--host','127.0.0.1','--port','8754','--chain-id','31337','--silent'],
  {stdio:['ignore','pipe','pipe']});
let anvilOutput='';
for(const stream of [anvil.stdout,anvil.stderr])stream.on('data',chunk=>anvilOutput+=chunk.toString().slice(0,2048));
const provider=new JsonRpcProvider(rpcUrl);
let server,browser,localWallet,caseContract,policyContract,rulingContract;
async function request(method,params=[]){
  const r=await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',method,params,id:1})});
  assert(r.ok,'Anvil RPC response');
  const payload=await r.json();
  if(payload.error)throw Error('Anvil '+method+': '+payload.error.message);
  return payload.result;
}
async function waitAnvil(){
  for(let i=0;i<100;i++){
    if(anvil.exitCode!==null)throw Error('Anvil exited: '+anvilOutput);
    try{await request('eth_chainId');return;}
    catch{await new Promise(done=>setTimeout(done,100));}
  }
  throw Error('Anvil failed to start: '+anvilOutput);
}
function artifact(contract){
  const path=resolve(contracts,'out',contract+'.sol',contract+'.json');
  assert(existsSync(path),'Compile missing Solidity artifact '+path);
  const a=JSON.parse(readFileSync(path,'utf8'));
  return {abi:a.abi,bytecode:a.bytecode.object};
}
async function deploy(contract,signer,...args){
  const a=artifact(contract);
  const instance=await new ContractFactory(a.abi,a.bytecode,signer).deploy(...args);
  await instance.waitForDeployment();
  return instance;
}
async function setup(){
  await waitAnvil();
  const accounts=await provider.listAccounts();
  assert(accounts.length>=5,'Anvil unlocked user/resolver accounts');
  const deployer=await provider.getSigner(0);
  const claimant=await provider.getSigner(1);
  const respondent=await provider.getSigner(2);
  const resolver=await provider.getSigner(3);
  const appealResolver=await provider.getSigner(4);
  const addresses={claimant:await claimant.getAddress(),respondent:await respondent.getAddress(),
    resolver:await resolver.getAddress(),appealResolver:await appealResolver.getAddress()};
  await request('anvil_impersonateAccount',[timelock]);
  await request('anvil_setBalance',[timelock,'0xde0b6b3a7640000']);
  const governance=await provider.getSigner(timelock);
  const originalRegistry=await deploy('ProtocolRegistry',deployer,timelock);
  const registryRuntime=await provider.getCode(await originalRegistry.getAddress());
  await request('anvil_setCode',[registryAddress,registryRuntime]);
  const registry=new Contract(registryAddress,artifact('ProtocolRegistry').abi,governance);
  policyContract=await deploy('ArbitrationPolicyRegistry420',deployer,timelock);
  caseContract=await deploy('ArbitrationCaseRegistry420',deployer,timelock,await policyContract.getAddress());
  rulingContract=await deploy('ArbitrationRulingRegistry420',deployer,await caseContract.getAddress());
  await (await caseContract.connect(governance).bindRulingRegistry(await rulingContract.getAddress())).wait();
  const router=await deploy('ArbitrationRouter420',deployer,
    await policyContract.getAddress(),await caseContract.getAddress(),await rulingContract.getAddress());
  await (await policyContract.connect(governance).setPolicy(domain,addresses.resolver,addresses.appealResolver,100,100,3,true)).wait();
  const names=['policies','cases','rulings','router'],contractsByName={policies:policyContract,cases:caseContract,rulings:rulingContract,router};
  const addressesOrdered=await Promise.all(names.map(k=>contractsByName[k].getAddress()));
  const hashes=await Promise.all(addressesOrdered.map(async a=>keccak256(await provider.getCode(a))));
  const root=keccak256(AbiCoder.defaultAbiCoder().encode(
    [...names.map(()=>'address'),...names.map(()=>'bytes32')],[...addressesOrdered,...hashes]));
  await (await registry.registerComponent(componentId,await router.getAddress(),[1,0,0],2)).wait();
  await (await registry.publishRegisteredService(serviceId,await router.getAddress(),
    metadataHash,1,true,3,manifestHash,root,interfaceHash)).wait();
  const release={serviceId:'420/service/arbitration/v1',chainId:31337,version:1,
    genesisHash:(await provider.getBlock(0)).hash,
    registry:{address:registryAddress,codeHash:keccak256(registryRuntime)},
    metadataHash,manifestHash,interfaceHash,domains:[{name:'Local Market',id:domain}]};
  assert.equal((await registry.resolveActive(serviceId))[0],await router.getAddress());
  return {addresses,release,router:await router.getAddress()};
}
function webServer(){
  return createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/rpc'){
      const chunks=[];for await(const part of req)chunks.push(part);
      try{
        const reply=await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},
          body:Buffer.concat(chunks)});
        res.writeHead(reply.status,{'content-type':'application/json','cache-control':'no-store'});
        res.end(Buffer.from(await reply.arrayBuffer()));
      }catch(e){res.writeHead(502).end(String(e));}
      return;
    }
    let path;
    try{path=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
    const file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep)||!existsSync(file)){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});
    createReadStream(file).pipe(res);
  });
}
async function switchWallet(page,account,release){
  await page.evaluate(({account,release})=>{
    window.__arbitrationDevAccount=account;
    if(!window.ethereum){
      const listeners=new Map();
      window.ethereum={
        on:(name,fn)=>listeners.set(name,fn),
        removeListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);},
        request:async({method,params=[]})=>{
          if(method==='eth_accounts')return [window.__arbitrationDevAccount];
          if(method==='eth_requestAccounts')throw Error('Never request implicit access in Arbitration');
          const r=await fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({jsonrpc:'2.0',id:Math.floor(Math.random()*10000000)+1,method,params})});
          if(!r.ok)throw Error('RPC HTTP '+r.status);
          const response=await r.json();
          if(response.error)throw Error(response.error.message);
          return response.result;
        }
      };
    }
    window.confirm=()=>true; // The UI still requires a separate deliberate click.
    document.dispatchEvent(new CustomEvent('wallet:verification-state',{detail:{
      config:{network:{chainId:'0x7a69'},arbitration:release},controller:account,
      network:{chainMismatch:false},phase:'ready'
    }}));
  },{account,release});
  await page.locator('#arbitration-connect').click();
  await page.waitForFunction(()=>document.querySelector('#arbitration-runtime-state')?.textContent==='Verified',
    null,{timeout:20000});
}
async function reviewAndSubmit(page){
  const panel=page.locator('#arbitration-management-panel');
  const review=panel.locator('#arbitration-review-panel');
  await review.waitFor({state:'visible',timeout:15000});
  assert.match(await review.textContent(),/Estimated network cost/);
  await panel.locator('#arbitration-authorize').click();
  await page.waitForFunction(()=>document.querySelector('#arbitration-tx-status')?.textContent?.includes('Pending canonical confirmation'),
    null,{timeout:15000});
  await panel.locator('#arbitration-check-receipt').click();
  await page.waitForFunction(()=>document.querySelector('#arbitration-tx-status')?.textContent?.includes('Canonically confirmed'),
    null,{timeout:15000});
}
async function selectCase(page,id){
  await page.locator('[data-arbitration-view="details"]').click();
  await page.locator('#arbitration-case-lookup').fill(id);
  await page.locator('#arbitration-lookup-form button').click();
  await page.waitForFunction(expected=>document.querySelector('#arbitration-case-details')?.textContent?.includes(expected),
    id,{timeout:15000});
}
try{
  const {addresses,release}=await setup();
  server=webServer();
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await switchWallet(page,addresses.claimant,release);
  await page.locator('[data-arbitration-view="open"]').click();
  const open=page.locator('#arbitration-open-form');
  await open.locator('input[name="respondent"]').fill(addresses.respondent);
  await open.locator('input[name="originComponentId"]').fill(origin);
  await open.locator('input[name="originObjectId"]').fill(id('local order 1'));
  await open.locator('input[name="claimHash"]').fill(id('private claim 1'));
  await open.locator('input[name="requestedRemedyHash"]').fill(id('requested remedy 1'));
  await open.locator('button[type="submit"]').click();
  await reviewAndSubmit(page);
  let events=await caseContract.queryFilter(caseContract.filters.CaseOpened());
  assert.equal(events.length,1,'new case mined in Anvil');
  const caseId=events[0].args.caseId;
  await selectCase(page,caseId);
  assert.equal(await page.getByRole('button',{name:'Submit evidence'}).count(),1);
  await page.getByRole('button',{name:'Submit evidence'}).click();
  const secret=Buffer.from('Private case-specific testimony; must never appear in logs or calldata.');
  await page.locator('#arbitration-private-file').setInputFiles({
    name:'private-testimony.txt',mimeType:'text/plain',buffer:secret
  });
  await page.locator('#arbitration-seal-file').click();
  await page.waitForFunction(()=>document.querySelector('#arbitration-seal-status')?.textContent?.includes('Encrypted privately'),
    null,{timeout:15000});
  const evidenceHash=await page.locator('#arbitration-evidence-form [name="evidenceHash"]').inputValue();
  assert.match(evidenceHash,/^0x[0-9a-f]{64}$/);
  await page.locator('#arbitration-show-secret').click();
  const recoveryKey=await page.locator('#arbitration-private-recovery').inputValue();
  assert.match(recoveryKey,/^0x[0-9a-f]{64}$/);
  const encryptedDownloadPromise=page.waitForEvent('download');
  await page.locator('#arbitration-export-sealed').click();
  const encryptedDownload=await encryptedDownloadPromise;
  const encryptedData=readFileSync(await encryptedDownload.path());
  assert(!encryptedData.toString('utf8').includes(secret.toString('utf8')),
    'No plaintext content may appear in exported encrypted evidence');
  await page.getByRole('button',{name:'Simulate and review evidence'}).click();
  await reviewAndSubmit(page);
  assert.equal((await caseContract.getCase(caseId)).round,0n);
  assert.equal(await caseContract.evidenceCommitted(caseId,0,evidenceHash),true);
  // Inspect only after the exact case/round/submitter/commitment is canonical.
  const inspect=page.locator('#arbitration-inspection-form');
  await inspect.locator('[name="commitment"]').fill(evidenceHash);
  await inspect.locator('[name="submitter"]').fill(addresses.claimant);
  await inspect.locator('[name="round"]').fill('0');
  await inspect.locator('[name="capsule"]').setInputFiles({
    name:'private-evidence.json',mimeType:'application/json',buffer:encryptedData
  });
  await inspect.locator('[name="recoveryKey"]').fill(recoveryKey);
  await inspect.locator('button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#arbitration-inspection-status')?.textContent?.includes('Private bytes verified'),
    null,{timeout:15000});
  const verifiedDownloadPromise=page.waitForEvent('download');
  await page.locator('#arbitration-export-verified').click();
  const verifiedDownload=await verifiedDownloadPromise;
  assert.deepEqual(readFileSync(await verifiedDownload.path()),secret,
    'Only verified original plaintext may be explicitly downloaded');
  assert.equal(await page.locator('#arbitration-export-verified').isDisabled(),true);
  await switchWallet(page,addresses.resolver,release);
  await selectCase(page,caseId);
  await page.getByRole('button',{name:'Submit ruling'}).click();
  const ruling=page.locator('#arbitration-ruling-form');
  await ruling.locator('[name="outcomeCode"]').fill('1');
  await ruling.locator('[name="rulingHash"]').fill(id('round zero reasoning'));
  await ruling.locator('[name="remedyCommitment"]').fill(id('round zero remedy'));
  await ruling.locator('button').click();
  await reviewAndSubmit(page);
  assert.equal((await caseContract.getCase(caseId)).state,2n);
  await switchWallet(page,addresses.claimant,release);
  await selectCase(page,caseId);
  await page.getByRole('button',{name:'Appeal ruling'}).click();
  await reviewAndSubmit(page);
  assert.equal((await caseContract.getCase(caseId)).round,1n);
  await switchWallet(page,addresses.appealResolver,release);
  await selectCase(page,caseId);
  await page.getByRole('button',{name:'Submit ruling'}).click();
  await ruling.locator('[name="outcomeCode"]').fill('2');
  await ruling.locator('[name="rulingHash"]').fill(id('round one reasoning'));
  await ruling.locator('[name="remedyCommitment"]').fill(id('round one remedy'));
  await ruling.locator('button').click();
  await reviewAndSubmit(page);
  await request('evm_increaseTime',[101]);await request('evm_mine',[]);
  await switchWallet(page,addresses.claimant,release);
  await selectCase(page,caseId);
  await page.getByRole('button',{name:'Finalize ruling'}).click();
  await reviewAndSubmit(page);
  assert.equal((await caseContract.getCase(caseId)).state,3n,'finalized on real local EVM');
  assert.equal((await rulingContract.getRuling(caseId,0)).outcomeCode,1n);
  assert.equal((await rulingContract.getRuling(caseId,1)).outcomeCode,2n);
  await page.locator('[data-arbitration-view="history"]').click();
  const text=await page.locator('#arbitration-timeline').textContent();
  for(const kind of ['opened','evidence','ruled','appealed','ruling','finalized'])
    assert(text.includes(kind),'canonical event missing: '+kind);
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:850});
    const layout=await page.evaluate(()=>({client:document.documentElement.clientWidth,
      scroll:document.documentElement.scrollWidth}));
    assert(layout.scroll<=layout.client+1,'Arbitration horizontal overflow '+width);
    await page.screenshot({path:resolve(artifacts,'arbitration-anvil-'+width+'.png'),fullPage:true});
  }
  const {default:axe}=await import('axe-core');
  await page.evaluate(source=>{const script=document.createElement('script');script.text=source;document.head.append(script);},axe.source);
  const violations=await page.evaluate(()=>window.axe.run(document.querySelector('#arbitration-management-panel'),
    {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
  assert.equal(violations.violations.length,0,'Arbitration accessibility '+violations.violations.map(v=>v.id).join(', '));
  console.log(JSON.stringify({result:'PASS',localEVM:true,network:31337,caseId,
    opened:1,evidence:1,encryptedEvidence:true,privateInspection:true,plaintextNeverBroadcast:true,rulings:2,appeals:1,finalized:true,history:true,viewport:[1440,390,320],
    axeViolations:0,contractSource:'canonical Arbitration Genesis graph'}));
}finally{
  await browser?.close();
  if(server)await new Promise(done=>server.close(done));
  anvil.kill('SIGTERM');
}
