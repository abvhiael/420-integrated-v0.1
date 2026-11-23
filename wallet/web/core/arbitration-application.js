// Canonical 420Arbitration application transport. Read-only discovery is delegated
// to ARB-PRE-03. This module neither creates signer identities nor signs transactions.
import {createVerifiedArbitrationWallet420} from './arbitration-verified.js';
import {tokenHashText420,tokenReadCall420} from './token-sdk.js';
import {readWalletTransactionStatus420} from './transaction-lifecycle.js';

const HASH=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HEX=/^0x(?:[0-9a-fA-F]{2})*$/;
const QTY=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const check=(ok,message)=>{if(!ok)throw Error(message);};
const hash=(v,label='commitment')=>{check(typeof v==='string'&&HASH.test(v)&&BigInt(v)!==0n,'invalid '+label);return v.toLowerCase();};
const address=(v)=>{check(typeof v==='string'&&ADDRESS.test(v)&&BigInt(v)!==0n,'invalid address');return v.toLowerCase();};
const quantity=(v)=>{check(typeof v==='string'&&QTY.test(v),'invalid RPC quantity');return BigInt(v);};
const words=(raw,count)=>{
  check(typeof raw==='string'&&HEX.test(raw)&&raw.length===2+count*64,'malformed Arbitration ABI response');
  return Array.from({length:count},(_,i)=>raw.slice(2+i*64,66+i*64).toLowerCase());
};
const decodeAddress=w=>{check(BigInt('0x'+w)<(1n<<160n),'malformed Arbitration ABI address');return '0x'+w.slice(24);};
const decodeBool=w=>{check(BigInt('0x'+w)<=1n,'malformed Arbitration ABI bool');return BigInt('0x'+w)===1n;};
const num=(w,bits=256)=>{const x=BigInt('0x'+w);check(x<(1n<<BigInt(bits)),'malformed Arbitration ABI integer');return x;};
const hexWord=w=>'0x'+w;
const enumState=['NONE','OPEN','RULED','FINALIZED'];
const encoder=new TextEncoder();
const event=name=>tokenHashText420(name);
export const ARBITRATION_EVENTS_420=Object.freeze({
  opened:event('CaseOpened(bytes32,bytes32,address,address,bytes32,bytes32)'),
  evidence:event('EvidenceCommitted(bytes32,uint8,address,bytes32)'),
  ruled:event('CaseRuled(bytes32,uint8,uint64)'),
  appealed:event('CaseAppealed(bytes32,uint8,address,uint64)'),
  finalized:event('CaseFinalized(bytes32,uint8)'),
  ruling:event('RulingSubmitted(bytes32,uint8,address,uint32,bytes32,bytes32,bytes32)'),
  rulingFinalized:event('RulingFinalized(bytes32,uint8,bytes32,bytes32)'),
});
const EVENT_BY_TOPIC=new Map(Object.entries(ARBITRATION_EVENTS_420).map(([k,v])=>[v,k]));
const actionTypes=Object.freeze({
  openCase:{sig:'openCase(bytes32,address,bytes32,bytes32,bytes32,bytes32)',types:['bytes32','address','bytes32','bytes32','bytes32','bytes32']},
  submitEvidence:{sig:'submitEvidence(bytes32,bytes32)',types:['bytes32','bytes32']},
  appeal:{sig:'appeal(bytes32)',types:['bytes32']},
  submitRuling:{sig:'submitRuling(bytes32,uint32,bytes32,bytes32,bytes32)',types:['bytes32','uint256','bytes32','bytes32','bytes32']},
  finalizeRuling:{sig:'finalizeRuling(bytes32)',types:['bytes32']},
});
const same=(x,y)=>x===y;
const lower=(a)=>a.toLowerCase();
const role=(record,user)=>{
  if(record.claimant===user)return 'Claimant';
  if(record.respondent===user)return 'Respondent';
  if((record.round===0?record.resolver:record.appealResolver)===user)return 'Resolver';
  return 'Observer';
};
const canAppeal=(r,now,user)=>r.state==='RULED'&&now<=r.appealDeadline&&
  r.round<r.maxAppeals&&(r.claimant===user||r.respondent===user);
const canEvidence=(r,now,user)=>r.state==='OPEN'&&now<=r.evidenceDeadline&&
  (r.claimant===user||r.respondent===user);
