import {SettlementError} from './buds-ledger.js';
import {address,calldata,words,word} from './finalized-rpc.js';
import {keccak256} from './keccak.js';
import {OPENING_DOMAIN,OPENING_POLICY_HASH,openingPurpose,poolDefinition,OPENING_POOLS,selectSeedOutcome,seedHash,openingKey,openingCommitment} from './seed-opening-selection.js';
const B=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/i.test(x);
const H=x=>B(x)&&BigInt(x)!==0n;
const n=x=>BigInt('0x'+x),hex=x=>'0x'+x,a=x=>address('0x'+x.slice(24));
const fail=m=>{throw new SettlementError(m);};
export class SeedOpeningChainReader {
 constructor({rpc,catalogue,gameId,profileId,timeoutSeconds,approvedRoutes}){
  if(typeof rpc?.header!=='function'||!catalogue?.rows||!H(gameId)||!H(profileId)||!Number.isSafeInteger(timeoutSeconds)||timeoutSeconds<1||!Array.isArray(approvedRoutes)||!approvedRoutes.length)fail('reviewed opening runtime required');
  for(const key of ['seedOpening','randomRouter','emergency'])if(!H(rpc.contracts?.[key]?.codeHash)||/^0x0{40}$/i.test(address(rpc.contracts[key].address)))fail('unpinned opening dependency');
  for(const r of approvedRoutes)if(![seedHash('420.RANDOM.METHOD.NATIVE_THRESHOLD_VRF.V1'),seedHash('420.RANDOM.METHOD.EXTERNAL_VRF.V1')].includes(r.methodId)||!H(r.routeId)||!H(r.methodId)||!H(r.verifierCodeHash)||!Number.isSafeInteger(r.revision)||r.revision<1||/^0x0{40}$/i.test(address(r.operator))||/^0x0{40}$/i.test(address(r.verifier)))fail('unreviewed opening proof route');
  Object.assign(this,{rpc,catalogue,gameId,profileId,timeoutSeconds,approvedRoutes});
  this.binding=Object.freeze({chainId:rpc.chainId,contract:address(rpc.contracts.seedOpening.address),contractCodeHash:rpc.contracts.seedOpening.codeHash.toLowerCase(),router:address(rpc.contracts.randomRouter.address),routerCodeHash:rpc.contracts.randomRouter.codeHash.toLowerCase(),emergency:address(rpc.contracts.emergency.address),emergencyCodeHash:rpc.contracts.emergency.codeHash.toLowerCase(),profileId,timeoutSeconds});
 }
 async session(){
  for(const [key,addressKey,hashKey] of [['seedOpening','contract','contractCodeHash'],['randomRouter','router','routerCodeHash'],['emergency','emergency','emergencyCodeHash']])if(address(this.rpc.contracts[key].address)!==this.binding[addressKey]||this.rpc.contracts[key].codeHash.toLowerCase()!==this.binding[hashKey])fail('opening RPC deployment changed');
  if(this.rpc.chainId!==this.binding.chainId)fail('opening RPC chain changed');
  const h=await this.rpc.header(),tag={blockHash:h.hash,requireCanonical:true},checked=new Set();
  const code=async(addr,hash)=>{const actual=await this.rpc.request('eth_getCode',[address(addr),tag]);if(actual==='0x'||keccak256(Buffer.from(actual.slice(2),'hex'))!==hash.toLowerCase())fail('opening contract code mismatch');};
  const call=async(name,sig,...args)=>{const c=this.rpc.contracts[name];if(!checked.has(name)){await code(c.address,c.codeHash);checked.add(name);}return words(await this.rpc.request('eth_call',[{to:address(c.address),data:calldata(sig,...args)},tag]));};
  const scalar=async(sig,expected)=>{const out=await call('seedOpening',sig);if(out.length!==1||out[0]!==word(expected))fail('opening runtime binding mismatch');};
  await scalar('router()',address(this.rpc.contracts.randomRouter.address));await scalar('emergencyState()',address(this.rpc.contracts.emergency.address));
  await scalar('gameId()',this.gameId);await scalar('policyHash()',OPENING_POLICY_HASH);await scalar('profileId()',this.profileId);await scalar('timeoutSeconds()',this.timeoutSeconds);
  const finish=async()=>{const last=await this.rpc.request('eth_getBlockByNumber',[h.number,false]);if(last?.hash?.toLowerCase()!==h.hash.toLowerCase())fail('opening finalized anchor changed');return {chainId:this.rpc.chainId,blockNumber:h.number,blockHash:h.hash};};
  return {h,call,scalar,code,finish};
 }
 async pool(s,pool){
  const out=await s.call('seedOpening','poolHash(uint8)',pool.index);if(out.length!==1||hex(out[0])!==pool.hash)fail('opening pool hash mismatch');
  for(let t=0;t<3;t++){const size=await s.call('seedOpening','poolSize(uint8,uint8)',pool.index,t);if(size.length!==1||n(size[0])!==BigInt(pool.tiers[t].length))fail('opening tier cardinality mismatch');}
 }
 async validatePool(pool){const s=await this.session();await this.pool(s,pool);return s.finish();}
 async read(intent){
  if(!intent.deployment||Object.entries(this.binding).some(([k,v])=>intent.deployment[k]!==v))fail('opening deployment cannot be replaced');
  if(intent.openingKey!==openingKey(this.gameId,intent.packId)||intent.gameId!==this.gameId||intent.policyHash!==OPENING_POLICY_HASH||intent.purpose!==openingPurpose(intent))fail('invalid opening intent');
  const pool=poolDefinition(this.catalogue,OPENING_POOLS[intent.pool]);if(!Array.isArray(intent.eligible)||intent.eligible.length!==pool.tiers.flat().length||new Set(intent.eligible.map(g=>g.genomeId)).size!==intent.eligible.length||intent.eligible.some((g,i)=>g.cultivarId!==pool.tiers.flat()[i]||!H(g.genomeId))||intent.sourcePack?.id!==intent.packId||intent.sourcePack?.owner!==intent.owner||intent.commitment!==openingCommitment(intent))fail('opening genome/source commitment mismatch');if(pool.hash!==intent.poolHash)fail('immutable opening pool changed');
  const s=await this.session();await this.pool(s,pool);
  const o=await s.call('seedOpening','getOpening(bytes32)',intent.openingKey);
  if(o.length!==9)fail('invalid opening ABI');
  if(n(o[0])===0n){if(o.some(w=>n(w)!==0n))fail('malformed absent opening');await s.finish();return null;}
  if(hex(o[0])!==intent.commitment||a(o[1])!==address(intent.wallet)||n(o[2])!==BigInt(intent.pool)||!H(hex(o[3]))||n(o[8])>1n)fail('canonical opening commitment mismatch');
  const requestId=hex(o[3]),r=await s.call('randomRouter','request(bytes32)',requestId),persistent=await s.call('randomRouter','persistentRequest(bytes32)',requestId);
  if(r.length!==21||a(r[0])!==address(this.rpc.contracts.seedOpening.address)||hex(r[1])!==this.profileId||hex(r[3])!==OPENING_DOMAIN||hex(r[4])!==intent.purpose||n(r[18])<2n||n(r[19])!==0n||![1n,3n].includes(n(r[20]))||persistent.length!==1||n(persistent[0])!==1n||n(r[17])-n(r[15])!==BigInt(this.timeoutSeconds))fail('canonical seed randomness binding mismatch');
  const route=this.approvedRoutes.find(route=>route.routeId===hex(r[5])&&BigInt(route.revision)===n(r[7])&&address(route.operator)===a(r[9])&&address(route.verifier)===a(r[11])&&route.methodId===hex(r[13]));
  if(!route)fail('unapproved frozen seed proof provider');await s.code(route.verifier,route.verifierCodeHash);
  const fulfilled=n(o[8])===1n,routerReady=n(r[20])===3n;
  const result={contract:address(this.rpc.contracts.seedOpening.address),openingKey:intent.openingKey,commitment:intent.commitment,requestId,fulfilled,routerReady};
  if(fulfilled){
   const rng=await s.call('randomRouter','result(bytes32)',requestId);
   if(!routerReady||rng.length!==2||!B(hex(rng[0]))||!B(hex(rng[1]))||o[6]!==rng[0]||o[7]!==rng[1])fail('opening proof or entropy mismatch');
   const selected=selectSeedOutcome(pool,hex(rng[0]),requestId);
   if(n(o[4])!==BigInt(selected.tierIndex)||n(o[5])!==BigInt(selected.index))fail('canonical opening selection mismatch');
   Object.assign(result,{tier:selected.tierIndex,index:selected.index,entropy:hex(rng[0]),proofHash:hex(rng[1])});
  }else if([o[4],o[5],o[6],o[7]].some(w=>n(w)!==0n))fail('unfulfilled opening contains preview outcome');
  result.anchor=await s.finish();return result;
 }
}
