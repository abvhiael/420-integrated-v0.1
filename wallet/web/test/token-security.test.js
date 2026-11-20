import test from 'node:test';
import assert from 'node:assert/strict';
import {createTokenDiscoverySession420,TOKEN_TEMPLATES_420,encodeTokenManagement420,describeTokenManagementRisk420} from '../core/token-app.js';
import {tokenHashText420,tokenReadCall420} from '../core/token-sdk.js';
import {ZERO_ADDRESS} from '../core/abi.js';
import {connected,enableTokenPortfolioFixture420,portfolioRecord420,enableTokenManagementFixture420} from './token-connected-fixture.js';
import {account,controller,addr,abi} from './token-test-fixture.js';
const profiles=Object.fromEntries(TOKEN_TEMPLATES_420.map(p=>[p.key,p])),spender=addr(91),to=addr(90),holder=addr(92),MAX=2n**256n-1n;
const setup=async(profile='ERC20_FIXED',owner=account)=>{
  const f=connected(),row=portfolioRecord420(1,profiles[profile],account,owner),pc=enableTokenPortfolioFixture420(f,[row]),mc=enableTokenManagementFixture420(f,pc),session=createTokenDiscoverySession420();
  const refresh=()=>session.refresh({provider:f.provider,config:f.config,controller,smartAccount:f.selected});
  assert.equal((await refresh()).status,'verified');const portfolio=await session.refreshPortfolio();assert.ok(portfolio,session.getPortfolio().error);
  return {f,row,pc,mc,session,item:portfolio.items[0]};
};
const expect=(s,action,params,events)=>{const op=encodeTokenManagement420(s.item,account,action,params);s.mc.expect(s.row,op.data,events??op.events,op.boolReturn);return op;};
const approve=(session,q)=>session.authorizeManagement(q,()=>true,q.security.acknowledgement);
const events=(sig,topics,data='0x')=>[{topics:[tokenHashText420(sig),...topics],data}];
const noSend=f=>assert.equal(f.calls.filter(([method])=>method==='eth_sendTransaction').length,0);
test('targeted owner and permission lookup across all eight profiles is immutable and read-only, not an inventory',async()=>{
  for(const p of TOKEN_TEMPLATES_420){const s=await setup(p.key);s.mc.allowance=MAX;s.mc.operator=true;s.mc.nftApproved=spender;s.mc.delegate=spender;s.mc.permitNonce=17n;
    const v=await s.session.inspectManagementPermissions(s.item,{spender,...(p.standard==='ERC20'?{}:{id:'7'})});
    assert.equal(v.authority,'PERMISSION_SNAPSHOT_ONLY');assert.equal(v.owner,account);assert.equal(v.account,account);assert.equal(v.chainId,420);assert.ok(Object.isFrozen(v)&&Object.isFrozen(v.revocations)&&v.revocations.every(x=>Object.isFrozen(x.params)));
    if(p.standard==='ERC20'){assert.equal(v.allowance,MAX.toString());assert.deepEqual(v.revocations[0].params,{spender,amount:'0'});assert.equal(v.permitNonce,p.permit?'17':null);assert.equal(v.delegation,p.votes?spender:null);}
    else {assert.equal(v.operator,true);assert.deepEqual(v.revocations[0].params,{spender,approved:'false'});if(p.standard==='ERC721'){assert.equal(v.nftOwner,account);assert.equal(v.nftApproved,spender);assert.deepEqual(v.revocations[1].params,{spender:ZERO_ADDRESS,id:'7'});}else assert.equal(v.nftOwner,null);}
    assert.ok(s.f.calls.every(([m])=>! /send|sign|requestAccounts/i.test(m)));
  }
});
test('transferred or renounced owner does not grant token ownership, NFT holder authority or collection revocation',async()=>{
  for(const owner of [holder,ZERO_ADDRESS]){const s=await setup('ERC20_FIXED',owner);const v=await s.session.inspectManagementPermissions(s.item,{spender});assert.equal(v.ownership,owner===ZERO_ADDRESS?'renounced':'transferred');assert.ok(v.revocations.some(r=>r.action==='approve'));assert.equal(v.owner,owner);await assert.rejects(s.session.reviewManagement(s.item,'transferOwnership',{to}));noSend(s.f);}
  const s=await setup('ERC721_COLLECTION',holder);s.mc.nftHolder=holder;s.mc.nftApproved=account;s.mc.operator=false;
  const v=await s.session.inspectManagementPermissions(s.item,{spender,id:'7'});assert.equal(v.nftOwner,holder);assert.equal(v.nftApproved,account);assert.equal(v.nftOperatorForHolder,false);assert.equal(v.revocations.length,0);
  s.mc.operator=true;assert.ok((await s.session.inspectManagementPermissions(s.item,{id:'7'})).revocations.some(r=>r.label==='Revoke NFT-specific approval'));
  noSend(s.f);
});
test('exact revocation targets and zero values use ordinary Wallet approval and canonical confirmation, not local cancellation',async()=>{
  const cases=[
    ['ERC20_FIXED','approve',{spender,amount:'0'},events('Approval(address,address,uint256)',[abi(account),abi(spender)],abi(0))],
    ['ERC721_COLLECTION','approve',{spender:ZERO_ADDRESS,id:'7'},events('Approval(address,address,uint256)',[abi(account),abi(ZERO_ADDRESS),abi(7)])],
    ['ERC721_COLLECTION','setApprovalForAll',{spender,approved:'false'},events('ApprovalForAll(address,address,bool)',[abi(account),abi(spender)],abi(0))],
    ['ERC1155_MULTI','setApprovalForAll',{spender,approved:'false'},events('ApprovalForAll(address,address,bool)',[abi(account),abi(spender)],abi(0))],
    ['ERC20_VOTES','delegate',{to:ZERO_ADDRESS},events('DelegateChanged(address,address,address)',[abi(account),abi(spender),abi(ZERO_ADDRESS)])]
  ];
  for(const [profile,action,params,expectedEvents] of cases){const s=await setup(profile);s.mc.operator=true;s.mc.nftApproved=spender;s.mc.delegate=spender;
    const v=await s.session.inspectManagementPermissions(s.item,{spender,...(profile==='ERC721_COLLECTION'?{id:'7'}:{})});
    assert.ok(v.revocations.some(r=>r.action===action&&Object.entries(params).every(([k,val])=>r.params[k]===val)));
    expect(s,action,params,expectedEvents);
    const q=await s.session.reviewManagement(s.item,action,params);assert.equal(q.security.classification,'revocation');assert.equal(q.security.acknowledgement,null);
    const approval=await s.session.authorizeManagement(q);noSend(s.f);const hash=await s.session.submitManagement(approval);assert.ok(hash);assert.equal((await s.session.checkTransaction(hash)).status,'confirmed');assert.equal(s.f.calls.filter(([method])=>method==='eth_sendTransaction').length,1);
  }
});
test('risk disclosures cover unlimited, allowance replacement, burn grant, operator, NFT and irreversible ownership',async()=>{
  const s=await setup('ERC20_BURNABLE');s.mc.allowance=1n;
  const max=(MAX/10n**18n).toString()+'.'+(MAX%10n**18n).toString().padStart(18,'0');
  const q=expect(s,'approve',{spender,amount:max});const v=await s.session.reviewManagement(s.item,'approve',{spender,amount:max});
  assert.equal(v.security.acknowledgement,'GRANT PERMISSION');assert.match(v.security.warnings.join(' '),/Unlimited allowance/);assert.match(v.security.warnings.join(' '),/old and new/);assert.match(v.security.warnings.join(' '),/burnFrom/);assert.equal(q.params.amount,MAX.toString());
  await assert.rejects(s.session.authorizeManagement(v),/acknowledgement/);
  const cases=[['ERC20_FIXED','renounceOwnership',{},'RENOUNCE OWNERSHIP'],['ERC20_FIXED','transferOwnership',{to},'TRANSFER OWNERSHIP'],['ERC721_COLLECTION','approve',{spender,id:'7'},'GRANT PERMISSION'],['ERC1155_MULTI','setApprovalForAll',{spender,approved:'true'},'GRANT PERMISSION'],['ERC20_VOTES','delegate',{to},'DELEGATE VOTES'],['ERC20_BURNABLE','burn',{amount:'1'},'BURN TOKENS']];
  for(const [p,action,params,phrase] of cases){const c=await setup(p);expect(c,action,params);const review=await c.session.reviewManagement(c.item,action,params);assert.equal(review.security.acknowledgement,phrase);await assert.rejects(c.session.authorizeManagement(review,()=>true,phrase.toLowerCase()),/acknowledgement/);
    const fresh=await c.session.reviewManagement(c.item,action,params);assert.ok(await c.session.authorizeManagement(fresh,()=>true,phrase));noSend(c.f);}
});
test('permission or risk state changes, owner, controller epoch, recovery state and destination code changes invalidate approval',async()=>{
  for(const mode of ['allowance','destination','owner','epoch','policy','recovery','accountCode','chain','genesis']){
    const s=await setup();expect(s,'approve',{spender,amount:'1'});const review=await s.session.reviewManagement(s.item,'approve',{spender,amount:'1'}),approval=await approve(s.session,review);
    if(mode==='allowance')s.mc.allowance=0n;if(mode==='destination')s.f.codes.set(spender,'0x6001');if(mode==='owner')s.pc.rows[0].owner=holder;
    if(mode==='epoch')s.f.control.epoch++;if(mode==='policy')s.f.control.policyVersion++;if(mode==='recovery'){s.f.control.pendingRecoveryOwner=holder;s.f.control.recoveryExecutableAt=100;}
    if(mode==='accountCode')s.f.control.accountCode='0x6003';if(mode==='chain')s.f.tokenControl.chain='0x1';if(mode==='genesis')s.f.tokenControl.genesisHash='0x'+'a'.repeat(64);
    await assert.rejects(s.session.submitManagement(approval),undefined,mode);noSend(s.f);
  }
});
test('a new review, explicit cancellation or revoked in-flight review/approval prevents broadcast',async()=>{
  for(const mode of ['newReview','cancel','revokeQuote','inFlightAuthorize','inFlightSubmit']){
    const s=await setup();expect(s,'transferOwnership',{to});const review=await s.session.reviewManagement(s.item,'transferOwnership',{to});
    if(mode==='newReview'){await s.session.reviewManagement(s.item,'transferOwnership',{to});await assert.rejects(approve(s.session,review));}
    if(mode==='cancel'||mode==='revokeQuote'){mode==='cancel'?s.session.cancelManagement():s.session.revokeManagement(review);await assert.rejects(approve(s.session,review));}
    if(mode.startsWith('inFlight')){
      const a=mode==='inFlightSubmit'?await approve(s.session,review):null;let release,entered;const gate=new Promise(r=>release=r),inRead=new Promise(r=>entered=r);let first=true;
      s.mc.onRead=async()=>{if(first){first=false;entered();await gate;}};
      const pending=mode==='inFlightSubmit'?s.session.submitManagement(a):approve(s.session,review);await inRead;s.session.revokeManagement(a??review);release();await assert.rejects(pending);
    }
    noSend(s.f);
  }
});
test('malformed, forged, reorganized and stale permission lookup fails closed without authority',async()=>{
  const s=await setup('ERC721_COLLECTION');
  await assert.rejects(s.session.inspectManagementPermissions({...s.item},{spender}));
  await assert.rejects(s.session.inspectManagementPermissions(s.item,{spender:'0x123'}));
  await assert.rejects(s.session.inspectManagementPermissions(s.item,{id:'1e3'}));
  s.mc.operatorRaw=2;await assert.rejects(s.session.inspectManagementPermissions(s.item,{spender}),/Malformed permission flag/);s.mc.operatorRaw=null;
  s.pc.reorg=true;await assert.rejects(s.session.inspectManagementPermissions(s.item,{spender}));s.pc.reorg=false;
  let release,entered;const gate=new Promise(r=>release=r),inRead=new Promise(r=>entered=r);let first=true;
  s.mc.onRead=async()=>{if(first){first=false;entered();await gate;}};const pending=s.session.inspectManagementPermissions(s.item,{spender});await inRead;s.session.invalidate();release();await assert.rejects(pending);noSend(s.f);
});
test('duplicate receipt log index cannot establish canonical management permission change',async()=>{
  const s=await setup();expect(s,'approve',{spender,amount:'0'});const q=await s.session.reviewManagement(s.item,'approve',{spender,amount:'0'}),a=await approve(s.session,q),hash=await s.session.submitManagement(a);s.mc.duplicateEvent=true;
  assert.equal(await s.session.checkTransaction(hash),null);let entries;const stop=s.session.subscribeTransactions(x=>entries=x);assert.equal(entries[0].status,'unverified');stop();
});
