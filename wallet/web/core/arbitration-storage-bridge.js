// Pre-testnet integration of Arbitration with the existing 420Storage v1 interface.
// This composes the qualified private retrieval transport, the existing v1
// prepare/ingest port and a separately authenticated application-side issuer.
// It cannot create Storage authority, sessions, agreements or Wallet privileges.
import {createArbitrationEvidenceWorkspace420} from './arbitration-evidence-workspace.js';
import {createPrivate420StorageRetrieval420} from './arbitration-storage420.js';
import {EvidencePrivacyError420} from './arbitration-evidence.js';

const blocked=()=>{throw new EvidencePrivacyError420('Approved private 420Storage session unavailable');};
const allowedURL=value=>{
  if(typeof value!=='string')return false;
  try{
    const url=new URL(value);
    return !url.username&&!url.password&&!url.search&&!url.hash&&(
      url.protocol==='https:'||(url.protocol==='http:'&&
      ['localhost','127.0.0.1','[::1]'].includes(url.hostname)));
  }catch{return false;}
};

/**
 * Installed by trusted Wallet application code, never by dApp or page input.
 *
 * approvedSessionIssuer: backend-controlled function that rechecks a
 * verified Wallet/controller session, on-chain case/round roles, Storage
 * capabilities, object identity and expiry before issuing a scoped private
 * 420Storage subject/session. A 420ID app login alone is NOT a Wallet proof.
 *
 * uploadPort: existing 420Storage v1 prepare/ingest protocol adapter with
 * canonical agreement, reservation and Storage commitment prerequisites.
 * Its absence makes uploads unavailable; retrieval still needs issuer.
 */
export function createArbitration420StorageBridge420({
  app,endpoint=null,approvedSessionIssuer=null,uploadPort=null,
  fetchImpl=globalThis.fetch,cryptoImpl=globalThis.crypto,clock=()=>Date.now()
}={}){
  if(!app||typeof app.verify!=='function'||typeof app.detail!=='function')
    blocked();
  // Local-only evidence remains usable before testnet. There is no
  // fallback to an anonymous/public object route.
  if(endpoint===null&&approvedSessionIssuer===null&&uploadPort===null)
    return Object.freeze({
      online:false,
      workspace:createArbitrationEvidenceWorkspace420({app,cryptoImpl})
    });
  if(!allowedURL(endpoint)||typeof approvedSessionIssuer!=='function')
    blocked();
  if(uploadPort!=null&&(typeof uploadPort.prepare!=='function'||
    typeof uploadPort.ingest!=='function'))blocked();
  const retrieval=createPrivate420StorageRetrieval420({endpoint,fetchImpl,cryptoImpl});
  const storage=Object.freeze({
    retrieve:args=>retrieval.retrieve(args),
    ...(uploadPort?{
      prepare:args=>uploadPort.prepare(args),
      ingest:args=>uploadPort.ingest(args)
    }:{})
  });
  const authenticate=async ({context,viewer,record,capability,object})=>{
    // No Javascript-generated grants. A session issuer is a distinct trusted
    // service boundary and must verify the current Wallet on every request.
    if(capability==='write'&&!uploadPort)blocked();
    try{
      const grant=await approvedSessionIssuer({context,viewer,record,capability,object});
      if(!grant||grant.source!=='420Storage'||
        !['read','write'].includes(grant.capability)||
        grant.capability!==capability||
        grant.account?.toLowerCase()!==viewer.toLowerCase()||
        grant.caseId?.toLowerCase()!==context.caseId||
        grant.round!==context.round||
        grant.chainId!==context.chainId||
        grant.caseRegistry?.toLowerCase()!==context.caseRegistry||
        !Number.isSafeInteger(grant.expiresAt)||grant.expiresAt<=clock()||
        !grant.storageObject||
        Object.keys(object||{}).some(k=>String(object[k])!==String(grant.storageObject[k]))||
        typeof grant.storageSessionId!=='string'||grant.storageSessionId.length<=20||
        typeof grant.storageSubject!=='string'||!grant.storageSubject)blocked();
      return grant;
    }catch{blocked();}
  };
  return Object.freeze({
    online:true,
    uploadReady:Boolean(uploadPort),
    workspace:createArbitrationEvidenceWorkspace420({app,cryptoImpl,storage,authenticate})
  });
}
