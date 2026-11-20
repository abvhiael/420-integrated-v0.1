// Read-only, bounded canonical factory portfolio. Discovery is about creator
// provenance, never a claim that the creator still owns the contract or assets.
import {TOKEN_TEMPLATES_420,tokenReadCall420,tokenHashHex420,tokenHashText420,tokenAddressWord420,tokenWord420,tokenEncodeAbi420} from './token-sdk.js';
import {normalizeTokenReleaseBinding420,TOKEN_CREATION_FEE_WEI_420,TOKEN_COMMUNITY_VAULT_ID_420} from './token-runtime.js';
import {assertWalletChain420} from './transaction-lifecycle.js';
const check=(v,m)=>{if(!v)throw Error(m);};
const h=(x)=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x)&&BigInt(x)!==0n;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const qty=x=>{check(typeof x==='string'&&x.length<=66&&/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(x),'Malformed portfolio block quantity');return BigInt(x);};
const address=(word,zero=false)=>{check(typeof word==='string'&&/^0x0{24}[0-9a-fA-F]{40}$/.test(word)&&(zero||BigInt(word)!==0n),'Malformed portfolio address');return '0x'+word.slice(-40).toLowerCase();};
const words=(raw,n)=>{check(typeof raw==='string'&&raw.length===2+n*64&&/^0x[0-9a-fA-F]+$/.test(raw),'Malformed factory/token ABI result');return Array.from({length:n},(_,i)=>'0x'+raw.slice(2+i*64,66+i*64).toLowerCase());};
const codeOK=x=>typeof x==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(x)&&!/^0x0+$/.test(x);
const topic=tokenHashText420('TokenDeployed(address,address,bytes32,uint32,bytes32,uint256)');
const feeTopic=tokenHashText420('CreationFeeDeposited(address,bytes32,uint256)');
const vaultId=tokenHashText420(TOKEN_COMMUNITY_VAULT_ID_420);
const padded=x=>'0x'+tokenAddressWord420(x);
const feeData='0x'+tokenWord420(TOKEN_CREATION_FEE_WEI_420);
export const TOKEN_PORTFOLIO_PAGE_SIZE_420=16;
function safeString(raw){
  check(typeof raw==='string'&&raw.length<=2+64*2+8192&&/^0x[0-9a-fA-F]+$/.test(raw)&&raw.length>=130,'Invalid token display metadata');
  check(BigInt('0x'+raw.slice(2,66))===32n,'Invalid token string offset');
  const len=BigInt('0x'+raw.slice(66,130));check(len<=4096n,'Token display metadata too large');
  const bytes=Uint8Array.from(raw.slice(130,130+Number(len)*2).match(/../g)||[],x=>parseInt(x,16));
  const value=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  check(tokenEncodeAbi420(['string'],[value])===raw.toLowerCase(),'Noncanonical token string');
  check(!/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value),'Unsafe token display metadata');
  return value;
}
async function canonical(provider,r,block){
  const [genesis,at]=await Promise.all([provider.request('eth_getBlockByNumber',['0x0',false]),provider.request('eth_getBlockByNumber',[block.number,false])]);
  check(genesis?.number==='0x0'&&same(genesis.hash,r.genesisHash),'Portfolio genesis mismatch');
  check(at?.number===block.number&&same(at.hash,block.hash),'Portfolio snapshot reorganized');
  await assertWalletChain420(provider,r.chainId);
}
// An optional, independent receipt check. The exact indexed token+creator+
// template filter does not require trusting indexer claims or local history.
// RPC history limits must not turn a verified factory record into fake receipt proof.
async function receiptEvidence(provider,r,block,row){
  const expectedTopics=[topic,padded(row.token),padded(row.creator),row.templateId];
  const data='0x'+tokenWord420(1n)+row.configHash.slice(2)+feeData.slice(2);
  const logs=await provider.request('eth_getLogs',[{address:r.factory.address,fromBlock:'0x0',toBlock:block.number,topics:expectedTopics}]);
  check(Array.isArray(logs)&&logs.length===1,'Missing or duplicate indexed deployment event');
  const l=logs[0];
  const exact=x=>same(x?.address,r.factory.address)&&Array.isArray(x.topics)&&x.topics.length===4&&x.topics.every((v,i)=>same(v,expectedTopics[i]))&&same(x.data,data);
  check(exact(l)&&l.removed===false&&h(l.transactionHash)&&h(l.blockHash)&&qty(l.blockNumber)<=qty(block.number),'Invalid deployment event');
  const receipt=await provider.request('eth_getTransactionReceipt',[l.transactionHash]);
  const at=await provider.request('eth_getBlockByNumber',[l.blockNumber,false]);
  check(receipt?.status==='0x1'&&same(receipt.transactionHash,l.transactionHash)&&same(receipt.blockHash,l.blockHash)&&receipt.blockNumber===l.blockNumber&&
    at?.number===l.blockNumber&&same(at.hash,l.blockHash)&&qty(at.timestamp)===BigInt(row.deployedAt),'Noncanonical deployment receipt');
  check(Array.isArray(receipt.logs)&&receipt.logs.length<=4096,'Missing or oversized receipt logs');
  const bound=x=>x.removed===false&&same(x.transactionHash,l.transactionHash)&&same(x.blockHash,l.blockHash)&&x.blockNumber===l.blockNumber&&qty(x.transactionIndex)===qty(receipt.transactionIndex);
  check(bound(l),'Indexed log transaction index mismatch');
  const factory=receipt.logs.filter(x=>same(x?.address,r.factory.address));
  for(const x of factory)check(bound(x),'Unbound factory receipt log');
  const indices=factory.map(x=>qty(x.logIndex));check(new Set(indices.map(String)).size===indices.length,'Duplicate receipt log index');
  const matches=factory.filter(exact);
  check(matches.length===1&&qty(matches[0].logIndex)===qty(l.logIndex),'Receipt deployment event mismatch');
  const index=qty(l.logIndex);
  const next=factory.filter(x=>same(x.topics?.[0],topic)&&qty(x.logIndex)>index).map(x=>qty(x.logIndex)).sort((a,b)=>a<b?-1:a>b?1:0)[0];
  const fees=factory.filter(x=>same(x.topics?.[0],feeTopic)&&qty(x.logIndex)>index&&(next==null||qty(x.logIndex)<next));
  check(fees.length===1&&fees[0].topics.length===3&&same(fees[0].topics[1],padded(r.communityTreasuryVault.address))&&same(fees[0].topics[2],vaultId)&&same(fees[0].data,feeData),'Missing or mismatched exact creation fee event');
  const [factoryCode,vaultCode,again,atAgain]=await Promise.all([provider.request('eth_getCode',[r.factory.address,l.blockNumber]),provider.request('eth_getCode',[r.communityTreasuryVault.address,l.blockNumber]),provider.request('eth_getTransactionReceipt',[l.transactionHash]),provider.request('eth_getBlockByNumber',[l.blockNumber,false])]);
  check(tokenHashHex420(factoryCode)===r.factory.codeHash&&tokenHashHex420(vaultCode)===r.communityTreasuryVault.codeHash,'Historical dependency code mismatch');
  check(again?.status==='0x1'&&same(again.transactionHash,l.transactionHash)&&same(again.blockHash,l.blockHash)&&again.blockNumber===l.blockNumber&&JSON.stringify(again.logs)===JSON.stringify(receipt.logs)&&atAgain?.number===l.blockNumber&&same(atAgain.hash,l.blockHash),'Deployment receipt reorganized');
  return Object.freeze({status:'verified',txHash:l.transactionHash.toLowerCase(),blockNumber:l.blockNumber,blockHash:l.blockHash.toLowerCase(),creationFeeWei:TOKEN_CREATION_FEE_WEI_420.toString(),communityTreasuryVault:r.communityTreasuryVault.address});
}
// Snapshot and cursor are retained by the privileged Wallet session. The
// function itself returns evidence only; callers cannot authorize transactions.
export async function readCreatedTokenPage420(provider,binding,creator,block,previous=null){
  const r=normalizeTokenReleaseBinding420(binding);
  creator=address(padded(creator));check(h(block?.hash),'Invalid portfolio snapshot');qty(block.number);
  block=Object.freeze({number:block.number,hash:block.hash.toLowerCase()});
  await canonical(provider,r,block);
  const call=(to,sig,types=[],args=[])=>provider.request('eth_call',[{to,data:tokenReadCall420(sig,types,args)},block.number]);
  const uint=async(...args)=>BigInt(words(await call(...args),1)[0]);
  const [factoryCode,total,created]=await Promise.all([provider.request('eth_getCode',[r.factory.address,block.number]),uint(r.factory.address,'deploymentCount()'),uint(r.factory.address,'creatorNonce(address)',['address'],[creator])]);
  check(tokenHashHex420(factoryCode)===r.factory.codeHash,'Portfolio factory code mismatch');check(created<=total,'Invalid factory creator count');
  if(previous)check(previous.creator===creator&&previous.chainId===r.chainId&&previous.factory===r.factory.address&&previous.releaseRoot===r.release.dependencyRoot&&previous.block.number===block.number&&previous.block.hash===block.hash&&BigInt(previous.total)===total&&BigInt(previous.createdCount)===created,'Portfolio cursor snapshot mismatch');
  let cursor=previous?BigInt(previous.remaining):total,found=previous?BigInt(previous.found):0n;
  check(cursor>=0n&&cursor<=total&&found>=0n&&found<=created,'Invalid portfolio cursor');
  const items=[],seen=new Set(previous?.seen||[]);
  // A zero creator nonce proves no creations at this snapshot; avoid scanning
  // unrelated history. Otherwise bound every request to a page of global records.
  if(created===0n)cursor=0n;
  for(let scanned=0;cursor>0n&&found<created&&scanned<TOKEN_PORTFOLIO_PAGE_SIZE_420;scanned++){
    const index=--cursor;
    const row=words(await call(r.factory.address,'deployment(uint256)',['uint256'],[index]),6);
    const token=address(row[0]),originalCreator=address(row[1]),profile=TOKEN_TEMPLATES_420.find(p=>p.id===row[2]);
    check(profile&&BigInt(row[3])===1n&&BigInt(row[5])<2n**64n,'Malformed or unknown factory provenance');
    if(originalCreator!==creator)continue;
    check(!seen.has(token)&&token!==creator&&!Object.values(r.dependencies).some(x=>x.address===token),'Duplicate or aliased factory deployment');seen.add(token);
    const [code,registered,template,ownerWord]=await Promise.all([provider.request('eth_getCode',[token,block.number]),uint(r.factory.address,'isFactoryDeployment(address)',['address'],[token]),call(token,'templateId()'),call(token,'owner()')]);
    check(codeOK(code)&&registered===1n&&same(words(template,1)[0],profile.id),'Created token provenance or code mismatch');
    const owner=address(words(ownerWord,1)[0],profile.standard==='ERC20');
    const record={index:index.toString(),token,creator,templateId:profile.id,templateKey:profile.key,standard:profile.standard,version:1,configHash:row[4],
      deployedAt:BigInt(row[5]).toString(),owner,ownership:owner===creator?'creator':BigInt(owner)===0n?'renounced':'transferred',
      codeHash:tokenHashHex420(code),name:null,symbol:null,uri:null,balance:null,totalSupply:null,decimals:null,metadataStatus:'verified'};
    // Unsafe or unavailable metadata is never rendered as trusted text. An
    // unverified display field does not erase the verified factory identity.
    async function field(key,fn){try{record[key]=await fn();}catch{record.metadataStatus='partial';}}
    if(profile.standard==='ERC1155')await field('uri',async()=>safeString(await call(token,'uri()')));
    else{
      await Promise.all([field('name',async()=>safeString(await call(token,'name()'))),field('symbol',async()=>safeString(await call(token,'symbol()'))),
        field('balance',async()=> (await uint(token,'balanceOf(address)',['address'],[creator])).toString()),field('totalSupply',async()=> (await uint(token,'totalSupply()')).toString())]);
      if(profile.standard==='ERC20')await field('decimals',async()=>{check(await uint(token,'decimals()')===18n,'Unexpected ERC20 decimals');return 18;});
    }
    let receipt;try{receipt=await receiptEvidence(provider,r,block,record);}catch{receipt=Object.freeze({status:'unverified'});}
    items.push(Object.freeze({...record,receipt}));found++;
  }
  check(found<=created&&(cursor!==0n||found===created),'Factory creator count does not reconcile');
  // Reaching the independently read creator count is sufficient to stop.
  // Do not claim that all global records were scanned in this case.
  const complete=found===created;
  await canonical(provider,r,block);
  return Object.freeze({authority:'FACTORY_PROVENANCE_ONLY',creator,chainId:r.chainId,factory:r.factory.address,releaseRoot:r.release.dependencyRoot,block,
    total:total.toString(),createdCount:created.toString(),remaining:cursor.toString(),found:found.toString(),complete,seen:Object.freeze([...seen]),items:Object.freeze(items)});
}
