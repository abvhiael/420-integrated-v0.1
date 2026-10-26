import {keccak256} from './keccak.js';
import {address} from './finalized-rpc.js';
import {SettlementError} from './buds-ledger.js';
const fail=x=>{throw new SettlementError(x);};
const hex32=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x);
const events=[
 ['organizations','OrganizationCreated(bytes32,address,bytes32)','organization'],
 ['organizations','Invitation(bytes32,address,bool)','organization'],
 ['organizations','MemberStatus(bytes32,address,uint8,uint32)','organization'],
 ['organizations','LeadershipProposed(bytes32,address,uint64)','organization'],
 ['organizations','AdministratorChanged(bytes32,address,address)','organization'],
 ['cooperatives','CooperativeCreated(bytes32,bytes32)','cooperative'],
 ['cooperatives','MemberEnrolled(bytes32,address,uint32)','cooperative'],
 ['cooperatives','MemberWithdrawn(bytes32,address,uint32)','cooperative'],
 ['governance','Proposed(bytes32,bytes32,uint32,uint32)','proposal'],
 ['governance','Voted(bytes32,address,bool)','proposal'],
 ['governance','Cancelled(bytes32)','proposal'],
 ['governance','MarkedExecuted(bytes32)','proposal']
];
export const SOCIAL_EVENT_TOPICS=Object.freeze(Object.fromEntries(events.map(([contract,signature,kind])=>[keccak256(Buffer.from(signature)),{contract,signature,kind}])));
export class CanonicalSocialEventIndexer{
 constructor({pool,rpc,contracts,scope}){
  if(!pool?.connect||!rpc?.request||!rpc?.header||!contracts||typeof scope!=='string')fail('canonical indexer dependencies required');
  Object.assign(this,{pool,rpc,contracts,scope});
 }
 async indexFinalized({txHash,principal,wallet,action}){
  if(!hex32(txHash)||typeof principal!=='string')fail('invalid journaled transaction');
  wallet=address(wallet);
  const client=await this.pool.connect();let begun=false;
  try{
   await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');begun=true;
   const existing=await client.query('SELECT principal,wallet,action,state FROM highcountry_social_intents WHERE scope=$1 AND tx_hash=$2 FOR UPDATE',[this.scope,txHash]);
   const row=existing.rows[0];
   if(!row||row.principal!==principal||row.wallet!==wallet||row.action!==action||row.state!=='finalized')fail('finalized private journal required');
   const receipt=await this.rpc.request('eth_getTransactionReceipt',[txHash]);
   const tx=await this.rpc.request('eth_getTransactionByHash',[txHash]);
   const head=await this.rpc.header();
   if(!receipt||!tx||receipt.status!=='0x1'||receipt.transactionHash?.toLowerCase()!==txHash||tx.hash?.toLowerCase()!==txHash||address(tx.from)!==wallet||
      !hex32(receipt.blockHash?.toLowerCase())||BigInt(receipt.blockNumber)>BigInt(head.number))fail('noncanonical receipt');
   const block=await this.rpc.request('eth_getBlockByNumber',[receipt.blockNumber,false]);
   if(block?.hash?.toLowerCase()!==receipt.blockHash.toLowerCase())fail('reorganized receipt');
   let indexed=0;
   for(const log of receipt.logs??[]){
    const topic=log.topics?.[0]?.toLowerCase(),def=SOCIAL_EVENT_TOPICS[topic];
    if(!def)continue;
    const canonicalAddress=address(this.contracts[def.contract]);
    if(address(log.address)!==canonicalAddress)continue;
    if(log.transactionHash?.toLowerCase()!==txHash||log.blockHash?.toLowerCase()!==receipt.blockHash.toLowerCase()||
       !hex32(log.topics?.[1]?.toLowerCase())||BigInt(log.blockNumber)!==BigInt(receipt.blockNumber))fail('invalid social event provenance');
    const entityId=log.topics[1].toLowerCase();
    const payload={signature:def.signature,topics:log.topics.map(x=>x.toLowerCase()),data:log.data};
    await client.query('INSERT INTO highcountry_social_events(scope,tx_hash,log_index,block_number,block_hash,contract_address,topic0,kind,entity_id,principal,wallet,event_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) ON CONFLICT DO NOTHING',
     [this.scope,txHash,Number(BigInt(log.logIndex)),Number(BigInt(receipt.blockNumber)),receipt.blockHash.toLowerCase(),canonicalAddress,topic,def.kind,entityId,principal,wallet,JSON.stringify(payload)]);
    indexed++;
   }
   await client.query('COMMIT');begun=false;
   return indexed;
  }catch(e){if(begun)await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 async history({kind,id,principal,wallet,cursor=null,limit=40}){
  if(!['organization','cooperative','proposal','permission'].includes(kind)||!hex32(id)||!Number.isSafeInteger(limit)||limit<1||limit>100)fail('history query forbidden');
  wallet=address(wallet);
  const lower=cursor===null?null:Number(cursor);
  if(cursor!==null&&(!Number.isSafeInteger(lower)||lower<0))fail('invalid history cursor');
  const r=await this.pool.query('SELECT tx_hash,log_index,block_number,block_hash,kind,entity_id,event_json FROM highcountry_social_events WHERE scope=$1 AND principal=$2 AND wallet=$3 AND kind=$4 AND entity_id=$5 AND canonical=true AND ($6::bigint IS NULL OR block_number < $6) ORDER BY block_number DESC,log_index DESC LIMIT $7',
   [this.scope,principal,wallet,kind,id,lower,limit+1]);
  const selected=r.rows.slice(0,limit);
  const entries=selected.map(row=>({hash:row.tx_hash,blockHash:row.block_hash,blockNumber:'0x'+BigInt(row.block_number).toString(16),logIndex:Number(row.log_index),kind:row.kind,id:row.entity_id,...row.event_json,visibleTo:[wallet],settled:false}));
  return {entries,nextCursor:r.rows.length>limit?String(selected.at(-1).block_number):null};
 }
}
