const SCHEMA_VERSION='1.0.0';
const PHASES=Object.freeze(['GP-17.1','GP-17.2','GP-17.3','GP-17.4','GP-17.5','GP-17.6','GP-17.7','GP-17.8','GP-17.9','GP-17.10']);

export class GamingOnboardingCloseoutError420 extends Error{constructor(message){super(message);this.name='GamingOnboardingCloseoutError420';}}
function assert420(condition,message){if(!condition)throw new GamingOnboardingCloseoutError420(message);}
function plain420(value){return value&&typeof value==='object'&&!Array.isArray(value);}

export function createGamingOnboardingCloseout420(input){
  assert420(plain420(input),'GP-17 closeout input is required');
  assert420(input.schemaVersion===SCHEMA_VERSION,'unsupported GP-17 closeout schemaVersion');
  assert420(typeof input.gameId==='string'&&/^420\/GAMING\/GAME\/[A-Z0-9_]+\/V1$/.test(input.gameId),'canonical gameId is required');
  assert420(typeof input.applicationId==='string'&&input.applicationId===input.gameId.toLowerCase().replaceAll('/','-'),'applicationId must match canonical game identity');
  assert420(Array.isArray(input.completedPhases),'completedPhases are required');
  assert420(input.completedPhases.length===PHASES.length&&PHASES.every((phase,index)=>input.completedPhases[index]===phase),'all GP-17 phases must be complete in order');
  assert420(input.documentation===true,'task-oriented onboarding documentation must be complete');
  assert420(input.troubleshooting===true,'gaming onboarding troubleshooting coverage must be complete');
  assert420(input.examples===true,'gaming onboarding examples must be complete');
  assert420(input.exactHeadQualification===true,'exact-head qualification evidence is required');
  assert420(input.developerHubAuthority===false,'Developer Hub must remain non-authoritative');
  assert420(input.liveNetworkClaimsRequireEvidence===true,'live-network claims must require live-network evidence');

  return Object.freeze({
    schemaVersion:SCHEMA_VERSION,
    status:'READY_FOR_GP17_CLOSEOUT',
    gameId:input.gameId,
    applicationId:input.applicationId,
    completedPhases:PHASES,
    developerHubAuthority:false,
    canonicalRegistrationCreated:false,
    canonicalGrantCreated:false,
    securityCertification:false,
    liveNetworkClaimsRequireEvidence:true,
    closeoutRule:'GP-17 repository closeout confirms developer onboarding coverage only; canonical state, Registry legitimacy, CapabilityRegistry authority and live-network qualification remain with their owning systems and evidence.'
  });
}
