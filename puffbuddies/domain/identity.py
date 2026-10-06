"""PB-2.1 identity and adult-eligibility consumption boundaries.

420Identity owns identity evidence. PuffBuddies consumes only a minimum-disclosure,
profile-bound adult-eligibility assertion and owns its local participation decision.
Raw identity, date of birth, wallet linkage, names, and identity documents are never
accepted or persisted by this boundary.
"""
from dataclasses import dataclass
from .types import EligibilityProjection, EligibilityState, ProfileId

IDENTITY_AUTHORITY = "420Identity"
LOCAL_ELIGIBILITY_AUTHORITY = "puffbuddies"

class EligibilityDenied(PermissionError):
    pass

@dataclass(frozen=True)
class AdultEligibilityAssertion:
    profile_id: ProfileId
    adult: bool
    source: str
    source_version: str
    issued_at_epoch: int
    expires_at_epoch: int
    revoked: bool = False

def consume_adult_eligibility(assertion: AdultEligibilityAssertion, *, profile_id: ProfileId, now_epoch: int) -> EligibilityProjection:
    if assertion.source != IDENTITY_AUTHORITY:
        raise EligibilityDenied("untrusted eligibility authority")
    if assertion.profile_id != profile_id:
        raise EligibilityDenied("eligibility assertion is not bound to this profile")
    if not assertion.source_version or assertion.issued_at_epoch < 0:
        raise EligibilityDenied("malformed eligibility assertion")
    if assertion.expires_at_epoch <= assertion.issued_at_epoch:
        raise EligibilityDenied("invalid eligibility validity window")
    if now_epoch < assertion.issued_at_epoch:
        raise EligibilityDenied("eligibility assertion is not yet valid")
    if assertion.revoked:
        return EligibilityProjection(EligibilityState.REVOKED, assertion.source_version, assertion.expires_at_epoch)
    if now_epoch >= assertion.expires_at_epoch:
        return EligibilityProjection(EligibilityState.EXPIRED, assertion.source_version, assertion.expires_at_epoch)
    if not assertion.adult:
        return EligibilityProjection(EligibilityState.INELIGIBLE, assertion.source_version, assertion.expires_at_epoch)
    return EligibilityProjection(EligibilityState.ELIGIBLE, assertion.source_version, assertion.expires_at_epoch)

def require_current_adult(projection: EligibilityProjection, *, now_epoch: int) -> bool:
    if projection.state != EligibilityState.ELIGIBLE:
        raise EligibilityDenied("current adult eligibility required")
    if projection.expires_at_epoch is None or now_epoch >= projection.expires_at_epoch:
        raise EligibilityDenied("adult eligibility expired")
    return True

FORBIDDEN_IDENTITY_FIELDS=frozenset({
    "date_of_birth","birth_date","government_id","government_id_image","raw_identity_document",
    "wallet_address","wallet_profile_link","legal_name","identity_payload","biometric_template",
})
