// Frozen Token V1 management actions. No arbitrary target, calldata, signer or native value.
import {TOKEN_TEMPLATES_420,tokenReadCall420,tokenHashHex420,tokenHashText420,tokenSelector420,tokenWord420,tokenAddressWord420,readTokenRecord420} from './token-sdk.js';
import {parseERC20Units420} from './token-erc20-wizard.js';
import {encodeExecute,ZERO_ADDRESS} from './abi.js';
import {assertWalletChain420,readWalletTransactionStatus420,normalizeTransactionHash420} from './transaction-lifecycle.js';
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const addr=(x,zero=false)=>{const w=tokenAddressWord420(x),a='0x'+w.slice(-40);check(zero||a!==ZERO_ADDRESS,'Zero address not permitted');return a;};
const uint=(x,zero=true)=>{check(typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&x.length<=78,'Enter an exact unsigned integer');const n=BigInt(x);tokenWord420(n);check(zero||n>0n,'Amount must be positive');return n.toString();};
const word=x=>'0x'+tokenAddressWord420(x);
const q=x=>{check(typeof x==='string'&&x.length<=66&&/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(x),'Invalid RPC quantity');return BigInt(x);};
const words=(x,n)=>{check(typeof x==='string'&&x.length===2+64*n&&/^0x[0-9a-fA-F]*$/.test(x),'Invalid management ABI result');return Array.from({length:n},(_,i)=>'0x'+x.slice(2+64*i,66+64*i).toLowerCase());};
const asAddr=x=>{check(/^0x0{24}[0-9a-f]{40}$/.test(x),'Invalid ABI address');return '0x'+x.slice(-40);};
const data=(...xs)=>'0x'+xs.map(x=>x.slice(2)).join('');
const w=x=>'0x'+tokenWord420(x);
const fields={to:'Recipient / new owner / delegate address',from:'Source holder address',spender:'Spender / operator address',amount:'Amount (tokens for ERC20; integer units for ERC1155)',id:'Token ID (uint256)',ids:'Token IDs (comma separated, maximum 16)',values:'Amounts (comma separated, maximum 16)',approved:'Approval (true or false)'};
const spec=(key,label,args,owner=false)=>Object.freeze({key,label,fields:Object.freeze(args.map(name=>Object.freeze({name,label:fields[name]}))),owner});
const own=spec('transferOwnership','Transfer contract ownership',['to'],true);
export function tokenManagementActions420(row,account){
  const p=TOKEN_TEMPLATES_420.find(p=>p.id===row?.templateId&&p.version===row.version);
  if(!p)return Object.freeze([]);
  const a=[own];
  if(p.standard==='ERC20'){
    a.push(spec('transfer','Transfer tokens',['to','amount']),spec('approve','Set token allowance',['spender','amount']),spec('transferFrom','Transfer using allowance',['from','to','amount']),spec('renounceOwnership','Renounce contract ownership permanently',[],true));
    if(p.mintable)a.push(spec('mint','Mint tokens',['to','amount'],true));
    if(p.burnable)a.push(spec('burn','Burn held tokens',['amount']),spec('burnFrom','Burn using allowance',['from','amount']));
    if(p.votes)a.push(spec('delegate','Delegate voting power (zero clears)',['to']));
  }else if(p.standard==='ERC721'){
    a.push(spec('mint','Mint NFT (ID)',['to','id'],true),spec('burn','Burn NFT (ID)',['id']),spec('approve','Approve NFT (zero clears)',['spender','id']),
      spec('setApprovalForAll','Set collection operator',['spender','approved']),spec('transfer','Safe NFT transfer',['from','to','id']));
  }else{
    a.push(spec('mint','Mint multi-token units',['to','id','amount'],true),spec('burn','Burn multi-token units',['from','id','amount']),spec('setApprovalForAll','Set multi-token operator',['spender','approved']),
      spec('transfer','Safe multi-token transfer',['from','to','id','amount']),spec('batchTransfer','Safe multi-token batch transfer',['from','to','ids','values']));
  }
  return Object.freeze(a.filter(x=>!x.owner||row.owner===account));
}
function dynamic(signature,head,tails){
  let offset=head.length*32;
  const body=head.map(x=>{if(typeof x==='string')return x;const t=tails[x.tail],v=tokenWord420(offset);offset+=t.length/2;return v;}).join('');
  return tokenSelector420(signature)+body+tails.join('');
}
const empty=tokenWord420(0);
export function encodeTokenManagement420(row,account,action,input){
  account=addr(account);const p=TOKEN_TEMPLATES_420.find(p=>p.id===row?.templateId&&p.version===row.version);
  const s=tokenManagementActions420(row,account).find(x=>x.key===action);check(p&&s,'Action unavailable for this template or owner');
  const raw=readTokenRecord420(input,s.fields.map(x=>x.name),'Token management fields');
  check(Object.keys(raw).length===s.fields.length,'Missing management fields');
  const v={};
  for(const {name} of s.fields){
    const x=raw[name];
    if(['to','from','spender'].includes(name))v[name]=addr(x,(action==='delegate'&&name==='to')||(p.standard==='ERC721'&&action==='approve'&&name==='spender'));
    else if(name==='approved'){check(x==='true'||x==='false','Choose true or false');v[name]=x;}
    else if(name==='amount'){v.amount=p.standard==='ERC20'?parseERC20Units420(x):uint(x,action==='approve');check(action==='approve'||BigInt(v.amount)>0n,'Amount must be positive');}
    else if(name==='id')v.id=uint(x);
    else {check(typeof x==='string'&&x.length<=1300,'Invalid batch fields');const arr=x.split(',').map(t=>uint(t.trim(),name==='ids'));check(arr.length<=16,'Batch limited to 16 IDs');v[name]=Object.freeze(arr);}
  }
  const call=(sig,types=[],values=[])=>tokenReadCall420(sig,types,values);
  const A='address',U='uint256';let calldata,boolReturn=false,events=[];
  const event=(sig,topics,body='0x')=>events.push(Object.freeze({topics:Object.freeze([tokenHashText420(sig),...topics]),data:body}));
  const transfer20=(from,to,n)=>event('Transfer(address,address,uint256)',[word(from),word(to)],w(n));
  const transfer721=(from,to,id)=>event('Transfer(address,address,uint256)',[word(from),word(to),w(id)]);
  const transfer1155=(from,to,id,n)=>event('TransferSingle(address,address,address,uint256,uint256)',[word(account),word(from),word(to)],data(w(id),w(n)));
  if(action==='transferOwnership'||action==='renounceOwnership'){
    const next=action==='renounceOwnership'?ZERO_ADDRESS:v.to;
    check(next!==account,'New owner must differ from current owner');
    calldata=action==='renounceOwnership'?call('renounceOwnership()'):call('transferOwnership(address)',[A],[next]);
    event('OwnershipTransferred(address,address)',[word(account),word(next)]);
  }else if(p.standard==='ERC20'){
    if(action==='transfer'||action==='mint'){calldata=call(action+'(address,uint256)',[A,U],[v.to,v.amount]);boolReturn=action==='transfer';transfer20(action==='mint'?ZERO_ADDRESS:account,v.to,v.amount);}
    else if(action==='approve'){calldata=call('approve(address,uint256)',[A,U],[v.spender,v.amount]);boolReturn=true;event('Approval(address,address,uint256)',[word(account),word(v.spender)],w(v.amount));}
    else if(action==='transferFrom'){calldata=call('transferFrom(address,address,uint256)',[A,A,U],[v.from,v.to,v.amount]);boolReturn=true;transfer20(v.from,v.to,v.amount);}
    else if(action==='burn'){calldata=call('burn(uint256)',[U],[v.amount]);transfer20(account,ZERO_ADDRESS,v.amount);}
    else if(action==='burnFrom'){calldata=call('burnFrom(address,uint256)',[A,U],[v.from,v.amount]);transfer20(v.from,ZERO_ADDRESS,v.amount);}
    else if(action==='delegate'){calldata=call('delegate(address)',[A],[v.to]);}
  }else if(p.standard==='ERC721'){
    if(action==='mint'){calldata=call('mint(address,uint256)',[A,U],[v.to,v.id]);transfer721(ZERO_ADDRESS,v.to,v.id);}
    else if(action==='burn'){calldata=call('burn(uint256)',[U],[v.id]);}
    else if(action==='approve'){calldata=call('approve(address,uint256)',[A,U],[v.spender,v.id]);}
    else if(action==='transfer'){calldata=call('safeTransferFrom(address,address,uint256)',[A,A,U],[v.from,v.to,v.id]);transfer721(v.from,v.to,v.id);}
  }else{
    if(action==='mint'){calldata=dynamic('mint(address,uint256,uint256,bytes)',[tokenAddressWord420(v.to),tokenWord420(v.id),tokenWord420(v.amount),{tail:0}],[empty]);transfer1155(ZERO_ADDRESS,v.to,v.id,v.amount);}
    else if(action==='burn'){calldata=call('burn(address,uint256,uint256)',[A,U,U],[v.from,v.id,v.amount]);transfer1155(v.from,ZERO_ADDRESS,v.id,v.amount);}
    else if(action==='transfer'){calldata=dynamic('safeTransferFrom(address,address,uint256,uint256,bytes)',[tokenAddressWord420(v.from),tokenAddressWord420(v.to),tokenWord420(v.id),tokenWord420(v.amount),{tail:0}],[empty]);transfer1155(v.from,v.to,v.id,v.amount);}
    else if(action==='batchTransfer'){
      check(v.ids.length===v.values.length&&new Set(v.ids).size===v.ids.length,'Batch IDs must be unique and match amounts');
      const array=a=>tokenWord420(a.length)+a.map(tokenWord420).join('');
      const ids=array(v.ids),values=array(v.values);
      calldata=dynamic('safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)',[tokenAddressWord420(v.from),tokenAddressWord420(v.to),{tail:0},{tail:1},{tail:2}],[ids,values,empty]);
      event('TransferBatch(address,address,address,uint256[],uint256[])',[word(account),word(v.from),word(v.to)],'0x'+tokenWord420(64)+tokenWord420(64+ids.length/2)+ids+values);
    }
  }
  if(action==='setApprovalForAll'){calldata=tokenSelector420('setApprovalForAll(address,bool)')+tokenAddressWord420(v.spender)+tokenWord420(v.approved==='true'?1:0);event('ApprovalForAll(address,address,bool)',[word(account),word(v.spender)],w(v.approved==='true'?1:0));}
  check(calldata,'Unsupported management action');
  return Object.freeze({action,label:s.label,profile:p,params:Object.freeze(v),data:calldata,boolReturn,events:Object.freeze(events),ownerOnly:s.owner});
}
// Every review re-reads the retained factory row, template, code, current
// contract ownership and operation-specific state at the verified block.
async function verifiedManagementRecord(provider,runtime,row,account){
  const block=runtime.verificationBlock,tag=block.number,target=addr(row.token);
  const read=(to,sig,types=[],values=[])=>provider.request('eth_call',[{to,data:tokenReadCall420(sig,types,values)},tag]);
  const readWords=async(to,sig,n,types=[],values=[])=>words(await read(to,sig,types,values),n);
  const [rec,member,code,template,ownerRaw]=await Promise.all([readWords(runtime.factory.address,'deployment(uint256)',6,['uint256'],[row.index]),readWords(runtime.factory.address,'isFactoryDeployment(address)',1,['address'],[target]),
    provider.request('eth_getCode',[target,tag]),readWords(target,'templateId()',1),readWords(target,'owner()',1)]);
  check(asAddr(rec[0])===target&&asAddr(rec[1])===account&&rec[2]===row.templateId&&BigInt(rec[3])===1n&&rec[4]===row.configHash&&BigInt(rec[5]).toString()===row.deployedAt&&BigInt(member[0])===1n&&same(template[0],row.templateId),'Factory provenance changed');
  check(typeof code==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(code)&&!/^0x0+$/.test(code)&&tokenHashHex420(code)===row.codeHash,'Token runtime identity changed');
  const owner=asAddr(ownerRaw[0]);const profile=TOKEN_TEMPLATES_420.find(p=>p.id===row.templateId&&p.version===row.version);
  check(profile&&(owner!==ZERO_ADDRESS||profile.standard==='ERC20'),'Invalid token owner or template');
  return {target,owner,profile,block,tag,readWords};
}

