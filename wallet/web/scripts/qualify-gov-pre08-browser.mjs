// Real Chromium EIP-1193 Wallet Governance against the *running* chain420.
// The Wallet key and verified 420ID mailbox are disposable local fixtures.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const getEthers=createRequire(path.join(ROOT,'420-indexer/package.json'));
const {Wallet,Interface,AbiCoder,keccak256,toUtf8Bytes}=getEthers('ethers');
const options=process.argv.slice(2);
const arg=(key,optional=false)=>{
 const pos=options.indexOf('--'+key);
 if(pos<0||!options[pos+1]){if(optional)return null;throw Error('missing '+key)}
 return options[pos+1];
};
const mode=arg('mode'),rpcUrl=arg('rpc'),output=arg('output');
assert.ok(['propose','vote','recovered'].includes(mode));
assert.match(rpcUrl,/^http:\/\/127\.0\.0\.1:\d+$/);
const graph=JSON.parse(await fs.readFile(arg('graph'),'utf8'));
assert.equal(graph.approvedV4,false);
assert.equal(graph.localBrowserRuleConfigured,true);
const wallet=new Wallet('0x'+'00'.repeat(31)+'01');
assert.equal(wallet.address.toLowerCase(),graph.localBrowserSigner.toLowerCase());
const civic=graph.walletCivicModuleAddresses;
const abi=new Interface([
 'function createProposal(uint8,bytes32,bytes32) returns(bytes32)',
 'event CivicProposalCreated(bytes32 indexed proposalId,address indexed proposer,uint8 indexed class_,bytes32 metadataHash,bytes32 actionsHash,uint64 snapshotBlock,uint64 voteStart,uint64 voteEnd,uint32 constitutionRevision)',
 'event CivicVoteCast(bytes32 indexed proposalId,uint8 indexed house,address indexed voter,uint8 support,uint256 weight)'
]);
let rpcId=0;
async function rpc(method,params=[]){
 const response=await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},
 body:JSON.stringify({jsonrpc:'2.0',id:++rpcId,method,params})});
 assert.equal(response.status,200);
 const payload=await response.json();
 if(payload.error)throw Error(method+': '+payload.error.message);
 return payload.result;
}
assert.equal(await rpc('eth_chainId'),'0x1a4');
const proposalTx=arg('proposal-tx',true);
let proposalId=null;
if(mode!=='propose'){
 const receipt=await rpc('eth_getTransactionReceipt',[proposalTx]);
 assert.equal(receipt?.status,'0x1');
 assert.equal(receipt.to.toLowerCase(),civic.governor.toLowerCase());
 const found=receipt.logs.map(x=>{try{return abi.parseLog(x)}catch{return null}})
   .find(x=>x?.name==='CivicProposalCreated');
 assert.ok(found,'real Geth proposal receipt missing Civic event');
 proposalId=found.args.proposalId.toLowerCase();
 assert.equal(found.args.voteStart,4n);
}

let currentAccount=wallet.address.toLowerCase(),chainChanged=false;
const transactions=[];
let approvals=0;
const pending=arg('pending-output',true);
async function providerRequest(method,params=[]){
 if(['eth_accounts','eth_requestAccounts'].includes(method))return currentAccount ? [currentAccount] : [];
 if(method==='eth_chainId'&&chainChanged)return '0x1a5';
 if(method!=='eth_sendTransaction')return rpc(method,params);
 const tx=params[0];
 if(chainChanged||tx.from?.toLowerCase()!==currentAccount||
    currentAccount!==wallet.address.toLowerCase())throw Error('wallet account or network changed');
 ++approvals;
 const gas=BigInt(await rpc('eth_estimateGas',[tx]));
 const nonce=BigInt(await rpc('eth_getTransactionCount',[wallet.address,'pending']));
 const raw=await wallet.signTransaction({chainId:420,type:2,to:tx.to,
    data:tx.data||'0x',value:BigInt(tx.value||0),nonce,
    gasLimit:gas+50000n,maxPriorityFeePerGas:1000000000n,maxFeePerGas:2000000000n});
 const txHash=await rpc('eth_sendRawTransaction',[raw]);
 assert.equal(txHash.toLowerCase(),keccak256(raw).toLowerCase());
 transactions.push({txHash,to:tx.to,from:wallet.address,nonce:nonce.toString()});
 if(pending&&mode==='vote'&&tx.to.toLowerCase()===civic.voting.toLowerCase())
   await fs.writeFile(pending,JSON.stringify({txHash,proposalId})+'\n',{flag:'wx'});
 return txHash;
}

