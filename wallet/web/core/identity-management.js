import { normalizeAddress, normalizeBytes32, ZERO_ADDRESS, ZERO_BYTES32 } from './abi.js';
import { keccak256Hex } from './keccak.js';

const textBytes = (text) => new TextEncoder().encode(text);
const selector = (signature) => keccak256Hex(textBytes(signature)).slice(2, 10);
const word = (value) => value.replace(/^0x/, '').padStart(64, '0');
const bytes32Word = (value) => normalizeBytes32(value).slice(2);
const addressWord = (value) => word(normalizeAddress(value));
const boolWord = (value) => BigInt(value ? 1 : 0).toString(16).padStart(64, '0');

const SELECTORS = Object.freeze({
  systemName: selector('systemName()'),
  protocolVersion: selector('protocolVersion()'),
  profiles: selector('profiles(bytes32)'),
  issuers: selector('issuers(bytes32)'),
  credentials: selector('credentials(bytes32)'),
  credentialValid: selector('credentialValid(bytes32)'),
  createProfile: selector('createProfile(bytes32,bytes32)'),
  updateProfile: selector('updateProfile(bytes32,bytes32,bool)'),
  setPrimaryName: selector('setPrimaryName(bytes32,bytes32)'),
  transferProfileController: selector('transferProfileController(bytes32,address)'),
  acceptProfileController: selector('acceptProfileController(bytes32)'),
  rejectCredential: selector('rejectCredential(bytes32)'),
  nameClaimsProfile: selector('nameClaimsProfile(bytes32,bytes32)'),
});

export const IDENTITY420_VERSION = 3n;
export const IDENTITY420_TRUST_CLASSES = Object.freeze(['NONE','COMMUNITY','VERIFIED','INSTITUTIONAL','SYSTEM']);

function checkedHex(value, label, bytes = null) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) throw new Error(`invalid ${label}`);
  if (bytes !== null && value.length !== 2 + bytes * 2) throw new Error(`invalid ${label}`);
  return value.toLowerCase();
}
function checkedChainId(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error('Identity420 requires a verified chain ID');
  return BigInt(value);
}
function uintWord(value) {
  const n = BigInt(value);
  if (n < 0n || n >= (1n << 256n)) throw new Error('uint256 out of range');
  return n.toString(16).padStart(64,'0');
}
function encodeCall(sel, ...words) { return `0x${sel}${words.join('')}`; }
function resultWords(result, count, label) {
  const hex = checkedHex(result, label).slice(2);
  if (hex.length !== count * 64) throw new Error(`invalid Identity420 ${label} response`);
  return Array.from({length:count}, (_,i)=>hex.slice(i*64,(i+1)*64));
}
function decodeAddressWord(value) { return normalizeAddress(`0x${value.slice(-40)}`); }
function decodeBytes32Word(value) { return normalizeBytes32(`0x${value}`); }
function decodeUintWord(value, bits=256) {
  const n=BigInt(`0x${value}`);
  if (n >= (1n << BigInt(bits))) throw new Error('invalid Identity420 integer response');
  return n;
}
function decodeBoolWord(value) {
  const n=decodeUintWord(value,8);
  if (n!==0n && n!==1n) throw new Error('invalid Identity420 boolean response');
  return n===1n;
}
function decodeStringResult(result) {
  const hex=checkedHex(result,'system name').slice(2);
  if (hex.length < 128) throw new Error('invalid Identity420 system name response');
  const offset=Number(BigInt(`0x${hex.slice(0,64)}`))*2;
  const length=Number(BigInt(`0x${hex.slice(offset,offset+64)}`));
  if (!Number.isSafeInteger(length) || length<0 || offset+64+length*2>hex.length) throw new Error('invalid Identity420 system name response');
  const bytes=hex.slice(offset+64,offset+64+length*2).match(/.{2}/g)||[];
  return new TextDecoder().decode(Uint8Array.from(bytes.map((x)=>parseInt(x,16))));
}

async function call(provider, to, data, from) {
  return provider.request('eth_call', [{to, data, ...(from ? {from} : {})}, 'latest']);
}
async function verifyCode(provider, address, label) {
  const code=await provider.request('eth_getCode',[address,'latest']);
  if (typeof code!=='string' || !/^0x[0-9a-fA-F]*$/.test(code) || code==='0x') throw new Error(`${label} has no deployed code`);
}
async function waitReceipt(provider, txHash, attempts=120) {
  for(let i=0;i<attempts;i+=1){
    const receipt=await provider.request('eth_getTransactionReceipt',[txHash]);
    if(receipt){
      if(receipt.status!=='0x1') throw new Error('Identity420 transaction reverted');
      return receipt;
    }
    await new Promise((resolve)=>setTimeout(resolve,250));
  }
  throw new Error('Identity420 transaction confirmation timed out');
}

