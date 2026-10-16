import {randomUUID} from 'node:crypto';
const ROLES=new Set(['OWNER_POLICY_ADMIN','MODERATION_SUPERVISOR','NAME_REVIEWER','APPEALS_REVIEWER','READ_ONLY_AUDITOR']);
export class ModeratorAppointments {
 constructor({store,capabilities,audit,verifyMfa,now=()=>Date.now()}){Object.assign(this,{store,capabilities,audit,verifyMfa,now});}
 async appoint({actor,subject,role,expiresAt,scope='cultivar-names',mfaProof}){
  if(!ROLES.has(role)||role==='OWNER_POLICY_ADMIN'||!subject||subject===actor||!Number.isSafeInteger(expiresAt)||expiresAt<=this.now())throw Error('invalid-appointment');
  if(!await this.store.hasRole(actor,'OWNER_POLICY_ADMIN')||!await this.verifyMfa(actor,mfaProof))throw Error('unauthorized-appointment');
  const grantId=randomUUID();
  await this.capabilities.grant({grantId,subject,role,scope,expiresAt});
  await this.store.recordAppointment({grantId,subject,role,scope,expiresAt,actor});
  await this.audit.write({kind:'APPOINT',grantId,actor,subject,role,at:this.now()});return grantId;
 }
 async revoke({actor,grantId,mfaProof}){
  if(!await this.store.hasRole(actor,'OWNER_POLICY_ADMIN')||!await this.verifyMfa(actor,mfaProof))throw Error('unauthorized-revocation');
  await this.capabilities.revoke(grantId);await this.store.markRevoked(grantId);await this.audit.write({kind:'REVOKE',grantId,actor,at:this.now()});
 }
}
