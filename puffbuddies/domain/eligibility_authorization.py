"""PB-2.7 eligibility authorization integration.

Binds the full current PB-2 EligibilityRecord into the already-qualified PB-1.5
AuthorizationContext. Authorization consumes a fail-closed effective eligibility state;
it does not let callers inject a bare ELIGIBLE flag that bypasses policy/expiry/current
record checks.
"""
from dataclasses import dataclass, replace

from puffbuddies.domain.authorization import AuthorizationContext
from puffbuddies.domain.eligibility_state import EligibilityRecord
from puffbuddies.domain.types import EligibilityState, ProfileId

class EligibilityAuthorizationDenied(PermissionError):
    pass

@dataclass(frozen=True)
class BoundEligibilityAuthorization:
    context: AuthorizationContext
    record_sequence: int
    policy_version: str
    checked_at_epoch: int

def effective_eligibility_state(
    record: EligibilityRecord,
    *,
    profile_id: ProfileId,
    current_policy_version: str,
    now_epoch: int,
) -> EligibilityState:
    if record.profile_id != profile_id:
        raise EligibilityAuthorizationDenied("eligibility subject mismatch")
    if not current_policy_version:
        raise EligibilityAuthorizationDenied("current policy version required")
    if now_epoch < record.checked_at_epoch:
        raise EligibilityAuthorizationDenied("authorization time predates eligibility state")
    if record.policy_version != current_policy_version:
        return EligibilityState.UNKNOWN
    if record.state != EligibilityState.ELIGIBLE:
        return record.state
    if record.expires_at_epoch is None or now_epoch >= record.expires_at_epoch:
        return EligibilityState.EXPIRED
    return EligibilityState.ELIGIBLE

def bind_current_eligibility(
    context: AuthorizationContext,
    record: EligibilityRecord,
    *,
    profile_id: ProfileId,
    current_policy_version: str,
    now_epoch: int,
) -> BoundEligibilityAuthorization:
    if context.subject_id != str(profile_id):
        raise EligibilityAuthorizationDenied("authorization subject/profile mismatch")
    state=effective_eligibility_state(
        record,profile_id=profile_id,current_policy_version=current_policy_version,now_epoch=now_epoch
    )
    return BoundEligibilityAuthorization(
        context=replace(context,eligibility=state),
        record_sequence=record.sequence,
        policy_version=record.policy_version,
        checked_at_epoch=record.checked_at_epoch,
    )
