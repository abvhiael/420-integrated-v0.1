import {chromium} from 'playwright';
import {HDNodeWallet,getBytes,AbiCoder,keccak256,toUtf8Bytes,concat,hexlify} from 'ethers';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const url=process.env.DAILY_APP_URL,rpc=process.env.DAILY_RPC,out=process.env.DAILY_OUTPUT;
const config=await (await fetch(url+'/api/config')).json(),pools=config.plannedPools,slates=Object.keys(config.slates);
let rpcID=0;const steps=[],posts=[];
async function rpcCall(method,params){const r=await (await fetch(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++rpcID,method,params})})).json();if(r.error)throw Error(r.error.message);return r.result;}
async function control(action,payload={}){const r=await fetch(process.env.DAILY_CONTROL,{method:'POST',headers:{'Content-Type':'application/json','X-Local-Qualification':process.env.DAILY_CONTROL_TOKEN},body:JSON.stringify({action,...payload})});const value=await r.json();if(!r.ok)throw Error(value.error);return value;}
async function api(path,data){const r=await fetch(url+path,data?{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify(data)}:{});return {status:r.status,value:await r.json()};}
async function record(name,fn){await fn();steps.push(name);console.log('EXECUTED '+name);}
async function submission(pool,index,ids){
 const profile=config.profiles[index],pre=(await api('/api/preflight?'+new URLSearchParams({pool,subject:profile.subject,credential:profile.credential,actor:profile.account}))).value;
 const salt=crypto.getRandomValues(new Uint8Array(32)),nonce=BigInt(pre.nonce),transport=toUtf8Bytes('420-FANTASY-LINEUP-V1'),abi=AbiCoder.defaultAbiCoder();
 const commitment=keccak256(abi.encode(['bytes32','uint256','address','bytes32','bytes32','uint64','uint32[7]','bytes32'],[keccak256(toUtf8Bytes('420.FANTASY.CONTEST.V1')),config.chainID,config.engine,pool,profile.subject,nonce,ids,salt]));
 const aad=getBytes(concat([transport,getBytes(pool),getBytes(profile.subject),getBytes('0x'+nonce.toString(16).padStart(16,'0'))]));
 const ephemeral=await crypto.subtle.generateKey('X25519',true,['deriveBits']),publicKey=await crypto.subtle.importKey('raw',getBytes(config.encryptionPublicKey),'X25519',false,[]);
 const shared=await crypto.subtle.deriveBits({name:'X25519',public:publicKey},ephemeral.privateKey,256),base=await crypto.subtle.importKey('raw',shared,'HKDF',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:getBytes(keccak256(aad)),info:transport},base,{name:'AES-GCM',length:256},false,['encrypt']),iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,getBytes(abi.encode(['uint32[7]','bytes32'],[ids,salt])));
 return {pool,subject:profile.subject,credential:profile.credential,actor:profile.account,commitment,nonce:pre.nonce,expiry:Math.min(Number(pre.slate.lockAt),pre.snapshot.timestamp+300),envelope:hexlify(concat([new Uint8Array([1]),new Uint8Array(await crypto.subtle.exportKey('raw',ephemeral.publicKey)),iv,new Uint8Array(ciphertext)]))};
}
async function authorize(request,index){const answer=await api('/api/authorize',request);assert.equal(answer.status,200);const wallet=HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,"m/44'/60'/0'/0/"+index);return {...request,walletSignature:await wallet.signMessage(answer.value.message)};}
const browser=await chromium.launch({headless:true});const pages=[];
async function open(index){const context=await browser.newContext();const page=await context.newPage();pages.push(page);
 const wallet=HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,"m/44'/60'/0'/0/"+index);
 assert.equal(wallet.address.toLowerCase(),(await rpcCall('eth_accounts',[]))[index].toLowerCase());
 await page.exposeBinding('localWalletRequest',async(_,{method,params=[]})=>{
  if(method==='eth_requestAccounts'||method==='eth_accounts')return [wallet.address];
  if(method==='personal_sign'){assert.equal(params[1].toLowerCase(),wallet.address.toLowerCase());return wallet.signMessage(getBytes(params[0]));}
  if(method==='eth_sendTransaction'){assert.equal(params[0].from.toLowerCase(),wallet.address.toLowerCase());return rpcCall(method,params);}
  if(['eth_chainId','eth_getTransactionReceipt','eth_estimateGas','eth_getBlockByNumber'].includes(method))return rpcCall(method,params);
  throw Error('unsupported test wallet method '+method);
 });
 await page.addInitScript(()=>{window.ethereum={request:async({method,params})=>{const result=await window.localWalletRequest({method,params});return method==='eth_getBlockByNumber'&&window.__qualificationWrongGenesis?{...result,hash:'0x'+'ff'.repeat(32)}:result;},on:()=>{}};});
 page.on('request',request=>{if(request.method()==='POST'&&request.url().startsWith(url+'/api/'))posts.push({url:request.url(),body:request.postData()});});
 page.on('pageerror',error=>console.error('BROWSER '+error.message));
 await page.goto(url);await page.waitForFunction(()=>document.getElementById('profile').options.length>0);
 await click(page,'#connect');return page;
}
async function click(page,selector,expected){await page.locator(selector).click();await page.waitForFunction(()=>document.body.dataset.busy==='false',{},{timeout:30000});
 const status=await page.locator('#status').textContent();if(await page.locator('#status').getAttribute('class')==='error')throw Error(status);if(expected)assert.ok(status.includes(expected),status);}