// Explicit target-by-target permission inspection, from a fresh verified block.
// These mappings are not enumerable; never imply a complete approvals inventory.
export async function inspectTokenPermissions420(provider,runtime,row,account,input={}){
  const query=readTokenRecord420(input,['spender','id'],'Permission lookup');
  const {target,owner,profile:p,block,readWords}=await verifiedManagementRecord(provider,runtime,row,account);
  const spender=query.spender==null||query.spender===''?null:addr(query.spender);
  const id=query.id==null||query.id===''?null:uint(query.id);
  check(p.standard!=='ERC20'||id===null,'Token ID not applicable to ERC20');
  const one=async(sig,types=[],values=[])=>(await readWords(target,sig,1,types,values))[0];
  const n=async(...args)=>BigInt(await one(...args));const A='address',U='uint256';
  const flag=async(...args)=>{const v=await n(...args);check(v<=1n,'Malformed permission flag');return v===1n;};
  const revocations=[];const revoke=(action,params,label)=>revocations.push(Object.freeze({action,params:Object.freeze(params),label}));
  const result={authority:'PERMISSION_SNAPSHOT_ONLY',target,account,chainId:runtime.chainId,block,templateId:p.id,standard:p.standard,owner,
    ownership:owner===account?'owner':owner===ZERO_ADDRESS?'renounced':'transferred',spender,id,allowance:null,operator:null,nftOwner:null,nftApproved:null,nftOperatorForHolder:null,balance:null,delegation:null,permitNonce:null};
  if(p.standard==='ERC20'){
    check(await n('decimals()')===18n,'Unexpected token decimals');
    for(const [key,sig] of [['mintable','mintable()'],['burnable','burnable()'],['permit','permitEnabled()'],['votes','votesEnabled()']])check(await n(sig)===(p[key]?1n:0n),'Template feature mismatch');
    result.balance=(await n('balanceOf(address)',[A],[account])).toString();
    if(spender!==null){result.allowance=(await n('allowance(address,address)',[A,A],[account,spender])).toString();if(BigInt(result.allowance)>0n)revoke('approve',{spender,amount:'0'},'Revoke ERC20 allowance');}
    if(p.permit)result.permitNonce=(await n('nonces(address)',[A],[account])).toString();
    if(p.votes){result.delegation=asAddr(await one('delegates(address)',[A],[account]));if(result.delegation!==ZERO_ADDRESS)revoke('delegate',{to:ZERO_ADDRESS},'Clear voting delegation');}
  }else{
    if(spender!==null){result.operator=await flag('isApprovedForAll(address,address)',[A,A],[account,spender]);if(result.operator)revoke('setApprovalForAll',{spender,approved:'false'},'Revoke collection-wide operator');}
    if(p.standard==='ERC721'){
      result.balance=(await n('balanceOf(address)',[A],[account])).toString();
      if(id!==null){result.nftOwner=asAddr(await one('ownerOf(uint256)',[U],[id]));check(result.nftOwner!==ZERO_ADDRESS,'Invalid NFT holder');result.nftApproved=asAddr(await one('getApproved(uint256)',[U],[id]));
        result.nftOperatorForHolder=await flag('isApprovedForAll(address,address)',[A,A],[result.nftOwner,account]);
        if(result.nftApproved!==ZERO_ADDRESS&&(result.nftOwner===account||result.nftOperatorForHolder))revoke('approve',{spender:ZERO_ADDRESS,id},'Revoke NFT-specific approval');}
    }else if(id!==null)result.balance=(await n('balanceOf(address,uint256)',[A,U],[account,id])).toString();
  }
  return Object.freeze({...result,revocations:Object.freeze(revocations)});
}

