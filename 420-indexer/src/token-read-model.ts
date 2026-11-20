// Historical deployment evidence only. No current ownership or admission authority.
import type { SqlExecutor420 } from './core-projections.js';
export const TOKEN_EVENTS_420 = {
  "Registry": "0x0000000000000000000000000000000000000434",
  "ServiceID": "0x76b0de4fe89da68b19741e7d8ae6273b3ea40d74f544a0f28511091c6238a879",
  "VaultID": "0x928187054f31f4a02547fa03a1fc48de277e822b9257d95101a142f5ec216aed",
  "Published": "0x19aa152c2c4c6794d89883e0808ea2365e3f6d5267840423debc9b08db5b3608",
  "Profile": "0x19af5a8b78ed7364ffacb8ddf22ac42f4bb67c6d9532cb2b7504781867c550d9",
  "Deployed": "0x45d0e026aef0ee7a66e25a58e08aa2394ae91739474927cb0d88b8f29f2c5d5e",
  "Fee": "0x5128de580b27803c2ec8474a27324a7bb7e4eff78a40d67868e349881044741a",
  "Native": "0xb5d7700fb0cf415158b8db7cc7c39f0eab16a825c92e221404b4c8bb099b4bbb",
  "Deposit": "0xdbf530fef1f70be00976ffb4d5ad694e65f46988cca1bfdb1bf68b0e954452d4",
  "FeeWei": "42000000000000000000",
  "FeeWord": "00000000000000000000000000000000000000000000000246ddf97976680000",
  "Kind": "factory-creation-and-fee-events"
} as const;
const E = TOKEN_EVENTS_420;
export const TOKEN_TEMPLATES_420: Readonly<Record<string,string>> = {
  "0x0517055aa8d8da1332a6a60f625f6d07c05e47f5b365f33b6fec4209c040ce0a": "ERC20_FIXED",
  "0xe5156234ac9b3e54dc1c2c6e8c94a57d3b07f62ad50ced369eac4f47f60b3b1c": "ERC20_MINTABLE",
  "0xe74089deb750312b3004a6a55dd2c4ff16555e6906ff2889ed8866a787312782": "ERC20_CAPPED",
  "0x2344b056575b6fa10fb2fea2187b5b55bcab2a0de20e31be1ec08c1f617b625e": "ERC20_BURNABLE",
  "0x72295c9752e27886f56cf2a7ce4927021b7f78c35dc206b107821153c3e7d15d": "ERC20_PERMIT",
  "0xd34aaf0c10eb82c0747dc2132ddd55a9e4761d2055f9e0e76f7bb316a764019a": "ERC20_VOTES",
  "0x14293498e399ab72ce8a044fed1b6444024a16f32644162736846536bf96813c": "ERC721_COLLECTION",
  "0x29477a601d8fab1bd6524005e80cc4653ff0ac4cf32290312ffc65ff7e1cd755": "ERC1155_MULTI"
};
const addr = (v:unknown):v is string => typeof v==='string' && /^0x[0-9a-f]{40}$/.test(v) && BigInt(v)!==0n;
const hash = (v:unknown):v is string => typeof v==='string' && /^0x[0-9a-f]{64}$/.test(v) && BigInt(v)!==0n;
const word = (v:unknown):v is string => typeof v==='string' && /^0x[0-9a-f]{64}$/.test(v);
const dep = (v:unknown):v is string => addr(v) && (BigInt(v)<0x420n||BigInt(v)>0x4ffn);
const w = (v:bigint|number) => BigInt(v).toString(16).padStart(64,'0');
const aw = (v:string) => '0x'+v.slice(2).padStart(64,'0');
const fail = ():never => {throw new Error('Token deployment binding or canonical evidence unavailable');};
export interface TokenBinding420 {chainId:number;genesisHash:string;factory:string;vault:string;accounting:string;factoryCodeHash:string;metadataHash:string;manifestHash:string;dependencyRoot:string;interfaceHash:string}
export function parseTokenBinding420(raw:string):TokenBinding420 {
 const b=JSON.parse(raw) as TokenBinding420;
 const keys=['chainId','genesisHash','factory','vault','accounting','factoryCodeHash','metadataHash','manifestHash','dependencyRoot','interfaceHash'];
 if(!b||typeof b!=='object'||Object.keys(b).length!==keys.length||!keys.every(k=>Object.hasOwn(b,k))||!Number.isSafeInteger(b.chainId)||b.chainId<=0||![b.factory,b.vault,b.accounting].every(dep)||new Set([b.factory,b.vault,b.accounting]).size!==3||![b.genesisHash,b.factoryCodeHash,b.metadataHash,b.manifestHash,b.dependencyRoot,b.interfaceHash].every(hash))return fail();
 return Object.freeze(b);
}
export interface TokenDeployment420 {chainId:string;genesisHash:string;snapshotHeight:string;snapshotHash:string;token:string;creator:string;templateId:string;template:string;templateVersion:1;configHash:string;factory:string;vault:string;accounting:string;creationFeeWei:string;blockNumber:string;blockHash:string;transactionHash:string;transactionIndex:number;logIndex:number;accountingLogIndex:number;vaultLogIndex:number;feeLogIndex:number;evidenceKind:string;authoritative:false}
type Log={address:string;blockNumber:bigint;blockHash:string;txHash:string;txIndex:number;logIndex:number;topics:string[];data:string};
const sameTx=(a:Log,b:Log)=>a.blockNumber===b.blockNumber&&a.blockHash===b.blockHash&&a.txHash===b.txHash&&a.txIndex===b.txIndex;
const before=(a:Log,b:Log)=>a.blockNumber<b.blockNumber||(a.blockNumber===b.blockNumber&&a.logIndex<b.logIndex);
const is=(l:Log,a:string,t:string)=>l.address===a&&l.topics[0]===t;
const words=(s:string,n:number)=>s.length===2+n*64&&/^0x[0-9a-f]+$/.test(s)?Array.from({length:n},(_,i)=>'0x'+s.slice(2+i*64,66+i*64)):null;
const uint=(v:unknown):bigint=>{if(typeof v!=='string'||!/^(0|[1-9][0-9]*)$/.test(v))return fail();return BigInt(v);};
const idx=(v:unknown):number=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)return fail();return v;};
// Single PostgreSQL statement: snapshot/checkpoint, publication, candidate
// transaction logs and canonical block/transaction/receipt joins share MVCC.
export async function tokenDeploymentState420(db:SqlExecutor420,chainId:bigint,b:TokenBinding420|undefined,token:string):Promise<TokenDeployment420|null>{
 if(!b||BigInt(b.chainId)!==chainId||!addr(token))return fail();
 const result=await db.query(`
 WITH snapshot AS (
  SELECT c.block_number,c.block_hash FROM idx_checkpoints c
  JOIN idx_blocks tip ON tip.chain_id=c.chain_id AND tip.block_number=c.block_number AND tip.block_hash=c.block_hash
  JOIN idx_blocks genesis ON genesis.chain_id=c.chain_id AND genesis.block_number=0 AND genesis.block_hash=$2
  WHERE c.chain_id=$1
 ), candidates AS (
  SELECT DISTINCT l.tx_hash FROM idx_logs l,snapshot s
  WHERE l.chain_id=$1 AND l.block_number<=s.block_number AND lower(l.address)=$4 AND l.topics->>0=$7 AND l.topics->>1=$8
 ), selected AS (
  SELECT l.* FROM idx_logs l,snapshot s
  WHERE l.chain_id=$1 AND l.block_number<=s.block_number AND
   ((lower(l.address)=$3 AND l.topics->>1=$9 AND l.topics->>0 IN ($10,$11)) OR
    (lower(l.address) IN ($4,$5,$6) AND l.tx_hash IN (SELECT tx_hash FROM candidates)))
 )
 SELECT s.block_number::text AS snapshot_height,s.block_hash AS snapshot_hash,
 l.address,l.block_number::text AS block_number,l.block_hash,l.tx_hash,l.tx_index,l.log_index,l.topics,l.data,
 (blk.block_hash=l.block_hash AND tx.block_number=l.block_number AND tx.block_hash=l.block_hash AND tx.tx_index=l.tx_index AND receipt.block_number=l.block_number AND receipt.block_hash=l.block_hash AND receipt.tx_index=l.tx_index AND receipt.status=1) AS provenance_ok
 FROM snapshot s LEFT JOIN selected l ON true
 LEFT JOIN idx_blocks blk ON blk.chain_id=l.chain_id AND blk.block_number=l.block_number
 LEFT JOIN idx_transactions tx ON tx.chain_id=l.chain_id AND tx.tx_hash=l.tx_hash
 LEFT JOIN idx_receipts receipt ON receipt.chain_id=l.chain_id AND receipt.tx_hash=l.tx_hash
 `,[chainId.toString(),b.genesisHash,E.Registry,b.factory,b.vault,b.accounting,E.Deployed,aw(token),E.ServiceID,E.Published,E.Profile]);
 const rows=(result as {rows?:Record<string,unknown>[]}).rows;if(!rows?.length)return fail();
 const height=uint(rows[0].snapshot_height);const snapshotHash=rows[0].snapshot_hash;if(!hash(snapshotHash))return fail();
 const logs:Log[]=[];const seen=new Set<string>();
 for(const r of rows){
  if(r.snapshot_height!==height.toString()||r.snapshot_hash!==snapshotHash)return fail();
  if(r.address===null)continue;
  if(r.provenance_ok!==true||!addr(r.address)||!hash(r.block_hash)||!hash(r.tx_hash)||!Array.isArray(r.topics)||!r.topics.every(word)||typeof r.data!=='string')return fail();
  const l:Log={address:r.address,blockNumber:uint(r.block_number),blockHash:r.block_hash,txHash:r.tx_hash,txIndex:idx(r.tx_index),logIndex:idx(r.log_index),topics:r.topics as string[],data:r.data};
  const key=l.blockNumber+':'+l.logIndex;if(l.blockNumber>height||(l.blockNumber===height&&l.blockHash!==snapshotHash)||seen.has(key))return fail();seen.add(key);logs.push(l);
 }
 const v1=logs.filter(l=>l.address===E.Registry&&l.topics[1]===E.ServiceID&&l.topics[2]==='0x'+w(1));
 const pubs=v1.filter(l=>l.topics[0]===E.Published),profiles=v1.filter(l=>l.topics[0]===E.Profile);
 if(pubs.length!==1||profiles.length!==1)return fail();
 const pub=pubs[0],profile=profiles[0];
 if(pub.topics.length!==4||pub.topics[3]!==aw(b.factory)||pub.data!=='0x'+b.factoryCodeHash.slice(2)+b.metadataHash.slice(2)+w(1)||profile.topics.length!==3||profile.data!=='0x'+w(3)+b.manifestHash.slice(2)+b.dependencyRoot.slice(2)+b.interfaceHash.slice(2)||!sameTx(pub,profile)||!before(pub,profile))return fail();
 const matches=logs.filter(l=>is(l,b.factory,E.Deployed)&&l.topics[1]===aw(token));if(matches.length===0)return null;if(matches.length!==1)return fail();
 const c=matches[0],fields=words(c.data,3),template=TOKEN_TEMPLATES_420[c.topics[3]],creator='0x'+(c.topics[2]??'').slice(26);
 if(!before(profile,c)||c.topics.length!==4||c.topics[2]!==aw(creator)||!addr(creator)||!template||!fields||fields[0]!=='0x'+w(1)||fields[2]!=='0x'+E.FeeWord||[creator,b.factory,b.vault,b.accounting].includes(token))return fail();
 const next=Math.min(Infinity,...logs.filter(l=>sameTx(l,c)&&is(l,b.factory,E.Deployed)&&l.logIndex>c.logIndex).map(l=>l.logIndex));
 const segment=logs.filter(l=>sameTx(l,c)&&l.logIndex>c.logIndex&&l.logIndex<next);
 const fees=segment.filter(l=>is(l,b.factory,E.Fee)),natives=segment.filter(l=>is(l,b.vault,E.Native)),deposits=segment.filter(l=>is(l,b.accounting,E.Deposit)&&l.topics[1]===E.VaultID&&l.topics[2]==='0x'+w(0));
 if(fees.length!==1||natives.length!==1||deposits.length!==1)return fail();
 const f=fees[0],n=natives[0],d=deposits[0],dw=words(d.data,2);
 if(f.topics.length!==3||f.topics[1]!==aw(b.vault)||f.topics[2]!==E.VaultID||f.data!=='0x'+E.FeeWord||n.topics.length!==2||n.topics[1]!==aw(b.factory)||n.data!=='0x'+E.FeeWord||d.topics.length!==3||!dw||dw[0]!=='0x'+E.FeeWord||BigInt(dw[1])<BigInt(E.FeeWei)||!(d.logIndex<n.logIndex&&n.logIndex<f.logIndex))return fail();
 return {chainId:chainId.toString(),genesisHash:b.genesisHash,snapshotHeight:height.toString(),snapshotHash,token,creator,templateId:c.topics[3],template,templateVersion:1,configHash:fields[1],factory:b.factory,vault:b.vault,accounting:b.accounting,creationFeeWei:E.FeeWei,blockNumber:c.blockNumber.toString(),blockHash:c.blockHash,transactionHash:c.txHash,transactionIndex:c.txIndex,logIndex:c.logIndex,accountingLogIndex:d.logIndex,vaultLogIndex:n.logIndex,feeLogIndex:f.logIndex,evidenceKind:E.Kind,authoritative:false};
}
