"""PB-1.5 server-side authorization primitives.

Authorization is explicit and fail-closed. Visibility never overrides lifecycle,
eligibility, relationship, block/safety, deletion, or purpose-limited moderator rules.
"""
from dataclasses import dataclass
from enum import Enum
from .types import EligibilityState,LifecycleState,RelationshipState,VisibilityAudience

class AccessDenied(PermissionError): pass
class PrincipalKind(str,Enum):
    SELF="SELF"; USER="USER"; MODERATOR="MODERATOR"; SERVICE="SERVICE"; PUBLIC="PUBLIC"
@dataclass(frozen=True)
class AuthorizationContext:
    principal: PrincipalKind
    subject_id: str
    actor_id: str|None=None
    eligibility: EligibilityState=EligibilityState.UNKNOWN
    lifecycle: LifecycleState=LifecycleState.UNREGISTERED
    relationship: RelationshipState=RelationshipState.NONE
    blocked: bool=False
    moderator_case: bool=False
    service_approved: bool=False
    aggregate_safe: bool=False
    public_explicit: bool=False

REVOKED_LIFECYCLES=frozenset({
 LifecycleState.DEACTIVATED,LifecycleState.SUSPENDED,LifecycleState.BANNED,
 LifecycleState.DELETE_REQUESTED,LifecycleState.DELETION_IN_PROGRESS,
 LifecycleState.DELETION_COMPLETE,LifecycleState.RETAINED_EVIDENCE_ONLY,
 LifecycleState.APPEAL_REVIEW,
})

def _current_participant(c):
    return c.eligibility==EligibilityState.ELIGIBLE and c.lifecycle==LifecycleState.ACTIVE

def authorize_private_access(audience:VisibilityAudience,c:AuthorizationContext)->bool:
    # Hard revocations precede ordinary visibility.
    if c.blocked and c.principal not in {PrincipalKind.SELF,PrincipalKind.MODERATOR}: return False
    if c.lifecycle in REVOKED_LIFECYCLES and c.principal not in {PrincipalKind.SELF,PrincipalKind.MODERATOR,PrincipalKind.SERVICE}: return False
    if audience==VisibilityAudience.NEVER_PUBLIC:
        return c.principal==PrincipalKind.SELF or (c.principal==PrincipalKind.MODERATOR and c.moderator_case) or (c.principal==PrincipalKind.SERVICE and c.service_approved)
    if audience==VisibilityAudience.PRIVATE_SELF: return c.principal==PrincipalKind.SELF
    if audience==VisibilityAudience.DISCOVERABLE: return c.principal==PrincipalKind.USER and _current_participant(c) and not c.blocked
    if audience==VisibilityAudience.MATCHED: return c.principal==PrincipalKind.USER and _current_participant(c) and c.relationship==RelationshipState.MATCHED and not c.blocked
    if audience==VisibilityAudience.PARTICIPANT_ONLY: return c.principal in {PrincipalKind.SELF,PrincipalKind.USER} and c.relationship==RelationshipState.MATCHED and not c.blocked
    if audience==VisibilityAudience.MODERATOR_ONLY: return c.principal==PrincipalKind.MODERATOR and c.moderator_case
    if audience==VisibilityAudience.SERVICE_MINIMUM: return c.principal==PrincipalKind.SERVICE and c.service_approved
    if audience==VisibilityAudience.AGGREGATE_ONLY: return c.principal==PrincipalKind.SERVICE and c.service_approved and c.aggregate_safe
    if audience==VisibilityAudience.PUBLIC_EXPLICIT: return c.principal==PrincipalKind.PUBLIC and c.public_explicit
    return False

def require_private_access(audience,c):
    if not authorize_private_access(audience,c): raise AccessDenied(f"access denied for {audience.value}")
    return True

def authorize_relationship_action(c:AuthorizationContext)->bool:
    return c.principal in {PrincipalKind.SELF,PrincipalKind.USER} and _current_participant(c) and not c.blocked

def authorize_safety_access(c:AuthorizationContext)->bool:
    return c.principal==PrincipalKind.MODERATOR and c.moderator_case

def authorize_eligibility_minimum(c:AuthorizationContext)->bool:
    return c.principal==PrincipalKind.SERVICE and c.service_approved

def authorize_lifecycle_self_access(c:AuthorizationContext)->bool:
    return c.principal==PrincipalKind.SELF

def authorize_repository_read(table:str,c:AuthorizationContext)->bool:
    # Server-side table boundary; callers must still apply field audience policy.
    if table=="safety": return authorize_safety_access(c)
    if table=="eligibility_projection": return c.principal==PrincipalKind.SELF or authorize_eligibility_minimum(c)
    if table in {"profile","preferences","visibility","relationship","lifecycle","location","cannabis","matching_input"}:
        return c.principal==PrincipalKind.SELF
    return False
