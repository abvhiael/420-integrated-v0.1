import {SettlementError} from './buds-ledger.js';
import {address,calldata,words,word} from './finalized-rpc.js';
import {keccak256} from './keccak.js';
const H=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/i.test(x);
const hex=x=>'0x'+x;
const n=x=>BigInt('0x'+x);
const a=x=>address('0x'+x.slice(24));
const ZERO='0x'+'0'.repeat(64);
const bytes=x=>Buffer.from(word(x),'hex');
const fail=m=>{throw new SettlementError(m);};
// uint64 event IDs must not round through JavaScript Number during JSON loading.
export const parseSeedBreedingPlan=text=>JSON.parse(text.replace(/("breedingEventId"\s*:\s*)(\d+)/g,'$1"$2"'));
export function canonicalSeedChild(parentA,parentB,entropy,eventId){
 if(parentA.length!==28||parentB.length!==28||!H(entropy)||entropy===ZERO)fail('invalid breeding inputs');
 return parentA.map((locus,i)=>{
  const draw=BigInt(keccak256(Buffer.concat([bytes(entropy),bytes(eventId),bytes(i)])));
  let selected=(draw&1n)===0n?locus:parentB[i];
  if(((draw>>8n)&255n)<5n){const domain=Buffer.from('HC.MUTATION.V1');selected=keccak256(Buffer.concat([bytes(160),bytes(selected),bytes(entropy),bytes(eventId),bytes(i),bytes(domain.length),Buffer.concat([domain,Buffer.alloc(32-domain.length)])]));}
  return selected;
 });
}
export class SeedChainReader {
 constructor({rpc,commonReferences,rarePlan,founders,deploymentBlock,maxScanBlocks=200000,logChunk=2000}){
  if(typeof rpc?.header!=='function'||typeof rpc?.request!=='function'||!Number.isSafeInteger(deploymentBlock)||deploymentBlock<0||!Number.isSafeInteger(maxScanBlocks)||maxScanBlocks<1||maxScanBlocks>1000000||!Number.isSafeInteger(logChunk)||logChunk<1||logChunk>5000||commonReferences?.genomes?.length!==23||rarePlan?.events?.length!==26||founders?.founders?.length!==16)fail('canonical seed reader configuration required');
  for(const key of ['seeds','genomes','plants','harvest','cultivation','breeding','breedingRandomness','randomRouter']){const c=rpc.contracts[key];if(!c||!H(c.codeHash)||c.codeHash===ZERO||/^0x0{40}$/i.test(address(c.address)))fail('unpinned seed contract');}
  Object.assign(this,{rpc,deploymentBlock,maxScanBlocks,logChunk});
  this.common=new Map(commonReferences.genomes.map(e=>[e.genomeId.toLowerCase(),e]));
  this.rare=new Map(rarePlan.events.map(e=>{if(typeof e.breedingEventId!=='string'||!/^[1-9]\d*$/.test(e.breedingEventId))fail('lossless breeding event ID required');return [e.childGenomeId.toLowerCase(),e];}));
  this.founders=new Map(founders.founders.map(f=>[keccak256(Buffer.from('HC.FOUNDING.GENETIC_LINE.'+f.index)),f.id]));
  if(this.common.size!==23||this.rare.size!==26||this.founders.size!==16||[...this.rare.values()].some(e=>!this.common.has(e.parentAGenomeId)||!this.common.has(e.parentBGenomeId)||e.parentAGenomeId===e.parentBGenomeId))fail('seed reference identity coverage');
 }
 async session(){
  const header=await this.rpc.header(),tag={blockHash:header.hash,requireCanonical:true},checked=new Set(),resolved=new Map();
  const call=async(name,sig,...args)=>{
   const spec=this.rpc.contracts[name];
   if(!spec)fail('unconfigured seed dependency');
   if(!checked.has(name)){
    const code=await this.rpc.request('eth_getCode',[address(spec.address),tag]);
    if(code==='0x'||keccak256(Buffer.from(code.slice(2),'hex'))!==spec.codeHash.toLowerCase())fail('seed contract code mismatch');checked.add(name);
   }
   return words(await this.rpc.request('eth_call',[{to:address(spec.address),data:calldata(sig,...args)},tag]));
  };
  const bound=async(name,sig,target)=>{const out=await call(name,sig);if(out.length!==1||a(out[0])!==address(this.rpc.contracts[target].address))fail('seed contract dependency mismatch');};
  await bound('seeds','genomeRegistry()','genomes');await bound('plants','genomeRegistry()','genomes');
  await bound('harvest','plantRegistry()','plants');await bound('harvest','cultivationEngine()','cultivation');await bound('cultivation','plantRegistry()','plants');
  const genome=async gid=>{
   if(!H(gid)||gid===ZERO)fail('invalid seed genome');
   const g=await call('genomes','getGenome(bytes32)',gid);
   if(g.length!==33||hex(g[0])!==gid.toLowerCase()||n(g[32])!==1n)fail('genome record mismatch');
   return {genomeId:gid.toLowerCase(),lineId:hex(g[1]),metadataHash:hex(g[2]),loci:g.slice(3,31).map(hex),founding:n(g[31])===1n};
  };
  const resolve=async gid=>{
   gid=gid.toLowerCase();if(resolved.has(gid))return resolved.get(gid);
   const g=await genome(gid);let result=null;
   const common=this.common.get(gid),rare=this.rare.get(gid);
   if(common){
    if(g.founding||g.lineId!==common.lineId||g.metadataHash!==common.metadataHash||g.loci.some((x,i)=>x!==common.loci[i]))fail('common reference record mismatch');
    result={cultivarId:common.cultivarId,genomeId:gid,basis:'registered-common-reference'};
   }else if(rare){
    await bound('breeding','genomeRegistry()','genomes');await bound('breeding','randomness()','breedingRandomness');await bound('breedingRandomness','breedingEngine()','breeding');await bound('breedingRandomness','router()','randomRouter');
    const e=await call('breeding','getBreedingEvent(uint64)',rare.breedingEventId);
    const expected=[rare.parentAGenomeId,rare.parentBGenomeId,rare.childGenomeId,rare.childLineId,rare.metadataHash,rare.contextHash,rare.localRequestId];
    if(e.length!==11||n(e[0])!==BigInt(rare.breedingEventId)||expected.some((v,i)=>v!==hex(e[i+1]))||n(e[9])!==1n||n(e[10])!==1n||g.founding||g.lineId!==rare.childLineId||g.metadataHash!==rare.metadataHash)fail('rare breeding provenance mismatch');
    const pa=await resolve(rare.parentAGenomeId),pb=await resolve(rare.parentBGenomeId);
    if(!pa||!pb)fail('unqualified rare parent');
    const pending=await call('breedingRandomness','pending(bytes32)',rare.localRequestId);
    const domain=keccak256(Buffer.from('HC.RANDOM.BREEDING.V1'));
    if(pending.length!==5||hex(pending[0])===ZERO||hex(pending[1])!==domain||hex(pending[2])!==rare.contextHash||n(pending[3])!==0n||n(pending[4])!==1n)fail('rare randomness consumption mismatch');
    const req=await call('randomRouter','request(bytes32)',hex(pending[0]));
    const profile=await call('breedingRandomness','profileId()');
    const rng=await call('randomRouter','result(bytes32)',hex(pending[0]));
    if(req.length!==21||profile.length!==1||a(req[0])!==address(this.rpc.contracts.breedingRandomness.address)||req[1]!==profile[0]||hex(req[3])!==domain||hex(req[4])!==rare.contextHash||n(req[20])!==3n||rng.length!==2||rng[0]!==e[8]||hex(rng[0])===ZERO||hex(rng[1])===ZERO)fail('rare proof binding mismatch');
    const loci=canonicalSeedChild(this.common.get(rare.parentAGenomeId).loci,this.common.get(rare.parentBGenomeId).loci,hex(e[8]),rare.breedingEventId);
    if(g.loci.some((x,i)=>x!==loci[i]))fail('rare inherited loci mismatch');
    result={cultivarId:rare.cultivarId,genomeId:gid,basis:'finalized-canonical-breeding',breedingEventId:rare.breedingEventId,canonicalRequestId:hex(pending[0]),proofHash:hex(rng[1])};
   }else if(g.founding&&this.founders.has(g.lineId)){
    const mapped=await call('genomes','foundingGenomeOfLine(bytes32)',g.lineId);
    if(mapped.length!==1||hex(mapped[0])!==gid)fail('founding line mismatch');
    result={cultivarId:this.founders.get(g.lineId),genomeId:gid,basis:'registered-founding-line'};
   }
   resolved.set(gid,result);return result;
  };
  const finish=async()=>{const check=await this.rpc.request('eth_getBlockByNumber',[header.number,false]);if(check?.hash?.toLowerCase()!==header.hash.toLowerCase())fail('seed finalized anchor changed');return {blockHash:header.hash,blockNumber:header.number,chainId:this.rpc.chainId};};
  return {header,call,resolve,finish};
 }
 async ownership(wallet){
  wallet=address(wallet);const s=await this.session(),head=Number(BigInt(s.header.number));
  if(!Number.isSafeInteger(head)||head<this.deploymentBlock||head-this.deploymentBlock+1>this.maxScanBlocks)fail('seed index range unavailable');
  const lotIds=new Set(),received=new Set(),owner='0x'+word(wallet),seedAddress=address(this.rpc.contracts.seeds.address);
  for(const signature of ['SeedLotRegistered(uint64,bytes32,address,uint32,uint64)','SeedLotTransferred(uint64,address,address)']){
   for(let from=this.deploymentBlock;from<=head;from+=this.logChunk){
    const to=Math.min(head,from+this.logChunk-1);
    const logs=await this.rpc.request('eth_getLogs',[{address:seedAddress,fromBlock:'0x'+from.toString(16),toBlock:'0x'+to.toString(16),topics:[keccak256(Buffer.from(signature)),null,null,owner]}]);
    if(!Array.isArray(logs)||logs.length>10000)fail('seed log index unavailable');
    for(const log of logs){
     if(log.removed||address(log.address)!==seedAddress||log.topics?.length!==4||log.topics[0]!==keccak256(Buffer.from(signature))||log.topics[3].toLowerCase()!==owner||!H(log.topics[1])||!H(log.blockHash)||!H(log.transactionHash))fail('untrusted seed log');
     const block=Number(BigInt(log.blockNumber));if(block<from||block>to)fail('seed log outside finalized range');
     const anchor=await this.rpc.request('eth_getBlockByNumber',[log.blockNumber,false]);if(anchor?.hash!==log.blockHash)fail('seed log anchor mismatch');
     lotIds.add(BigInt(log.topics[1]).toString());if(lotIds.size>500)fail('seed index page limit exceeded');
    }
   }
  }
  const quantities={},provenance={};let uncataloguedLots=0;
  for(const lotId of lotIds){
   const lot=await s.call('seeds','getSeedLot(uint64)',lotId);
   if(lot.length!==7||n(lot[0])!==BigInt(lotId)||n(lot[6])!==1n)fail('seed lot mismatch');
   const known=await s.resolve(hex(lot[1]));if(known)received.add(known.cultivarId);
   if(a(lot[3])!==wallet)continue;
   const left=await s.call('seeds','remainingQuantity(uint64)',lotId);
   if(left.length!==1||n(left[0])>n(lot[4])||n(lot[4])>0xffffffffn)fail('seed lot quantity mismatch');
   if(known){quantities[known.cultivarId]=(quantities[known.cultivarId]??0)+Number(n(left[0]));provenance[known.cultivarId]=known;}
   else uncataloguedLots++;
  }
  return {quantities,discovered:[...received],provenance,uncataloguedLots,anchor:await s.finish()};
 }
 async harvest(wallet,plantId){
  wallet=address(wallet);const s=await this.session();
  const h=await s.call('harvest','getHarvest(uint64)',plantId),score=await s.call('harvest','getHarvestScore(uint64)',plantId);
  if(h.length!==10||n(h[0])!==BigInt(plantId)||a(h[5])!==wallet||n(h[9])!==1n||[h[1],h[2],h[3],h[4]].some(x=>hex(x)===ZERO)||n(h[6])===0n||n(h[8])===0n||score.length!==4||n(score[0])<1n||n(score[0])>1000n||n(score[1])<1n||n(score[1])>10000n||n(score[3])<1n||n(score[3])>4n)fail('successful grower harvest required');
  const plant=await s.call('plants','getPlant(uint64)',plantId);
  if(plant.length!==9||plant[0]!==h[0]||plant[1]!==h[1]||plant[2]!==h[5]||plant[3]!==h[6]||n(plant[8])!==1n)fail('harvest plant binding mismatch');
  const provenance=await s.resolve(hex(h[1]));if(!provenance)fail('harvest cultivar not canonically catalogued');
  return {successful:true,cultivarId:provenance.cultivarId,genomeId:hex(h[1]),plantId,sourceKey:JSON.stringify([this.rpc.chainId,address(this.rpc.contracts.harvest.address),plantId]),grower:wallet,quantityGrams:Number(n(score[0])),qualityBps:Number(n(score[1])),grade:Number(n(score[3])),expressionHash:hex(h[2]),provenance,anchor:await s.finish()};
 }
}
