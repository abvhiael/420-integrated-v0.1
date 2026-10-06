"""PB-8 Safety and moderation.

Private safety cases, independent blocking, evidence-integrity metadata, least-privilege
moderation actions, lifecycle enforcement and appeal workflow.

This module deliberately does not implement raw evidence storage, automated irreversible
adjudication, operator UI, law-enforcement workflow, public reputation, contracts,
addresses, deployments, or production moderation infrastructure.
"""
from dataclasses import dataclass, replace
from enum import Enum
import re
from typing import Mapping

from puffbuddies.domain.invalidation import CanonicalChange, Invalidation, invalidation_for
from puffbuddies.domain.matching import PairRelationship
from puffbuddies.domain.profiles import ProfileRecord
from puffbuddies.domain.state_machines import Authority, TransitionDenied, lifecycle_transition, relationship_transition
from puffbuddies.domain.types import LifecycleState, ProfileId, RelationshipState
from puffbuddies.persistence.revocation import RevocationMarker, next_revocation

class SafetyDenied(PermissionError): pass

class ReportClass(str, Enum):
    HARASSMENT_THREATS = "HARASSMENT_THREATS"
    STALKING_DOXXING_LOCATION = "STALKING_DOXXING_LOCATION"
    IMPERSONATION_CATFISHING = "IMPERSONATION_CATFISHING"
    MINOR_ELIGIBILITY = "MINOR_ELIGIBILITY"
    SEXUAL_EXPLOITATION = "SEXUAL_EXPLOITATION"
    FRAUD_EXTORTION = "FRAUD_EXTORTION"
    HATE_ABUSE = "HATE_ABUSE"
    SPAM_BOTTING_MANIPULATION = "SPAM_BOTTING_MANIPULATION"
    BLOCK_BAN_EVASION = "BLOCK_BAN_EVASION"
    DANGEROUS_UNLAWFUL = "DANGEROUS_UNLAWFUL"
    CANNABIS_COERCION_UNSAFE_TRANSACTION = "CANNABIS_COERCION_UNSAFE_TRANSACTION"
    OTHER = "OTHER"

class ModerationState(str, Enum):
    RECEIVED="RECEIVED"; TRIAGED="TRIAGED"; REVIEWING="REVIEWING"
    RESTRICTED_PENDING_REVIEW="RESTRICTED_PENDING_REVIEW"; ACTIONED="ACTIONED"
    NO_ACTION="NO_ACTION"; APPEALED="APPEALED"; CLOSED="CLOSED"

class SafetyAction(str, Enum):
    NONE="NONE"; WARNING="WARNING"; DISCOVERY_RESTRICTION="DISCOVERY_RESTRICTION"
    MESSAGING_RESTRICTION="MESSAGING_RESTRICTION"; FEATURE_RESTRICTION="FEATURE_RESTRICTION"
    TEMPORARY_RESTRICTION="TEMPORARY_RESTRICTION"; ELIGIBILITY_HOLD="ELIGIBILITY_HOLD"
    SUSPENSION="SUSPENSION"; BAN="BAN"; EVIDENCE_PRESERVATION="EVIDENCE_PRESERVATION"

class ModeratorRole(str, Enum):
    TRIAGE="TRIAGE"; MODERATOR="MODERATOR"; SENIOR_MODERATOR="SENIOR_MODERATOR"; APPEALS="APPEALS"

HIGH_PRIORITY=frozenset({
    ReportClass.STALKING_DOXXING_LOCATION,ReportClass.MINOR_ELIGIBILITY,
    ReportClass.SEXUAL_EXPLOITATION,ReportClass.FRAUD_EXTORTION,
    ReportClass.DANGEROUS_UNLAWFUL,
})
HEX64=re.compile(r"^[0-9a-f]{64}$")

