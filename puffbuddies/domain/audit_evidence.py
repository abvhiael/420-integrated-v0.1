"""PB-1.6 protected, privacy-minimized transition audit evidence.

Evidence records security-relevant transition facts without payloads, profile content,
messages, location, cannabis data, identity source evidence, or public enumeration.
"""
from dataclasses import dataclass
from enum import Enum
from hashlib import sha256
from typing import Mapping
from .state_machines import Authority,TransitionDenied,lifecycle_transition,relationship_transition
from .types import LifecycleState,RelationshipState

class AuditKind(str,Enum):
    LIFECYCLE="LIFECYCLE"; RELATIONSHIP="RELATIONSHIP"; MODERATION="MODERATION"; CONSENT="CONSENT"; DELETION="DELETION"

@dataclass(frozen=True)
class TransitionEvidence:
    kind: AuditKind
    subject_ref: str
    source: str
    target: str
    authority: str
    reason_code: str
    sequence: int

def protected_subject_ref(profile_id:str,pepper:str)->str:
    if not profile_id or not pepper: raise ValueError("profile_id and protected pepper required")
    return sha256((pepper+"\0"+profile_id).encode()).hexdigest()

def record_transition(*,kind:AuditKind,profile_id:str,source:Enum,target:Enum,authority:Authority,reason_code:str,sequence:int,pepper:str)->TransitionEvidence:
    if sequence < 1 or not reason_code or len(reason_code)>64: raise ValueError("bounded reason and positive sequence required")
    if kind==AuditKind.LIFECYCLE or kind==AuditKind.DELETION:
        lifecycle_transition(source,target,authority)
        if kind==AuditKind.DELETION and target not in {LifecycleState.DELETE_REQUESTED,LifecycleState.DELETION_IN_PROGRESS,LifecycleState.DELETION_COMPLETE}: raise TransitionDenied("not a deletion transition")
    elif kind in {AuditKind.RELATIONSHIP,AuditKind.CONSENT}:
        relationship_transition(source,target,authority)
        if kind==AuditKind.CONSENT and target not in {RelationshipState.LIKED,RelationshipState.MATCHED,RelationshipState.UNMATCHED,RelationshipState.BLOCKED}: raise TransitionDenied("not a consent-relevant transition")
    elif kind==AuditKind.MODERATION:
        lifecycle_transition(source,target,authority)
        if authority not in {Authority.SAFETY,Authority.REVIEW}: raise TransitionDenied("moderation evidence requires safety/review authority")
    else: raise TransitionDenied("unsupported audit kind")
    return TransitionEvidence(kind,protected_subject_ref(profile_id,pepper),source.value,target.value,authority.value,reason_code,sequence)

FORBIDDEN_EVIDENCE_FIELDS=frozenset({"profile_id","wallet_address","display_name","bio","message","message_content","latitude","longitude","location","cannabis","date_of_birth","identity_document","raw_identity_evidence","moderation_notes","evidence_blob"})

def evidence_payload(e:TransitionEvidence)->Mapping[str,object]:
    payload={"kind":e.kind.value,"subject_ref":e.subject_ref,"source":e.source,"target":e.target,"authority":e.authority,"reason_code":e.reason_code,"sequence":e.sequence}
    if set(payload)&FORBIDDEN_EVIDENCE_FIELDS: raise ValueError("private payload leakage")
    return payload
