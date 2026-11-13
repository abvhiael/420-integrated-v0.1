import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {
 normalizeConvenience420,normalizeAddressLabel420,updateAddressLabel420,
 normalizeServiceDirectory420,portfolioAnalytics420,actionableNotifications420,
 encryptConvenienceBackup420,decryptConvenienceBackup420,validateMobileInvite420
} from '../../extension/core/extension-convenience420.js';
import {walletConnectProject420,walletConnectProposal420,walletConnectRequest420,
 walletConnectError420,walletConnectResult420} from '../../extension/core/walletconnect-policy420.js';

const account='0x'+'ab'.repeat(20),other='0x'+'cd'.repeat(20),chain='0x1a4',topic='a'.repeat(64),sym='b'.repeat(64);
test('privacy settings fail closed for malformed imported preference values',()=>{
 const defaults=normalizeConvenience420();
 assert.equal(defaults.privacy.notifications,false);
 assert.equal(defaults.privacy.serviceDiscovery,false);
 assert.equal(defaults.privacy.allowDeepLinks,false);
 assert.equal(normalizeConvenience420({privacy:{notifications:'true',hideBalances:true}}).privacy.notifications,false);
 assert.equal(normalizeConvenience420({privacy:{hideBalances:true}}).privacy.hideBalances,true);
 assert.equal(Object.hasOwn(defaults,'privateKey'),false);
});
test('labels are exact chain scoped, deduplicated, bounded and reject control chars',()=>{
 const label=normalizeAddressLabel420({address:account.toUpperCase().replace('0X','0x'),chainId:chain,label:' My phone '});
 assert.equal(label.address,account);assert.equal(label.label,'My phone');
 let state=updateAddressLabel420(null,label);
 assert.equal(state.labels.length,1);
 state=updateAddressLabel420(state,{...label,label:'New'});
 assert.equal(state.labels[0].label,'New');assert.equal(state.labels.length,1);
 state=updateAddressLabel420(state,{...label,label:'gone'},{remove:true});
 assert.deepEqual(state.labels,[]);
 assert.throws(()=>normalizeAddressLabel420({...label,chainId:'0x0'}),/Invalid/);
 assert.throws(()=>normalizeAddressLabel420({...label,label:'bad\u0000name'}),/Invalid/);
 assert.throws(()=>normalizeAddressLabel420({...label,address:'0x123'}),/Invalid/);
});
test('service directory rejects user URL authority and duplicate IDs, never auto-trusts websites',()=>{
 const good={id:'swap:main',name:'420Swap',type:'420Swap',approved:true,chainId:chain,
   url:'https://swap.example.org/',origin:'https://swap.example.org',description:'Verified route only'};
 const x=normalizeServiceDirectory420({ecosystemServices:[
   good,{...good,id:'clone',url:'https://evil.example.org/'},
   {...good,id:'other-chain',chainId:'0x1'},
   {...good,id:'malformed',url:'https://user:pass@swap.example.org/'},
   {...good,id:'malformed2',url:'http://swap.example.org/'},
   {...good,id:'swap:main'}
 ]},chain);
 assert.equal(x.length,1);assert.equal(x[0].url,'https://swap.example.org/');
});
test('portfolio insights distinguish verified quoted subtotal from historical performance',()=>{
 const p={status:'verified',chainId:chain,blockNumber:'400',checkedAt:123,currency:'CAD',
  tokens:[{address:account,symbol:'ONE',verified:true,decimals:18,hidden:false,spam:false,
   balance:{status:'spendable',spendable:'300'},price:{status:'verified',value:'12.45'}},
   {address:other,symbol:'TWO',verified:true,decimals:6,hidden:false,spam:false,
    balance:{status:'spendable',spendable:'600'},price:{status:'unavailable'}}]};
 const a=portfolioAnalytics420(p,[{at:42,chainId:chain,status:'confirmed'},{at:43,chainId:'0x1',status:'failed'}]);
 assert.equal(a.pricedSubtotalCents,'1245');assert.equal(a.partial,true);
 assert.equal(a.transactionCount,1);assert.equal(a.statuses.confirmed,1);
 assert.equal(a.performanceReturnUnavailable,true);
 assert.equal(portfolioAnalytics420(p,[],{enabled:false}).available,false);
 assert.equal(portfolioAnalytics420({...p,status:'outage'}).available,false);
});
test('notification filtering binds chain/account and does not expose external data',()=>{
 const items=[
  {id:'one',at:1,controller:account,chainId:chain,status:'confirmed',hash:'0x'+'11'.repeat(32)},
  {id:'two',at:2,controller:other,chainId:chain,status:'confirmed'},
  {id:'three',at:3,controller:account,chainId:'0x1',status:'reverted'},
  {id:'four',at:4,controller:account,chainId:chain,status:'pending'}];
 const filtered=actionableNotifications420(items,{account,chainId:chain,after:0});
 assert.deepEqual(filtered.map(x=>x.id),['one']);assert.equal(filtered[0].hash,items[0].hash);
 assert.throws(()=>actionableNotifications420(items,{account:'bad',chainId:chain}),/scope/);
});
test('WalletConnect pairing only permits valid bounded v2 EVM URI',()=>{
 const uri='wc:'+topic+'@2?relay-protocol=irn&symKey='+sym;
 assert.equal(validateMobileInvite420(uri).topic,topic);
 for(const bad of ['wc:'+topic+'@1?relay-protocol=irn&symKey='+sym,
  'https://evil.org/',uri+'&relay-protocol=unknown',uri.replace('symKey='+sym,'symKey=x')]){
  assert.throws(()=>validateMobileInvite420(bad));
 }
});
test('WalletKit proposal namespace binds exact account, EIP-155 network, HTTPS origin and allowlisted methods',()=>{
 const example={id:42,params:{requiredNamespaces:{eip155:{
  chains:['eip155:420'],methods:['personal_sign','eth_sendTransaction'],events:['accountsChanged']
 }},proposer:{metadata:{url:'https://app.example.org/path',name:'Example Dapp'}}}};
 const checked=walletConnectProposal420(example,{chainId:chain,account});
 assert.equal(checked.origin,'https://app.example.org');
 assert.deepEqual(checked.namespaces.eip155.accounts,['eip155:420:'+account]);
 assert.throws(()=>walletConnectProposal420({...example,params:{...example.params,
   requiredNamespaces:{eip155:{...example.params.requiredNamespaces.eip155,methods:['eth_sign']}}}},{chainId:chain,account}),/Unsupported/);
 assert.throws(()=>walletConnectProposal420({...example,params:{...example.params,
   requiredNamespaces:{eip155:{...example.params.requiredNamespaces.eip155,chains:['eip155:1']}}}},{chainId:chain,account}),/unapproved chain/);
 assert.throws(()=>walletConnectProposal420({...example,params:{...example.params,proposer:{metadata:{url:'http://phishing.org'}}}},{chainId:chain,account}),/HTTPS/);
});
test('WalletKit session requests reject ungranted method, chain, sender and topic',()=>{
 const network='eip155:420';
 const session={topic:'topic',namespaces:{eip155:{accounts:[network+':'+account],methods:['personal_sign','eth_sendTransaction']}}};
 const selected={account,network,origin:'https://app.example.org'};
 const request={topic:'topic',id:1,params:{chainId:network,request:{method:'personal_sign',params:['0x11',account]}}};
 assert.equal(walletConnectRequest420(session,request,selected).method,'personal_sign');
 assert.throws(()=>walletConnectRequest420(session,{...request,topic:'fake'},selected),/topic/);
 assert.throws(()=>walletConnectRequest420(session,{...request,params:{...request.params,chainId:'eip155:1'}},selected),/chain/);
 assert.throws(()=>walletConnectRequest420(session,{...request,params:{...request.params,request:{method:'eth_sign',params:[]}}},selected),/Unsupported/);
 assert.throws(()=>walletConnectRequest420(session,{...request,params:{...request.params,request:{method:'personal_sign',params:['0x11',other]}}},selected),/signer/);
 assert.throws(()=>walletConnectRequest420(session,request,{...selected,account:other}),/never shared/);
 assert.equal(walletConnectResult420(1,'0xab').result,'0xab');
 assert.equal(walletConnectError420(1,new Error('Denied')).error.code,4001);
 assert.throws(()=>walletConnectProject420('short'),/project identifier/);
});
test('encrypted backup preserves only normalized metadata and rejects incorrect passphrase/tamper',async()=>{
 const data={version:1,privacy:{hideBalances:true,notifications:true},labels:[
  {address:account,chainId:chain,label:'My hardware'}],
  privateKey:'never export',recoveryPhrase:'never export',siteGrants:[{origin:'https://example.org'}]};
 const encrypted=await encryptConvenienceBackup420(data,'12character-secure-passphrase',{cryptoRef:webcrypto});
 assert.equal(encrypted.includes('never export'),false);
 assert.equal(encrypted.includes(account),false);
 const decrypted=await decryptConvenienceBackup420(encrypted,'12character-secure-passphrase',{cryptoRef:webcrypto});
 assert.equal(decrypted.labels[0].label,'My hardware');
 assert.equal(decrypted.privacy.hideBalances,true);
 assert.equal(Object.hasOwn(decrypted,'privateKey'),false);
 assert.equal(Object.hasOwn(decrypted,'recoveryPhrase'),false);
 await assert.rejects(()=>decryptConvenienceBackup420(encrypted,'wrong passphrase',{cryptoRef:webcrypto}),/Incorrect passphrase/);
 const altered=JSON.parse(encrypted);altered.algorithm='NONE';
 await assert.rejects(()=>decryptConvenienceBackup420(JSON.stringify(altered),'12character-secure-passphrase',{cryptoRef:webcrypto}),/Unsupported/);
});
