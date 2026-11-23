// 420Arbitration user-side evidence orchestration over verified ARB-PRE-04 case state.
// Private bytes never enter contract calldata or application diagnostics.
import {
  preparePrivateEvidence420,verifyPrivateEvidence420,normalizeEvidenceContext420,
  createPrivateEvidenceStore420,EvidencePrivacyError420,
} from './arbitration-evidence.js';

const validHash=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x)&&BigInt(x)!==0n;
const fail=message=>{throw new EvidencePrivacyError420(message);};
export function createArbitrationEvidenceWorkspace420({app,cryptoImpl=globalThis.crypto,storage=null,
  authenticate=null}={}){
  if(!app||typeof app.detail!=='function'||typeof app.verify!=='function'||!app.account)
    fail('verified Arbitration Wallet application required');
  const external=authenticate?createPrivateEvidenceStore420({storage,authenticate}):null;
  async function contextFor(caseId,round=null,submitter=app.account){
    const [detail,verified]=await Promise.all([app.detail(caseId),app.verify()]);
    const r=round===null?detail.round:round;
    if(!Number.isInteger(r)||r<0||r>detail.round||r>3)fail('evidence round unavailable');
    const context=normalizeEvidenceContext420({
      chainId:verified.binding.chainId,caseRegistry:verified.binding.dependencies.cases.address,
      caseId:detail.id,round:r,submitter
    });
    return {detail,context};
  }
  async function prepare({caseId,data}){
    const {detail,context}=await contextFor(caseId);
    if(!detail.permissions.evidence||app.account!==context.submitter)
      fail('evidence submission is not permitted');
    return preparePrivateEvidence420({context,data,cryptoImpl});
  }
  async function verifyCommitted({caseId,round,submitter,commitment}){
    if(!validHash(commitment))fail('invalid evidence commitment');
    const {detail,context}=await contextFor(caseId,round,submitter);
    const resolver=context.round===0?detail.resolver:detail.appealResolver;
    const permitted=[detail.claimant,detail.respondent,resolver]
      .some(identity=>identity?.toLowerCase()===app.account.toLowerCase());
    if(!permitted)fail('private evidence authorization required');
    const match=detail.history.find(item=>item.kind==='evidence'&&
      item.caseId===context.caseId&&item.round===context.round&&
      item.actor===context.submitter&&item.details.evidenceHash===commitment.toLowerCase());
    if(!match)fail('evidence commitment not recorded on this case and round');
    return Object.freeze({context,detail,commitment:commitment.toLowerCase(),
      blockNumber:match.blockNumber,transactionHash:match.transactionHash});
  }
  async function inspectLocal({caseId,round,submitter,commitment,encrypted,recoveryKey}){
    const bound=await verifyCommitted({caseId,round,submitter,commitment});
    // The chain is checked before ANY private bytes are decrypted/displayed.
    const plaintext=await verifyPrivateEvidence420({encrypted,recoveryKey,
      context:bound.context,expectedCommitment:bound.commitment,cryptoImpl});
    // Recheck canonical history on return so a chain reorg cannot bless stale evidence.
    // If that recheck fails, erase the decrypted working buffer before propagating.
    try{await verifyCommitted({caseId,round,submitter,commitment});}
    catch{plaintext.fill(0);fail('private evidence case authorization or chain history changed');}
    return Object.freeze({bytes:plaintext,context:bound.context,commitment:bound.commitment,
      chainTransaction:bound.transactionHash});
  }
  async function upload({caseId,round,submitter,commitment,encrypted,object,retentionMs,signal}){
    const bound=await verifyCommitted({caseId,round,submitter,commitment});
    if(!external)fail('approved private evidence storage unavailable');
    const receipt=await external.upload({encrypted,context:bound.context,record:bound.detail,
      viewer:app.account,object,retentionMs,signal});
    await verifyCommitted({caseId,round,submitter,commitment});
    return receipt;
  }
  async function retrieve({caseId,round,submitter,commitment,object,recoveryKey,signal}){
    const bound=await verifyCommitted({caseId,round,submitter,commitment});
    if(!external)fail('approved private evidence storage unavailable');
    const bytes=await external.retrieve({context:bound.context,record:bound.detail,
      viewer:app.account,object,recoveryKey,expectedCommitment:bound.commitment,signal});
    try{await verifyCommitted({caseId,round,submitter,commitment});}
    catch{bytes.fill(0);fail('private evidence case authorization or chain history changed');}
    return Object.freeze({bytes,context:bound.context,commitment:bound.commitment});
  }
  return Object.freeze({contextFor,prepare,verifyCommitted,inspectLocal,upload,retrieve});
}
