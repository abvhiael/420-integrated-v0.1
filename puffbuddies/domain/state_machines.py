"""Canonical PB-1.2 lifecycle and relationship state machines.

Transitions fail closed unless explicitly listed and authorized. Dependencies, clients,
payments, algorithms and derived services are never transition authorities.
"""
from dataclasses import dataclass
from enum import Enum
from .types import LifecycleState, RelationshipState

class TransitionDenied(ValueError): pass

class Authority(str, Enum):
    USER = "USER"
    ENTRY = "ENTRY"
    PROFILE_POLICY = "PROFILE_POLICY"
    SAFETY = "SAFETY"
    DELETION_PROCESSOR = "DELETION_PROCESSOR"
    REVIEW = "REVIEW"
    RECIPROCAL_USERS = "RECIPROCAL_USERS"

@dataclass(frozen=True)
class Transition:
    source: Enum
    target: Enum
    authority: Authority

LIFECYCLE_TRANSITIONS = frozenset({
    Transition(LifecycleState.UNREGISTERED,LifecycleState.ELIGIBILITY_PENDING,Authority.ENTRY),
    Transition(LifecycleState.ELIGIBILITY_PENDING,LifecycleState.PROFILE_INCOMPLETE,Authority.ENTRY),
    Transition(LifecycleState.ELIGIBILITY_PENDING,LifecycleState.ELIGIBILITY_FAILED,Authority.ENTRY),
    Transition(LifecycleState.PROFILE_INCOMPLETE,LifecycleState.ACTIVE,Authority.PROFILE_POLICY),
    Transition(LifecycleState.ACTIVE,LifecycleState.DEACTIVATED,Authority.USER),
    Transition(LifecycleState.DEACTIVATED,LifecycleState.ACTIVE,Authority.PROFILE_POLICY),
    Transition(LifecycleState.ACTIVE,LifecycleState.RESTRICTED,Authority.SAFETY),
    Transition(LifecycleState.DEACTIVATED,LifecycleState.RESTRICTED,Authority.SAFETY),
    Transition(LifecycleState.ACTIVE,LifecycleState.SUSPENDED,Authority.SAFETY),
    Transition(LifecycleState.DEACTIVATED,LifecycleState.SUSPENDED,Authority.SAFETY),
    Transition(LifecycleState.RESTRICTED,LifecycleState.SUSPENDED,Authority.SAFETY),
    *{Transition(s,LifecycleState.BANNED,Authority.SAFETY) for s in LifecycleState if s not in {LifecycleState.DELETION_COMPLETE,LifecycleState.RETAINED_EVIDENCE_ONLY}},
    Transition(LifecycleState.RESTRICTED,LifecycleState.APPEAL_REVIEW,Authority.REVIEW),
    Transition(LifecycleState.SUSPENDED,LifecycleState.APPEAL_REVIEW,Authority.REVIEW),
    Transition(LifecycleState.BANNED,LifecycleState.APPEAL_REVIEW,Authority.REVIEW),
    *{Transition(s,LifecycleState.DELETE_REQUESTED,Authority.USER) for s in {
        LifecycleState.PROFILE_INCOMPLETE,LifecycleState.ACTIVE,LifecycleState.DEACTIVATED,
        LifecycleState.RESTRICTED,LifecycleState.SUSPENDED,LifecycleState.BANNED,LifecycleState.APPEAL_REVIEW}},
    Transition(LifecycleState.DELETE_REQUESTED,LifecycleState.DELETION_IN_PROGRESS,Authority.DELETION_PROCESSOR),
    Transition(LifecycleState.DELETION_IN_PROGRESS,LifecycleState.DELETION_COMPLETE,Authority.DELETION_PROCESSOR),
})

RELATIONSHIP_TRANSITIONS = frozenset({
    Transition(RelationshipState.NONE,RelationshipState.LIKED,Authority.USER),
    Transition(RelationshipState.NONE,RelationshipState.PASSED,Authority.USER),
    Transition(RelationshipState.LIKED,RelationshipState.MATCHED,Authority.RECIPROCAL_USERS),
    Transition(RelationshipState.MATCHED,RelationshipState.UNMATCHED,Authority.USER),
    Transition(RelationshipState.NONE,RelationshipState.BLOCKED,Authority.USER),
    Transition(RelationshipState.LIKED,RelationshipState.BLOCKED,Authority.USER),
    Transition(RelationshipState.PASSED,RelationshipState.BLOCKED,Authority.USER),
    Transition(RelationshipState.MATCHED,RelationshipState.BLOCKED,Authority.USER),
    Transition(RelationshipState.UNMATCHED,RelationshipState.BLOCKED,Authority.USER),
})

NON_PARTICIPATING = frozenset({
    LifecycleState.UNREGISTERED,LifecycleState.ELIGIBILITY_PENDING,LifecycleState.ELIGIBILITY_FAILED,
    LifecycleState.PROFILE_INCOMPLETE,LifecycleState.DEACTIVATED,LifecycleState.SUSPENDED,
    LifecycleState.BANNED,LifecycleState.DELETE_REQUESTED,LifecycleState.DELETION_IN_PROGRESS,
    LifecycleState.DELETION_COMPLETE,LifecycleState.RETAINED_EVIDENCE_ONLY,LifecycleState.APPEAL_REVIEW,
})

def transition(current: Enum, target: Enum, authority: Authority, allowed) -> Enum:
    candidate=Transition(current,target,authority)
    if candidate not in allowed: raise TransitionDenied(f"denied: {current.value}->{target.value} by {authority.value}")
    return target

def lifecycle_transition(current, target, authority):
    return transition(current,target,authority,LIFECYCLE_TRANSITIONS)

def relationship_transition(current,target,authority):
    return transition(current,target,authority,RELATIONSHIP_TRANSITIONS)

def ordinary_participation_allowed(state: LifecycleState) -> bool:
    return state == LifecycleState.ACTIVE
