import {keccak256,selector} from './keccak.js';
import {SettlementError} from './buds-ledger.js';
const hex32=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x);
export const address=x=>{if(typeof x!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(x))throw new SettlementError('invalid chain address');return x.toLowerCase();};
export const word=x=>typeof x==='string'&&x.startsWith('0x')?x.slice(2).padStart(64,'0'):BigInt(x).toString(16).padStart(64,'0');
export const calldata=(sig,...args)=>'0x'+selector(sig)+args.map(word).join('');
export const words=x=>{if(typeof x!=='string'||!/^0x([0-9a-fA-F]{64})+$/.test(x))throw new SettlementError('invalid canonical response');return x.slice(2).match(/.{64}/g);};
export class FinalizedRpc {
 constructor({url,chainId,contracts,fetchImpl=fetch}) {
  if(!/^https?:\/\//.test(url)||!Number.isSafeInteger(chainId)||chainId<=0||!contracts)throw new SettlementError('missing canonical RPC configuration');
  this.url=url;this.chainId=chainId;this.contracts=contracts;this.fetch=fetchImpl;this.sequence=0;
 }
 async request(method,params){
  const requestId=++this.sequence;
  const response=await this.fetch(this.url,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new SettlementError('canonical RPC unavailable');
  const r=await response.json();if(r.error||r.id!==requestId||r.result===undefined)throw new SettlementError('canonical RPC rejected');
  return r.result;
 }
 async header(){
  if(Number(BigInt(await this.request('eth_chainId',[])))!==this.chainId)throw new SettlementError('wrong chain');
  const h=await this.request('eth_getBlockByNumber',['finalized',false]);
  if(!h||!hex32(h.hash)||!/^0x[0-9a-f]+$/i.test(h.number))throw new SettlementError('finalized header unavailable');
  return h;
 }
 async call(name,data){
  const spec=this.contracts[name];if(!spec||!hex32(spec.codeHash))throw new SettlementError('unpinned contract');
  const h=await this.header(),tag={blockHash:h.hash,requireCanonical:true};
  const code=await this.request('eth_getCode',[address(spec.address),tag]);
  if(code==='0x'||keccak256(Buffer.from(code.slice(2),'hex'))!==spec.codeHash.toLowerCase())throw new SettlementError('canonical code mismatch');
  const result=await this.request('eth_call',[{to:address(spec.address),data},tag]);
  const check=await this.request('eth_getBlockByNumber',[h.number,false]);
  if(check?.hash?.toLowerCase()!==h.hash.toLowerCase())throw new SettlementError('canonical anchor changed');
  return {result,blockHash:h.hash,blockNumber:h.number};
 }
 async playerProfile(game,wallet){
  const a=words((await this.call('identity',calldata('profileIdOf(bytes32,address)',game,address(wallet)))).result)[0];
  if(BigInt('0x'+a)===0n)throw new SettlementError('canonical profile required');
  const p=words((await this.call('identity',calldata('profile(bytes32)','0x'+a))).result);
  if(p.length!==6||'0x'+p[1]!==game.toLowerCase()||'0x'+p[2].slice(24)!==address(wallet)||BigInt('0x'+p[5])!==1n)
   throw new SettlementError('canonical profile mismatch');
  return '0x'+a;
 }
 async verifyWallet(wallet,message,signature){
  address(wallet);
  if(typeof signature!=='string'||!/^0x[0-9a-f]+$/i.test(signature))return false;
  const bytes=Buffer.from(message),digest=keccak256(Buffer.concat([Buffer.from('\x19Ethereum Signed Message:\n'+bytes.length),bytes]));
  const h=await this.header(),tag={blockHash:h.hash,requireCanonical:true};
  const code=await this.request('eth_getCode',[wallet,tag]);
  if(code!=='0x'){
   const sig=signature.slice(2),data='0x'+selector('isValidSignature(bytes32,bytes)')+word(digest)+word(64)+word(sig.length/2)+sig.padEnd(Math.ceil(sig.length/64)*64,'0');
   const result=await this.request('eth_call',[{to:wallet,data},tag]);
   return result.slice(0,10).toLowerCase()==='0x1626ba7e';
  }
  if(signature.length!==132)return false;
  const s=BigInt('0x'+signature.slice(66,130)),v=parseInt(signature.slice(130),16);
  if(s===0n||s>0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n||![27,28].includes(v))return false;
  const recovered=await this.request('eth_call',[{to:'0x0000000000000000000000000000000000000001',
   data:digest+word(v)+signature.slice(2,66)+signature.slice(66,130)},tag]);
  return recovered?.toLowerCase()==='0x'+word(wallet);
 }
 async missionReward(source,wallet,id,amount){
  const m=words((await this.call(source,calldata('mission(address,bytes32)',address(wallet),id))).result);
  return m.length===9&&BigInt('0x'+m[0])===3n&&BigInt('0x'+m[8])===BigInt(amount)&&BigInt('0x'+m[4])!==0n;
 }
 async progressionReward(source,wallet,id,amount){
  const p=words((await this.call(source,calldata('progress(address,bytes32)',address(wallet),id))).result);
  const t=words((await this.call(source,calldata('track(bytes32)',id))).result);
  return p.length===2&&t.length===6&&BigInt('0x'+p[1])===1n&&BigInt('0x'+t[4])===BigInt(amount);
 }
 async unrestricted(domain){
  return BigInt('0x'+words((await this.call('emergency',calldata('isRestricted(bytes32)',domain))).result)[0])===0n;
 }
}