export function describeTokenManagementRisk420(op,state,account){
  const {action,params:v,profile:p}=op;const risks=[];let acknowledgement=null,classification='ordinary';
  const high=(kind,phrase,warning)=>{classification=kind;acknowledgement=phrase;risks.push(warning);};
  if(action==='transferOwnership')high('ownership','TRANSFER OWNERSHIP','Immediate contract ownership transfer. The new owner receives all owner-only powers; the original creator record does not change. The transfer may be irreversible.');
  else if(action==='renounceOwnership')high('irreversible','RENOUNCE OWNERSHIP','Permanent ownership renunciation to the zero address. Owner-only functions cannot be restored by this Wallet. Existing holder approvals and balances are not revoked.');
  else if(action==='approve'&&p.standard==='ERC20'){
    const old=BigInt(state.allowance),next=BigInt(v.amount);
    if(next===0n){classification='revocation';risks.push('Sets only this spender allowance to zero; other approvals, prior spending and already signed permits are not cancelled.');}
    else {high('permission','GRANT PERMISSION',next===2n**256n-1n?'Unlimited allowance: this spender can spend future balances without repeated approval.':'The spender can transfer approved token units without another Wallet confirmation.');if(old>0n&&old!==next)risks.push('Replacing a nonzero allowance may let the spender use both old and new allowances around confirmation. Consider confirming a zero revocation before granting a new allowance.');if(p.burnable)risks.push('This allowance also permits burnFrom: the spender can destroy authorized units.');}
  }else if(action==='approve'&&p.standard==='ERC721'){
    if(v.spender===ZERO_ADDRESS){classification='revocation';risks.push('Clears only this NFT approval. Collection-wide operators remain authorized.');}
    else high('permission','GRANT PERMISSION','This address can transfer or burn the specified NFT. Existing collection operators retain their permissions.');
  }else if(action==='setApprovalForAll'){
    if(v.approved==='false'){classification='revocation';risks.push('Revokes only this operator for the selected holder and collection. Other operators and NFT-specific approvals remain.');}
    else high('permission','GRANT PERMISSION','Collection-wide operator authority covers all current and future NFTs or units of this collection; it can transfer or burn them without further Wallet confirmation.');
  }else if(action==='burn'||action==='burnFrom')high('irreversible','BURN TOKENS','This destroys the specified holdings permanently. Contract ownership does not grant authority to burn other holders’ assets.');
  else if(action==='mint')high('supply','MINT TOKENS','Minting increases supply or creates a new item. Verify recipient, token ID and amount. This is not asset approval or a guarantee of value.');
  else if(action==='delegate'){
    if(v.to===ZERO_ADDRESS){classification='revocation';risks.push('Clears this account’s voting delegation only; past checkpoints remain.');}
    else high('delegation','DELEGATE VOTES','Delegates voting power, not ownership or spending authority; the delegate can exercise current delegated votes.');
  }else if(v.from&&v.from!==account)high('third-party','USE HOLDER PERMISSION','This operation uses an allowance or operator grant from another holder. Verify its intended source and destination.');
  if(state.destinationCode==='contract')risks.push('The destination has deployed contract code at the reviewed block. A contract address is not proof of trust or ability to manage ownership.');
  else if(state.destinationCode==='no-code')risks.push('The destination has no deployed code at this block. This is not proof of identity, custody or future code.');
  if(action==='mint'&&p.standard==='ERC721'&&state.destinationCode==='contract')risks.push('ERC721 mint does not check the receiver callback; the NFT may be stranded.');
  return Object.freeze({classification,acknowledgement,warnings:Object.freeze(risks)});
}
export async function prepareTokenManagement420(provider,runtime,row,account,controller,action,input){
  const {target,owner,block,tag,readWords}=await verifiedManagementRecord(provider,runtime,row,account);
  const op=encodeTokenManagement420({...row,owner},account,action,input),v=op.params,p=op.profile;
  const state={owner};const readOne=async(sig,types=[],values=[])=> (await readWords(target,sig,1,types,values))[0];
  async function get(key,sig,types=[],values=[]){const value=await readOne(sig,types,values);state[key]=value;return value;}
  const n=async(...args)=>BigInt(await get(...args)),A='address',U='uint256';
  const events=[...op.events],emit=(sig,topics,body='0x')=>events.push(Object.freeze({topics:Object.freeze([tokenHashText420(sig),...topics]),data:body}));
  if(p.standard==='ERC20'){
    check(await n('decimals','decimals()')===18n,'Unexpected token decimals');
    for(const [flag,sig] of [['mintable','mintable()'],['burnable','burnable()'],['permit','permitEnabled()'],['votes','votesEnabled()']])
      check(await n(flag,sig)===(p[flag]?1n:0n),'Template feature mismatch');
    if(action==='mint'){const supply=await n('supply','totalSupply()'),cap=await n('cap','cap()');check(p.capped?cap>0n&&supply+BigInt(v.amount)<=cap:cap===0n,'Mint exceeds immutable cap');}
    if(['transfer','burn','transferFrom','burnFrom'].includes(action)){
      const holder=v.from??account;check(await n('balance','balanceOf(address)',[A],[holder])>=BigInt(v.amount),'Insufficient holder balance');
      if(v.from)check(await n('allowance','allowance(address,address)',[A,A],[holder,account])>=BigInt(v.amount),'Insufficient allowance');
    }
    if(action==='approve')await n('allowance','allowance(address,address)',[A,A],[account,v.spender]);
    if(action==='delegate'){const previous=asAddr(await get('delegate','delegates(address)',[A],[account]));await n('balance','balanceOf(address)',[A],[account]);emit('DelegateChanged(address,address,address)',[word(account),word(previous),word(v.to)]);}
  }else if(p.standard==='ERC721'){
    if(['transfer','burn','approve'].includes(action)){
      const holder=asAddr(await get('holder','ownerOf(uint256)',[U],[v.id]));
      const approved=asAddr(await get('approved','getApproved(uint256)',[U],[v.id]));
      const all=await n('operator','isApprovedForAll(address,address)',[A,A],[holder,account]);check(all<=1n,'Malformed NFT operator flag');
      check(holder===account||all===1n||(action!=='approve'&&approved===account),'NFT holder/operator permission unavailable');
      if(action==='transfer')check(v.from===holder,'Wrong NFT source holder');
      if(action==='burn')emit('Transfer(address,address,uint256)',[word(holder),word(ZERO_ADDRESS),w(v.id)]);
      if(action==='approve')emit('Approval(address,address,uint256)',[word(holder),word(v.spender),w(v.id)]);
    }
    if(action==='mint')await n('supply','totalSupply()');
  }else if(['transfer','batchTransfer','burn'].includes(action)){
    if(v.from!==account)check(await n('operator','isApprovedForAll(address,address)',[A,A],[v.from,account])===1n,'Multi-token operator permission unavailable');
    const ids=v.ids??[v.id],values=v.values??[v.amount];
    for(let i=0;i<ids.length;i++)check(await n('balance:'+ids[i],'balanceOf(address,uint256)',[A,U],[v.from,ids[i]])>=BigInt(values[i]),'Insufficient multi-token balance');
  }
  if(action==='setApprovalForAll')check(await n('operator','isApprovedForAll(address,address)',[A,A],[account,v.spender])<=1n,'Malformed operator flag');
  check(events.length>0,'Missing management event expectation');
  const destination=v.to??v.spender;
  if(destination&&destination!==ZERO_ADDRESS){
    const code=await provider.request('eth_getCode',[destination,tag]);
    check(typeof code==='string'&&/^0x(?:[0-9a-fA-F]{2})*$/.test(code),'Malformed destination code');
    state.destinationCode=code==='0x'?'no-code':'contract';state.destinationCodeHash=tokenHashHex420(code);
  }
  const security=describeTokenManagementRisk420(op,state,account);
  const transaction=Object.freeze({from:controller,to:account,value:'0x0',data:encodeExecute(target,0n,op.data)});
  const simulated=await provider.request('eth_call',[transaction,tag]);
  const expected='0x'+tokenWord420(32)+tokenWord420(op.boolReturn?32:0)+(op.boolReturn?tokenWord420(1):'');
  check(same(simulated,expected),'Management simulation returned unexpected result');
  const gas=q(await provider.request('eth_estimateGas',[transaction,tag])),price=q(await provider.request('eth_gasPrice',[]));check(gas>0n&&gas*price<2n**256n,'Invalid management gas estimate');
  check(q(await provider.request('eth_getBalance',[controller,tag]))>=gas*price,'Insufficient controller balance for network gas');
  return Object.freeze({authority:'SIMULATED_MANAGEMENT_ONLY',controller,smartAccount:account,chainId:runtime.chainId,release:runtime.release,block,target,tokenCodeHash:row.codeHash,
    templateId:row.templateId,action,label:op.label,params:v,transaction,events:Object.freeze(events),state:Object.freeze(state),security,executionHash:tokenHashHex420(transaction.data),
    gasUnits:gas.toString(),gasPriceWei:price.toString(),estimatedGasWei:(gas*price).toString(),creationFeeWei:'0'});
}
export function sameTokenManagementReview420(a,b){
  return ['controller','smartAccount','chainId','target','templateId','tokenCodeHash','action','executionHash','gasUnits','gasPriceWei','estimatedGasWei','authorizationEpoch','authorizationPolicyVersion'].every(k=>a[k]===b[k])&&
    a.release.dependencyRoot===b.release.dependencyRoot&&a.release.manifestHash===b.release.manifestHash&&JSON.stringify(a.state)===JSON.stringify(b.state)&&JSON.stringify(a.events)===JSON.stringify(b.events)&&JSON.stringify(a.security)===JSON.stringify(b.security)&&JSON.stringify(a.accountAuthority)===JSON.stringify(b.accountAuthority);
}
export async function readTokenManagementReceipt420(provider,record,binding){
  const review=record.review,hash=normalizeTransactionHash420(record.txHash);
  check(review.chainId===binding.chainId&&review.release.dependencyRoot===binding.release.dependencyRoot&&review.release.manifestHash===binding.release.manifestHash,'Management release mismatch');
  async function genesis(){const g=await provider.request('eth_getBlockByNumber',['0x0',false]);check(g?.number==='0x0'&&same(g.hash,binding.genesisHash),'Management genesis mismatch');}
  await genesis();
  const result=await readWalletTransactionStatus420(provider,hash,{canonical:true,expectedChainId:review.chainId});
  if(!['confirmed','reverted'].includes(result.status))return Object.freeze({txHash:hash,status:result.status,confirmations:result.confirmations});
  const r=result.receipt,t=await provider.request('eth_getTransactionByHash',[hash]);
  check(t&&same(t.hash,hash)&&same(t.blockHash,r.blockHash)&&q(t.blockNumber)===q(r.blockNumber)&&same(t.from,review.controller)&&same(t.to,review.smartAccount)&&same(r.from,t.from)&&same(r.to,t.to)&&same(t.input,review.transaction.data)&&q(t.value)===0n,'Management transaction mismatch');
  check((t.chainId==null||q(t.chainId)===BigInt(review.chainId))&&(t.type==null||q(t.type)===0n)&&t.maxFeePerGas==null&&t.maxPriorityFeePerGas==null,'Management transaction chain or fee type mismatch');
  const gas=q(t.gas),price=q(t.gasPrice),used=q(r.gasUsed),effective=q(r.effectiveGasPrice);
  check(gas>0n&&gas<=BigInt(review.gasUnits)&&price<=BigInt(review.gasPriceWei)&&gas*price<=BigInt(review.estimatedGasWei)&&used<=gas&&effective===price,'Management fee bounds exceeded');
  if(result.status==='confirmed'){
    check(tokenHashHex420(await provider.request('eth_getCode',[review.target,r.blockNumber]))===review.tokenCodeHash,'Historical management token code mismatch');
    check(Array.isArray(r.logs)&&r.logs.length<=4096,'Missing management receipt logs');
    const targetLogs=r.logs.filter(l=>same(l?.address,review.target));const indices=new Set();
    for(const l of targetLogs){const index=q(l.logIndex).toString();check(!indices.has(index)&&l.removed===false&&same(l.transactionHash,hash)&&same(l.blockHash,r.blockHash)&&l.blockNumber===r.blockNumber&&q(l.transactionIndex)===q(r.transactionIndex),'Duplicate or unbound management log');indices.add(index);}
    for(const event of review.events){
      const matches=r.logs.filter(l=>same(l.address,review.target)&&Array.isArray(l.topics)&&l.topics.length===event.topics.length&&l.topics.every((x,i)=>same(x,event.topics[i]))&&same(l.data,event.data));
      check(matches.length===1,'Missing or duplicate expected management event');
      const l=matches[0];check(l.removed===false&&same(l.transactionHash,hash)&&same(l.blockHash,r.blockHash)&&l.blockNumber===r.blockNumber&&q(l.transactionIndex)===q(r.transactionIndex),'Unbound management event');
    }
  }
  const [again,block]=await Promise.all([provider.request('eth_getTransactionReceipt',[hash]),provider.request('eth_getBlockByNumber',[r.blockNumber,false])]);
  await genesis();await assertWalletChain420(provider,review.chainId);
  if(!again||!same(again.transactionHash,hash)||!same(again.blockHash,r.blockHash)||again.blockNumber!==r.blockNumber||again.status!==r.status||JSON.stringify(again.logs)!==JSON.stringify(r.logs)||again.gasUsed!==r.gasUsed||again.effectiveGasPrice!==r.effectiveGasPrice||again.transactionIndex!==r.transactionIndex||!same(again.from,r.from)||!same(again.to,r.to)||!same(block?.hash,r.blockHash)||block?.number!==r.blockNumber)return Object.freeze({txHash:hash,status:'reorganized',confirmations:0n});
  return Object.freeze({txHash:hash,status:result.status,confirmations:result.confirmations,blockNumber:r.blockNumber,gasPaidWei:(used*effective).toString()});
}
