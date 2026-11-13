// W15.6-M8: on-chain verified ERC-721 / ERC-1155 holdings and bounded RPC indexing.
// Metadata is untrusted display text; transfer events and images NEVER prove ownership.
import {normalizeAddress,decodeString} from './abi.js';
import {keccak256Hex} from './keccak.js';
const ZERO='0x'+'0'.repeat(40),WORD=/^0x[0-9a-fA-F]{64}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const UINT256=(1n<<256n)-1n;
const topic=s=>keccak256Hex(new TextEncoder().encode(s));
export const NFT_TRANSFER721_TOPIC_420=topic('Transfer(address,address,uint256)');
export const NFT_TRANSFER_SINGLE_TOPIC_420=topic('TransferSingle(address,address,address,uint256,uint256)');
export const NFT_TRANSFER_BATCH_TOPIC_420=topic('TransferBatch(address,address,address,uint256[],uint256[])');
const boolWord=hex=>{if(typeof hex!=='string'||!WORD.test(hex))throw Error('Invalid ERC-165 ABI response');const n=BigInt(hex);if(n!==0n&&n!==1n)throw Error('Invalid ERC-165 response boolean');return n===1n};
const word=n=>BigInt(n).toString(16).padStart(64,'0');
const ownerTopic=address=>'0x'+normalizeAddress(address).slice(2).padStart(64,'0');
const requireSafe=(yes,msg)=>{if(!yes)throw Error(msg)};
export function nftId420(contract,standard,tokenId){
 const address=normalizeAddress(contract);
 requireSafe(address!==ZERO&&['ERC721','ERC1155'].includes(standard),'Invalid NFT collection');
 const id=BigInt(tokenId);
 requireSafe(id>=0n&&id<=UINT256,'Invalid NFT ID');
 return standard+':'+address+':'+id.toString();
}
export function normalizedNftRecord420(record){
 const standard=record?.standard,address=normalizeAddress(record?.address);
 const id=nftId420(address,standard,record.tokenId);
 return {key:id,standard,address,tokenId:BigInt(record.tokenId).toString()};
}
export function nftSpamFlags420({name='',description='',tokenUri='',spam=false}={}){
 const bad=/(?:https?:\/\/|www\.|\.xyz\b|airdrop|claim now|connect wallet|free mint|urgent reward|voucher|visit link)/i;
 const reasons=[];
 if([name,description].some(x=>typeof x==='string'&&bad.test(x)))reasons.push('Promotional or link-like NFT metadata');
 if(typeof tokenUri==='string'&&/^(?:javascript:|data:text\/html|file:)/i.test(tokenUri))reasons.push('Unsafe metadata URI');
 if(spam)reasons.push('Marked as spam locally');
 return {spam:reasons.length>0,reasons};
}
export function nftSafeMetadata420(input={},uri=''){
 requireSafe(input&&typeof input==='object'&&!Array.isArray(input),'NFT metadata must be a JSON object');
 const safe=(value,max)=>typeof value==='string'?value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
 const name=safe(input.name,140),description=safe(input.description,1000);
 const image=safe(input.image,2048);
 const tokenUri=safe(uri,2048);
 const attributes=Array.isArray(input.attributes)?input.attributes.slice(0,25).map(x=>({
  trait_type:safe(x?.trait_type,64),value:safe(
   typeof x?.value==='number'&&Number.isFinite(x.value)?String(x.value):x?.value,140)
 })).filter(x=>x.trait_type||x.value):[];
 const flags=nftSpamFlags420({name,description,tokenUri});
 // Never return an active image URL for popup DOM insertion: NFT metadata
 // may be a tracker, redirect, SVG script or poisoned media file.
 return {name,description,attributes,imageReference:image,
  contentWarning:'External NFT images and interactive metadata are never embedded automatically.',
  flags,source:'untrusted-token-metadata',ownershipAuthority:'on-chain-balance-only'};
}
export function nftMetadataUrl420(value,{tokenId=null}={}){
 if(typeof value!=='string'||value.length>2048)throw Error('Malformed NFT metadata URI');
 let uri=value.trim();
 if(tokenId!==null)uri=uri.replace(/\{id\}/gi,BigInt(tokenId).toString(16).padStart(64,'0'));
 if(uri.startsWith('ipfs://')){
  const path=uri.slice(7).replace(/^ipfs\//,'');
  requireSafe(/^[a-zA-Z0-9]{32,100}(?:\/[a-zA-Z0-9_./-]{1,256})?$/.test(path)&&!path.includes('..'),
   'Unsafe IPFS NFT metadata path');
  uri='https://ipfs.io/ipfs/'+path;
 }
 const url=new URL(uri);
 requireSafe(url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&
  !['localhost','127.0.0.1','0.0.0.0','[::1]'].includes(url.hostname.toLowerCase())&&
  !url.hostname.endsWith('.local')&&!url.hostname.endsWith('.internal')&&
  !/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)&&!url.hostname.includes('..'),
  'NFT metadata must be a public HTTPS JSON endpoint');
 return url.href;
}
export async function fetchSafeNftMetadata420(uri,{fetcher=fetch,tokenId=null}={}){
 const url=nftMetadataUrl420(uri,{tokenId});
 const abort=new AbortController();
 const timeout=setTimeout(()=>abort.abort(),7000);
 const promise=fetcher(url,{method:'GET',redirect:'error',credentials:'omit',
  cache:'no-store',referrerPolicy:'no-referrer',signal:abort.signal,
  headers:{Accept:'application/json'}});
 let res;
 try{res=await promise;
  requireSafe(res?.ok===true,'NFT metadata request failed');
  const type=res.headers?.get?.('content-type')||'';
  requireSafe(/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(type),
   'NFT metadata response is not JSON');
  const claimed=Number(res.headers?.get?.('content-length')||0);
  requireSafe(!claimed||claimed<=65536,'NFT metadata exceeds 64 KiB');
  const body=await res.text();
  requireSafe(body.length<=65536,'NFT metadata exceeds 64 KiB');
  return nftSafeMetadata420(JSON.parse(body),uri);
 }finally{clearTimeout(timeout);abort.abort();}
}
export async function verifiedNftStandard420(provider,address){
 const contract=normalizeAddress(address);
 requireSafe(contract!==ZERO,'Invalid NFT contract');
 const code=await provider.request('eth_getCode',[contract,'latest']);
 requireSafe(typeof code==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(code)&&!/^0x0*$/i.test(code),
  'NFT contract has no code');
 const supports=async iface=>boolWord(await provider.request('eth_call',[
  {to:contract,data:'0x01ffc9a7'+iface.padEnd(64,'0')},'latest']));
 requireSafe(await supports('01ffc9a7')&&!await supports('ffffffff'),
  'NFT contract fails ERC-165 verification');
 if(await supports('80ac58cd'))return 'ERC721';
 if(await supports('d9b67a26'))return 'ERC1155';
 throw Error('Not a supported ERC-721 or ERC-1155 collection');
}
export async function verifyNftOwnership420(provider,record,owner){
 const {address,standard,tokenId,key}=normalizedNftRecord420(record);
 const account=normalizeAddress(owner),id=word(tokenId);
 const standardOnChain=await verifiedNftStandard420(provider,address);
 requireSafe(standardOnChain===standard,'NFT standard changed or event was spoofed');
 const data=standard==='ERC721'?'0x6352211e'+id:
  '0x00fdd58e'+account.slice(2).padStart(64,'0')+id;
 const raw=await provider.request('eth_call',[{to:address,data},'latest']);
 requireSafe(typeof raw==='string'&&WORD.test(raw),'Malformed NFT ownership ABI');
 if(standard==='ERC721')requireSafe(/^0x0{24}[0-9a-fA-F]{40}$/.test(raw),'Invalid ERC721 ownerOf return padding');
 const owned=standard==='ERC721'?raw.slice(-40).toLowerCase()===account.slice(2):
  BigInt(raw)>0n;
 return {...record,key,address,standard,tokenId,owner:account,quantity:
  standard==='ERC721'?(owned?'1':'0'):BigInt(raw).toString(),
  verified:owned,ownership:owned?'verified':'not-owned',stale:false};
}
function boundedArray(hex,{max=40}={}){
 requireSafe(typeof hex==='string'&&/^0x[0-9a-fA-F]+$/.test(hex),
  'Malformed ERC-1155 batch transfer log');
 const raw=hex.slice(2);
 const at=i=>{const off=i*64;requireSafe(off+64<=raw.length,'Truncated ERC-1155 batch data');return BigInt('0x'+raw.slice(off,off+64))};
 const offsetA=at(0),offsetB=at(1);
 requireSafe(offsetA%32n===0n&&offsetB%32n===0n,'Malformed ERC-1155 ABI offsets');
 const a=Number(offsetA/32n),b=Number(offsetB/32n);
 requireSafe(Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&a>=2&&b>=2,
  'Malformed ERC-1155 batch array offsets');
 const read=offset=>{const length=Number(at(offset));
  requireSafe(Number.isSafeInteger(length)&&length<=max,'Unbounded ERC-1155 batch array');
  return Array.from({length},(_,i)=>at(offset+1+i).toString());
 };
 const ids=read(a),values=read(b);
 requireSafe(ids.length===values.length,'ERC-1155 batch token/value mismatch');
 return ids;
}
export async function discoverNftTransfers420(provider,owner,{
 fromBlock,toBlock,maxLogs=300,maxSpan=2048n,maxAssets=90
}={}){
 const address=normalizeAddress(owner);
 const from=BigInt(fromBlock),to=BigInt(toBlock);
 requireSafe(from>=0n&&to>=from&&to-from<=BigInt(maxSpan),
  'NFT index requires bounded confirmed chain interval');
 const h=n=>'0x'+n.toString(16),topicOwner=ownerTopic(address);
 const filters=[
  [NFT_TRANSFER721_TOPIC_420,null,topicOwner],
  [NFT_TRANSFER721_TOPIC_420,topicOwner],
  [NFT_TRANSFER_SINGLE_TOPIC_420,null,null,topicOwner],
  [NFT_TRANSFER_SINGLE_TOPIC_420,null,topicOwner],
  [NFT_TRANSFER_BATCH_TOPIC_420,null,null,topicOwner],
  [NFT_TRANSFER_BATCH_TOPIC_420,null,topicOwner]
 ];
 const found=new Map();
 let count=0;
 for(const topics of filters){
  const logs=await provider.request('eth_getLogs',[{fromBlock:h(from),toBlock:h(to),topics}]);
  requireSafe(Array.isArray(logs)&&logs.length+count<=maxLogs,'NFT index log limit reached; narrow block range');
  count+=logs.length;
  for(const log of logs){
   if(typeof log?.address!=='string'||!Array.isArray(log.topics)||log.topics[0]?.toLowerCase()!==topics[0])continue;
   let standard,ids=[];
   try{
    if(topics[0]===NFT_TRANSFER721_TOPIC_420){
     requireSafe(log.topics.length===4&&HASH.test(log.topics[3]),'Malformed ERC721 Transfer');
     standard='ERC721';ids=[BigInt(log.topics[3]).toString()];
    }else if(topics[0]===NFT_TRANSFER_SINGLE_TOPIC_420){
     requireSafe(log.topics.length===4&&/^0x[0-9a-fA-F]{128}$/.test(log.data),
      'Malformed TransferSingle');
     standard='ERC1155';ids=[BigInt('0x'+log.data.slice(2,66)).toString()];
    }else{
     requireSafe(log.topics.length===4,'Malformed TransferBatch');
     standard='ERC1155';ids=boundedArray(log.data);
    }
    for(const tokenId of ids){
     const key=nftId420(log.address,standard,tokenId);
     if(!found.has(key))found.set(key,{standard,address:normalizeAddress(log.address),tokenId});
     if(found.size>maxAssets)throw Error('NFT asset discovery cap exceeded');
    }
   }catch(e){if(/cap exceeded/.test(e.message))throw e;}
  }
 }
 const items=[];
 for(const row of found.values()){
  try{
   const inspected=await verifyNftOwnership420(provider,row,address);
   if(inspected.verified)items.push(inspected);
  }catch{/* Logs never prove ownership; malformed contracts remain invisible. */}
 }
 return {nfts:items,fromBlock:from.toString(),toBlock:to.toString(),
  limited:true,eventsInspected:count,warning:'Event-based partial index; balances and owners reverified on chain'};
}
export function nftTransferCall420({standard,contract,tokenId,from,to,quantity='1'}={}){
 const asset=normalizedNftRecord420({standard,address:contract,tokenId});
 const owner=normalizeAddress(from),recipient=normalizeAddress(to);
 requireSafe(owner!==ZERO&&recipient!==ZERO&&owner!==recipient,'Unsafe NFT transfer endpoint');
 const amount=BigInt(quantity);
 requireSafe(amount>0n&&amount<=UINT256,'NFT quantity invalid');
 if(standard==='ERC721'){
  requireSafe(amount===1n,'ERC721 quantity must be exactly one');
  return {to:asset.address,value:'0x0',data:'0x42842e0e'+
   owner.slice(2).padStart(64,'0')+recipient.slice(2).padStart(64,'0')+word(asset.tokenId),
   asset,from:owner,recipient,quantity:'1'};
 }
 return {to:asset.address,value:'0x0',
  data:'0xf242432a'+owner.slice(2).padStart(64,'0')+recipient.slice(2).padStart(64,'0')+
   word(asset.tokenId)+word(amount)+word(160)+word(0),asset,from:owner,recipient,quantity:amount.toString()};
}
export function nftApprovalCall420({standard,contract,tokenId,owner,operator,approved=false,collectionWide=false}={}){
 const asset=normalizedNftRecord420({standard,address:contract,tokenId});
 const from=normalizeAddress(owner),spender=normalizeAddress(operator);
 requireSafe(from!==ZERO&&spender!==ZERO&&from!==spender,'Invalid NFT operator');
 requireSafe(typeof approved==='boolean'&&typeof collectionWide==='boolean','Explicit NFT approval choice required');
 requireSafe(standard==='ERC721'||collectionWide,'ERC1155 supports only operator-wide approvals');
 const approvalTarget=!approved&&!collectionWide?ZERO:spender;
 const data=collectionWide?'0xa22cb465'+spender.slice(2).padStart(64,'0')+word(approved?1:0):
  '0x095ea7b3'+approvalTarget.slice(2).padStart(64,'0')+word(asset.tokenId);
 // approve(address,uint256) for ERC721; do not confuse with ERC20's selector.
 return {to:asset.address,value:'0x0',data,asset,from,operator:spender,approved,collectionWide};
}
export async function verifyNftApproval420(provider,request,owner){
 const asset=normalizedNftRecord420(request.asset);
 const account=normalizeAddress(owner),op=normalizeAddress(request.operator);
 const data=request.collectionWide?'0xe985e9c5'+account.slice(2).padStart(64,'0')+
  op.slice(2).padStart(64,'0'):'0x081812fc'+word(asset.tokenId);
 const result=await provider.request('eth_call',[{to:asset.address,data},'latest']);
 requireSafe(typeof result==='string'&&WORD.test(result),'Malformed NFT approval response');
 return request.collectionWide?BigInt(result)===(request.approved?1n:0n):
  result.slice(-40).toLowerCase()===(request.approved?op.slice(2):ZERO.slice(2));
}

