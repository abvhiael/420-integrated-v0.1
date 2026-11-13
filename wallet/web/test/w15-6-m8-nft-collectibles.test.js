import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
 NFT_TRANSFER721_TOPIC_420,NFT_TRANSFER_SINGLE_TOPIC_420,NFT_TRANSFER_BATCH_TOPIC_420,
 nftId420,normalizedNftRecord420,nftSpamFlags420,nftSafeMetadata420,nftMetadataUrl420,
 fetchSafeNftMetadata420,verifiedNftStandard420,verifyNftOwnership420,
 discoverNftTransfers420,nftTransferCall420,nftApprovalCall420,verifyNftApproval420,readNftApproval420
} from '../core/extension-nfts.js';
const owner='0x'+'11'.repeat(20),recipient='0x'+'22'.repeat(20),
 operator='0x'+'33'.repeat(20),erc721='0x'+'44'.repeat(20),erc1155='0x'+'55'.repeat(20);
const word=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const topic=a=>'0x'+a.slice(2).padStart(64,'0');
const supportABI=x=>word(x?1:0);
function provider({owner721=owner,balance1155=3n,has1155=true}={}){
 const calls=[];
 return {calls,request:async(method,params=[])=>{
  calls.push({method,params});
  if(method==='eth_getCode')return '0x6001600055';
  if(method==='eth_call'){
   const to=params[0].to.toLowerCase(),data=params[0].data.toLowerCase();
   if(data.startsWith('0x01ffc9a7')){
    const iface=data.slice(10,18);
    return supportABI(iface==='01ffc9a7'||(iface==='80ac58cd'&&to===erc721)||
     (iface==='d9b67a26'&&to===erc1155&&has1155));
   }
   if(data.startsWith('0x6352211e'))return topic(owner721);
   if(data.startsWith('0x00fdd58e'))return word(balance1155);
   if(data.startsWith('0x081812fc'))return topic(operator);
   if(data.startsWith('0xe985e9c5'))return word(1);
   throw Error('unknown call '+data);
  }
  if(method==='eth_getLogs'){
   const filter=params[0],type=filter.topics[0];
   if(type===NFT_TRANSFER721_TOPIC_420&&filter.topics[2]===topic(owner))
    return [{address:erc721,topics:[type,topic(recipient),topic(owner),word(42)],data:'0x'}];
   if(type===NFT_TRANSFER_SINGLE_TOPIC_420&&filter.topics[3]===topic(owner))
    return [{address:erc1155,topics:[type,topic(operator),topic(recipient),topic(owner)],data:word(7)+word(3).slice(2)}];
   if(type===NFT_TRANSFER_BATCH_TOPIC_420&&filter.topics[3]===topic(owner))
    return [{address:erc1155,topics:[type,topic(operator),topic(recipient),topic(owner)],
     data:word(64)+word(160).slice(2)+word(2).slice(2)+word(7).slice(2)+word(8).slice(2)+word(2).slice(2)+word(1).slice(2)+word(2).slice(2)}];
   return [];
  }
  throw Error('unexpected RPC '+method);
 }};
}
test('ERC721 and ERC1155 interface support is checked against canonical ERC165 and deployed bytecode',async()=>{
 const p=provider();
 assert.equal(await verifiedNftStandard420(p,erc721),'ERC721');
 assert.equal(await verifiedNftStandard420(p,erc1155),'ERC1155');
 assert.ok(p.calls.some(x=>x.method==='eth_getCode'));
 assert.equal(nftId420(erc1155,'ERC1155','7'),'ERC1155:'+erc1155+':7');
 assert.throws(()=>normalizedNftRecord420({address:erc721,standard:'ERC20',tokenId:1}),/Invalid NFT/);
 await assert.rejects(verifiedNftStandard420({request:async()=> '0x'},erc721),/no code/);
});
test('NFT event scan verifies actual current ERC721 owner and ERC1155 nonzero balance after logs',async()=>{
 const p=provider();
 const result=await discoverNftTransfers420(p,owner,{fromBlock:10n,toBlock:30n});
 assert.deepEqual(result.nfts.map(n=>n.key).sort(),[
  nftId420(erc721,'ERC721',42),nftId420(erc1155,'ERC1155',7),nftId420(erc1155,'ERC1155',8)
 ].sort());
 assert.ok(result.nfts.every(n=>n.ownership==='verified'&&n.stale===false));
 assert.equal(result.limited,true);
 const wrong=await discoverNftTransfers420(provider({owner721:recipient,balance1155:0n}),owner,{
  fromBlock:10n,toBlock:30n});
 assert.equal(wrong.nfts.length,0,'historical transfer does not certify present-day ownership');
 await assert.rejects(discoverNftTransfers420(p,owner,{fromBlock:0n,toBlock:3000n}),/bounded/);
});
test('ERC1155 hostile batch logs do not fabricate holdings or bypass max log limits',async()=>{
 const p=provider();
 const bad={request:async(method,params)=>{
  if(method!=='eth_getLogs')return p.request(method,params);
  const type=params[0].topics[0];
  if(type===NFT_TRANSFER_BATCH_TOPIC_420)return [{
   address:erc1155,topics:[type,topic(operator),topic(recipient),topic(owner)],
   data:word(64)+word(160).slice(2)+word(2000).slice(2)
  }];
  return [];
 }};
 const result=await discoverNftTransfers420(bad,owner,{fromBlock:1n,toBlock:2n});
 assert.equal(result.nfts.length,0);
 const flood={request:async(m)=>m==='eth_getLogs'?Array(301).fill({}):'0x'};
 await assert.rejects(discoverNftTransfers420(flood,owner,{fromBlock:1n,toBlock:2n}),/log limit/);
});
test('NFT metadata JSON is plain text only, strips controls and never treats claimed ownership/image as verified',()=>{
 const m=nftSafeMetadata420({
  name:'<img src=x onerror=alert(1)>',description:'Claim NOW at http://evil.example\u0000',
  image:'javascript:alert(1)',owner:recipient,
  attributes:[{trait_type:'42 game asset',value:'2026'},{trait_type:'<script>',value:'<svg/onload=1>'}]
 },'https://assets.example/meta/1');
 assert.match(m.name,/<img/);
 assert.match(m.flags.reasons.join(' '),/Promotional/);
 assert.equal(m.ownershipAuthority,'on-chain-balance-only');
 assert.equal(m.source,'untrusted-token-metadata');
 assert.equal(Object.hasOwn(m,'owner'),false);
 assert.equal(Object.hasOwn(m,'image'),false);
 assert.equal(m.attributes.length,2);
 assert.throws(()=>nftMetadataUrl420('javascript:alert(1)'),/HTTPS/);
 assert.throws(()=>nftMetadataUrl420('http://localhost/metadata'),/HTTPS/);
 assert.throws(()=>nftMetadataUrl420('https://127.0.0.1/path'),/HTTPS/);
 assert.throws(()=>nftMetadataUrl420('https://public.example/../../oops#x'),/HTTPS/);
 assert.equal(nftMetadataUrl420('ipfs://bafybeigdyrzt5sfp7udm7hu76uhw3h4x4oie2crz5ggnnykbf7lwlqf4wa/{id}',{tokenId:'15'})
  .includes('000000000000000000000000000000000000000000000000000000000000000f'),true);
});
test('metadata is explicit opt-in, HTTPS JSON only, bounded body and no redirects/cookies',async()=>{
 const seen=[];
 const fetcher=async(url,options)=>{
  seen.push({url,options});
  return {ok:true,headers:{get:k=>k==='content-type'?'application/json':null},
   text:async()=>JSON.stringify({name:'420Integrated Collectible',description:'Game cosmetic'})};
 };
 const meta=await fetchSafeNftMetadata420('https://metadata.example/token/2',{fetcher});
 assert.equal(meta.name,'420Integrated Collectible');
 assert.equal(meta.ownershipAuthority,'on-chain-balance-only');
 assert.equal(seen[0].options.credentials,'omit');
 assert.equal(seen[0].options.redirect,'error');
 assert.equal(seen[0].options.referrerPolicy,'no-referrer');
 await assert.rejects(fetchSafeNftMetadata420('https://metadata.example/x',{fetcher:async()=>({
  ok:true,headers:{get:()=> 'text/html'},text:async()=>'<script>alert(1)</script>'
 })}),/not JSON/);
 await assert.rejects(fetchSafeNftMetadata420('https://metadata.example/x',{fetcher:async()=>({
  ok:true,headers:{get:()=> 'application/json'},text:async()=> 'x'.repeat(70000)
 })}),/64 KiB/);
});
test('safe ERC721 and ERC1155 transfers encode exact owner, quantity and target',()=>{
 const a=nftTransferCall420({standard:'ERC721',contract:erc721,tokenId:'42',from:owner,to:recipient});
 assert.equal(a.to,erc721);assert.match(a.data,/^0x42842e0e/);
 assert.equal(a.quantity,'1');
 const b=nftTransferCall420({standard:'ERC1155',contract:erc1155,tokenId:'7',quantity:'2',from:owner,to:recipient});
 assert.match(b.data,/^0xf242432a/);assert.equal(b.quantity,'2');
 assert.equal(b.data.slice(-64),word(0).slice(2));
 assert.throws(()=>nftTransferCall420({standard:'ERC721',contract:erc721,tokenId:3,
  quantity:2,from:owner,to:recipient}),/exactly one/);
 assert.throws(()=>nftTransferCall420({standard:'ERC1155',contract:erc1155,tokenId:3,
  quantity:0,from:owner,to:recipient}),/quantity/);
 assert.throws(()=>nftTransferCall420({standard:'ERC1155',contract:erc1155,tokenId:3,
  quantity:1,from:owner,to:owner}),/endpoint/);
});
test('NFT approval separates ERC721 single-id and broad operator grants from ERC1155',async()=>{
 const a=nftApprovalCall420({standard:'ERC721',contract:erc721,tokenId:42,
  owner,operator,approved:true,collectionWide:false});
 assert.match(a.data,/^0x095ea7b3/);
 const b=nftApprovalCall420({standard:'ERC1155',contract:erc1155,tokenId:7,
  owner,operator,approved:true,collectionWide:true});
 assert.match(b.data,/^0xa22cb465/);
 assert.equal(b.data.slice(-64),word(1).slice(2));
 const revokeSingle=nftApprovalCall420({standard:'ERC721',contract:erc721,tokenId:42,
  owner,operator,approved:false,collectionWide:false});
 assert.equal(revokeSingle.data.slice(10,74),word(0).slice(2),
  'ERC721 per-token revoke must approve the ZERO address, not reapprove the operator');
 const revoke=nftApprovalCall420({standard:'ERC1155',contract:erc1155,tokenId:7,
  owner,operator,approved:false,collectionWide:true});
 assert.equal(revoke.data.slice(-64),word(0).slice(2));
 assert.throws(()=>nftApprovalCall420({standard:'ERC1155',contract:erc1155,tokenId:7,
  owner,operator,approved:true,collectionWide:false}),/operator-wide/);
 const p=provider();
 assert.equal(await verifyNftApproval420(p,a,owner),true);
 assert.equal(await verifyNftApproval420(p,b,owner),true);
 const single=await readNftApproval420(p,{asset:a.asset,owner});
 assert.equal(single.scope,'token');
 assert.equal(single.approvedOperator,operator);
 const collection=await readNftApproval420(p,{asset:b.asset,owner,operator});
 assert.equal(collection.scope,'collection');
 assert.equal(collection.approved,true);
 await assert.rejects(readNftApproval420(p,{asset:b.asset,owner}),/operator must be specified/);
});
test('NFT popup and worker require guarded review + real local signer; metadata never iframe/HTML injection',()=>{
 const root=resolve(new URL('../../extension/',import.meta.url).pathname);
 const files=['popup.html','popup.js','service-worker.js'];
 const [html,popup,worker]=files.map(p=>readFileSync(resolve(root,p),'utf8'));
 for(const id of ['nft-detail-view','nft-action-form','nft-review','nft-review-ack','nft-load-metadata',
  'nft-collection-wide','nft-hide','nft-spam','nft-index-status','nft-import-form','nft-approval-status'])assert.ok(html.includes('id="'+id+'"'));
 for(const action of ['nft-review','nft-submit','nft-metadata','nft-visibility','nft-import','nft-approval-status'])assert.ok(worker.includes(action));
 assert.ok(worker.includes('verifyNftOwnership420'));
 assert.ok(worker.includes('executeWithLocalAuthority'));
 assert.ok(worker.includes('NFT_REVIEW_KEY_420'));
 assert.ok(popup.includes('textContent'));
 assert.equal(popup.includes('innerHTML'),false);
 assert.equal(html.includes('<iframe'),false);
});
test('portfolio settings preserve user trusted NFT overrides without changing ownership',async()=>{
 const {normalizedPortfolioSettings420}=await import('../core/extension-portfolio.js');
 const key=nftId420(erc721,'ERC721',42);
 const settings=normalizedPortfolioSettings420({nftSpam:[key],nftTrusted:[key],nftHidden:[key]});
 assert.deepEqual(settings.nftSpam,[key]);
 assert.deepEqual(settings.nftTrusted,[key]);
 assert.deepEqual(settings.nftHidden,[key]);
 assert.ok(!Object.hasOwn(settings,'ownership'));
});