@dataclass(frozen=True)
class SafetyCase:
    case_id:str
    reporter_profile_id:ProfileId
    subject_profile_id:ProfileId
    report_class:ReportClass
    state:ModerationState
    evidence_digest:str
    evidence_ref:str
    policy_basis:str
    action:SafetyAction
    moderator_actor_id:str|None
    retention_reason:str
    version:int=1
    def __post_init__(self):
        if not self.case_id or len(self.case_id)>128 or any(ch.isspace() for ch in self.case_id):
            raise SafetyDenied("bounded case id required")
        if self.reporter_profile_id==self.subject_profile_id:
            raise SafetyDenied("self-report is not canonical safety report")
        if not HEX64.fullmatch(self.evidence_digest):
            raise SafetyDenied("sha256 evidence digest required")
        if not self.evidence_ref or len(self.evidence_ref)>160 or "://" in self.evidence_ref or any(ch.isspace() for ch in self.evidence_ref):
            raise SafetyDenied("opaque evidence reference required")
        if not self.policy_basis or len(self.policy_basis)>160:
            raise SafetyDenied("bounded policy basis required")
        if not self.retention_reason or len(self.retention_reason)>160:
            raise SafetyDenied("purpose-limited retention reason required")
        if self.version<1: raise SafetyDenied("positive safety version required")

@dataclass(frozen=True)
class SafetyCaseMutation:
    case:SafetyCase
    subject_marker:RevocationMarker|None=None
    invalidation:Invalidation|None=None
    lifecycle:LifecycleState|None=None

@dataclass(frozen=True)
class BlockOutcome:
    pair:PairRelationship
    markers:tuple[RevocationMarker,RevocationMarker]
    invalidations:tuple[Invalidation,Invalidation]

_ALLOWED_CASE_TRANSITIONS={
    ModerationState.RECEIVED:{ModerationState.TRIAGED},
    ModerationState.TRIAGED:{ModerationState.REVIEWING,ModerationState.RESTRICTED_PENDING_REVIEW,ModerationState.NO_ACTION},
    ModerationState.REVIEWING:{ModerationState.RESTRICTED_PENDING_REVIEW,ModerationState.ACTIONED,ModerationState.NO_ACTION},
    ModerationState.RESTRICTED_PENDING_REVIEW:{ModerationState.REVIEWING,ModerationState.ACTIONED,ModerationState.NO_ACTION},
    ModerationState.ACTIONED:{ModerationState.APPEALED,ModerationState.CLOSED},
    ModerationState.NO_ACTION:{ModerationState.CLOSED},
    ModerationState.APPEALED:{ModerationState.ACTIONED,ModerationState.NO_ACTION,ModerationState.CLOSED},
    ModerationState.CLOSED:set(),
}

def submit_report(*,case_id:str,reporter_profile_id:ProfileId,subject_profile_id:ProfileId,
                  report_class:ReportClass,evidence_digest:str,evidence_ref:str,
                  policy_basis:str,retention_reason:str)->SafetyCase:
    return SafetyCase(case_id,reporter_profile_id,subject_profile_id,report_class,
        ModerationState.RECEIVED,evidence_digest,evidence_ref,policy_basis,SafetyAction.NONE,
        None,retention_reason,1)

def case_priority(case:SafetyCase)->str:
    return "HIGH" if case.report_class in HIGH_PRIORITY else "STANDARD"

def _require_role(role:ModeratorRole,allowed:set[ModeratorRole]):
    if role not in allowed: raise SafetyDenied("moderator role lacks case authority")

def advance_case(case:SafetyCase,*,target:ModerationState,actor_id:str,role:ModeratorRole)->SafetyCase:
    if target not in _ALLOWED_CASE_TRANSITIONS[case.state]:
        raise SafetyDenied("invalid moderation-state transition")
    if not actor_id or len(actor_id)>128: raise SafetyDenied("bounded moderation actor required")
    if target==ModerationState.TRIAGED:
        _require_role(role,{ModeratorRole.TRIAGE,ModeratorRole.MODERATOR,ModeratorRole.SENIOR_MODERATOR})
    elif target==ModerationState.APPEALED:
        raise SafetyDenied("appeal must be user-requested through request_appeal")
    elif case.state==ModerationState.APPEALED:
        _require_role(role,{ModeratorRole.APPEALS,ModeratorRole.SENIOR_MODERATOR})
    else:
        _require_role(role,{ModeratorRole.MODERATOR,ModeratorRole.SENIOR_MODERATOR,ModeratorRole.APPEALS})
    return replace(case,state=target,moderator_actor_id=actor_id,version=case.version+1)

