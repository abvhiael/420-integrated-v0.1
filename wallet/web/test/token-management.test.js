import test from 'node:test';
import assert from 'node:assert/strict';
import {TOKEN_TEMPLATES_420,createTokenDiscoverySession420,tokenManagementActions420,encodeTokenManagement420} from '../core/token-app.js';
import {tokenHashText420,tokenSelector420,tokenReadCall420} from '../core/token-sdk.js';
import {encodeExecute,ZERO_ADDRESS} from '../core/abi.js';
import {connected,enableTokenPortfolioFixture420,portfolioRecord420,enableTokenManagementFixture420} from './token-connected-fixture.js';
import {controller,account,addr,digest,abi,word} from './token-test-fixture.js';
const profiles=Object.fromEntries(TOKEN_TEMPLATES_420.map(p=>[p.key,p])),to=addr(90),spender=addr(91),holder=addr(92);
const sig=tokenHashText420,call=tokenReadCall420,evt=(s,ts,d='0x')=>({topics:[sig(s),...ts],data:d});
const T='Transfer(address,address,uint256)';
const transfer=(from,to,amount)=>evt(T,[abi(from),abi(to)],abi(amount));
function row(profile,owner=account){return {...portfolioRecord420(1,profiles[profile],account,owner),templateId:profiles[profile].id,version:1};}
function encode(profile,action,args,owner=account){return encodeTokenManagement420(row(profile,owner),account,action,args);}
async function setup(profile='ERC20_FIXED',owner=account){
  const f=connected(),r=portfolioRecord420(1,profiles[profile],account,owner),pc=enableTokenPortfolioFixture420(f,[r]),mc=enableTokenManagementFixture420(f,pc),session=createTokenDiscoverySession420();
  assert.equal((await session.refresh({provider:f.provider,config:f.config,controller,smartAccount:f.selected})).status,'verified');
  const page=await session.refreshPortfolio();assert.ok(page,session.getPortfolio().error);
  return {f,r,pc,mc,session,item:page.items[0]};
}
test('all eight frozen profiles expose only actual owner/holder capabilities and retain transferred holder actions',()=>{
  for(const p of TOKEN_TEMPLATES_420){
    const actions=tokenManagementActions420(row(p.key),account),keys=actions.map(x=>x.key);
    assert.ok(keys.includes('transfer')&&keys.includes('transferOwnership'));
    assert.equal(keys.includes('mint'),p.mintable);assert.equal(keys.includes('burn'),p.standard!=='ERC20'||p.burnable);assert.equal(keys.includes('delegate'),p.votes);
    assert.equal(keys.includes('renounceOwnership'),p.standard==='ERC20');assert.equal(keys.includes('batchTransfer'),p.standard==='ERC1155');
    assert.ok(!keys.includes('permit'));
    const transferred=tokenManagementActions420(row(p.key,to),account);assert.ok(transferred.every(x=>!x.owner));assert.ok(transferred.some(x=>x.key==='transfer'));
  }
});
test('canonical selectors and exact integer encoding across all standards, dynamic bytes and array offsets',()=>{
  assert.equal(encode('ERC20_FIXED','transfer',{to,amount:'1.000000000000000001'}).data,'0xa9059cbb'+word(to)+word(1000000000000000001n));
  assert.equal(encode('ERC20_FIXED','approve',{spender,amount:'0'}).data,'0x095ea7b3'+word(spender)+word(0));
  assert.equal(encode('ERC721_COLLECTION','transfer',{from:account,to,id:'7'}).data,'0x42842e0e'+word(account)+word(to)+word(7));
  assert.equal(encode('ERC721_COLLECTION','approve',{spender:ZERO_ADDRESS,id:'0'}).data,'0x095ea7b3'+word(ZERO_ADDRESS)+word(0));
  assert.equal(encode('ERC1155_MULTI','mint',{to,id:'7',amount:'8'}).data,tokenSelector420('mint(address,uint256,uint256,bytes)')+word(to)+word(7)+word(8)+word(128)+word(0));
  assert.equal(encode('ERC1155_MULTI','transfer',{from:account,to,id:'7',amount:'8'}).data,'0xf242432a'+word(account)+word(to)+word(7)+word(8)+word(160)+word(0));
  assert.equal(encode('ERC1155_MULTI','batchTransfer',{from:account,to,ids:'7,8',values:'2,3'}).data,'0x2eb2c2d6'+[account,to,160,256,352,2,7,8,2,2,3,0].map(word).join(''));
  assert.equal(encode('ERC20_VOTES','delegate',{to:ZERO_ADDRESS}).data,'0x5c19a95c'+word(ZERO_ADDRESS));
  for(const [profile,action,args] of [['ERC20_FIXED','mint',{to,amount:'1'}],['ERC20_MINTABLE','burn',{amount:'1'}],['ERC20_FIXED','transfer',{to:ZERO_ADDRESS,amount:'1'}],
    ['ERC20_FIXED','transfer',{to,amount:'1e3'}],['ERC20_FIXED','approve',{spender,amount:'-1'}],['ERC721_COLLECTION','renounceOwnership',{}],
    ['ERC1155_MULTI','batchTransfer',{from:account,to,ids:'1,1',values:'1,1'}],['ERC1155_MULTI','batchTransfer',{from:account,to,ids:'1,2',values:'1'}],
    ['ERC1155_MULTI','mint',{to,id:'1',amount:'0'}],['ERC721_COLLECTION','mint',{to,id:'1',data:'0x'}]])assert.throws(()=>encode(profile,action,args));
  assert.throws(()=>encode('ERC20_MINTABLE','mint',{to,amount:'1'},to));
});
test('explicit one-use review, authorization, zero-value Wallet submission and canonical receipt across template-specific actions',async()=>{
  const cases=[
    ['ERC20_FIXED','transfer',{to,amount:'0.000000000000000001'},call('transfer(address,uint256)',['address','uint256'],[to,1]),[transfer(account,to,1)],true],
    ['ERC20_MINTABLE','mint',{to,amount:'1'},call('mint(address,uint256)',['address','uint256'],[to,10n**18n]),[transfer(ZERO_ADDRESS,to,10n**18n)],false],
    ['ERC20_CAPPED','mint',{to,amount:'1'},call('mint(address,uint256)',['address','uint256'],[to,10n**18n]),[transfer(ZERO_ADDRESS,to,10n**18n)],false],
    ['ERC20_BURNABLE','burn',{amount:'1'},call('burn(uint256)',['uint256'],[10n**18n]),[transfer(account,ZERO_ADDRESS,10n**18n)],false],
    ['ERC20_PERMIT','approve',{spender,amount:'0'},call('approve(address,uint256)',['address','uint256'],[spender,0]),[evt('Approval(address,address,uint256)',[abi(account),abi(spender)],abi(0))],true],
    ['ERC20_VOTES','delegate',{to},call('delegate(address)',['address'],[to]),[evt('DelegateChanged(address,address,address)',[abi(account),abi(ZERO_ADDRESS),abi(to)])],false],
    ['ERC721_COLLECTION','mint',{to,id:'7'},call('mint(address,uint256)',['address','uint256'],[to,7]),[evt(T,[abi(ZERO_ADDRESS),abi(to),abi(7)])],false],
    ['ERC1155_MULTI','mint',{to,id:'7',amount:'8'},tokenSelector420('mint(address,uint256,uint256,bytes)')+[to,7,8,128,0].map(word).join(''),[evt('TransferSingle(address,address,address,uint256,uint256)',[abi(account),abi(ZERO_ADDRESS),abi(to)],abi(7,8))],false],
  ];
  for(const [p,action,args,data,events,returns] of cases){
    const {f,r,mc,session,item}=await setup(p);mc.expect(r,data,events,returns);
    const quote=await session.reviewManagement(item,action,args);assert.equal(quote.creationFeeWei,'0');assert.equal(quote.transaction.data,encodeExecute(r.token,0n,data));assert.equal(quote.transaction.value,'0x0');assert.deepEqual(quote.events,events);
    await assert.rejects(session.authorizeManagement({...quote}));const approval=await session.authorizeManagement(quote,()=>true,quote.security.acknowledgement);await assert.rejects(session.authorizeManagement(quote,()=>true,quote.security.acknowledgement));
    assert.ok(f.calls.every(([m])=>! /send|sign|requestAccounts/i.test(m)));const hash=await session.submitManagement(approval);assert.ok(hash);await assert.rejects(session.submitManagement(approval));
    const sends=f.calls.filter(([m])=>m==='eth_sendTransaction');assert.equal(sends.length,1);assert.deepEqual(sends[0][1][0],{...quote.transaction,gas:'0x100000',gasPrice:'0x3b9aca00',type:'0x0',chainId:'0x1a4'});
    mc.pending=true;assert.equal((await session.checkTransaction(hash)).status,'pending');mc.pending=false;assert.equal((await session.checkTransaction(hash)).status,'confirmed');
    mc.reorg=true;assert.equal((await session.checkTransaction(hash)).status,'reorganized');mc.reorg=false;assert.equal((await session.checkTransaction(hash)).status,'confirmed');
  }
});
test('owner, cap, balance, operator, changed fee, wrong return and forged record fail before send',async()=>{
  for(const mode of ['owner','cap','balance','operator','fee','return','forged','cancel','reorg','feature','disconnect']){
    const profile=mode==='cap'||mode==='owner'?'ERC20_CAPPED':mode==='operator'?'ERC1155_MULTI':'ERC20_FIXED';
    const {f,r,pc,mc,session,item}=await setup(profile);let action='transfer',args={to,amount:'1'},data=call('transfer(address,uint256)',['address','uint256'],[to,10n**18n]),events=[transfer(account,to,10n**18n)],ret=true;
    if(profile==='ERC20_CAPPED'){action='mint';data=call('mint(address,uint256)',['address','uint256'],[to,10n**18n]);events=[transfer(ZERO_ADDRESS,to,10n**18n)];ret=false;}
    if(profile==='ERC1155_MULTI'){args={from:holder,to,id:'1',amount:'1'};data=encodeTokenManagement420(item,account,action,args).data;events=[];ret=false;}
    mc.expect(r,data,events,ret);
    if(mode==='owner')pc.rows[0].owner=to;if(mode==='cap')mc.cap=10n**18n;if(mode==='balance')mc.balance=0n;if(mode==='return')mc.wrongReturn=true;if(mode==='feature')r.profile={...r.profile,mintable:true};
    if(['fee','cancel','reorg','disconnect'].includes(mode)){
      const q=await session.reviewManagement(item,action,args),approval=await session.authorizeManagement(q,()=>true,q.security.acknowledgement);
      if(mode==='fee')f.control.gasPrice='0x77359400';if(mode==='reorg')pc.reorg=true;if(mode==='disconnect')session.invalidate();
      await assert.rejects(session.submitManagement(approval,()=>mode!=='cancel'));
    }else await assert.rejects(session.reviewManagement(mode==='forged'?{...item}:item,action,args));
    assert.equal(f.calls.filter(([m])=>m==='eth_sendTransaction').length,0,mode);
  }
});
test('allowance transfer and burn, approved NFT operations, operator and batch management enforce exact state',async()=>{
  const cases=[
    ['ERC20_BURNABLE','burnFrom',{from:holder,amount:'1'}],
    ['ERC20_FIXED','transferFrom',{from:holder,to,amount:'1'}],
    ['ERC721_COLLECTION','approve',{spender,id:'1'}],
    ['ERC721_COLLECTION','burn',{id:'1'}],
    ['ERC721_COLLECTION','transfer',{from:holder,to,id:'1'}],
    ['ERC1155_MULTI','batchTransfer',{from:holder,to,ids:'1,2',values:'2,3'}],
    ['ERC1155_MULTI','burn',{from:holder,id:'1',amount:'1'}],
    ['ERC721_COLLECTION','setApprovalForAll',{spender,approved:'false'}],
    ['ERC1155_MULTI','setApprovalForAll',{spender,approved:'true'}],
    ['ERC20_FIXED','renounceOwnership',{}],
    ['ERC721_COLLECTION','transferOwnership',{to}],
  ];
  for(const [p,action,args] of cases){
    const {r,mc,session,item}=await setup(p);mc.operator=true;mc.nftHolder=holder;mc.nftApproved=account;
    const op=encodeTokenManagement420(item,account,action,args);mc.expect(r,op.data,op.events,op.boolReturn);
    const q=await session.reviewManagement(item,action,args);assert.ok(q.events.length>0);assert.equal(q.transaction.data,encodeExecute(r.token,0n,op.data));
    if(['burnFrom','transferFrom'].includes(action)){mc.allowance=0n;await assert.rejects(session.authorizeManagement(q,()=>true,q.security.acknowledgement));}
    else if(['batchTransfer'].includes(action)||action==='burn'&&p==='ERC1155_MULTI'){mc.operator=false;await assert.rejects(session.authorizeManagement(q,()=>true,q.security.acknowledgement));}
  }
});
test('receipt mismatch is unverified, reverted is not confirmed, unknown prompt never retries',async()=>{
  for(const mode of ['wrongEvent','reverted','unknown','rejected']){
    const {f,r,mc,session,item}=await setup();mc.expect(r,call('transfer(address,uint256)',['address','uint256'],[to,1]),[transfer(account,to,1)],true);
    const q=await session.reviewManagement(item,'transfer',{to,amount:'0.000000000000000001'}),approval=await session.authorizeManagement(q,()=>true,q.security.acknowledgement);
    if(mode==='unknown'||mode==='rejected')mc.sendError=Object.assign(Error('prompt failed'),mode==='rejected'?{code:4001}:{});
    const hash=await session.submitManagement(approval);
    if(mode==='wrongEvent'){mc.wrongEvent=true;assert.equal(await session.checkTransaction(hash),null);let last;const stop=session.subscribeTransactions(x=>last=x);assert.equal(last[0].status,'unverified');stop();}
    if(mode==='reverted'){mc.reverted=true;assert.equal((await session.checkTransaction(hash)).status,'reverted');}
    if(mode==='unknown'||mode==='rejected')assert.equal(hash,null);
    assert.equal(f.calls.filter(([m])=>m==='eth_sendTransaction').length,1);await assert.rejects(session.submitManagement(approval));
  }
});
