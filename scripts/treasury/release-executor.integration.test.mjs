/** Actual Anvil transactions: real Treasury/Vault/Registry/capability contracts, test-only token and recipients. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeReviewedPlan, verifyReleaseReceipt, recoverRelease } from './verify-release-receipt.mjs';
const require=createRequire(new URL('../../420-indexer/package.json',import.meta.url));
const {JsonRpcProvider,ContractFactory,ZeroAddress,ZeroHash,id,keccak256,toBeHex, toQuantity, AbiCoder}=require('ethers');
const rpc=new JsonRpcProvider(process.env.TREASURY_RPC_URL,undefined,{cacheTimeout:0,batchMaxCount:1});
rpc.pollingInterval=50;
const root=process.env.TREASURY_ROOT;
const T=id('420/TREASURY/COMPONENT/V1'), V=id('420/COMPONENT/VAULT/V1');
const EXEC=id('420/TREASURY/ACTION/EXECUTE_DISBURSEMENT/V1'), WITHDRAW=id('420/VAULT/ACTION/WITHDRAW/V1');
const CIVIC=id('rec4-civic'), PURPOSE=id('rec4-purpose'), VAULT=id('rec4-vault');
const CATEGORY=id('420/TREASURY/BUDGET/DEVELOPMENT/V1');
const TS=id('420/service/treasury/v1'), VS=id('420/service/vault/v1');
const A=id('rec4-auth'),S=id('rec4-asset'),R=id('rec4-release'),C=id('rec4-accounting');
const artifact=(name,source=name)=>JSON.parse(readFileSync(join(root,'out',source+'.sol',name+'.json')));
const send=async(p)=>{const tx=await p;const receipt=await tx.wait();assert.equal(receipt.status,1);return receipt;};
async function deploy(signer,name,args=[],source=name) {
  const a=artifact(name,source);
  const c=await new ContractFactory(a.abi,a.bytecode.object,signer).deploy(...args);
  await c.waitForDeployment();return c;
}
const addr=c=>c.target;
const bal=async(a)=>BigInt(await rpc.send('eth_getBalance',[a,'latest']));
const head=()=>rpc.send('eth_blockNumber',[]);
const failure=async(p)=>{await assert.rejects(async()=>{const tx=await p;await tx.wait();});};
let gov,op,attacker,recipient,registry,caps,ta,policy,budgets,disb,router,va,vp,vr,accounting,vaultRouter,vault,executor,token;
let seq=0;
async function setup(){
  [gov,op,attacker,recipient]=await Promise.all([0,1,2,3].map(i=>rpc.getSigner(i)));
  caps=await deploy(gov,'CapabilityRegistry420');
  await send(caps.registerProtocolComponent(T,gov.address));await send(caps.registerProtocolComponent(V,gov.address));
  registry=await deploy(gov,'ProtocolRegistry',[gov.address]);
  ta=await deploy(gov,'TreasuryAuthorization420',[addr(caps)]);
  policy=await deploy(gov,'TreasuryPolicyRegistry420',[gov.address]);
  budgets=await deploy(gov,'TreasuryBudgetRegistry420',[gov.address,addr(policy)]);
  disb=await deploy(gov,'TreasuryDisbursementRegistry420',[gov.address,addr(ta),addr(policy),addr(budgets)]);
  await send(budgets.setController(addr(disb)));
  router=await deploy(gov,'TreasuryRouter420',[addr(budgets),addr(disb)]);
  va=await deploy(gov,'VaultAuthorization420',[addr(caps)]);
  vp=await deploy(gov,'VaultPolicyRegistry420',[gov.address]);
  vr=await deploy(gov,'VaultRegistry420',[addr(va),addr(vp)]);
  accounting=await deploy(gov,'VaultAccounting420',[addr(vr)]);
  vaultRouter=await deploy(gov,'VaultRouter420',[addr(vr),addr(accounting),addr(va)]);
  for(const [key,kind] of [[A,'AUTHORIZATION'],[S,'ASSET'],[R,'RELEASE'],[C,'ACCOUNTING']]){
    await send(vp.setPolicy(key,id('420/VAULT/POLICY/'+kind+'/V1'),key,ZeroHash,true));
  }
  vault=await deploy(gov,'AssetVault420',[VAULT,addr(vr),addr(va),addr(accounting),gov.address]);
  await send(vr.registerVault(VAULT,addr(vault),id('420/VAULT/TYPE/TREASURY/V1'),A,S,R,C,ZeroHash,ZeroHash,ZeroHash));
  for(const [service,implementation] of [[TS,router],[VS,vaultRouter]]){
    await send(registry.publishRegisteredService(service,addr(implementation),CIVIC,1,true,2,A,S,R));
  }
  executor=await deploy(gov,'TreasuryReleaseExecutor420',[addr(registry),op.address]);
  token=await deploy(gov,'TreasuryReleaseSixDecimalToken420',[],'TreasuryReleaseTestFixtures420');
  await send(policy.setAssetPolicy(ZeroAddress,true,10n**20n,10n**22n,86400));
  await send(policy.setAssetPolicy(addr(token),true,10n**12n,10n**14n,86400));
  await send(vault.depositNative({value:10n**19n}));
  await send(token.mint(gov.address,10_000_000n));await send(token.approve(addr(vault),10_000_000n));
  await send(vault.depositToken(addr(token),10_000_000n));
}
async function schedule(asset=ZeroAddress,receiver=recipient.address,amount=10n, vaultId=VAULT){
  const budget=id('rec4-budget-'+(++seq));const block=await rpc.send('eth_getBlockByNumber',['latest',false]);
  const start=BigInt(block.timestamp)-1n,end=start+10000n;
  await send(budgets.createBudget(budget,vaultId,CATEGORY,asset,amount,start,end,CIVIC,S));
  const disbursementId=await disb.canonicalId(budget,receiver,amount,start,end,CIVIC,PURPOSE);
  await send(disb.schedule(disbursementId,budget,receiver,amount,start,end,CIVIC,PURPOSE));
  return {budget,disbursementId,asset,receiver,amount,vaultId};
}
async function grant(x,principal=addr(executor),treasury=true,vaultGrant=true){
  const g=id('rec4-treasury-grant-'+(++seq));
  if(treasury) await send(caps.createGrant(g,principal,T,EXEC,await ta.scopeForDisbursement(x.disbursementId),x.amount,0,0,0,0));
  if(vaultGrant) await send(caps.createGrant(id('rec4-vault-grant-'+(++seq)),principal,V,WITHDRAW,
    await va.scopeForRoute(x.vaultId,x.asset,x.receiver,WITHDRAW),x.amount,0,0,0,0));
  return g;
}
async function plan(x,e=executor){
  const [evidence,commitment]=await e.preview(x.disbursementId);
  const p={chainId:(await rpc.send('eth_chainId',[])),registry:addr(registry),executor:addr(e),
    executorCodeHash:keccak256(await rpc.send('eth_getCode',[addr(e),'latest'])),disbursementId:x.disbursementId,evidence,commitment};
  const decoded=decodeReviewedPlan(p);
  assert.equal(decoded.budgetId,x.budget);assert.equal(decoded.vaultId,x.vaultId);
  assert.equal(decoded.amount,x.amount);assert.equal(decoded.asset.toLowerCase(),x.asset.toLowerCase());
  assert.equal(decoded.recipient.toLowerCase(),x.receiver.toLowerCase());assert.equal(decoded.civicActionHash,CIVIC);
  assert.equal(decoded.purposeHash,PURPOSE);return p;
}
async function snapshot(x,p){
  const e=decodeReviewedPlan(p),b=await budgets.budget(x.budget),d=await disb.disbursement(x.disbursementId);
  const a=await accounting.getAccounting(x.vaultId,x.asset);
  const block=await rpc.send('eth_getBlockByNumber',['latest',false]);
  return {committed:b.committed,executed:b.executed,state:d.state,commitment:d.vaultReleaseHash,
    recorded:a.recordedBalance,released:a.released,reserved:a.reserved,claimable:a.claimable,
    operationUsed:await vault.executedOperation(e.operationId),
    epoch:await disb.epochSpent(x.asset,BigInt(block.timestamp)/86400n)};
}
const execute=(x,p,signer=op,e=executor)=>e.connect(signer).execute(x.disbursementId,p.commitment,{gasLimit:3_000_000});
const blockTag=n=>toQuantity(BigInt(n));
const corruptRPC=(method,change)=>({send:async(m,args)=>{
  const value=await rpc.send(m,args);return m===method?change(structuredClone(value)):value;
}});
test('Treasury REC-4 actual local execution and receipt qualification',async(t)=>{
  try{
    await setup();
    let native, tokenRelease;
    await t.test('native exact transfer, commitment, receipt linkage, interrupted result recovery and replay',async()=>{
      const x=await schedule(ZeroAddress,recipient.address,10n**18n+1n);await grant(x);const p=await plan(x);
      const from=await head(),before=await snapshot(x,p),beforeRecipient=await bal(x.receiver);
      assert.equal(before.state,1n);assert.equal(before.executed,0n);assert.equal(before.operationUsed,false);
      const noMatch=await recoverRelease(rpc,p,from,from);assert.equal(noMatch.status,'SCHEDULED_NO_MATCH_IN_RANGE');assert.equal(noMatch.automaticRetryAuthorized,false);
      const receipt=await send(execute(x,p)),after=await snapshot(x,p);
      assert.equal(await bal(x.receiver),beforeRecipient+x.amount);
      assert.equal(after.executed,x.amount);assert.equal(after.commitment,p.commitment);assert.equal(after.state,2n);
      assert.equal(after.recorded,before.recorded-x.amount);assert.equal(after.released,before.released+x.amount);
      assert.equal(after.epoch,before.epoch+x.amount);assert.equal(after.operationUsed,true);
      const evidence=await verifyReleaseReceipt(rpc,p,receipt.hash);assert.equal(evidence.status,'CORRELATED_AT_CHECKED_CANONICAL_BLOCK');
      assert.equal(evidence.blockHash,receipt.blockHash);assert.equal(evidence.logIndices.length,5);
      const recovered=await recoverRelease(rpc,p,from,await head());assert.equal(recovered.transactionHash,receipt.hash);
      await failure(execute(x,p));assert.deepEqual(await snapshot(x,p),after);
      assert.equal(await bal(addr(executor)),0n);assert.equal(await bal(addr(disb)),0n);
      native={x,p,receipt};
    });
    await t.test('six-decimal token transfer and exact receipt',async()=>{
      const x=await schedule(addr(token),recipient.address,1_000_001n);await grant(x);const p=await plan(x);
      const before=await token.balanceOf(x.receiver),s=await snapshot(x,p);
      const receipt=await send(execute(x,p));const a=await snapshot(x,p);
      assert.equal(await token.balanceOf(x.receiver),before+x.amount);assert.equal(await token.decimals(),6n);
      assert.equal(a.recorded,s.recorded-x.amount);assert.equal(a.executed,x.amount);
      assert.equal(await token.balanceOf(addr(executor)),0n);assert.equal(await token.balanceOf(addr(disb)),0n);
      assert.equal((await verifyReleaseReceipt(rpc,p,receipt.hash)).commitment,p.commitment);
      tokenRelease={x,p,receipt};
    });
    await t.test('unauthorized operator, absent independent grants, false and unrelated review commitment',async()=>{
      const x=await schedule();const p=await plan(x);const before=await snapshot(x,p);
      await failure(execute(x,p,attacker));await failure(execute(x,p));
      await grant(x,addr(executor),true,false);
      // Avoid reusing an existing Vault route grant for the same recipient from earlier tests:
      // create a fresh route on a different recipient.
      const isolated=await schedule(ZeroAddress,attacker.address,11n);const ip=await plan(isolated);
      await grant(isolated,addr(executor),true,false);
      const iBefore=await snapshot(isolated,ip);await failure(execute(isolated,ip));
      assert.deepEqual(await snapshot(isolated,ip),iBefore);
      await grant(isolated,addr(executor),false,true);
      await failure(execute(isolated,{...ip,commitment:ZeroHash}));
      await failure(execute(isolated,{...ip,commitment:native.p.commitment}));
      assert.deepEqual(await snapshot(isolated,ip),iBefore);
      assert.deepEqual(await snapshot(x,p),before);
      await send(execute(isolated,ip));
    });
    await t.test('failed Vault release leaves all state unchanged',async()=>{
      const reject=await deploy(gov,'TreasuryReleaseRejectingRecipient420',[],'TreasuryReleaseTestFixtures420');
      const x=await schedule(ZeroAddress,addr(reject),10n);await grant(x);const p=await plan(x);
      const before=await snapshot(x,p);await failure(execute(x,p));assert.deepEqual(await snapshot(x,p),before);
      const underfunded=await schedule(ZeroAddress,recipient.address,10n**20n);
      await assert.rejects(executor.preview(underfunded.disbursementId));
      assert.equal((await disb.disbursement(underfunded.disbursementId)).state,1n);
    });
    await t.test('Treasury rejection after real withdrawal rolls back transfer, capability revocation and operation',async()=>{
      const revoker=await deploy(gov,'TreasuryReleaseRevokingRecipient420',[addr(caps)],'TreasuryReleaseTestFixtures420');
      const x=await schedule(ZeroAddress,addr(revoker),123n);const g=await grant(x);const p=await plan(x);
      await send(revoker.configure(g,true));await send(caps.updateProtocolComponentAuthority(T,addr(revoker)));
      const before=await snapshot(x,p),recipientBefore=await bal(addr(revoker));
      await failure(execute(x,p));assert.deepEqual(await snapshot(x,p),before);
      assert.equal(await bal(addr(revoker)),recipientBefore);
      assert.equal(await ta.isDisbursementAuthorized(addr(executor),x.disbursementId,EXEC,x.amount),true);
      // Restore the review context and retry exactly the same operation after the failure.
      await send(revoker.configure(g,false));await send(caps.updateProtocolComponentAuthority(T,gov.address));
      const receipt=await send(execute(x,p));
      assert.equal(await bal(addr(revoker)),recipientBefore+x.amount);
      assert.equal((await verifyReleaseReceipt(rpc,p,receipt.hash)).commitment,p.commitment);
    });
    await t.test('injected real budget accounting failure after Vault transfer is atomic and retryable',async()=>{
      const x=await schedule(ZeroAddress,recipient.address,29n);await grant(x);const p=await plan(x);
      const e=decodeReviewedPlan(p);
      // Fault injection only: corrupt the real budget committed field via the compiled
      // storage layout, to force the real BudgetRegistry.settle to reject after withdrawal.
      const layout=artifact('TreasuryBudgetRegistry420').storageLayout;
      const mapping=layout.storage.find(v=>v.label==='_budgets');
      const valueType=layout.types[layout.types[mapping.type].value];
      const member=valueType.members.find(v=>v.label==='committed');
      const base=BigInt(keccak256(AbiCoder.defaultAbiCoder().encode(['bytes32','uint256'],[x.budget,BigInt(mapping.slot)])));
      const slot=toQuantity((base+BigInt(member.slot))%(1n<<256n));
      const original=await rpc.send('eth_getStorageAt',[addr(budgets),slot,'latest']);
      const shift=BigInt(member.offset)*8n;
      const bits=BigInt(layout.types[member.type].numberOfBytes)*8n;
      const mask=((1n<<bits)-1n)<<shift;
      await rpc.send('anvil_setStorageAt',[addr(budgets),slot,toBeHex(BigInt(original)&~mask,32)]);
      assert.equal((await budgets.budget(x.budget)).committed,0n);
      const before=await snapshot(x,p),recipientBefore=await bal(x.receiver);
      await assert.rejects(executor.connect(op).execute.staticCall(x.disbursementId,p.commitment),
        err=>err.data===budgets.interface.getError('BudgetExceeded').selector);
      await failure(execute(x,p));assert.deepEqual(await snapshot(x,p),before);
      assert.equal(await bal(x.receiver),recipientBefore);
      assert.equal(await vault.executedOperation(e.operationId),false);
      await rpc.send('anvil_setStorageAt',[addr(budgets),slot,original]);
      const receipt=await send(execute(x,p));
      assert.equal((await verifyReleaseReceipt(rpc,p,receipt.hash)).commitment,p.commitment);
    });
    await t.test('historic split release is detected and not automatically repeated or settled',async()=>{
      const x=await schedule(ZeroAddress,recipient.address,37n);await grant(x);const p=await plan(x);
      const e=decodeReviewedPlan(p);await grant(x,attacker.address,false,true);
      const from=await head();
      await send(vault.connect(attacker).withdraw(e.operationId,e.asset,e.recipient,e.amount));
      const before=await snapshot(x,p);assert.equal(before.state,1n);assert.equal(before.operationUsed,true);
      const found=await recoverRelease(rpc,p,from,await head());
      assert.equal(found.status,'MANUAL_RECONCILIATION_REQUIRED');assert.equal(found.automaticRetryAuthorized,false);
      await failure(execute(x,p));assert.deepEqual(await snapshot(x,p),before);
      const rotated=await deploy(gov,'TreasuryReleaseExecutor420',[addr(registry),op.address]);
      assert.equal(await rotated.operationId(addr(disb),x.disbursementId),e.operationId);
    });
    await t.test('mismatched or false evidence rejected by receipt utility, registry remains commitment-only',async()=>{
      const {x,p,receipt}=native;
      await assert.rejects(verifyReleaseReceipt(rpc,{...p,commitment:id('false')},receipt.hash));
      await assert.rejects(verifyReleaseReceipt(rpc,{...p,chainId:'0x1'},receipt.hash));
      await assert.rejects(verifyReleaseReceipt(rpc,{...p,executorCodeHash:id('wrong code')},receipt.hash));
      await assert.rejects(verifyReleaseReceipt(rpc,p,id('unrelated transaction')));
      await assert.rejects(verifyReleaseReceipt(rpc,p,tokenRelease.receipt.hash));
      await assert.rejects(verifyReleaseReceipt(corruptRPC('eth_getTransactionReceipt',r=>{
        r.logs=r.logs.filter(l=>l.address.toLowerCase()!==addr(vault).toLowerCase());return r;
      }),p,receipt.hash),/missing or duplicate Withdrawal/);
      await assert.rejects(verifyReleaseReceipt(corruptRPC('eth_getTransactionReceipt',r=>{
        r.logs.push(structuredClone(r.logs.at(-1)));return r;
      }),p,receipt.hash),/duplicate/);
      await assert.rejects(verifyReleaseReceipt(corruptRPC('eth_getTransactionReceipt',r=>{
        r.blockHash=id('orphaned block');return r;
      }),p,receipt.hash),/canonical block/);
      await assert.rejects(verifyReleaseReceipt(corruptRPC('eth_getTransactionReceipt',r=>{
        r.logs.at(-1).transactionHash=id('other transaction');return r;
      }),p,receipt.hash),/log provenance/);
      const legacy=await schedule(ZeroAddress,recipient.address,19n);const lp=await plan(legacy);
      await grant(legacy,attacker.address,true,false);
      const forged=await send(disb.connect(attacker).markExecuted(legacy.disbursementId,id('arbitrary nonzero commitment')));
      assert.equal((await disb.disbursement(legacy.disbursementId)).state,2n);
      await assert.rejects(verifyReleaseReceipt(rpc,lp,forged.hash));
      assert.equal((await recoverRelease(rpc,lp,blockTag(forged.blockNumber),await head())).status,'MANUAL_RECONCILIATION_REQUIRED');
      assert.equal((await disb.disbursement(x.disbursementId)).vaultReleaseHash,p.commitment);
    });
  }finally{rpc.destroy();}
});
