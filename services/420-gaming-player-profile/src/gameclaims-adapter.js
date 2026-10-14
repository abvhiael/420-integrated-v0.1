// R05.4 canonical GameClaims420 / HighCountryGamingBridge420 / HighCountryMigration420 adapters.
// Uses exact deployed contract method signatures through separately configured transports.
// Never accepts a client-supplied "finalized" flag or holds/derives player private keys.
const reject=(code)=>{throw Object.assign(new Error(code),{code});};
const bytes32=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&x!=='0x'+'0'.repeat(64);
const addr=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/.test(x)&&x!=='0x'+'0'.repeat(40);
const uint=(x,bits)=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<2n**BigInt(bits);
const eq=(a,b)=>a===b;
const make=x=>Object.freeze(x);
const claimsABI=make({
 issue:'issue(bytes32,bytes32,address,bytes32,bytes32,uint64)',
 claim:'claim(bytes32)',
 consume:'consume(bytes32)',
 cancel:'cancel(bytes32)'
});
const bridgeABI=make({
 bindGrowerProfile:'bindGrowerProfile(uint64)',
 bindConsumedMigrationClaim:'bindConsumedMigrationClaim(bytes32,uint64,bytes32)',
 growerProfileIdOfMigrationClaim:'growerProfileIdOfMigrationClaim(bytes32)',
 gameProfileIdOfGrower:'gameProfileIdOfGrower(uint64)'
});
const migrationABI=make({
 guestStateCommitment:'guestStateCommitment(bytes32,uint64,bytes32)',
 migrationPayloadHash:'migrationPayloadHash(bytes32,uint64,uint32,bytes32)',
 isReadyToApply:'isReadyToApply(bytes32,uint64,bytes32,bytes32)',
 markApplied:'markApplied(bytes32,uint64,bytes32,bytes32)',
 appliedMigration:'appliedMigration(bytes32)'
});
export const R054_CANONICAL_ABI=make({claims:claimsABI,bridge:bridgeABI,migration:migrationABI});
const B32={name:'claimId',type:'bytes32'};
const claimOut={name:'record',type:'tuple',components:[
 {name:'claimId',type:'bytes32'},{name:'gameId',type:'bytes32'},{name:'targetAccount',type:'address'},
 {name:'guestStateCommitment',type:'bytes32'},{name:'migrationPayloadHash',type:'bytes32'},
 {name:'validUntil',type:'uint64'},{name:'consumed',type:'bool'},{name:'cancelled',type:'bool'},
 {name:'exists',type:'bool'}]};
const appliedOut={name:'record',type:'tuple',components:[
 {name:'growerProfileId',type:'uint64'},{name:'guestStateCommitment',type:'bytes32'},
 {name:'migrationPayloadHash',type:'bytes32'},{name:'appliedAt',type:'uint64'},
 {name:'exists',type:'bool'}]};
const fn=(name,inputs,outputs=[],stateMutability='view')=>({type:'function',name,inputs,outputs,stateMutability});
const input=(name,type)=>({name,type});
export const R054_ABI=Object.freeze({
 claims:Object.freeze([
  fn('claim',[B32],[claimOut]),
  fn('issue',[B32,input('gameId','bytes32'),input('targetAccount','address'),
   input('guestStateCommitment','bytes32'),input('migrationPayloadHash','bytes32'),
   input('validUntil','uint64')],[],'nonpayable'),
  fn('consume',[B32],[input('profileId','bytes32')],'nonpayable')
 ]),
 bridge:Object.freeze([
  fn('growerProfileIdOfMigrationClaim',[B32],[input('growerId','uint64')]),
  fn('gameProfileIdOfGrower',[input('growerId','uint64')],[input('profileId','bytes32')]),
  fn('bindConsumedMigrationClaim',[B32,input('growerId','uint64'),input('expectedPayloadHash','bytes32')],[],'nonpayable')
 ]),
 migration:Object.freeze([
  fn('guestStateCommitment',[input('guestAccountCommitment','bytes32'),input('saveRevision','uint64'),
   input('stateHash','bytes32')],[input('commitment','bytes32')],'pure'),
  fn('migrationPayloadHash',[input('guestStateCommitment','bytes32'),input('growerId','uint64'),
   input('schemaVersion','uint32'),input('bodyHash','bytes32')],[input('payloadHash','bytes32')],'pure'),
  fn('isReadyToApply',[B32,input('growerId','uint64'),input('guestStateCommitment','bytes32'),
   input('payloadHash','bytes32')],[input('ready','bool')]),
  fn('appliedMigration',[B32],[appliedOut]),
  fn('markApplied',[B32,input('growerId','uint64'),input('guestStateCommitment','bytes32'),
   input('payloadHash','bytes32')],[],'nonpayable')
 ])
});
const toContractArgs=(functionName,args)=>args.map(x=>
 typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&['issue','guestStateCommitment',
 'migrationPayloadHash','bindConsumedMigrationClaim','isReadyToApply','markApplied'].includes(functionName)?
 BigInt(x):x);

