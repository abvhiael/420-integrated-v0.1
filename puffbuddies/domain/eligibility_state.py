"""PB-2.2 canonical adult-eligibility state model.

This model governs PuffBuddies' private eligibility conclusion over time. It does not
store raw identity evidence and it cannot create lifecycle, relationship, or consent
authority.
"""
from dataclasses import dataclass
from enum import Enum
from .types import EligibilityProjection, EligibilityState, ProfileId

class EligibilityTransitionDenied(ValueError): pass

class EligibilityCause(str,Enum):
    AUTHORITATIVE_CHECK="AUTHORITATIVE_CHECK"
    EXPIRY="EXPIRY"
    REVOCATION="REVOCATION"
    POLICY_REEVALUATION="POLICY_REEVALUATION"
    AUTHORITY_UNAVAILABLE="AUTHORITY_UNAVAILABLE"

@dataclass(frozen=True)
class EligibilityRecord:
    profile_id: ProfileId
    state: EligibilityState
    source_version: str
    policy_version: str
    expires_at_epoch: int|None
    sequence: int
    checked_at_epoch: int

def initial_eligibility(profile_id:ProfileId, *, policy_version:str, now_epoch:int)->EligibilityRecord:
    if not policy_version or now_epoch<0: raise EligibilityTransitionDenied("valid policy/time required")
    return EligibilityRecord(profile_id,EligibilityState.UNKNOWN,"",policy_version,None,0,now_epoch)

def apply_authoritative_projection(current:EligibilityRecord, projection:EligibilityProjection, *,
                                   policy_version:str, current_policy_version:str,
                                   sequence:int, now_epoch:int)->EligibilityRecord:
    if sequence<=current.sequence: raise EligibilityTransitionDenied("stale/replayed eligibility decision")
    if now_epoch<current.checked_at_epoch: raise EligibilityTransitionDenied("eligibility time cannot move backwards")
    if not policy_version or not current_policy_version: raise EligibilityTransitionDenied("policy version required")
    if policy_version!=current_policy_version:
        return EligibilityRecord(current.profile_id,EligibilityState.UNKNOWN,projection.source_version,
                                 current_policy_version,None,sequence,now_epoch)
    if not projection.source_version: raise EligibilityTransitionDenied("authoritative source version required")
    state=projection.state
    expiry=projection.expires_at_epoch
    if state==EligibilityState.ELIGIBLE:
        if expiry is None or now_epoch>=expiry: state=EligibilityState.EXPIRED
    elif state==EligibilityState.UNKNOWN:
        expiry=None
    return EligibilityRecord(current.profile_id,state,projection.source_version,
                             current_policy_version,expiry,sequence,now_epoch)

def expire_if_due(current:EligibilityRecord, *, now_epoch:int)->EligibilityRecord:
    if now_epoch<current.checked_at_epoch: raise EligibilityTransitionDenied("eligibility time cannot move backwards")
    if current.state==EligibilityState.ELIGIBLE and (current.expires_at_epoch is None or now_epoch>=current.expires_at_epoch):
        return EligibilityRecord(current.profile_id,EligibilityState.EXPIRED,current.source_version,
                                 current.policy_version,current.expires_at_epoch,current.sequence,now_epoch)
    return current

def authority_unavailable(current:EligibilityRecord, *, sequence:int, now_epoch:int)->EligibilityRecord:
    if sequence<=current.sequence: raise EligibilityTransitionDenied("stale availability event")
    if now_epoch<current.checked_at_epoch: raise EligibilityTransitionDenied("eligibility time cannot move backwards")
    return EligibilityRecord(current.profile_id,EligibilityState.UNKNOWN,current.source_version,
                             current.policy_version,None,sequence,now_epoch)

def require_policy_current(current:EligibilityRecord, *, current_policy_version:str, sequence:int, now_epoch:int)->EligibilityRecord:
    if not current_policy_version: raise EligibilityTransitionDenied("current policy version required")
    if current.policy_version==current_policy_version: return expire_if_due(current,now_epoch=now_epoch)
    if sequence<=current.sequence: raise EligibilityTransitionDenied("stale policy reevaluation")
    return EligibilityRecord(current.profile_id,EligibilityState.UNKNOWN,current.source_version,
                             current_policy_version,None,sequence,now_epoch)

def ordinary_eligibility_allowed(current:EligibilityRecord, *, current_policy_version:str, now_epoch:int)->bool:
    return (current.state==EligibilityState.ELIGIBLE
            and current.policy_version==current_policy_version
            and current.expires_at_epoch is not None
            and now_epoch<current.expires_at_epoch)