const browser=await chromium.launch({headless:true,args:[
 '--no-proxy-server',
 '--host-resolver-rules=MAP auth.420integrated.org 127.0.0.1:18785, MAP wallet.420integrated.org 127.0.0.1:18785'
]});
const context=await browser.newContext({viewport:{width:1280,height:900},ignoreHTTPSErrors:true});
const page=await context.newPage();
page.on('dialog',dialog=>dialog.accept());
page.on('response',response=>{
 const {hostname,pathname}=new URL(response.url());
 if(response.status()>=400 && (hostname==='auth.420integrated.org'||pathname.startsWith('/420id-api/')))
   console.error('420ID qualification HTTP',response.status(),pathname);
});
await page.exposeBinding('nativeWallet420',(_,method,params)=>providerRequest(method,params));
await page.addInitScript(()=>{
 const handlers=new Map();
 window.ethereum={
   request:({method,params=[]})=>window.nativeWallet420(method,params),
   on(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn)},
   removeListener(name,fn){handlers.get(name)?.delete(fn)}
 };
 window.__walletEvent=(name,value)=>{
   const listeners=[...(handlers.get(name)||[])];
   for(const handler of listeners)handler(value);
   return listeners.length;
 };
});
async function assertProviderInvalidation(event, value) {
 // The Wallet shell intentionally reloads on provider changes. Read the old
 // document in the same browser task as dispatch, then verify the new document.
 const navigation=page.waitForEvent('framenavigated',{
   predicate:frame=>frame===page.mainFrame(),timeout:12000
 });
 const [snapshot]=await Promise.all([
   page.evaluate(({event,value})=>{
     const listeners=window.__walletEvent(event,value);
     return {
       listeners,
       status:document.querySelector('#governance-app-state').textContent,
       account:document.querySelector('#governance-account').textContent,
       voteDisabled:[...document.querySelectorAll('[data-governance-support]')].every(button=>button.disabled)
     };
   },{event,value}),
   navigation
 ]);
 assert.ok(snapshot.listeners>0,`No listeners for EIP-1193 ${event}`);
 assert.equal(snapshot.status,'Reload required',`Governance did not synchronously invalidate on ${event}`);
 assert.equal(snapshot.account,'—');
 assert.equal(snapshot.voteDisabled,true);
 await page.locator('#governance-app-state').filter({hasText:/^Not connected$/}).waitFor();
 assert.equal(await page.locator('[data-governance-support="1"]').isDisabled(),true);
}