export function claimIdToBytes32(id){
 if(!uint(id,64)||id==='0')reject('r054-invalid-claim-id');
 return '0x'+BigInt(id).toString(16).padStart(64,'0');
}
function assertConfig(x){
 if(!x||!uint(x.chainId,64)||x.chainId==='0'||!bytes32(x.gameId)||
 !addr(x.claims)||!addr(x.bridge)||!addr(x.migration)||!addr(x.operator))reject('r054-config-invalid');
 if(new Set([x.claims,x.bridge,x.migration]).size!==3)reject('r054-config-collision');
}
function io(client){
 if(typeof client?.readContract!=='function'||typeof client?.chainId!=='function')reject('r054-transport-invalid');
}
const check=(v,label)=>{if(!v)reject(label);};
export class HighCountryGameClaimsAdapter420 {
 #config;#read;#operator;
 constructor({config,readClient,operatorClient}={}){
  assertConfig(config);io(readClient);
  if(!operatorClient||typeof operatorClient.writeContract!=='function')reject('r054-operator-invalid');
  this.#config=make({...config});this.#read=readClient;this.#operator=operatorClient;
 }
 async #chain(){
  const actual=await this.#read.chainId();
  if(String(actual)!==this.#config.chainId)reject('r054-wrong-chain');
 }
 async #get(address,functionName,args=[]){
  await this.#chain();
  const abi=address===this.#config.claims?R054_ABI.claims:
   address===this.#config.bridge?R054_ABI.bridge:R054_ABI.migration;
  return this.#read.readContract({address,abi,functionName,args:toContractArgs(functionName,args)});
 }
 async #write(address,functionName,args){
  await this.#chain();
  if(typeof this.#operator.chainId==='function'&&String(await this.#operator.chainId())!==this.#config.chainId)
   reject('r054-operator-chain-mismatch');
  if(typeof this.#operator.account!=='function'||(await this.#operator.account())!==this.#config.operator)
   reject('r054-not-game-operator');
  const abi=address===this.#config.claims?R054_ABI.claims:
   address===this.#config.bridge?R054_ABI.bridge:R054_ABI.migration;
  return this.#operator.writeContract({address,abi,functionName,args:toContractArgs(functionName,args),account:this.#config.operator});
 }
 // All identifiers and expected hashes are supplied by already-authenticated, reviewed policy,
 // never a player HTTP request. Issuance retries MUST read claim before any new submission.
 async issue(x){
  const keys=['claimId','targetWallet','guestAccountCommitment','saveRevision','stateHash',
    'growerId','schemaVersion','payloadBodyHash','validUntil'];
  if(!x||Object.keys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k))||
    !addr(x.targetWallet)||!bytes32(x.guestAccountCommitment)||!uint(x.saveRevision,64)||
    !bytes32(x.stateHash)||!uint(x.growerId,64)||x.growerId==='0'||
    !uint(x.schemaVersion,32)||x.schemaVersion==='0'||!bytes32(x.payloadBodyHash)||
    !uint(x.validUntil,64)||x.validUntil==='0')reject('r054-invalid-issue');
  const claimId=claimIdToBytes32(x.claimId);
  const guest=await this.#get(this.#config.migration,'guestStateCommitment',
    [x.guestAccountCommitment,x.saveRevision,x.stateHash]);
  const payload=await this.#get(this.#config.migration,'migrationPayloadHash',
    [guest,x.growerId,x.schemaVersion,x.payloadBodyHash]);
  if(!bytes32(guest)||!bytes32(payload))reject('r054-untrusted-commitments');
  let existing;
  try{existing=await this.#get(this.#config.claims,'claim',[claimId]);}
  catch(e){if(e?.code!=='ClaimNotFound')throw e;}
  if(existing){
   this.#assertClaim(existing,{claimId,targetWallet:x.targetWallet,guest,payload,validUntil:x.validUntil});
   return make({claimId,guestStateCommitment:guest,migrationPayloadHash:payload,alreadyIssued:true});
  }
  // Configured operator must still be canonical GameRegistry operator; contract enforces it.
  const tx=await this.#write(this.#config.claims,'issue',
    [claimId,this.#config.gameId,x.targetWallet,guest,payload,x.validUntil]);
  return make({claimId,guestStateCommitment:guest,migrationPayloadHash:payload,tx,alreadyIssued:false});
 }
 #assertClaim(c,{claimId,targetWallet,guest,payload,validUntil}){
  if(!c||c.exists!==true||!eq(c.claimId,claimId)||!eq(c.gameId,this.#config.gameId)||
    !eq(c.targetAccount,targetWallet)||!eq(c.guestStateCommitment,guest)||
    !eq(c.migrationPayloadHash,payload)||String(c.validUntil)!==validUntil||
    c.cancelled===true)reject('r054-claim-conflict');
 }
 async readClaim(id){
  const claimId=claimIdToBytes32(id);
  const claim=await this.#get(this.#config.claims,'claim',[claimId]);
  if(!claim||!claim.exists||claim.claimId!==claimId||claim.gameId!==this.#config.gameId)
   reject('r054-claim-mismatch');
  return make({...claim});
 }
 // Return a specific wallet request; the target wallet signs/broadcasts externally.
 // DO NOT call operatorClient or server custody on behalf of a player.
 async targetWalletConsume({claimId,targetWallet}){
  if(!addr(targetWallet))reject('r054-invalid-target');
  const c=await this.readClaim(claimId);
  if(c.targetAccount!==targetWallet||c.cancelled||c.consumed||
    (BigInt(c.validUntil)!==0n&&BigInt(c.validUntil)<BigInt(Math.floor(Date.now()/1000))))
    reject('r054-consume-unavailable');
  return make({chainId:this.#config.chainId,address:this.#config.claims,
    functionName:'consume',args:make([claimIdToBytes32(claimId)]),requiredSigner:targetWallet});
 }
 async targetWalletBind({claimId,targetWallet,growerId,payloadHash}){
  if(!addr(targetWallet)||!uint(growerId,64)||growerId==='0'||!bytes32(payloadHash))
   reject('r054-invalid-binding');
  const c=await this.readClaim(claimId);
  if(!c.consumed||c.cancelled||c.targetAccount!==targetWallet||c.migrationPayloadHash!==payloadHash)
   reject('r054-binding-denied');
  const bound=await this.#get(this.#config.bridge,'growerProfileIdOfMigrationClaim',
    [claimIdToBytes32(claimId)]);
  if(String(bound)!=='0')reject('r054-already-bound');
  return make({chainId:this.#config.chainId,address:this.#config.bridge,
    functionName:'bindConsumedMigrationClaim',
    args:make([claimIdToBytes32(claimId),growerId,payloadHash]),requiredSigner:targetWallet});
 }
 async verifyConsumedBound({claimId,targetWallet,growerId,guestStateCommitment,payloadHash}){
  if(!addr(targetWallet)||!uint(growerId,64)||growerId==='0'||
    !bytes32(guestStateCommitment)||!bytes32(payloadHash))reject('r054-invalid-verification');
  const c=await this.readClaim(claimId);
  if(!c.consumed||c.cancelled||c.targetAccount!==targetWallet||
    c.guestStateCommitment!==guestStateCommitment||c.migrationPayloadHash!==payloadHash)
   reject('r054-claim-not-consumed');
  const id=claimIdToBytes32(claimId);
  const [bound,ready]=await Promise.all([
    this.#get(this.#config.bridge,'growerProfileIdOfMigrationClaim',[id]),
    this.#get(this.#config.migration,'isReadyToApply',[id,growerId,guestStateCommitment,payloadHash])
  ]);
  if(String(bound)!==growerId||ready!==true)reject('r054-unbound-or-unready');
  // This is on-chain contract-state verification, NOT proof of canonical finality.
  // R05.7 must pin finalized block hash and independent canonical RPC before DB apply.
  return make({claimId:id,gameId:this.#config.gameId,targetWallet,growerId,
    guestStateCommitment,payloadHash,ready:true,canonicalFinality:'UNVERIFIED'});
 }
 async receiptState({claimId,growerId,guestStateCommitment,payloadHash}){
  if(!uint(growerId,64)||growerId==='0'||!bytes32(guestStateCommitment)||!bytes32(payloadHash))
   reject('r054-invalid-receipt');
  const row=await this.#get(this.#config.migration,'appliedMigration',[claimIdToBytes32(claimId)]);
  if(!row?.exists)return make({status:'NOT_APPLIED'});
  if(String(row.growerProfileId)!==growerId||row.guestStateCommitment!==guestStateCommitment||
    row.migrationPayloadHash!==payloadHash)reject('r054-receipt-mismatch');
  return make({status:'APPLIED_UNFINALIZED',appliedAt:String(row.appliedAt)});
 }
 async operatorReceiptRequest({claimId,growerId,guestStateCommitment,payloadHash}){
  if(!uint(growerId,64)||growerId==='0'||!bytes32(guestStateCommitment)||!bytes32(payloadHash))
   reject('r054-invalid-receipt');
  const read=await this.receiptState({claimId,growerId,guestStateCommitment,payloadHash});
  if(read.status!=='NOT_APPLIED')return make({...read,alreadySubmitted:true});
  const tx=await this.#write(this.#config.migration,'markApplied',
    [claimIdToBytes32(claimId),growerId,guestStateCommitment,payloadHash]);
  return make({status:'SUBMITTED_UNFINALIZED',tx});
 }
}
