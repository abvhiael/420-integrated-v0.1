import fs from 'node:fs';
import {hexUtf8,wordHex,wordUint,wordAddress} from './abi.mjs';
import {hash,address} from './consumer.mjs';

const ZERO='0x'+'0'.repeat(40),ONE='0x'+'0'.repeat(39)+'1';
const CURVE_N=BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const HASH=/^0x[0-9a-fA-F]{64}$/;
function reject(message){throw Object.assign(new Error(message),{statusCode:400});}
function cleanSignature(signature){
  if(typeof signature!=='string'||!/^0x[0-9a-fA-F]{130}$/.test(signature))reject('invalid Wallet signature');
  const r=BigInt('0x'+signature.slice(2,66)),s=BigInt('0x'+signature.slice(66,130));
  let v=Number.parseInt(signature.slice(130),16);if(v<2)v+=27;
  if(!r||r>=CURVE_N||!s||s>CURVE_N/2n||!([27,28].includes(v)))reject('noncanonical Wallet signature');
  return {r,s,v,raw:signature.toLowerCase()};
}
export async function verifyCreatorSignature(rpc,requestId,account,signature){
  const {r,s,v,raw}=cleanSignature(signature),who=address(account),message=hash(requestId);
  const prefix=hexUtf8('\x19Ethereum Signed Message:\n32').slice(2);
  const digest=hash(await rpc.call('web3_sha3',['0x'+prefix+message.slice(2)]));
  const code=await rpc.call('eth_getCode',[who,'latest']);
  if(typeof code!=='string'||!/^0x[0-9a-fA-F]*$/.test(code))throw new Error('unverifiable requester code');
  if(code!=='0x'&&code!=='0x0'&&code!=='0x00'){
    const selector=await rpc.selector('isValidSignature(bytes32,bytes)');
    const data=selector+wordHex(digest)+wordUint(64)+wordUint(65)+raw.slice(2).padEnd(192,'0');
    let result;
    try{result=await rpc.ethCall(who,data);}catch{reject('Wallet contract signature not verified');}
    if(String(result).slice(0,10).toLowerCase()!=='0x1626ba7e')reject('Wallet contract signature not verified');
    return {kind:'EIP1271',requester:who,requestId:message};
  }
  const precompileData='0x'+wordHex(digest)+wordUint(v)+wordUint(r)+wordUint(s);
  let recovered;
  try{recovered=await rpc.ethCall(ONE,precompileData);}catch{reject('Wallet EOA signature not verified');}
  if(!/^0x[0-9a-fA-F]{64}$/.test(recovered||'')||
      '0x'+recovered.slice(-40).toLowerCase()!==who||who===ZERO)reject('Wallet EOA signature not verified');
  return {kind:'EIP191',requester:who,requestId:message};
}
function safeRead(file){
  if(!file)throw Object.assign(new Error('creator request queue is not configured'),{statusCode:503});
  if(!fs.existsSync(file))return [];
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.size>2*1024*1024)throw Object.assign(new Error('creator request queue unavailable'),{statusCode:503});
  const text=fs.readFileSync(file,'utf8');if(text&& !text.endsWith('\n'))throw new Error('creator request queue has incomplete entry');
  const list=text.trim()?text.trimEnd().split('\n').map(line=>JSON.parse(line)):[];
  if(list.length>1500||list.some(v=>v.schema!=='420-launchpad-governance-receipt-v1'||!HASH.test(v.requestId||'')))
    throw new Error('invalid governance request ledger');
  return list;
}
export class CreatorQueue{
  constructor(file){this.file=file;}
  list(account){
    const who=address(account);
    return safeRead(this.file).filter(r=>r.requester===who).map(r=>({
      schema:r.schema,requestId:r.requestId,requester:r.requester,status:r.status,
      chainId:r.chainId,projectId:r.projectId,saleId:r.saleId,createdAt:r.createdAt,
      requestKind:r.requestKind,signatureKind:r.signatureKind
    }));
  }
  async submit(rpc,prepared,signature){
    if(prepared?.schema!=='420-launchpad-creator-preparation-v1'||prepared.canonical!==true||
      prepared.requiresGovernance!==true||prepared.governanceRequest?.requester==null)
      reject('invalid governance request');
    const requestId=hash(prepared.requestId),who=address(prepared.governanceRequest.requester);
    // Signature is proof of requester intent, not evidence of on-chain governance approval.
    const proof=await verifyCreatorSignature(rpc,requestId,who,signature);
    const current=safeRead(this.file);
    if(current.some(r=>r.requestId===requestId))throw Object.assign(new Error('governance request already submitted'),{statusCode:409});
    if(current.length>=1500)throw Object.assign(new Error('governance request ledger full'),{statusCode:503});
    const receipt={schema:'420-launchpad-governance-receipt-v1',requestId,requester:who,
      chainId:prepared.source.chainId,projectId:prepared.projectId,saleId:prepared.saleId,
      requestKind:prepared.governanceRequest.kind,metadataHash:prepared.metadataHash||null,
      metadataJson:prepared.metadataJson||null,governanceRequest:prepared.governanceRequest,
      createdAt:new Date().toISOString(),status:'RECEIVED_FOR_GOVERNANCE_REVIEW',signatureKind:proof.kind};
    const data=JSON.stringify(receipt)+'\n';
    if(Buffer.byteLength(data)>16000)reject('governance request too large');
    const flags=fs.constants.O_WRONLY|fs.constants.O_APPEND|fs.constants.O_CREAT|fs.constants.O_NOFOLLOW;
    const fd=fs.openSync(this.file,flags,0o600);
    try{const n=fs.writeSync(fd,data,null,'utf8');if(n!==Buffer.byteLength(data))throw new Error('incomplete governance request write');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    return {schema:receipt.schema,canonical:true,requestId,projectId:receipt.projectId,
      saleId:receipt.saleId,status:receipt.status,requester:who,signatureKind:proof.kind,
      notice:'Receipt means only that the signed request entered the operator review ledger. Governance approval, project registration and sale activation are separate on-chain decisions.'};
  }
}
