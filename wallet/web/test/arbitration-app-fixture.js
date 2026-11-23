// Deterministic RPC fixture with exact ABI words, roles, logs and transaction lifecycle.
// Models explicit contract behavior for Wallet tests; not a replacement for Anvil tests.
import {tokenHashHex420,tokenHashText420,tokenReadCall420,tokenWord420} from '../core/token-sdk.js';
import {ARBITRATION_SERVICE_ID} from '../core/arbitration-runtime.js';
import {ARBITRATION_REGISTRY_420,ARBITRATION_TIMELOCK_420,ARBITRATION_COMPONENT_ID_420} from '../core/arbitration-verified.js';
import {ARBITRATION_EVENTS_420} from '../core/arbitration-application.js';

export const addr=n=>'0x'+n.toString(16).padStart(40,'0');
export const h=n=>'0x'+n.toString(16).padStart(64,'0');
const aw=a=>a.slice(2).padStart(64,'0');
const codeHash=c=>tokenHashHex420(c);
export const ADDR=Object.freeze({registry:ARBITRATION_REGISTRY_420,router:addr(300),
  policies:addr(301),cases:addr(302),rulings:addr(303),claimant:addr(100),respondent:addr(101),
  resolver:addr(102),appealResolver:addr(103)});
export const CODE=Object.freeze({registry:'0x6001600055',router:'0x6002600055',
  policies:'0x6003600055',cases:'0x6004600055',rulings:'0x6005600055'});
export const DOMAIN=tokenHashText420('420/arbitration/domain/test/v1');
export const ORIGIN=tokenHashText420('420/component/test/v1');
export const CASE_ID=h(900);
const meta=h(201),manifest=h(200),interfaceHash=h(202),genesisHash=h(203),blockHash=h(204);
const roots=['policies','cases','rulings','router'];
const dependencyRoot=tokenHashHex420('0x'+roots.map(k=>aw(ADDR[k])).join('')
  +roots.map(k=>codeHash(CODE[k]).slice(2)).join(''));
