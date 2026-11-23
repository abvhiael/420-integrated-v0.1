// Real Chromium EIP-1193 Wallet Governance against the *running* chain420.
// All wallet keys and SSO account responses in this harness are disposable
// LOCAL qualification fixtures. Live 420ID is tested in the Go SSO suite.
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
let identity={authenticated:true,app:'420wallet',
 subject:'12345678-1234-4123-8123-123456789abc',
 financialAuthority:false,permissions:[]};
const transactions=[];
let approvals=0;
const pending=arg('pending-output',true);
async function providerRequest(method,params=[]){
 if(['eth_accounts','eth_requestAccounts'].includes(method))return [currentAccount];
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

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();
page.on('dialog',dialog=>dialog.accept());
await page.exposeBinding('nativeWallet420',(_,method,params)=>providerRequest(method,params));
await page.addInitScript(()=>{
 const handlers=new Map();
 window.ethereum={
   request:({method,params=[]})=>window.nativeWallet420(method,params),
   on(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn)},
   removeListener(name,fn){handlers.get(name)?.delete(fn)}
 };
 window.__walletEvent=(name,value)=>{for(const handler of handlers.get(name)||[])handler(value)};
});
const runtime={
 schema:'420-wallet-runtime-config-v1',
 network:{name:'GOV-PRE-08 local chain420',chainId:'0x1a4',rpcUrl},
 identitySession:{app:'420wallet',enabled:true,gatewayPath:'/420id-api',authority:'confidential-app-gateway-only'},
 governance:{indexerUrl:'https://wallet.420integrated.org',
   discovery:{source:'protocol-registry',serviceId:'420/service/governance/v1',revision:1,
   registryAddress:'0x0000000000000000000000000000000000000434',
   modules:civic,componentIds:Object.fromEntries(Object.keys(civic).map(x=>[x,graph.walletCanonicalComponentIds[x]]))}}
};
await page.route('https://wallet.420integrated.org/**',async route=>{
 const request=new URL(route.request().url());
 if(request.pathname==='/runtime-config.json')return route.fulfill({json:runtime});
 if(request.pathname==='/420id-api/auth/session')return route.fulfill({json:identity});
 if(request.pathname==='/420id-api/auth/logout'){
   identity={authenticated:false};return route.fulfill({json:{signedOut:true}});
 }
 if(request.pathname==='/v1/protocols/events'){
   return route.fulfill({json:{items:proposalId?[{eventName:'CivicProposalRegistered',fields:{proposalId}}]:[]}});
 }
 const relative=path.normalize(decodeURIComponent(request.pathname==='/'?'/index.html':request.pathname)).replace(/^\/+/, '');
 const base=path.resolve(ROOT,'wallet/web');
 const file=path.resolve(base,relative);
 if(!file.startsWith(base+path.sep))return route.fulfill({status:403});
 try{
   const bytes=await fs.readFile(file);
   return route.fulfill({body:bytes,contentType:{
     '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
     '.css':'text/css','.json':'application/json','.svg':'image/svg+xml',
     '.png':'image/png'}[path.extname(file)]||'application/octet-stream'});
 }catch{return route.fulfill({status:404})}
});
