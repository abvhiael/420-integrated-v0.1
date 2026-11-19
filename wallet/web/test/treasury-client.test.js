import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256Hex} from '../core/keccak.js';
import {createTreasuryClient420, TREASURY_SERVICE_ID_420, TREASURY_ROUTER_COMPONENT_420, TREASURY_EXECUTION_ACTION_420} from '../core/treasury-client.js';
import {prepareTreasuryWalletRelease420, submitTreasuryWalletRelease420, treasuryWalletReceipt420, reviewGovernedTreasuryBatch420} from '../core/treasury-handoff.js';
import {resolveServices} from '../core/services.js';
import {GENESIS_APP_SERVICES} from '../core/genesis-app-catalog.js';

const A=n=>'0x'+n.toString(16).padStart(40,'0');
const H=n=>'0x'+n.toString(16).padStart(64,'0');
const h=s=>keccak256Hex(new TextEncoder().encode(s));
const hb=s=>keccak256Hex(Uint8Array.from(s.slice(2).match(/../g),x=>parseInt(x,16)));
const w=v=>(typeof v==='string'&&v.startsWith('0x')?v.slice(2):BigInt(v).toString(16)).padStart(64,'0');
const abi=(...values)=>'0x'+values.map(w).join('');
const enc=(sig,...values)=>h(sig).slice(0,10)+values.map(w).join('');
const str=s=>'0x'+w(32)+w(s.length)+Buffer.from(s).toString('hex').padEnd(Math.ceil(s.length/32)*64,'0');
const registry=A(0x434),timelock=A(0x429),router=A(1),budgets=A(2),disb=A(3),policy=A(4),auth=A(5),cap=A(6),executor=A(7),owner=A(8),account=A(9),recipient=A(10),vault=A(11),asset=A(0),budget=H(12),civic=H(13),purpose=H(14),vaultId=H(15);
const blockHash=H(90),txHash=H(91),code='0x60016000',codeHash=hb(code),sid=h(TREASURY_SERVICE_ID_420),cid=h(TREASURY_ROUTER_COMPONENT_420);
const disbursement=hb(abi(h('420/TREASURY/DISBURSEMENT/V1'),budget,recipient,42n,100n,200n,civic,purpose));
const evidence=abi(420n,registry,router,1n,A(16),1n,disb,budgets,A(17),disbursement,budget,vaultId,vault,codeHash,asset,recipient,42n,civic,purpose,executor,account,H(18));
const commitment=hb('0x'+w(h('420/TREASURY/VAULT_RELEASE_COMMITMENT/V1'))+evidence.slice(2));
const state={deployed:true,controller:owner,owner,controllerIsOwner:true,smartAccount:account,factoryAddress:A(60),entryPoint:A(61),capabilityRegistry:cap,expectedChainId:'0x1a4'};