const sel=s=>tokenReadCall420(s).slice(0,10);
const words=(...ws)=>'0x'+ws.map(w=>typeof w==='string'&&w.startsWith('0x')?w.slice(2).padStart(64,'0'):tokenWord420(w)).join('');
const topicAddress=a=>'0x'+aw(a);
function records(state) {
  const r=state.record;
  return words(r.claimant,r.respondent,r.domainId,r.originComponentId,r.originObjectId,r.claimHash,
    r.requestedRemedyHash,r.resolver,r.appealResolver,r.evidenceWindow,r.appealWindow,
    r.openedAt,r.evidenceDeadline,r.appealDeadline,r.maxAppeals,r.round,
    {NONE:0,OPEN:1,RULED:2,FINALIZED:3}[r.state],1);
}
export function arbitrationAppFixture420(account=ADDR.claimant){
  const record={id:CASE_ID,claimant:ADDR.claimant,respondent:ADDR.respondent,
    domainId:DOMAIN,originComponentId:ORIGIN,originObjectId:h(901),claimHash:h(902),requestedRemedyHash:h(903),
    resolver:ADDR.resolver,appealResolver:ADDR.appealResolver,evidenceWindow:100,appealWindow:100,
    openedAt:100,evidenceDeadline:200,appealDeadline:0,maxAppeals:3,round:0,state:'OPEN'};
  const state={record,now:150,chain:'0x1a4',accounts:[account],block:'0x20',hash:blockHash,
    version:1,active:true,meta,manifest,interfaceHash,root:dependencyRoot,
    pendingHash:h(800),receipt:null,tx:null,sendCount:0,malformed:null,override:null,logs:[],
    calls:[],links:{router:{policies:ADDR.policies,cases:ADDR.cases,rulings:ADDR.rulings},
      cases:{policies:ADDR.policies,rulingRegistry:ADDR.rulings,governanceTimelock:ARBITRATION_TIMELOCK_420},
      rulings:{cases:ADDR.cases},policies:{governanceTimelock:ARBITRATION_TIMELOCK_420}}};
  const eventLog=(kind,topics,data,blockNumber=0x10,logIndex=0)=>({
    address:['ruling','rulingFinalized'].includes(kind)?ADDR.rulings:ADDR.cases,
    topics:[ARBITRATION_EVENTS_420[kind],...topics],data:blockData(data),
    blockNumber:'0x'+blockNumber.toString(16),blockHash:state.hash,
    transactionHash:h(501+logIndex),logIndex:'0x'+logIndex.toString(16)
  });
  const blockData=(data)=>words(...data);
  state.logs.push(eventLog('opened',[CASE_ID,DOMAIN,topicAddress(ADDR.claimant)],
    [ADDR.respondent,ORIGIN,record.originObjectId]));
  let currentAccount=account;
  const listeners=new Map();
  const provider={
    on(name,fn){listeners.set(name,fn);},
    removeListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},
    async request(method,params=[]){
      state.calls.push([method,params]);
      if(state.override){const v=state.override(method,params);if(v!==undefined)return v;}
      if(method==='eth_chainId')return state.chain;
      if(method==='eth_accounts')return state.accounts;
      if(method==='eth_getBlockByNumber'){
        const block=params[0];
        return {number:block==='0x0'?'0x0':block==='latest'?state.block:block,
          hash:block==='0x0'?genesisHash:state.hash,timestamp:'0x'+state.now.toString(16)};
      }
      if(method==='eth_getCode'){
        const key=Object.keys(ADDR).find(k=>ADDR[k]===params[0]);
        return CODE[key]||'0x';
      }
      if(method==='eth_gasPrice')return '0x64';
      if(method==='eth_estimateGas')return '0x5208';
      if(method==='eth_getTransactionByHash')return state.tx||null;
      if(method==='eth_getTransactionReceipt')return state.receipt;
      if(method==='eth_blockNumber')return state.block;
      if(method==='eth_sendTransaction'){
        state.tx={from:currentAccount,to:params[0].to,input:params[0].data,hash:state.pendingHash};
        state.sendCount++;return state.pendingHash;
      }
      if(method==='eth_getLogs'){
        const filter=params[0],from=BigInt(filter.fromBlock),to=BigInt(filter.toBlock);
        return state.logs.filter(l=>BigInt(l.blockNumber)>=from&&BigInt(l.blockNumber)<=to&&
          filter.address.includes(l.address)&&
          (filter.topics[0]==null || (Array.isArray(filter.topics[0])?
            filter.topics[0].includes(l.topics[0]):filter.topics[0]===l.topics[0]))&&
          (!filter.topics[1]||filter.topics[1]===l.topics[1]));
      }
      if(method!=='eth_call')throw Error('unexpected RPC '+method);
      const [{to,data}]=params,key=Object.keys(ADDR).find(k=>ADDR[k]===to),signature=data.slice(0,10);
      if(state.malformed&&state.malformed.signature===signature)return state.malformed.data;
      if(key==='registry'){
        if(signature===sel('getService(bytes32)'))return words(ADDR.router,codeHash(CODE.router),
          state.meta,state.version,1,state.active?1:0);
        if(signature===sel('resolveActive(bytes32)')){
          if(!state.active)throw Error('UnknownService');return words(ADDR.router,state.version);
        }
        if(signature===sel('getRegistrationProfile(bytes32,uint32)'))
          return words(3,state.manifest,state.root,state.interfaceHash);
        if(signature===sel('component(bytes32)'))return words(
          tokenHashText420(ARBITRATION_COMPONENT_ID_420),ADDR.router,codeHash(CODE.router),1,0,0,2);
        if(signature===sel('resolve(bytes32)'))return words(ADDR.router);
      }
      if(signature===sel('protocolVersion()'))return words(1);
      if(state.links[key])for(const [getter,target] of Object.entries(state.links[key]))
        if(signature===sel(getter+'()'))return words(target);
      if(key==='policies'&&signature===sel('getPolicy(bytes32)'))
        return words(ADDR.resolver,ADDR.appealResolver,100,100,3,1,1);
      if(key==='cases'&&signature===sel('getCase(bytes32)')){
        const requested='0x'+data.slice(-64);
        if(requested!==CASE_ID)throw Error('UnknownCase');
        return records(state);
      }
      if(key==='rulings'&&signature===sel('getRuling(bytes32,uint8)')){
        if(state.record.state==='OPEN'&&state.record.round===0)throw Error('InvalidRuling');
        return words(1,h(700),h(701),h(0),ADDR.resolver,150,1);
      }
      if(['cases','rulings'].includes(key)&&params[0].from&&params[0].data&&
        ![sel('getCase(bytes32)'),sel('getRuling(bytes32,uint8)')].includes(signature))
        return '0x';
      if(['cases','rulings'].includes(key)&&params[0].from)return '0x';
      throw Error('unexpected ABI '+key+' '+signature);
    }
  };
  const release={serviceId:ARBITRATION_SERVICE_ID,chainId:420,version:1,genesisHash,
    registry:{address:ADDR.registry,codeHash:codeHash(CODE.registry)},
    metadataHash:meta,manifestHash:manifest,interfaceHash};
  return {state,provider,release,account,domains:[{name:'Test Market',id:DOMAIN}],listeners,
    addEvidence(){
      state.logs.push(eventLog('evidence',[CASE_ID,words(0),topicAddress(ADDR.claimant)],[h(950)],0x11,1));
    },
    submitReceipt(){
      state.receipt={transactionHash:state.pendingHash,blockNumber:'0x20',blockHash:state.hash,status:'0x1',
        from:currentAccount,to:state.tx.to};
    },
    changeAccount(a){currentAccount=a;state.accounts=[a];listeners.get('accountsChanged')?.([a]);}
  };
}
