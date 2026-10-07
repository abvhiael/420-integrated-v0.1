import {Interface} from 'ethers';
import {assertPublicAttentionValue420} from './privacy.js';
const EVENT_ABI=[
 'event CampaignCreated(bytes32 indexed campaignId,address indexed sponsor,address indexed verifier,uint256 declaredBudget)',
 'event CampaignActivated(bytes32 indexed campaignId)','event CampaignPaused(bytes32 indexed campaignId)','event CampaignClosed(bytes32 indexed campaignId)','event CampaignCancelled(bytes32 indexed campaignId)',
 'event CampaignFunded(bytes32 indexed campaignId,address indexed sponsor,uint256 amount)','event RewardReserved(bytes32 indexed campaignId,bytes32 indexed rewardId,uint256 amount)','event RewardReleased(bytes32 indexed campaignId,bytes32 indexed rewardId,address indexed recipient,uint256 amount)','event CampaignRefunded(bytes32 indexed campaignId,address indexed sponsor,uint256 amount)',
 'event GlobalConsentSet(address indexed account,bool enabled,uint64 revision,bytes32 policyHash)','event CampaignConsentSet(address indexed account,bytes32 indexed campaignId,bool enabled,uint64 revision,bytes32 policyHash)',
 'event AttentionProofCommitted(bytes32 indexed proofId,bytes32 indexed campaignId,address indexed account,uint64 attentionUnits,bytes32 evidenceHash)',
 'event RewardAccrued(bytes32 indexed rewardId,bytes32 indexed campaignId,address indexed account,uint256 amount,bytes32 proofId)','event RewardClaimed(bytes32 indexed rewardId,address indexed account,uint256 amount)'
];
const campaignView=new Interface(['function campaign(bytes32) view returns (address sponsor,address verifier,bytes32 metadataHash,bytes32 audiencePolicyHash,uint256 declaredBudget,uint256 rewardPerUnit,uint256 maxRewardPerAccount,uint64 startsAt,uint64 endsAt,uint8 state)']);
const proofView=new Interface(['function proof(bytes32) view returns (bytes32 campaignId,address account,address verifier,uint64 observedAt,uint64 attentionUnits,bytes32 evidenceHash,bool exists)']);
const iface=new Interface(EVENT_ABI);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const jsonSafe=v=>typeof v==='bigint'?v.toString():v;
async function fetchJson(fetchImpl,url,options,retries,baseMs){
  let last;for(let i=0;i<=retries;i++){try{const r=await fetchImpl(url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',...options});if(r.ok)return r.json();if(r.status<500&&r.status!==429)throw new Error('upstream '+r.status);last=new Error('upstream '+r.status);}catch(e){last=e;}if(i<retries)await sleep(baseMs*(2**i));}throw last;
}
export class AttentionIndexerSource420{
  constructor({chainId,indexerBaseUrl,rpcUrl,contracts,fetchImpl=globalThis.fetch,maxRetries=3,retryBaseMs=100}){
    this.chainId=String(chainId);this.indexer=indexerBaseUrl.replace(/\/$/,'');this.rpc=rpcUrl;this.contracts=contracts;this.fetch=fetchImpl;this.maxRetries=maxRetries;this.retryBaseMs=retryBaseMs;
  }
  async rpcCall(to,data,block='latest'){const body={jsonrpc:'2.0',id:1,method:'eth_call',params:[{to,data},block]};const p=await fetchJson(this.fetch,this.rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},this.maxRetries,this.retryBaseMs);if(p.error)throw new Error('rpc eth_call failed');return p.result;}
  async logs(address){
    const out=[];let cursor=null;
    do{const q=new URLSearchParams({chainId:this.chainId,address,limit:'200',direction:'asc'});if(cursor)q.set('cursor',cursor);const p=await fetchJson(this.fetch,`${this.indexer}/v1/logs?${q}`,{},this.maxRetries,this.retryBaseMs);if(p?.apiVersion!=='v1'||!p?.data||!Array.isArray(p.data.items))throw new Error('invalid Indexer log response');out.push(...p.data.items);cursor=p.data.nextCursor??null;}while(cursor);return out;
  }
  async enrich(event){
    if(event.eventName==='CampaignCreated'){const data=campaignView.encodeFunctionData('campaign',[event.fields.campaignId]);const raw=await this.rpcCall(this.contracts.campaignRegistry,data,'0x'+BigInt(event.blockNumber).toString(16));const c=campaignView.decodeFunctionResult('campaign',raw);Object.assign(event.fields,{sponsor:c.sponsor,verifier:c.verifier,metadataHash:c.metadataHash,audiencePolicyHash:c.audiencePolicyHash,declaredBudget:c.declaredBudget.toString(),rewardPerUnit:c.rewardPerUnit.toString(),maxRewardPerAccount:c.maxRewardPerAccount.toString(),startsAt:c.startsAt.toString(),endsAt:c.endsAt.toString()});}
    if(event.eventName==='AttentionProofCommitted'){const data=proofView.encodeFunctionData('proof',[event.fields.proofId]);const raw=await this.rpcCall(this.contracts.proofRegistry,data,'0x'+BigInt(event.blockNumber).toString(16));const p=proofView.decodeFunctionResult('proof',raw);Object.assign(event.fields,{campaignId:p.campaignId,account:p.account,verifier:p.verifier,observedAt:p.observedAt.toString(),attentionUnits:p.attentionUnits.toString(),evidenceHash:p.evidenceHash});}
    return event;
  }
  async rebuildEvents(){
    const addresses=[this.contracts.campaignRegistry,this.contracts.attentionTreasury,this.contracts.consentRegistry,this.contracts.proofRegistry,this.contracts.rewardRegistry].filter(Boolean);const all=[];
    for(const address of addresses)for(const log of await this.logs(address)){let parsed;try{parsed=iface.parseLog({topics:log.topics,data:log.data});}catch{continue;}if(!parsed)continue;const fields={};parsed.fragment.inputs.forEach((input,i)=>{fields[input.name]=jsonSafe(parsed.args[i]);});const event={chainId:log.chainId,blockNumber:log.blockNumber,blockHash:log.blockHash,transactionHash:log.transactionHash,transactionIndex:log.transactionIndex,logIndex:log.logIndex,contractAddress:log.address,eventName:parsed.name,fields};assertPublicAttentionValue420(fields);all.push(await this.enrich(event));}
    return all;
  }
}