def impose_pending_restriction(case:SafetyCase,profile:ProfileRecord,*,actor_id:str,
                               role:ModeratorRole,current_generation:int)->SafetyCaseMutation:
    _require_role(role,{ModeratorRole.MODERATOR,ModeratorRole.SENIOR_MODERATOR})
    if case.state not in {ModerationState.TRIAGED,ModerationState.REVIEWING}:
        raise SafetyDenied("case not eligible for pending restriction")
    try:
        new_lifecycle=lifecycle_transition(profile.lifecycle,LifecycleState.RESTRICTED,Authority.SAFETY)
    except TransitionDenied as exc: raise SafetyDenied(str(exc)) from exc
    updated=replace(case,state=ModerationState.RESTRICTED_PENDING_REVIEW,
                    moderator_actor_id=actor_id,action=SafetyAction.TEMPORARY_RESTRICTION,
                    version=case.version+1)
    marker=next_revocation(str(profile.profile_id),current_generation,"SAFETY_RESTRICTED")
    return SafetyCaseMutation(updated,marker,invalidation_for(marker,CanonicalChange.SAFETY),new_lifecycle)

def apply_action(case:SafetyCase,profile:ProfileRecord,*,action:SafetyAction,actor_id:str,
                 role:ModeratorRole,current_generation:int,human_reviewed:bool)->SafetyCaseMutation:
    if case.state not in {ModerationState.REVIEWING,ModerationState.RESTRICTED_PENDING_REVIEW,ModerationState.APPEALED}:
        raise SafetyDenied("case not ready for action")
    if case.state == ModerationState.APPEALED:
        _require_role(role,{ModeratorRole.APPEALS,ModeratorRole.SENIOR_MODERATOR})
    else:
        _require_role(role,{ModeratorRole.MODERATOR,ModeratorRole.SENIOR_MODERATOR})
    if not human_reviewed:
        raise SafetyDenied("irreversible/final moderation action requires human review")
    target_lifecycle=profile.lifecycle
    if action in {SafetyAction.DISCOVERY_RESTRICTION,SafetyAction.MESSAGING_RESTRICTION,
                  SafetyAction.FEATURE_RESTRICTION,SafetyAction.TEMPORARY_RESTRICTION,
                  SafetyAction.ELIGIBILITY_HOLD}:
        target=LifecycleState.RESTRICTED
    elif action==SafetyAction.SUSPENSION: target=LifecycleState.SUSPENDED
    elif action==SafetyAction.BAN: target=LifecycleState.BANNED
    elif action in {SafetyAction.WARNING,SafetyAction.EVIDENCE_PRESERVATION}: target=None
    else: raise SafetyDenied("non-action cannot be adjudicated")
    if target is not None and target!=profile.lifecycle:
        try: target_lifecycle=lifecycle_transition(profile.lifecycle,target,Authority.SAFETY)
        except TransitionDenied as exc: raise SafetyDenied(str(exc)) from exc
    updated=replace(case,state=ModerationState.ACTIONED,action=action,
                    moderator_actor_id=actor_id,version=case.version+1)
    marker=next_revocation(str(profile.profile_id),current_generation,"SAFETY_ACTION")
    return SafetyCaseMutation(updated,marker,invalidation_for(marker,CanonicalChange.SAFETY),target_lifecycle)

def no_action(case:SafetyCase,*,actor_id:str,role:ModeratorRole)->SafetyCase:
    if case.state not in {ModerationState.TRIAGED,ModerationState.REVIEWING,
                          ModerationState.RESTRICTED_PENDING_REVIEW,ModerationState.APPEALED}:
        raise SafetyDenied("case cannot resolve NO_ACTION")
    if case.state == ModerationState.APPEALED:
        _require_role(role,{ModeratorRole.APPEALS,ModeratorRole.SENIOR_MODERATOR})
    else:
        _require_role(role,{ModeratorRole.MODERATOR,ModeratorRole.SENIOR_MODERATOR})
    return replace(case,state=ModerationState.NO_ACTION,action=SafetyAction.NONE,
                   moderator_actor_id=actor_id,version=case.version+1)