export async function readNftApproval420(provider,{asset,owner,operator=null,collectionWide=false}={}){
 const ref=normalizedNftRecord420(asset),from=normalizeAddress(owner);
 const verified=await verifyNftOwnership420(provider,ref,from);
 requireSafe(verified.verified,'NFT owner changed before approval inspection');
 if(ref.standard==='ERC721'&&!collectionWide){
  const response=await provider.request('eth_call',[{
   to:ref.address,data:'0x081812fc'+word(ref.tokenId)
  },'latest']);
  requireSafe(typeof response==='string'&&/^0x0{24}[0-9a-fA-F]{40}$/.test(response),
   'Malformed ERC721 getApproved address');
  return {...ref,owner:from,approvedOperator:'0x'+response.slice(-40).toLowerCase(),
   approved:response.slice(-40).toLowerCase()!==ZERO.slice(2),scope:'token'};
 }
 requireSafe(typeof operator==='string',ref.standard+' operator must be specified for collection-wide approval');
 const checked=normalizeAddress(operator);
 requireSafe(checked!==ZERO&&checked!==from,'Invalid operator for ERC1155 approval inspection');
 const response=await provider.request('eth_call',[{
  to:ref.address,data:'0xe985e9c5'+from.slice(2).padStart(64,'0')+
   checked.slice(2).padStart(64,'0')
 },'latest']);
 requireSafe(typeof response==='string'&&WORD.test(response)&&
  (BigInt(response)===0n||BigInt(response)===1n),'Invalid ERC1155 operator approval response');
 return {...ref,owner:from,operator:checked,approved:BigInt(response)===1n,scope:'collection'};
}
