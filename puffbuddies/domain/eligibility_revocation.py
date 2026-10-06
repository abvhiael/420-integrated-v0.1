"""PB-2.6 revocation and expiry handling.

Canonical eligibility revocation/expiry transitions advance the private eligibility
sequence, preserve source/policy binding, and invalidate every derived PuffBuddies
surface through the existing PB-1.8/PB-1.9 generation boundary.
"""
from dataclasses import dataclass
from typing import Optional

from puffbuddies.domain.eligibility_state import EligibilityRecord, EligibilityTransitionDenied
from puffbuddies.domain.eligibility_persistence import persist_eligibility
from puffbuddies.domain.invalidation import CanonicalChange, Invalidation, invalidation_for
from puffbuddies.domain.repositories import StoredRecord
from puffbuddies.domain.types import EligibilityState
from puffbuddies.persistence.revocation import RevocationMarker, next_revocation

class EligibilityRevocationDenied(ValueError):
    pass

@dataclass(frozen=True)
class EligibilityInvalidationOutcome:
    record: EligibilityRecord
    marker: RevocationMarker
    invalidation: Invalidation

def _require_event_order(current: EligibilityRecord, *, sequence: int, event_at_epoch: int) -> None:
    if sequence <= current.sequence:
        raise EligibilityRevocationDenied("stale/replayed eligibility event")
    if event_at_epoch < current.checked_at_epoch:
        raise EligibilityRevocationDenied("eligibility event time cannot move backwards")

def _outcome(
    current: EligibilityRecord,
    *,
    state: EligibilityState,
    sequence: int,
    event_at_epoch: int,
    current_generation: int,
    reason: str,
) -> EligibilityInvalidationOutcome:
    _require_event_order(current,sequence=sequence,event_at_epoch=event_at_epoch)
    marker=next_revocation(str(current.profile_id),current_generation,reason)
    record=EligibilityRecord(
        profile_id=current.profile_id,
        state=state,
        source_version=current.source_version,
        policy_version=current.policy_version,
        expires_at_epoch=current.expires_at_epoch,
        sequence=sequence,
        checked_at_epoch=event_at_epoch,
    )
    return EligibilityInvalidationOutcome(
        record=record,
        marker=marker,
        invalidation=invalidation_for(marker,CanonicalChange.ELIGIBILITY),
    )

def apply_authoritative_revocation(
    current: EligibilityRecord,
    *,
    source_version: str,
    sequence: int,
    revoked_at_epoch: int,
    current_generation: int,
) -> EligibilityInvalidationOutcome:
    if not source_version or source_version != current.source_version:
        raise EligibilityRevocationDenied("revocation source version mismatch")
    if current.state == EligibilityState.UNKNOWN:
        raise EligibilityRevocationDenied("UNKNOWN has no current eligibility authority to revoke")
    return _outcome(
        current,state=EligibilityState.REVOKED,sequence=sequence,
        event_at_epoch=revoked_at_epoch,current_generation=current_generation,
        reason="ELIGIBILITY_REVOKED",
    )

def apply_expiry_if_due(
    current: EligibilityRecord,
    *,
    sequence: int,
    now_epoch: int,
    current_generation: int,
) -> Optional[EligibilityInvalidationOutcome]:
    if now_epoch < current.checked_at_epoch:
        raise EligibilityRevocationDenied("eligibility time cannot move backwards")
    if current.state != EligibilityState.ELIGIBLE:
        return None
    if current.expires_at_epoch is None:
        raise EligibilityRevocationDenied("ELIGIBLE state missing bounded expiry")
    if now_epoch < current.expires_at_epoch:
        return None
    return _outcome(
        current,state=EligibilityState.EXPIRED,sequence=sequence,
        event_at_epoch=now_epoch,current_generation=current_generation,
        reason="ELIGIBILITY_EXPIRED",
    )

def persist_invalidation_outcome(
    repository,
    outcome: EligibilityInvalidationOutcome,
    *,
    expected_version: int,
) -> StoredRecord:
    return persist_eligibility(repository,outcome.record,expected_version=expected_version)
