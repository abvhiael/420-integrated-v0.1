"""PB-2.5 eligibility persistence and lifecycle.

Persists only the canonical minimum-disclosure PB-2.2 EligibilityRecord. Sequence and
checked-time metadata are durable so replay/time-order protections survive repository
reloads. Raw identity/proof evidence remains prohibited.
"""
from typing import Optional

from puffbuddies.domain.eligibility_state import EligibilityRecord, EligibilityTransitionDenied
from puffbuddies.domain.repositories import InvalidRecord, StoredRecord, VersionConflict
from puffbuddies.domain.types import EligibilityState, ProfileId
from puffbuddies.persistence.schema import TABLES

ELIGIBILITY_TABLE = "eligibility_projection"

class EligibilityPersistenceDenied(ValueError):
    pass

def _record_values(record: EligibilityRecord) -> dict[str, object]:
    if not record.profile_id:
        raise EligibilityPersistenceDenied("profile binding required")
    if not record.policy_version:
        raise EligibilityPersistenceDenied("policy version required")
    if record.sequence < 0 or record.checked_at_epoch < 0:
        raise EligibilityPersistenceDenied("nonnegative sequence/time required")
    if record.state != EligibilityState.UNKNOWN and not record.source_version:
        raise EligibilityPersistenceDenied("authoritative source version required")
    if record.state == EligibilityState.UNKNOWN and record.expires_at_epoch is not None:
        raise EligibilityPersistenceDenied("UNKNOWN cannot retain expiry authority")
    if record.state == EligibilityState.ELIGIBLE:
        if record.expires_at_epoch is None or record.expires_at_epoch <= record.checked_at_epoch:
            raise EligibilityPersistenceDenied("ELIGIBLE requires future bounded expiry")
    return {
        "profile_id": str(record.profile_id),
        "decision": record.state.value,
        "source_version": record.source_version,
        "expires_at": record.expires_at_epoch,
        "policy_version": record.policy_version,
        "sequence": record.sequence,
        "checked_at_epoch": record.checked_at_epoch,
    }

def decode_eligibility_record(stored: StoredRecord, *, profile_id: ProfileId) -> EligibilityRecord:
    if stored.table != ELIGIBILITY_TABLE:
        raise EligibilityPersistenceDenied("wrong canonical table")
    values=dict(stored.values)
    allowed=set(TABLES[ELIGIBILITY_TABLE].fields)
    if set(values) != allowed:
        raise EligibilityPersistenceDenied("eligibility record must use exact canonical schema")
    if values["profile_id"] != str(profile_id):
        raise EligibilityPersistenceDenied("stored eligibility subject mismatch")
    try:
        state=EligibilityState(str(values["decision"]))
        sequence=int(values["sequence"])
        checked=int(values["checked_at_epoch"])
        expiry=None if values["expires_at"] is None else int(values["expires_at"])
    except (TypeError,ValueError):
        raise EligibilityPersistenceDenied("malformed persisted eligibility record")
    record=EligibilityRecord(
        profile_id=profile_id,
        state=state,
        source_version=str(values["source_version"]),
        policy_version=str(values["policy_version"]),
        expires_at_epoch=expiry,
        sequence=sequence,
        checked_at_epoch=checked,
    )
    _record_values(record)
    return record

def load_eligibility(repository, profile_id: ProfileId) -> Optional[tuple[EligibilityRecord,int]]:
    stored=repository.get(ELIGIBILITY_TABLE,str(profile_id))
    if stored is None:
        return None
    return decode_eligibility_record(stored,profile_id=profile_id),stored.version

def persist_eligibility(repository, record: EligibilityRecord, *, expected_version: Optional[int]) -> StoredRecord:
    current=repository.get(ELIGIBILITY_TABLE,str(record.profile_id))
    if current is None:
        if expected_version is not None:
            raise VersionConflict("expected existing eligibility record")
    else:
        current_record=decode_eligibility_record(current,profile_id=record.profile_id)
        if record.sequence <= current_record.sequence:
            raise EligibilityPersistenceDenied("eligibility sequence must advance monotonically")
        if record.checked_at_epoch < current_record.checked_at_epoch:
            raise EligibilityPersistenceDenied("eligibility checked time cannot move backwards")
    return repository.put(
        ELIGIBILITY_TABLE,str(record.profile_id),_record_values(record),
        expected_version=expected_version,
    )

def require_persisted_policy_current(record: EligibilityRecord, *, current_policy_version: str) -> None:
    if not current_policy_version or record.policy_version != current_policy_version:
        raise EligibilityTransitionDenied("persisted eligibility requires current policy reevaluation")