try{
 await page.goto('https://auth.420integrated.org/__qualification/session',{waitUntil:'domcontentloaded',timeout:15000});
 await page.goto('https://wallet.420integrated.org/',{waitUntil:'domcontentloaded',timeout:15000});
 await page.locator('[data-420id-status]').filter({hasText:/Not signed in/}).waitFor();
 await page.locator('#governance-connect').click();
 await page.locator('#governance-app-state').filter({hasText:/^Action blocked$/}).waitFor();
 assert.match(await page.locator('#governance-error-recovery').textContent(),/420ID/);
 assert.equal(await page.locator('[data-governance-support="1"]').isDisabled(),true);
 await page.locator('[data-420id-login]').click();
 await page.waitForURL('https://auth.420integrated.org/sso/authorize?*');
 await page.locator('#sso-approve').click();
 await page.waitForURL('https://wallet.420integrated.org/');
 await page.locator('[data-420id-logout]').waitFor({state:'visible'});
 const appCookie=(await context.cookies('https://wallet.420integrated.org')).find(cookie=>
   cookie.name==='__Host-app420_session');
 assert.ok(appCookie?.httpOnly&&appCookie.secure&&appCookie.sameSite==='Lax');
 await page.locator('#governance-connect').click();
 await page.locator('#governance-app-state[data-state="passed"]').waitFor({timeout:30000});
 assert.equal((await page.locator('#governance-account').textContent()).toLowerCase(),wallet.address.toLowerCase());
 let proof={mode,chainId:420,localOnly:true,realChromium:true,
    actualNativeGeth:true,realRegistryAndCivicCodeVerified:true,
    real420IDBrowserGateway:true,real420IDCentralConsentAndPKCE:true,privateSessionCookieVerified:true};
 if(mode==='propose'){
   const policy=graph.actualProductionConstructorAddresses.TreasuryPolicyRegistry420;
   const action=new Interface(['function setAssetPolicy(address,bool,uint128,uint128,uint64)'])
      .encodeFunctionData('setAssetPolicy',['0x000000000000000000000000000000000000d00d',true,123,456,86400]);
   const actions=[[policy,'0',action]];
   const actionsHash=keccak256(AbiCoder.defaultAbiCoder().encode(
      ['tuple(address,uint256,bytes)[]'],[actions]));
   const metadataHash=keccak256(toUtf8Bytes('GOV-PRE08/BROWSER/LOCAL-ONLY'));
   const call=abi.encodeFunctionData('createProposal',[0,metadataHash,actionsHash]);
   const hash=await page.evaluate(tx=>window.ethereum.request({
      method:'eth_sendTransaction',params:[tx]}),
      {from:wallet.address,to:civic.governor,data:call,value:'0x0'});
   assert.ok(transactions.some(tx=>tx.txHash===hash&&tx.to.toLowerCase()===civic.governor.toLowerCase()));
   proof={...proof,proposalTxHash:hash,actions,realNativeWalletSignedCivicProposal:true};
 }else{
   await page.locator('#governance-proposal-list .governance-proposal-row').first().click();
   await page.locator('#governance-state').getByText('ACTIVE').waitFor({timeout:18000});
   if(mode==='vote'){
     await page.locator('#governance-check-eligibility').click();
     await page.locator('#governance-eligibility[data-state="passed"]').waitFor({timeout:16000});
     const forButton=page.locator('[data-governance-support="1"]');
     assert.equal(await forButton.isEnabled(),true,'real voting weight not found on native Geth');
     await forButton.click();
     // The parent Python harness waits for a real signed tx in the live Geth
     // mempool, then mines it in the NEXT independently BLS-certified block.
     await page.getByText('Vote confirmed',{exact:true}).waitFor({timeout:60000});
     assert.match(await page.locator('#governance-transaction-state').textContent(),/Vote confirmed/);
     const submission=transactions.find(tx=>tx.to.toLowerCase()===civic.voting.toLowerCase());
     assert.ok(submission,'browser supplied no real typed EVM ballot');
     const receipt=await rpc('eth_getTransactionReceipt',[submission.txHash]);
     assert.equal(receipt?.status,'0x1');
     const found=receipt.logs.map(log=>{try{return abi.parseLog(log)}catch{return null}})
        .find(log=>log?.name==='CivicVoteCast');
     assert.ok(found,'no CivicVoteCast from real mined native block');
     assert.equal(found.args.proposalId.toLowerCase(),proposalId);
     assert.equal(found.args.voter.toLowerCase(),wallet.address.toLowerCase());
     assert.equal(found.args.support,1n);
     proof={...proof,realVoteReceiptHash:submission.txHash,
       actualSourceCompiledCivicVote:true,realOnchainEvent:true,
       actualNativeBlockNumber:Number(BigInt(receipt.blockNumber))};
   }else{
     await page.waitForFunction(()=>document.querySelector('#governance-community-tally')?.textContent?.includes('FOR 1'),null,{timeout:16000});
     proof={...proof,canonicalCivicBallotRecoveredAfterHardStop:true};
   }
 }
 const before=transactions.length;
 // Provider lifecycle coverage runs on the proposal journey. The separate
 // ballot and recovery sessions preserve the actual 420ID client rate limits.
 if(mode==='propose'){
  assert.match(graph.localBrowserChangedAccount,/^0x[0-9a-fA-F]{40}$/);
  currentAccount=graph.localBrowserChangedAccount.toLowerCase();
  await assertProviderInvalidation('accountsChanged',[currentAccount]);
  await page.locator('#governance-connect').click();
  await page.locator('#governance-app-state[data-state="passed"]').waitFor();
  assert.equal((await page.locator('#governance-account').textContent()).toLowerCase(),currentAccount);

  chainChanged=true;
  await assertProviderInvalidation('chainChanged','0x1a5');
  await page.locator('#governance-connect').click();
  await page.locator('#governance-app-state').filter({hasText:/^Action blocked$/}).waitFor();
  assert.match(await page.locator('#governance-error-recovery').textContent(),/network|chain/i);
  assert.equal(await page.locator('[data-governance-support="1"]').isDisabled(),true);

  chainChanged=false;
  currentAccount=wallet.address.toLowerCase();
  await page.locator('#governance-connect').click();
  await page.locator('#governance-app-state[data-state="passed"]').waitFor();
  currentAccount=null;
  await assertProviderInvalidation('disconnect',{code:4900,message:'Provider disconnected'});
  await page.locator('#governance-connect').click();
  await page.locator('#governance-app-state').filter({hasText:/^Action blocked$/}).waitFor();
  assert.equal(await page.locator('[data-governance-support="1"]').isDisabled(),true);

  currentAccount=wallet.address.toLowerCase();
  await page.locator('#governance-connect').click();
  await page.locator('#governance-app-state[data-state="passed"]').waitFor();
   await page.locator('[data-420id-logout]').click();
   await page.locator('[data-420id-status]').filter({hasText:/Signed out of this app/}).waitFor();
   await page.locator('#governance-app-state').filter({hasText:/^Reload required$/}).waitFor();
   assert.equal((await context.cookies('https://wallet.420integrated.org')).some(cookie=>
     cookie.name==='__Host-app420_session'),false);
   assert.match(await page.locator('#governance-transaction-state').textContent(),/420ID/);
   assert.equal(await page.locator('[data-governance-support="1"]').isDisabled(),true);
   proof={...proof,accountChangedInvalidatesMountedGovernance:true,
     chainChangeAndDisconnectInvalidateMountedGovernance:true,
     appSSORevocationInvalidatesMountedGovernance:true};
 }
 assert.equal(transactions.length,before,'provider changes or logout submitted an unauthorized transaction');
 proof={...proof,signedEOATransactions:transactions,explicitDeviceApprovals:approvals};
 await fs.writeFile(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 console.log('GOV_PRE_08_CHROMIUM_420ID_NATIVE_GETH_EIP1193='+mode.toUpperCase()+'_PASS');
}catch(error){
 if(page.url()==='https://wallet.420integrated.org/'){
   const governance=await page.locator('#governance-management-panel').count();
   if(governance)console.error('Governance on failure:',
     await page.locator('#governance-app-state').textContent(),
     await page.locator('#governance-error-recovery').textContent());
 }
 throw error;
}finally{
 await browser.close();
}