const canRule=(r,user)=>r.state==='OPEN'&&(r.round===0?r.resolver:r.appealResolver)===user;
const canFinalize=(r,now)=>r.state==='RULED'&&now>r.appealDeadline;

function parsePolicy(w){
  return Object.freeze({resolver:decodeAddress(w[0]),appealResolver:decodeAddress(w[1]),
    evidenceWindow:num(w[2],64),appealWindow:num(w[3],64),
    maxAppeals:Number(num(w[4],8)),active:decodeBool(w[5]),exists:decodeBool(w[6])});
}
function parseCase(id,w){
  check(decodeBool(w[17]),'Arbitration case does not exist');
  const stateNumber=Number(num(w[16],8));
  check(enumState[stateNumber]&&stateNumber!==0,'malformed Arbitration case state');
  return Object.freeze({id,claimant:decodeAddress(w[0]),respondent:decodeAddress(w[1]),
    domainId:hexWord(w[2]),originComponentId:hexWord(w[3]),originObjectId:hexWord(w[4]),
    claimHash:hexWord(w[5]),requestedRemedyHash:hexWord(w[6]),
    resolver:decodeAddress(w[7]),appealResolver:decodeAddress(w[8]),
    evidenceWindow:num(w[9],64),appealWindow:num(w[10],64),openedAt:num(w[11],64),
    evidenceDeadline:num(w[12],64),appealDeadline:num(w[13],64),
    maxAppeals:Number(num(w[14],8)),round:Number(num(w[15],8)),state:enumState[stateNumber]});
}
function parseRuling(w,round){
  check(decodeBool(w[6]),'Arbitration ruling does not exist');
  return Object.freeze({round,outcomeCode:num(w[0],32),rulingHash:hexWord(w[1]),
    remedyCommitment:hexWord(w[2]),panelCommitment:hexWord(w[3]),
    resolver:decodeAddress(w[4]),ruledAt:num(w[5],64)});
}
function parseEvent(log){
  check(log&&typeof log==='object'&&Array.isArray(log.topics),'malformed Arbitration event');
  const kind=EVENT_BY_TOPIC.get(lower(log.topics[0]||''));
  check(kind&&log.topics.length===(['opened','evidence','appealed','ruling'].includes(kind)?4:3),
    'unexpected Arbitration event topics');
  const id=hash(log.topics[1],'case identifier'),roundTopic=kind==='opened'?null:num(words(log.topics[2],1)[0],8);
  const indexedActor=['evidence','appealed','ruling'].includes(kind)?decodeAddress(words(log.topics[3],1)[0]):
    kind==='opened'?decodeAddress(words(log.topics[3],1)[0]):null;
  const expected={opened:3,evidence:1,ruled:1,appealed:1,finalized:0,ruling:4,rulingFinalized:2}[kind];
  const w=words(log.data,expected);
  return Object.freeze({kind,caseId:id,round:roundTopic===null?0:Number(roundTopic),
    actor:indexedActor,domainId:kind==='opened'?hexWord(words(log.topics[2],1)[0]):null,
    details:kind==='opened'?{respondent:decodeAddress(w[0]),originComponentId:hexWord(w[1]),originObjectId:hexWord(w[2])}:
      kind==='evidence'?{evidenceHash:hexWord(w[0])}:
      kind==='ruled'?{appealDeadline:num(w[0],64)}:
      kind==='appealed'?{evidenceDeadline:num(w[0],64)}:
      kind==='ruling'?{outcomeCode:num(w[0],32),rulingHash:hexWord(w[1]),remedyCommitment:hexWord(w[2]),panelCommitment:hexWord(w[3])}:
      kind==='rulingFinalized'?{rulingHash:hexWord(w[0]),remedyCommitment:hexWord(w[1])}:{},
    blockNumber:quantity(log.blockNumber),blockHash:hash(log.blockHash,'event block hash'),
    transactionHash:hash(log.transactionHash,'event transaction hash'),
    logIndex:quantity(log.logIndex)});
}
const reviewKey=r=>[r.id,r.round,r.state,r.resolver,r.appealResolver,r.evidenceDeadline,
  r.appealDeadline,r.maxAppeals,r.domainId,r.originComponentId,r.originObjectId].join('|');