function fixture(overrides={}) {
 const calls=[],answers=new Map();
 const put=(to,sig,values,result)=>answers.set(to+enc(sig,...values),result);
 for(const [address,name,version] of [[registry,'ProtocolRegistry',4],[router,'TreasuryRouter420',1],[budgets,'TreasuryBudgetRegistry420',1],[disb,'TreasuryDisbursementRegistry420',1],[policy,'TreasuryPolicyRegistry420',1],[auth,'TreasuryAuthorization420',1]]) {
   put(address,'systemName()',[],str(name));put(address,'protocolVersion()',[],abi(version));
 }
 put(registry,'getService(bytes32)',[sid],abi(router,codeHash,H(80),1,10,1));
 put(registry,'resolveActive(bytes32)',[sid],abi(router,1));
 put(registry,'component(bytes32)',[cid],abi(cid,router,codeHash,1,0,0,2));
 put(registry,'resolve(bytes32)',[cid],abi(router));
 put(registry,'getRegistrationProfile(bytes32,uint32)',[sid,1],abi(3,H(81),hb(abi(cap,auth,policy,budgets,disb,router,codeHash,codeHash,codeHash,codeHash,codeHash)),H(83)));
 for(const [address,sig,value] of [[router,'budgets()',budgets],[router,'disbursements()',disb],[budgets,'policy()',policy],[disb,'authorization()',auth],[disb,'budgets()',budgets],[disb,'policy()',policy],[budgets,'controller()',disb],[auth,'capabilityRegistry()',cap],[executor,'registry()',registry],[executor,'operator()',account],[account,'owner()',owner]])put(address,sig,[],abi(value));
 for(const target of [budgets,disb,policy])put(target,'governanceTimelock()',[],abi(timelock));
 put(disb,'disbursement(bytes32)',[disbursement],abi(budget,recipient,asset,42,100,200,civic,purpose,H(0),1,1));
 put(budgets,'budget(bytes32)',[budget],abi(vaultId,H(19),asset,1000,42,0,90,300,civic,H(20),1,1));
 put(router,'isExecutable(bytes32)',[disbursement],abi(1));
 put(auth,'isDisbursementAuthorized(address,bytes32,bytes32,uint256)',[executor,disbursement,h(TREASURY_EXECUTION_ACTION_420),42],abi(1));
 put(executor,'preview(bytes32)',[disbursement],abi(64,commitment,704)+evidence.slice(2));
 const provider={request:async(method,params=[])=>{
   calls.push([method,params]);
   if(method==='eth_chainId')return overrides.chain??'0x1a4';
   if(method==='eth_getBlockByNumber')return {number:'0x5',hash:overrides.blockHash??blockHash};
   if(method==='eth_getCode')return overrides.badCode===params[0]?'0x6002':code;
   if(method==='eth_accounts')return overrides.accounts??[owner];
   if(method==='eth_call'){
     const t=params[0],key=t.to+t.data;
     if(overrides.simFail&&t.to===account&&t.from)throw new Error('execution reverted');
     if(t.to===account&&t.from)return '0x';
     if(!answers.has(key))throw new Error('unhandled '+key);
     return answers.get(key);
   }
   if(method==='eth_estimateGas')return '0x5208';
   if(method==='eth_sendTransaction')return txHash;
   if(method==='eth_getTransactionReceipt')return overrides.receipt??null;
   if(method==='eth_blockNumber')return '0x5';
   throw new Error(method);
 }};
 const client=createTreasuryClient420({provider,chainId:'0x1a4',registryCodeHash:codeHash,releaseExecutor:overrides.noExecutor?null:{address:executor,codeHash}});
 return {client,provider,calls,put,overrides};
}
test('Treasury verifies separate Registry service and component namespaces and actual constructor graph',async()=>{
 const f=fixture();const ctx=await f.client.discover();assert.equal(ctx.disbursements,disb);assert.equal(ctx.capabilityRegistry,cap);
 const d=await f.client.disbursement(disbursement);assert.equal(d.amount,42n);assert.equal(d.independentTransferVerified,false);assert.equal(d.asset,asset);
});
test('wrong chain, Registry runtime, component and controller mismatches reject without simulation',async()=>{
 for(const f of [fixture({chain:'0x2'}),fixture({badCode:registry}),fixture({badCode:router})])await assert.rejects(f.client.discover());
 const f=fixture();f.put(registry,'component(bytes32)',[cid],abi(cid,budgets,codeHash,1,0,0,2));
 await assert.rejects(f.client.discover(),/component binding/);
 const g=fixture();g.put(budgets,'controller()',[],abi(executor));await assert.rejects(g.client.discover(),/constructor graph/);
 const j=fixture();j.put(registry,'getRegistrationProfile(bytes32,uint32)',[sid,1],abi(3,H(81),H(82),H(83)));await assert.rejects(j.client.discover(),/dependency root mismatch/);
 await assert.rejects(fixture({badCode:policy}).client.discover(),/dependency root mismatch/);
});
test('governed action preparation is typed, exact canonical ID and never broadcasts',async()=>{
 const {client,calls}=fixture();
 const prepared=await client.prepareGovernedAction({kind:'schedule',budgetId:budget,recipient,amount:42n,notBefore:100n,expiresAt:200n,civicActionHash:civic,purposeHash:purpose});
 assert.equal(prepared.action.target,disb);assert.equal(prepared.action.data,enc('schedule(bytes32,bytes32,address,uint128,uint64,uint64,bytes32,bytes32)',disbursement,budget,recipient,42,100,200,civic,purpose));
 const p=await client.prepareGovernedAction({kind:'setAssetPolicy',asset,allowed:true,maxSingle:'100',maxEpoch:'200',epochSeconds:'86400'});
 assert.equal(p.action.target,policy);
 const b=await client.prepareGovernedAction({kind:'createBudget',budgetId:budget,vaultId,category:H(22),asset,ceiling:'100',validFrom:'90',validUntil:'300',civicActionHash:civic,metadataHash:H(0)});
 assert.equal(b.action.target,budgets);
 const c=await client.prepareGovernedAction({kind:'cancel',disbursementId:disbursement});
 assert.equal(c.action.data,enc('cancel(bytes32)',disbursement));
 await assert.rejects(client.prepareGovernedAction({kind:'markExecuted'}),/unsupported/);
 await assert.rejects(client.prepareGovernedAction({kind:'schedule',disbursementId:H(99),budgetId:budget,recipient,amount:42n,notBefore:100n,expiresAt:200n,civicActionHash:civic,purposeHash:purpose}),/supplied id mismatch/);
 assert.ok(!calls.some(([m])=>m==='eth_sendTransaction'));
 const result=await reviewGovernedTreasuryBatch420({verifySession:async()=>({chainId:420n}),reviewActionBatch:async(id,actions)=>({id,actions,matchesCommitment:true})},H(33),[prepared]);
 assert.equal(result.matchesCommitment,true);assert.deepEqual(result.actions,[prepared.action]);
});
test('release preparation rejects absent deployment, inadequate capability, substituted preview and operator',async()=>{
 const f=fixture();const r=await f.client.prepareRelease(disbursement,account);assert.equal(r.commitment,commitment);assert.equal(r.data,enc('execute(bytes32,bytes32)',disbursement,commitment));assert.equal(r.independentTransferVerified,false);
 await assert.rejects(fixture({noExecutor:true}).client.prepareRelease(disbursement,account),/not configured/);
 await assert.rejects(f.client.prepareRelease(disbursement,owner),/binding mismatch/);
 f.put(auth,'isDisbursementAuthorized(address,bytes32,bytes32,uint256)',[executor,disbursement,h(TREASURY_EXECUTION_ACTION_420),42],abi(0));
 await assert.rejects(f.client.prepareRelease(disbursement,account),/capability denied/);
 const g=fixture();g.put(executor,'preview(bytes32)',[disbursement],abi(64,H(55),704)+evidence.slice(2));await assert.rejects(g.client.prepareRelease(disbursement,account),/commitment mismatch/);
});
test('release simulation and explicit confirmation precede any user-approved Wallet send',async()=>{
 const f=fixture();const r=await prepareTreasuryWalletRelease420(f.provider,owner,state,f.client,disbursement);
 assert.equal(r.transaction.to,account);assert.equal(r.target,executor);assert.equal(r.simulation.passed,true);
 await assert.rejects(submitTreasuryWalletRelease420(f.provider,owner,state,f.client,disbursement),/explicit Treasury confirmation/);
 await assert.rejects(submitTreasuryWalletRelease420(f.provider,owner,state,f.client,disbursement,async()=>false),/confirmation rejected/);
 assert.equal(f.calls.filter(x=>x[0]==='eth_sendTransaction').length,0);
 const sent=await submitTreasuryWalletRelease420(f.provider,owner,state,f.client,disbursement,async reviewed=>reviewed.review.commitment===commitment);
 assert.equal(sent.txHash,txHash);assert.equal(f.calls.filter(x=>x[0]==='eth_sendTransaction').length,1);
 const pending=await treasuryWalletReceipt420(f.provider,sent);assert.equal(pending.status,'pending');
 f.overrides.receipt={transactionHash:txHash,status:'0x0',blockHash,blockNumber:'0x5',to:account,from:owner};
 const reverted=await treasuryWalletReceipt420(f.provider,sent);assert.equal(reverted.status,'reverted');assert.equal(reverted.independentTransferVerified,false);
 f.overrides.receipt={...f.overrides.receipt,status:'0x1'};assert.equal((await treasuryWalletReceipt420(f.provider,sent)).status,'confirmed');
 f.overrides.receipt={...f.overrides.receipt,blockHash:H(99)};assert.equal((await treasuryWalletReceipt420(f.provider,sent)).status,'reorganized');
});
test('failed simulation, account change or chain change after review cannot broadcast',async()=>{
 const f=fixture({simFail:true});await assert.rejects(prepareTreasuryWalletRelease420(f.provider,owner,state,f.client,disbursement),/simulation reverted/);
 const g=fixture();await assert.rejects(submitTreasuryWalletRelease420(g.provider,owner,state,g.client,disbursement,async()=>{g.overrides.chain='0x2';return true;}),/wrong Treasury chain/);
 const z=fixture();await assert.rejects(submitTreasuryWalletRelease420(z.provider,owner,state,z.client,disbursement,async()=>{z.overrides.accounts=[recipient];return true;}),/no longer authorized/);
 for(const x of [f,g,z])assert.ok(!x.calls.some(([m])=>m==='eth_sendTransaction'));
});
test('Treasury covered protocol cannot launch from manifest-only URL',()=>{
 const service=GENESIS_APP_SERVICES.find(x=>x.id==='treasury');
 assert.equal(service.classification,'COVERED_PROTOCOL');
 const [resolved]=resolveServices({schema:'420-ecosystem-manifest-v1',verified:true,services:[{...service,url:'https://unverified.example/'}]},[service]);
 assert.equal(resolved.available,false);assert.equal(resolved.url,null);
});
