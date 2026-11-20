import {readSale,call,address,hash} from './consumer.mjs';
import {wordHex,decodeAddress,decodeUint,decodeBool,hexUtf8} from './abi.mjs';
const MODES=['NONE','REWARD','DONATION','COMMUNITY_PROJECT','PRODUCT_PREORDER'];
const LOGS=[
  {name:'contributions',sig:'ContributionRecorded(bytes32,address,uint128,bytes32)',from:'allocation',saleIndex:1,amount:true},
  {name:'claims',sig:'AllocationClaimed(bytes32,address,uint128,bytes32)',from:'allocation',saleIndex:1,amount:true},
  {name:'refunds',sig:'RefundRecorded(bytes32,address,uint128,bytes32)',from:'allocation',saleIndex:1,amount:true},
  {name:'fulfillment',sig:'DeliveryEvidenceBound(bytes32,address,bytes32,uint128)',from:'crowd',saleIndex:1,amount:true},
  {name:'deliveryAttestations',sig:'DeliveryAttested(bytes32,address,bytes32)',from:'crowd',saleIndex:1},
  {name:'disputes',sig:'DisputeLinked(bytes32,address,bytes32)',from:'crowd',saleIndex:1},
  {name:'finalizedDisputeOutcomes',sig:'DisputeOutcomePublished(bytes32,address,bytes32,uint32,bytes32,bytes32)',from:'crowd',saleIndex:1},
  {name:'reputationEvidence',sig:'ReputationEvidencePublished(bytes32,bytes32,bytes32,address,bytes32,bytes32)',from:'crowd',saleIndex:2}
];
const addrEq=(a,b)=>a.toLowerCase()===b.toLowerCase();
const ZERO='0x'+'0'.repeat(40);
function rejected(message){throw Object.assign(new Error(message),{statusCode:403});}
async function projectInfo(rpc,rt,projectId){
  const p=await call(rpc,rt.projectRegistryAddress,'project(bytes32)',[wordHex(projectId)]);
  return {controller:decodeAddress(p,0),saleAsset:decodeAddress(p,1),metadataHash:'0x'+p.slice(130,194).toLowerCase(),
    issuanceCommitment:'0x'+p.slice(194,258).toLowerCase(),active:decodeBool(p,4),exists:decodeBool(p,5)};
}
async function sourceSnapshot(rpc){
  const [chainId,block]=await Promise.all([rpc.call('eth_chainId',[]),rpc.call('eth_getBlockByNumber',['latest',false])]);
  if(!/^0x[0-9a-fA-F]{64}$/.test(block?.hash||''))throw new Error('unverified creator reporting block');
  return {chainId,blockHash:block.hash,blockNumber:block.number};
}
export async function creatorReport(rpc,rt,account,saleId,{fromBlock=null}={}){
  const who=address(account),id=hash(saleId);
  const [sale,source]=await Promise.all([readSale(rpc,rt,id),sourceSnapshot(rpc)]);
  if(source.chainId.toLowerCase()!==rt.chainId.toLowerCase())throw new Error('creator chain mismatch');
  const [project,modeBytes,refundedRaw]=await Promise.all([
    projectInfo(rpc,rt,sale.projectId),
    call(rpc,rt.crowdfundingIntegrationAddress,'campaignMode(bytes32)',[wordHex(id)]),
    call(rpc,rt.crowdfundingIntegrationAddress,'reconciledSaleRefundPrincipal(bytes32)',[wordHex(id)])
  ]);
  if(!project.exists||!addrEq(project.controller,who))rejected('caller is not the canonical project controller');
  const mode=MODES[Number(decodeUint(modeBytes))];
  if(!mode)throw new Error('invalid canonical creator campaign mode');
  const recordedRefundPrincipal=decodeUint(refundedRaw).toString();
  const report={schema:'420-launchpad-creator-report-v1',canonical:true,source,account:who,projectId:sale.projectId,
    saleId:id,project,sale,mode,
    approval:!project.active?'PROJECT_INACTIVE':mode==='NONE'?'GOVERNANCE_MODE_PENDING':
      sale.state==='SCHEDULED'?'GOVERNANCE_APPROVED_SCHEDULED':sale.state==='ACTIVE'?'ACTIVE':sale.state,
    grossRecordedFunding:sale.raised,recordedRefundPrincipal,
    historicalRaisedIsNotNet:true,events:null,
    coverage:{available:false,reason:'Historical event reporting requires a configured canonical deployment start block; gross funding and reconciled principal remain on-chain',fromBlock:null,throughBlock:source.blockNumber,completeFromGenesis:false}};
  if(fromBlock===null||fromBlock===undefined)return report;
  const start=BigInt(fromBlock),end=BigInt(source.blockNumber);
  if(start<0n||start>end||end-start>100000n)throw new Error('creator reporting window out of bounds (max 100000 blocks)');
  const topicMap=await Promise.all(LOGS.map(async spec=>({
    ...spec,topic:(await rpc.call('web3_sha3',[hexUtf8(spec.sig)])).toLowerCase(),
    address:spec.from==='allocation'?rt.allocationRegistryAddress:rt.crowdfundingIntegrationAddress
  })));
  const events=Object.fromEntries(LOGS.map(x=>[x.name,{count:0,participants:0,...(x.amount?{amount:'0'}:{})}]));
  const participants=Object.fromEntries(LOGS.map(x=>[x.name,new Set()]));
  const seen=new Set();
  // Query in bounded slices for providers that enforce eth_getLogs range limits.
  for(let n=start;n<=end;n+=2000n){
    const until=n+1999n<end?n+1999n:end;
    for(const spec of topicMap){
      const topics=spec.saleIndex===1?[spec.topic,id]:[spec.topic,null,id];
      const logs=await rpc.call('eth_getLogs',[{address:spec.address,topics,
        fromBlock:'0x'+n.toString(16),toBlock:'0x'+until.toString(16)}]);
      if(!Array.isArray(logs)||logs.length>2000)throw new Error('creator event reporting returned incomplete or oversized batch');
      for(const log of logs){
        if(!addrEq(log.address||ZERO,spec.address)||!Array.isArray(log.topics)||
          log.topics[0]?.toLowerCase()!==spec.topic||log.topics[spec.saleIndex]?.toLowerCase()!==id||
          !/^0x[0-9a-fA-F]{64}$/.test(log.blockHash||'')||!/^0x[0-9a-fA-F]{64}$/.test(log.transactionHash||'')||
          log.removed===true||!/^0x[0-9a-fA-F]+$/.test(log.logIndex||''))throw new Error('noncanonical creator event');
        const logKey=log.transactionHash.toLowerCase()+':'+log.logIndex.toLowerCase()+':'+spec.name;
        if(seen.has(logKey))throw new Error('duplicate canonical creator event');seen.add(logKey);
        events[spec.name].count++;
        if(spec.amount){
          if(!/^0x[0-9a-fA-F]{128}$/.test(log.data||''))throw new Error('malformed creator event amount');
          const raw=decodeUint(log.data);
          if(raw>(1n<<128n)-1n)throw new Error('invalid creator event amount');
          events[spec.name].amount=(BigInt(events[spec.name].amount)+raw).toString();
        }
        if(spec.saleIndex===1&&log.topics[2])participants[spec.name].add(log.topics[2].toLowerCase());
      }
    }
  }
  // A moving chain head invalidates the report; do not claim provenance from an old snapshot.
  const post=await rpc.call('eth_getBlockByNumber',[source.blockNumber,false]);
  if(post?.hash?.toLowerCase()!==source.blockHash.toLowerCase())throw new Error('creator event scan reorged; retry');
  for(const spec of LOGS)events[spec.name].participants=participants[spec.name].size;
  report.events=events;
  report.coverage={available:true,fromBlock:'0x'+start.toString(16),throughBlock:source.blockNumber,
    completeFromGenesis:start===0n,reason:start===0n?'Genesis-to-head canonical logs':'Partial event window; do not present counts as all-time'};
  return report;
}
export async function creatorCampaigns(rpc,rt,projection,account){
  const who=address(account),p=projection.read(),results=[],seen=new Set();
  // The indexer is discovery only. Each candidate is independently authorized by its project contract.
  const candidates=p.items.filter(x=>x.controller&&addrEq(x.controller,who));
  if(candidates.length>50)throw Object.assign(new Error('creator campaign discovery exceeds 50 records; use individual sale lookup'),{statusCode:400});
  for(const c of candidates){
    if(!/^0x[0-9a-fA-F]{64}$/.test(c.saleId||'')||seen.has(c.saleId))continue;
    seen.add(c.saleId);
    const s=await readSale(rpc,rt,c.saleId);
    if(!addrEq(s.projectId,c.projectId))throw new Error('creator projection changed sale project identity');
    const p=await projectInfo(rpc,rt,s.projectId);
    if(!p.exists||!addrEq(p.controller,who))continue;
    const mode=Number(decodeUint(await call(rpc,rt.crowdfundingIntegrationAddress,'campaignMode(bytes32)',[wordHex(c.saleId)])));
    if(!MODES[mode])throw new Error('invalid on-chain creator mode');
    results.push({saleId:s.saleId,projectId:s.projectId,title:String(c.title||'Untitled campaign').slice(0,120),
      state:s.state,mode:MODES[mode],grossRaised:s.raised,hardCap:s.hardCap,endsAt:s.endsAt,
      approvals:MODES[mode]==='NONE'?'MODE_PENDING':s.state});
  }
  return {schema:'420-launchpad-creator-campaigns-v1',canonical:true,source:p.source,
    account:who,items:results,discoveryOnly:true,note:'Only campaigns discovered in the provenance-stamped projection are listed; use sale ID lookup for any missing campaign'};
}