export function createArbitrationApplication420({provider,release,account,domains=[]}){
  check(provider&&typeof provider.request==='function','Arbitration Wallet provider required');
  const user=address(account),verifier=createVerifiedArbitrationWallet420({provider,release,account:user});
  const supplied=domains.map(d=>{
    check(d&&typeof d.name==='string'&&d.name.length>0&&d.name.length<120,'invalid arbitration domain name');
    return Object.freeze({name:d.name,id:hash(d.id,'arbitration domain')});
  });
  check(new Set(supplied.map(d=>d.id)).size===supplied.length,'duplicate arbitration domains');
  let generation=0;
  const proposals=new WeakMap(),received=new Map();
  const rpc=(method,params=[])=>provider.request(method,params);
  async function verified(){const s=await verifier.discover();check(s.account===user,'Wallet session mismatch');return s;}
  async function read(target,sig,types,values,count,block){
    return words(await rpc('eth_call',[{to:target,data:tokenReadCall420(sig,types,values)},block]),count);
  }
  async function clock(snapshot){
    const b=await rpc('eth_getBlockByNumber',[snapshot.block,false]);
    check(b&&b.hash?.toLowerCase()===snapshot.blockHash,'Arbitration chain reorganized');
    return quantity(b.timestamp);
  }
  async function caseAt(snapshot,id) {
    return parseCase(hash(id,'case identifier'),await read(snapshot.binding.dependencies.cases.address,
      'getCase(bytes32)',['bytes32'],[id],18,snapshot.block));
  }
  async function policyAt(snapshot,id) {
    return parsePolicy(await read(snapshot.binding.dependencies.policies.address,
      'getPolicy(bytes32)',['bytes32'],[id],7,snapshot.block));
  }
  async function rulingAt(snapshot,id,round){
    check(Number.isInteger(round)&&round>=0&&round<=3,'invalid arbitration round');
    return parseRuling(await read(snapshot.binding.dependencies.rulings.address,'getRuling(bytes32,uint8)',
      ['bytes32','uint256'],[id,round],7,snapshot.block),round);
  }
  async function guardedSnapshot(){
    const s=await verified(),now=await clock(s);
    return {s,now};
  }
  async function policies(){
    const {s,now}=await guardedSnapshot(),items=[];
    for(const d of supplied) {
      try{const policy=await policyAt(s,d.id);if(policy.active&&policy.exists)items.push({...d,policy});}
      catch{ /* Unregistered or disabled policies are never selectable */ }
    }
    return Object.freeze({domains:Object.freeze(items),block:s.block,now});
  }
  async function detail(id){
    id=hash(id,'case identifier');
    const {s,now}=await guardedSnapshot(),record=await caseAt(s,id);
    const rulings=[];
    for(let round=0;round<=record.round;round++){
      try{rulings.push(await rulingAt(s,id,round));}
      catch(e){if(round<record.round||record.state!=='OPEN')throw e;}
    }
    const history=await historyAt(s,id);
    return Object.freeze({...record,role:role(record,user),now,
      permissions:Object.freeze({evidence:canEvidence(record,now,user),appeal:canAppeal(record,now,user),
        rule:canRule(record,user),finalize:canFinalize(record,now)}),
      rulings:Object.freeze(rulings),history:Object.freeze(history)});
  }
  async function logsAt(s,topics,from,to){
    const addresses=[s.binding.dependencies.cases.address,s.binding.dependencies.rulings.address];
    const result=await rpc('eth_getLogs',[{address:addresses,fromBlock:'0x'+from.toString(16),
      toBlock:'0x'+to.toString(16),topics}]);
    check(Array.isArray(result)&&result.length<=2000,'Arbitration event page too large');
    const blocks=new Map(),seen=new Set(),items=[];
    for(const log of result){
      check(addresses.includes(address(log.address)),'Arbitration event emitter mismatch');
      const event=parseEvent(log);
      check(event.blockNumber>=from&&event.blockNumber<=to,'Arbitration event outside requested range');
      const key=event.transactionHash+'/'+event.logIndex;
      check(!seen.has(key),'duplicated Arbitration chain log');seen.add(key);
      if(!blocks.has(event.blockNumber.toString())){
        const b=await rpc('eth_getBlockByNumber',['0x'+event.blockNumber.toString(16),false]);
        check(b&&hash(b.hash,'block hash')===event.blockHash,'Arbitration event log not canonical');
        blocks.set(event.blockNumber.toString(),event.blockHash);
      }
      items.push(event);
    }
    items.sort((a,b)=>a.blockNumber===b.blockNumber?
      (a.logIndex<b.logIndex?-1:1):(a.blockNumber<b.blockNumber?-1:1));
    return items;
  }
  async function historyAt(s,id){
    const tip=quantity(s.block),size=2500n,events=[];
    for(let end=tip;end>=0n;){
      const from=end>=size?end-size+1n:0n;
      const page=await logsAt(s,[[...Object.values(ARBITRATION_EVENTS_420)],id],from,end);
      events.unshift(...page);
      if(from===0n)break;
      end=from-1n;
    }
    return events;
  }
  async function dashboard({before=null,range=2500}={}){
    check(Number.isInteger(range)&&range>0&&range<=10000,'invalid Arbitration page size');
    const {s,now}=await guardedSnapshot();
    const top=quantity(s.block),end=before===null?top:BigInt(before);
    check(end>=0n&&end<=top,'invalid Arbitration event cursor');
    const start=end>=BigInt(range)?end-BigInt(range)+1n:0n;
    const opened=await logsAt(s,[ARBITRATION_EVENTS_420.opened],start,end);
    const ids=[...new Set(opened.map(e=>e.caseId))],records=[];
    for(const id of ids){
      const record=await caseAt(s,id),r=role(record,user);
      if(record.claimant===user||record.respondent===user||r==='Resolver')
        records.push({...record,role:r,permissions:{evidence:canEvidence(record,now,user),
          appeal:canAppeal(record,now,user),rule:canRule(record,user),finalize:canFinalize(record,now)}});
    }
    return Object.freeze({cases:Object.freeze(records),nextBefore:start===0n?null:start-1n,
      now,block:s.block});
  }
  async function build(action,fields,s,now){
    check(Object.hasOwn(actionTypes,action),'unsupported Arbitration action');
    let args,record=null;
    if(action==='openCase'){
      const domainId=hash(fields.domainId,'arbitration domain');
      check(supplied.some(x=>x.id===domainId),'Arbitration domain is not configured');
      const policy=await policyAt(s,domainId);
      check(policy.exists&&policy.active,'Arbitration policy inactive');
      const respondent=address(fields.respondent);
      check(respondent!==user,'claimant and respondent must differ');
      args=[domainId,respondent,hash(fields.originComponentId,'origin component'),
        hash(fields.originObjectId,'origin object'),hash(fields.claimHash,'claim commitment'),
        hash(fields.requestedRemedyHash,'requested remedy commitment')];
    }else{
      const id=hash(fields.caseId,'case identifier');
      record=await caseAt(s,id);
      if(action==='submitEvidence'){
        check(canEvidence(record,now,user),'Arbitration evidence unavailable for this account or deadline');
        args=[id,hash(fields.evidenceHash,'evidence commitment')];
      }else if(action==='appeal'){
        check(canAppeal(record,now,user),'Arbitration appeal unavailable for this account or deadline');
        args=[id];
      }else if(action==='submitRuling'){
        check(canRule(record,user),'Arbitration resolver unauthorized for the current round');
        const outcome=fields.outcomeCode;
        check(Number.isSafeInteger(outcome)&&outcome>0&&outcome<=0xffffffff,'invalid ruling outcome');
        const panel=fields.panelCommitment||'0x'+'0'.repeat(64);
        check(typeof panel==='string'&&HASH.test(panel),'invalid optional panel commitment');
        args=[id,outcome,hash(fields.rulingHash,'ruling commitment'),
          hash(fields.remedyCommitment,'remedy commitment'),panel.toLowerCase()];
      }else if(action==='finalizeRuling'){
        check(canFinalize(record,now),'Arbitration appeal window remains open or case already finalized');
        args=[id];
      }
    }
    const definition=actionTypes[action],data=tokenReadCall420(definition.sig,definition.types,args);
    check(data.length<=2+4096*2,'Arbitration Wallet calldata exceeds limit');
    const to=action==='openCase'||action==='submitEvidence'||action==='appeal'?
      s.binding.dependencies.cases.address:s.binding.dependencies.rulings.address;
    return {action,args,data,to,record,context:record?reviewKey(record):null};
  }
  async function review(action,fields){
    const epoch=generation,token=await verifier.prepare(action),{s,now}=await guardedSnapshot();
    check(epoch===generation,'Arbitration session invalidated');
    const payload=await build(action,fields,s,now);
    check(payload.to===token.target,'Arbitration transaction target mismatch');
    const tx={from:user,to:payload.to,data:payload.data,value:'0x0'};
    await rpc('eth_call',[tx,'latest']);
    const gas=quantity(await rpc('eth_estimateGas',[tx]));
    const gasPrice=quantity(await rpc('eth_gasPrice',[]));
    check(epoch===generation,'Arbitration review invalidated');
    const summary=Object.freeze({action,to:payload.to,from:user,chainId:s.binding.chainId,
      data:payload.data,gas:gas.toString(),gasPrice:gasPrice.toString(),
      estimatedGasCostWei:(gas*gasPrice).toString(),protocolFeeWei:'0',
      caseId:payload.record?.id||null,round:payload.record?.round??null,
      value:'0',requiresExplicitConfirmation:true});
    const quote=Object.freeze({summary});
    proposals.set(quote,{token,epoch,fields:structuredClone(fields),payload,summary});
    return quote;
  }
  async function submit(quote,authorize){
    const saved=proposals.get(quote);
    check(saved&&saved.epoch===generation,'Arbitration review expired or forged');
    check(typeof authorize==='function','explicit Wallet approval callback required');
    proposals.delete(quote); // Never automatically replay an interrupted approval
    const fresh=await review(saved.summary.action,saved.fields);
    const current=proposals.get(fresh);
    proposals.delete(fresh);
    check(current.summary.data===saved.summary.data&&current.summary.to===saved.summary.to&&
      current.payload.context===saved.payload.context&&current.summary.gas===saved.summary.gas&&
      current.summary.gasPrice===saved.summary.gasPrice,'Arbitration transaction changed; review again');
    const approved=await verifier.confirm(saved.token,{authorize:async()=>{
      const consent=await authorize(saved.summary);
      return consent===true;
    }});
    check(saved.epoch===generation&&approved.to===saved.summary.to&&approved.from===user,
      'Arbitration confirmation/session changed');
    const tx={from:user,to:approved.to,data:saved.summary.data,value:'0x0'};
    await rpc('eth_call',[tx,'latest']);
    const txHash=hash(await rpc('eth_sendTransaction',[tx]),'submitted transaction');
    const result=Object.freeze({txHash,action:saved.summary.action,to:approved.to,from:user,
      chainId:approved.chainId,submittedAt:Date.now(),status:'pending'});
    received.set(txHash,result);
    return result;
  }
  async function restore(transaction) {
    const txHash=hash(transaction?.txHash,'transaction identifier');
    const to=address(transaction?.to);
    const chainId=transaction?.chainId;
    check(Number(chainId)===Number(release.chainId)&&transaction.from===user,
      'Arbitration pending transaction belongs to another Wallet or network');
    const current=await verified();
    check([current.binding.dependencies.cases.address,current.binding.dependencies.rulings.address].includes(to),
      'Arbitration pending transaction target no longer canonical');
    const tx=await rpc('eth_getTransactionByHash',[txHash]);
    check(tx&&address(tx.from)===user&&address(tx.to)===to,'Arbitration pending transaction identity mismatch');
    check(tx.input&&HEX.test(tx.input)&&tx.input.length>=10,'Arbitration pending calldata missing');
    const selectors=Object.values(actionTypes).map(x=>tokenReadCall420(x.sig).slice(0,10));
    check(selectors.includes(tx.input.slice(0,10).toLowerCase()),'Arbitration pending action selector mismatch');
    received.set(txHash,Object.freeze({txHash,to,from:user,chainId}));
    return Object.freeze({txHash,to,from:user,chainId});
  }
  async function status(transaction){
    const txHash=hash(transaction?.txHash,'transaction identifier');
    check(received.has(txHash),'unknown Arbitration transaction for this session');
    const current=await readWalletTransactionStatus420(provider,txHash,{expectedChainId:release.chainId,canonical:true});
    if(current.receipt){
      check(current.receipt.from&&address(current.receipt.from)===user &&
        current.receipt.to&&address(current.receipt.to)===transaction.to,
        'Arbitration receipt identity mismatch');
    }
    await verified();
    return Object.freeze({state:current.status,txHash,confirmations:current.confirmations,
      canonical:current.status==='confirmed'||current.status==='reverted'});
  }
  function invalidate(){
    generation+=1;verifier.invalidate();proposals.clear?.();
  }
  function dispose(){generation+=1;verifier.dispose();received.clear();}
  return Object.freeze({account:user,domains:Object.freeze(supplied),policies,dashboard,detail,review,submit,restore,status,
    invalidate,dispose});
}
