import {createHash,createPublicKey,verify} from 'node:crypto';
export class IdentityError extends Error {constructor(code){super(code);this.code=code}}
const deny=x=>{throw new IdentityError(x)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(x);
const hex=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{40}$/.test(x);
const h=x=>createHash('sha256').update(x).digest('hex');
export function createIdentityRegistry({chainId,sourcePolicies=[],now=()=>Date.now()}){
 if(!id(chainId))deny('CHAIN');const policies=new Map(),byExternal=new Map(),byWallet=new Map(),usedProofs=new Set(),history=[];
 for(const s of sourcePolicies){if(!id(s.sourceId)||!id(s.projectId)||!s.permissionApproved||!s.ownershipProofApproved||!s.publicKeyPem)deny('POLICY');const key=s.sourceId+'|'+s.projectId;if(policies.has(key))deny('POLICY');let pub;try{pub=createPublicKey(s.publicKeyPem)}catch{deny('POLICY')};if(pub.asymmetricKeyType!=='ed25519')deny('POLICY');policies.set(key,pub)}
 const walletKey=(wallet,src,project)=>[chainId,wallet.toLowerCase(),src,project].join('|');
 const externalKey=(src,project,commitment)=>[src,project,commitment].join('|');
 const validRequest=x=>{if(x.chainId!==chainId||!hex(x.wallet)||!id(x.sourceId)||!id(x.projectId)||!/^[a-f0-9]{64}$/.test(x.externalCommitment)||!/^[a-f0-9]{64}$/.test(x.nonce)||!Number.isSafeInteger(x.expiresAt)||x.expiresAt<=now()||x.expiresAt>now()+300000)deny('INVALID_BINDING')};
 return {
  link({request,externalSignature,walletAuthorization}){
   validRequest(request);const policy=policies.get(request.sourceId+'|'+request.projectId);if(!policy)deny('SOURCE_NOT_APPROVED');
   if(walletAuthorization?.wallet?.toLowerCase()!==request.wallet.toLowerCase()||walletAuthorization?.chainId!==chainId||walletAuthorization?.digest!==h(JSON.stringify(request))||walletAuthorization?.verified!==true)deny('WALLET_AUTHORIZATION_REQUIRED');
   const payload=Buffer.from('420/S04/EXTERNAL_OWNERSHIP/V1\n'+JSON.stringify(request));const sig=Buffer.from(externalSignature||'','base64url');
   if(sig.length!==64||!verify(null,payload,policy,sig))deny('EXTERNAL_PROOF_REQUIRED');
   const proofKey=h(Buffer.concat([payload,sig]));if(usedProofs.has(proofKey))deny('PROOF_REPLAY');
   const ek=externalKey(request.sourceId,request.projectId,request.externalCommitment),wk=walletKey(request.wallet,request.sourceId,request.projectId);
   if(byExternal.has(ek)||byWallet.has(wk))deny('LINK_CONFLICT');
   usedProofs.add(proofKey);
   const record={linkId:h(ek+'|'+wk+'|'+request.nonce),chainId,wallet:request.wallet.toLowerCase(),sourceId:request.sourceId,projectId:request.projectId,externalCommitment:request.externalCommitment,linkedAt:now(),active:true,monetizationEligible:false,identityVerified:true};
   byExternal.set(ek,record);byWallet.set(wk,record);history.push({action:'LINK',linkId:record.linkId,time:now(),digest:h(JSON.stringify(request))});return {...record};
  },
  disconnect({wallet,sourceId,projectId,authorization}){
   if(!hex(wallet)||authorization?.verified!==true||authorization?.wallet?.toLowerCase()!==wallet.toLowerCase()||authorization?.chainId!==chainId||authorization?.operation!=='DISCONNECT')deny('WALLET_AUTHORIZATION_REQUIRED');
   const wk=walletKey(wallet,sourceId,projectId),r=byWallet.get(wk);if(!r||!r.active)deny('NOT_LINKED');r.active=false;byWallet.delete(wk);byExternal.delete(externalKey(r.sourceId,r.projectId,r.externalCommitment));history.push({action:'DISCONNECT',linkId:r.linkId,time:now()});return {linkId:r.linkId,active:false,monetizationEligible:false};
  },
  status(wallet,sourceId,projectId){const r=byWallet.get(walletKey(wallet,sourceId,projectId));return r?{linkId:r.linkId,active:r.active,identityVerified:r.identityVerified,monetizationEligible:false}:null},
  audit(){return history.map(x=>({...x}))}
 }
}