async function choose(page,pool){await click(page,'#refresh');await page.selectOption('#pool',pool);await page.waitForFunction(()=>document.body.dataset.busy==='false');await click(page,'#refresh');}
async function lineup(page,ids){for(let i=0;i<ids.length;i++)await page.selectOption('#slot-'+i,String(ids[i]));}
async function enter(page,pool,ids){await choose(page,pool);await lineup(page,ids);await click(page,'#submit','Entry funded');}
async function view(pool,index){const r=await api('/api/pool?'+new URLSearchParams({pool,actor:config.profiles[index].account}));assert.equal(r.status,200);return r.value;}
async function waitPublished(pool,count){for(let i=0;i<100;i++){const v=await view(pool,1);if(v.pool.revealed===count)return v;await new Promise(r=>setTimeout(r,200));}throw Error('publication did not complete');}
try{
 const admin=await open(0),alice=await open(1),bob=await open(2),resolver=await open(4);
 await record('platform creates paid, sponsored-free, underfilled and timeout pools through browser',async()=>{
  if(config.assetKind==='wrapped-native'){await alice.fill('#wrap-amount','0.125');await click(alice,'#wrap','wrapped at 1:1');await click(alice,'#unwrap','unwrapped at 1:1');}
  await admin.locator('#admin summary').click();
  for(const [i,fee,prize,slate] of [[0,'1','0',slates[0]],[1,'0','10',slates[0]],[2,'1','0',slates[0]],[3,'1','0',slates[1]],[4,'0','3',slates[0]]]){
   await admin.selectOption('#access',i===4?'invite':'public');await admin.fill('#payout-weights',i===4?'70,20,10':'60,30,10');await admin.selectOption('#new-pool',pools[i]);await admin.selectOption('#slate',slate);await admin.fill('#entry-fee',fee);await admin.fill('#free-prize',prize);await click(admin,'#create','Pool created');
  }
  const v=await view(pools[1],0);assert.equal(v.pool.gross,'10000000000000000000');assert.equal(v.config.paid,false);
 });
 await record('two wallets fund actual $420 escrow and submit browser-encrypted lineups',async()=>{
  for(const page of [alice,bob])await click(page,'#refresh');
  for(const [page,ids] of [[alice,[1,2,3,4,5,6,7]],[bob,[8,9,10,11,12,13,14]]])for(const pool of [pools[0],pools[1],pools[3]])await enter(page,pool,ids);
  await enter(alice,pools[2],[1,2,3,4,5,6,7]);
  const privatePre=await api('/api/preflight?'+new URLSearchParams({pool:pools[4],subject:config.profiles[1].subject,credential:config.profiles[1].credential,actor:config.profiles[1].account}));assert.equal(privatePre.status,400);
  await choose(admin,pools[4]);await admin.selectOption('#invite-profile',config.profiles[1].subject);await click(admin,'#invite','Invitation confirmed');await enter(alice,pools[4],[1,2,3,4,5,6,7]);
  const privatePool=await view(pools[4],1);assert.equal(privatePool.config.inviteOnly,true);assert.deepEqual(privatePool.payoutWeights,[7000,2000,1000]);
  const page=await api('/api/pool?'+new URLSearchParams({pool:pools[0],actor:config.profiles[1].account,start:2}));assert.equal(page.status,200);assert.equal(page.value.entries.length,1);assert.equal(page.value.ownEntries[0].id,1);
  const v=await view(pools[0],1);assert.equal(v.pool.gross,'2000000000000000000');assert.ok(v.entries.every(e=>!e.revealed&&e.lineup.every(i=>i===0)));
 });
 await record('authorized edit changes the accepted nonce without another payment',async()=>{
  await choose(alice,pools[0]);await lineup(alice,[15,2,3,4,5,6,7]);await click(alice,'#submit','Encrypted edit confirmed');
  const v=await view(pools[0],1);assert.equal(v.entries[0].nonce,2);assert.equal(v.pool.gross,'2000000000000000000');assert.equal(v.pool.count,2);
 });
 await record('pre-lock requests never transmit lineup plaintext or salt',async()=>{
  for(const request of posts){const b=JSON.parse(request.body);assert.equal(b.lineup,undefined);assert.equal(b.salt,undefined);if(request.url.endsWith('/api/attest'))assert.equal(getBytes(b.envelope).length,317);}
  const latest=posts.filter(r=>r.url.endsWith('/api/attest')).at(-1);assert.ok(latest);
  const replay=await api('/api/attest',JSON.parse(latest.body));assert.equal(replay.status,400);
  const foreign={...JSON.parse(latest.body),pool:pools[1]};assert.equal((await api('/api/attest',foreign)).status,400);
  const csrf=await fetch(url+'/api/attest',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://attacker.invalid'},body:latest.body});assert.equal(csrf.status,403);
  await choose(alice,pools[0]);await alice.evaluate(()=>window.__qualificationWrongGenesis=true);await alice.locator('#submit').click();await alice.waitForFunction(()=>document.body.dataset.busy==='false');assert.ok((await alice.locator('#status').textContent()).includes('genesis'));assert.equal((await view(pools[0],1)).entries[0].nonce,2);await alice.evaluate(()=>window.__qualificationWrongGenesis=false);await click(alice,'#connect');
 });
 await record('custodian rejects authenticated malformed lineups, tampered ciphertext and wrong-wallet consent',async()=>{
  const invalid=await authorize(await submission(pools[0],1,[2,1,3,4,5,6,7]),1);assert.equal((await api('/api/attest',invalid)).status,400);
  const tampered=await submission(pools[0],1,[1,2,3,4,5,6,7]);tampered.envelope=tampered.envelope.slice(0,-2)+(tampered.envelope.endsWith('00')?'01':'00');assert.equal((await api('/api/attest',await authorize(tampered,1))).status,400);
  const valid=await submission(pools[0],1,[1,2,3,4,5,6,7]);assert.equal((await api('/api/attest',await authorize(valid,2))).status,400);
  const pending=await api('/api/attest',await authorize(valid,1));assert.equal(pending.status,200);assert.equal(pending.value.nonce,3);
  // This valid newer receipt is deliberately never broadcast. Accepted nonce 2 must survive it.
  const files=await readdir(process.env.DAILY_PRIVATE);for(const name of files.filter(n=>n.startsWith('custody.sqlite3'))){const bytes=await readFile(join(process.env.DAILY_PRIVATE,name));assert.equal(bytes.includes(Buffer.from('"lineup":')),false);assert.equal(bytes.includes(Buffer.from('"salt":')),false);}
 });
 await record('durable custody survives service restart and releases latest accepted lineups after lock',async()=>{
  await control('restart');for(let i=0;i<100;i++){try{if((await api('/api/health')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  await control('advance',{timestamp:Number(config.slates[slates[0]].lockAt)+1});
  const v=await waitPublished(pools[0],2);assert.deepEqual(v.entries[0].lineup,[15,2,3,4,5,6,7]);await waitPublished(pools[1],2);
  await choose(alice,pools[0]);assert.equal(await alice.locator('#submit').isDisabled(),true);assert.ok((await alice.locator('#standings').textContent()).includes('Center 15'));
 });
 await record('underfilled paid pool cancels and browser returns exact entry escrow',async()=>{
  await choose(alice,pools[2]);const v=await view(pools[2],1);assert.equal(v.pool.state,5);await click(alice,'#collect','credited');await click(alice,'#withdraw','withdrawn');await choose(admin,pools[4]);assert.equal((await view(pools[4],0)).pool.state,5);await click(admin,'#withdraw','withdrawn');
 });
 await record('actual quorum oracle, proofs and rankings produce visible provisional standings',async()=>{
  await control('score',{pool:pools[0]});await control('score',{pool:pools[1]});await control('prepareCorrection',{pool:pools[1]});await choose(alice,pools[0]);
  const v=await view(pools[0],1);assert.equal(v.pool.state,3);assert.equal(v.entries[0].score,'135');assert.equal(v.entries[1].score,'35');assert.equal(v.entries[0].payout,'1940000000000000000');
 });
 await record('paid challenge escrows half-entry bond and independent resolver denies it',async()=>{
  let v=await view(pools[0],1);await control('advance',{timestamp:Number(v.dispute.correctionEnd)});await choose(alice,pools[0]);await alice.fill('#evidence','Synthetic challenge evidence: qualification case denied');await click(alice,'#challenge','Challenge and bond accepted');
  let free=await view(pools[1],2);await control('advance',{timestamp:Number(free.dispute.correctionEnd)});await choose(bob,pools[1]);await bob.fill('#evidence','Synthetic correction evidence: qualification case upheld');await click(bob,'#challenge','Challenge and bond accepted');
  free=await view(pools[1],2);v=await view(pools[0],1);await control('advance',{timestamp:Math.max(Number(v.dispute.reviewUntil),Number(free.dispute.reviewUntil))});assert.equal(v.claims[0].bond,'500000000000000000');await control('scopeResolver',{claim:v.claims[0].id});await choose(resolver,pools[0]);await resolver.fill('#resolution-reason','Denied: supplied synthetic evidence does not contradict the verified statistics.');await click(resolver,'.claim button:text("Deny")','Dispute transaction confirmed');
  await choose(alice,pools[0]);await click(alice,'.claim button:text("Collect bond")','Dispute transaction confirmed');const community=await open(9);await choose(community,pools[0]);await click(community,'#withdraw','withdrawn');
 });
 await record('sponsored-free challenge is upheld, bond returned and corrected candidate re-reviewed',async()=>{
  let v=await view(pools[1],2);assert.equal(v.claims[0].bond,'1000000000000000000');await control('scopeResolver',{claim:v.claims[0].id});await choose(resolver,pools[1]);await resolver.fill('#resolution-reason','Upheld: independently reviewed correction matches the pre-deadline verified revision.');await click(resolver,'.claim button:text("Uphold")','Dispute transaction confirmed');
  await choose(bob,pools[1]);await click(bob,'.claim button:text("Collect bond")','Dispute transaction confirmed');await click(bob,'#withdraw','withdrawn');
  await control('score',{pool:pools[1],revision:2,bobWins:true});v=await view(pools[1],2);assert.equal(v.pool.revision,2);assert.equal(v.dispute.invalidated,false);
 });
 await record('dispute-gated canonical settlement pays winners and exact 3% development fee',async()=>{
  const a=await view(pools[0],1),b=await view(pools[1],2);await control('advance',{timestamp:Math.max(Number(a.dispute.reviewUntil),Number(b.dispute.reviewUntil))+1});
  for(const pool of [pools[0],pools[1]]){await choose(admin,pool);await click(admin,'#finalize','Verified results finalized');}
  for(const page of [alice,bob])for(const pool of [pools[0],pools[1]]){await choose(page,pool);await click(page,'#collect','credited');await click(page,'#withdraw');}
 });
 await record('missing publication deadline yields full refunds with no development deduction',async()=>{
  await control('advance',{timestamp:Number(config.slates[slates[1]].lockAt)+3601});
  for(let i=0;i<100;i++){if((await view(pools[3],1)).pool.state===5)break;await new Promise(r=>setTimeout(r,100));}
  for(const page of [alice,bob]){await choose(page,pools[3]);await click(page,'#collect','credited');await click(page,'#withdraw');}
  const totals=await control('totals');assert.equal(totals.balances[1],'100440000000000000000');assert.equal(totals.balances[2],'109000000000000000000');assert.equal(totals.balances[8],'60000000000000000');assert.equal(totals.balances[9],'500000000000000000');assert.equal(totals.engineBalance,'0');assert.equal(totals.engineLiability,'0');assert.equal(totals.bondBalance,'0');assert.equal(totals.bondLiability,'0');
  await writeFile(join(out,'conservation.json'),JSON.stringify(totals,null,2));
 });
 await choose(alice,pools[0]);await alice.screenshot({path:join(out,'daily-pool.png'),fullPage:true});await alice.setViewportSize({width:390,height:844});await alice.screenshot({path:join(out,'daily-pool-mobile.png'),fullPage:true});
 await writeFile(join(out,'browser-result.json'),JSON.stringify({steps,passed:steps.length,realBrowser:true,realEncryption:true,realTokenEscrow:true,realCanonicalSettlement:true,assetKind:config.assetKind,realNativeWrapping:config.assetKind==='wrapped-native',syntheticSportsData:true,externalWalletExtensionQualified:false},null,2));
 console.log(JSON.stringify({passed:steps.length,realBrowser:true}));
}catch(error){for(const [i,page] of pages.entries())await page.screenshot({path:join(out,'failure-'+i+'.png'),fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}