export function classifyIdentity420Error(error) {
  const message=String(error?.message||error||'Identity420 action failed');
  const lower=message.toLowerCase();
  if(lower.includes('user rejected')||lower.includes('denied transaction')) return {message:'Wallet approval was rejected. No Identity420 transaction was submitted.',retryable:true};
  if(lower.includes('wrong network')||lower.includes('chain id')) return {message:'Wallet network no longer matches the qualified Identity420 deployment.',retryable:true};
  if(lower.includes('not profile controller')) return {message:'The connected account is not the current controller of this profile.',retryable:false};
  if(lower.includes('not pending controller')) return {message:'The connected account is not the nominated pending controller.',retryable:false};
  if(lower.includes('not credential subject')) return {message:'The connected account does not control the credential subject profile.',retryable:false};
  if(lower.includes('no deployed code')) return {message:'The configured Identity420 or Names420 deployment is unavailable.',retryable:true};
  return {message,retryable:true};
}

export function createIdentity420Client({provider, identityAddress, namesAddress, chainId, account}) {
  if(!provider || typeof provider.request!=='function') throw new Error('Identity420 provider required');
  const identity=normalizeAddress(identityAddress);
  const names=normalizeAddress(namesAddress);
  const controller=normalizeAddress(account);
  const expectedChain=checkedChainId(chainId);

  async function verifySession(){
    const liveChain=checkedChainId(await provider.request('eth_chainId'));
    if(liveChain!==expectedChain) throw new Error(`Wrong network: expected 0x${expectedChain.toString(16)}, received 0x${liveChain.toString(16)}`);
    await verifyCode(provider,identity,'Identity420');
    await verifyCode(provider,names,'Names420');
    const systemName=decodeStringResult(await call(provider,identity,`0x${SELECTORS.systemName}`,controller));
    if(systemName!=='Identity420') throw new Error('configured Identity420 address has wrong contract identity');
    const [versionWord]=resultWords(await call(provider,identity,`0x${SELECTORS.protocolVersion}`,controller),1,'protocol version');
    const version=decodeUintWord(versionWord,32);
    if(version!==IDENTITY420_VERSION) throw new Error(`unsupported Identity420 protocol version ${version}`);
    const accounts=await provider.request('eth_accounts');
    if(!Array.isArray(accounts)||!accounts.some((x)=>typeof x==='string'&&x.toLowerCase()===controller)) throw new Error('connected Identity420 account is no longer authorized');
    return {chainId:liveChain,systemName,version};
  }

  async function profile(profileId){
    const id=normalizeBytes32(profileId);
    const words=resultWords(await call(provider,identity,encodeCall(SELECTORS.profiles,bytes32Word(id)),controller),7,'profile');
    return {
      profileId:id, controller:decodeAddressWord(words[0]), pendingController:decodeAddressWord(words[1]),
      metadataHash:decodeBytes32Word(words[2]), primaryName:decodeBytes32Word(words[3]),
      createdAt:decodeUintWord(words[4],64), updatedAt:decodeUintWord(words[5],64), active:decodeBoolWord(words[6]),
      exists:decodeAddressWord(words[0])!==ZERO_ADDRESS,
    };
  }

  async function issuer(issuerId){
    const id=normalizeBytes32(issuerId);
    const words=resultWords(await call(provider,identity,encodeCall(SELECTORS.issuers,bytes32Word(id)),controller),4,'issuer');
    const trust=decodeUintWord(words[2],8);
    if(trust>4n) throw new Error('invalid Identity420 issuer trust class');
    return {issuerId:id,controller:decodeAddressWord(words[0]),metadataHash:decodeBytes32Word(words[1]),trustClass:Number(trust),trustLabel:IDENTITY420_TRUST_CLASSES[Number(trust)],active:decodeBoolWord(words[3])};
  }

  async function credential(credentialId){
    const id=normalizeBytes32(credentialId);
    const words=resultWords(await call(provider,identity,encodeCall(SELECTORS.credentials,bytes32Word(id)),controller),8,'credential');
    const [validWord]=resultWords(await call(provider,identity,encodeCall(SELECTORS.credentialValid,bytes32Word(id)),controller),1,'credential validity');
    const result={
      credentialId:id,issuerId:decodeBytes32Word(words[0]),subjectProfileId:decodeBytes32Word(words[1]),
      credentialType:decodeBytes32Word(words[2]),claimHash:decodeBytes32Word(words[3]),
      issuedAt:decodeUintWord(words[4],64),expiresAt:decodeUintWord(words[5],64),revokedAt:decodeUintWord(words[6],64),
      subjectRejected:decodeBoolWord(words[7]),valid:decodeBoolWord(validWord),
    };
    result.exists=result.subjectProfileId!==ZERO_BYTES32;
    result.issuer=result.exists ? await issuer(result.issuerId) : null;
    return result;
  }

  async function bilateralPrimaryName(profileId,labelHash){
    const p=await profile(profileId);
    const label=normalizeBytes32(labelHash);
    if(label===ZERO_BYTES32) return {profile:p,labelHash:label,identityClaims:false,namesClaims:false,bilateral:false};
    const identityClaims=p.primaryName===label;
    const [claimWord]=resultWords(await call(provider,names,encodeCall(SELECTORS.nameClaimsProfile,bytes32Word(label),bytes32Word(p.profileId)),controller),1,'Names420 profile claim');
    const namesClaims=decodeBoolWord(claimWord);
    return {profile:p,labelHash:label,identityClaims,namesClaims,bilateral:identityClaims&&namesClaims};
  }

  async function send(data, revalidate){
    await verifySession();
    if(revalidate) await revalidate();
    await provider.request('eth_call',[{from:controller,to:identity,data},'latest']);
    await provider.request('eth_estimateGas',[{from:controller,to:identity,data}]);
    if(revalidate) await revalidate();
    await verifySession();
    const txHash=await provider.request('eth_sendTransaction',[{from:controller,to:identity,data,value:'0x0'}]);
    checkedHex(txHash,'transaction hash',32);
    return {txHash:txHash.toLowerCase()};
  }

  return Object.freeze({
    identityAddress:identity,namesAddress:names,account:controller,verifySession,profile,issuer,credential,bilateralPrimaryName,
    confirm:(txHash)=>waitReceipt(provider,checkedHex(txHash,'transaction hash',32)),
    async createProfile({profileId,metadataHash}){
      const id=normalizeBytes32(profileId), meta=normalizeBytes32(metadataHash);
      return send(encodeCall(SELECTORS.createProfile,bytes32Word(id),bytes32Word(meta)), async()=>{
        const current=await profile(id); if(current.exists) throw new Error('Identity420 profile already exists');
      });
    },
    async updateProfile({profileId,metadataHash,active}){
      const id=normalizeBytes32(profileId),meta=normalizeBytes32(metadataHash);
      return send(encodeCall(SELECTORS.updateProfile,bytes32Word(id),bytes32Word(meta),boolWord(Boolean(active))), async()=>{
        const current=await profile(id); if(!current.exists) throw new Error('Identity420 profile does not exist'); if(current.controller!==controller) throw new Error('not profile controller');
      });
    },
    async transferController({profileId,newController}){
      const id=normalizeBytes32(profileId), next=normalizeAddress(newController);
      return send(encodeCall(SELECTORS.transferProfileController,bytes32Word(id),addressWord(next)), async()=>{
        const current=await profile(id); if(current.controller!==controller) throw new Error('not profile controller'); if(next===ZERO_ADDRESS||next===controller) throw new Error('invalid new profile controller');
      });
    },
    async acceptController({profileId}){
      const id=normalizeBytes32(profileId);
      return send(encodeCall(SELECTORS.acceptProfileController,bytes32Word(id)), async()=>{
        const current=await profile(id); if(current.pendingController!==controller) throw new Error('not pending controller');
      });
    },
    async setPrimaryName({profileId,labelHash}){
      const id=normalizeBytes32(profileId),label=normalizeBytes32(labelHash);
      return send(encodeCall(SELECTORS.setPrimaryName,bytes32Word(id),bytes32Word(label)), async()=>{
        const current=await profile(id); if(current.controller!==controller) throw new Error('not profile controller');
        if(label!==ZERO_BYTES32){
          const check=await bilateralPrimaryName(id,label);
          if(!check.namesClaims) throw new Error('Names420 does not currently claim this profile; establish Names→Identity binding before setting the Identity primary name');
        }
      });
    },
    async rejectCredential({credentialId}){
      const id=normalizeBytes32(credentialId);
      return send(encodeCall(SELECTORS.rejectCredential,bytes32Word(id)), async()=>{
        const current=await credential(id); if(!current.exists) throw new Error('Identity420 credential does not exist');
        const subject=await profile(current.subjectProfileId); if(subject.controller!==controller) throw new Error('not credential subject');
        if(current.subjectRejected) throw new Error('credential is already rejected');
      });
    },
  });
}