def request_appeal(case:SafetyCase,*,subject_profile_id:ProfileId)->SafetyCase:
    if case.subject_profile_id!=subject_profile_id or case.state!=ModerationState.ACTIONED:
        raise SafetyDenied("appeal unavailable")
    return replace(case,state=ModerationState.APPEALED,version=case.version+1)

def close_case(case:SafetyCase,*,actor_id:str,role:ModeratorRole)->SafetyCase:
    if case.state not in {ModerationState.ACTIONED,ModerationState.NO_ACTION,ModerationState.APPEALED}:
        raise SafetyDenied("case cannot close")
    _require_role(role,{ModeratorRole.MODERATOR,ModeratorRole.SENIOR_MODERATOR,ModeratorRole.APPEALS})
    return replace(case,state=ModerationState.CLOSED,moderator_actor_id=actor_id,version=case.version+1)

def block_pair(pair:PairRelationship,*,actor_profile_id:ProfileId,
               left_current_generation:int,right_current_generation:int)->BlockOutcome:
    if actor_profile_id not in {pair.left_profile_id,pair.right_profile_id}:
        raise SafetyDenied("only pair participant may block")
    if pair.state==RelationshipState.BLOCKED:
        raise SafetyDenied("pair already blocked")
    try: state=relationship_transition(pair.state,RelationshipState.BLOCKED,Authority.USER)
    except TransitionDenied as exc: raise SafetyDenied(str(exc)) from exc
    blocked=PairRelationship(pair.left_profile_id,pair.right_profile_id,state,pair.consent_epoch+1)
    lm=next_revocation(str(pair.left_profile_id),left_current_generation,"BLOCK")
    rm=next_revocation(str(pair.right_profile_id),right_current_generation,"BLOCK")
    return BlockOutcome(blocked,(lm,rm),
        (invalidation_for(lm,CanonicalChange.BLOCK),invalidation_for(rm,CanonicalChange.BLOCK)))

def encode_case(case:SafetyCase)->dict[str,object]:
    return {
        "case_id":case.case_id,"subject_profile_id":str(case.subject_profile_id),
        "actor_profile_id":str(case.reporter_profile_id),"report_class":case.report_class.value,
        "evidence_digest":case.evidence_digest,"evidence_ref":case.evidence_ref,
        "policy_basis":case.policy_basis,"action":case.action.value,"status":case.state.value,
        "moderator_actor_id":case.moderator_actor_id,"retention_reason":case.retention_reason,
        "version":case.version,
    }

def decode_case(values:Mapping[str,object],*,case_id:str)->SafetyCase:
    expected={"case_id","subject_profile_id","actor_profile_id","report_class","evidence_digest",
              "evidence_ref","policy_basis","action","status","moderator_actor_id",
              "retention_reason","version"}
    if set(values)!=expected or values.get("case_id")!=case_id:
        raise SafetyDenied("canonical safety case required")
    try:
        return SafetyCase(case_id,ProfileId(str(values["actor_profile_id"])),
            ProfileId(str(values["subject_profile_id"])),ReportClass(str(values["report_class"])),
            ModerationState(str(values["status"])),str(values["evidence_digest"]),
            str(values["evidence_ref"]),str(values["policy_basis"]),SafetyAction(str(values["action"])),
            None if values["moderator_actor_id"] is None else str(values["moderator_actor_id"]),
            str(values["retention_reason"]),int(values["version"]))
    except (ValueError,TypeError) as exc: raise SafetyDenied("invalid safety case") from exc

def persist_case(repository,case:SafetyCase,*,expected_version:int|None):
    return repository.put("safety",case.case_id,encode_case(case),expected_version=expected_version)

def load_case(repository,case_id:str):
    row=repository.get("safety",case_id)
    if row is None:return None,None
    return decode_case(row.values,case_id=case_id),row.version
