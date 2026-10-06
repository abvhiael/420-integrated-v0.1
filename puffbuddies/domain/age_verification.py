"""PB-2.3 age-verification interface.

This is a PuffBuddies-side consumer contract for an approved 420Identity verifier/
adapter. It deliberately does not encode a direct Identity420 RPC/API shape and does
not store raw identity or credential evidence.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Protocol
from .types import ProfileId, EligibilityProjection, EligibilityState
from .identity import IDENTITY_AUTHORITY, AdultEligibilityAssertion, consume_adult_eligibility

class AgeVerificationDenied(PermissionError): pass

class VerificationDecision(str,Enum):
    ELIGIBLE="ELIGIBLE"
    INELIGIBLE="INELIGIBLE"
    UNKNOWN="UNKNOWN"

@dataclass(frozen=True)
class AgeVerificationRequest:
    profile_id: ProfileId
    policy_version: str
    request_nonce: str
    requested_at_epoch: int

@dataclass(frozen=True)
class AgeVerificationResponse:
    profile_id: ProfileId
    policy_version: str
    request_nonce: str
    source: str
    source_version: str
    decision: VerificationDecision
    checked_at_epoch: int
    expires_at_epoch: int|None
    revoked: bool=False

class AgeVerificationVerifier(Protocol):
    def verify_adult_eligibility(self, request:AgeVerificationRequest)->AgeVerificationResponse: ...

FORBIDDEN_VERIFICATION_FIELDS=frozenset({
    "date_of_birth","birth_date","legal_name","government_id","government_id_image",
    "raw_identity_document","wallet_address","wallet_profile_link","claim_hash",
    "biometric_template","home_address","precise_location",
})

def validate_request(request:AgeVerificationRequest)->None:
    if not request.profile_id: raise AgeVerificationDenied("profile binding required")
    if not request.policy_version: raise AgeVerificationDenied("policy binding required")
    if not request.request_nonce or len(request.request_nonce)<16:
        raise AgeVerificationDenied("strong request nonce required")
    if request.requested_at_epoch<0: raise AgeVerificationDenied("invalid request time")

def consume_verification_response(request:AgeVerificationRequest,response:AgeVerificationResponse,*,
                                  now_epoch:int,max_response_age:int=300)->EligibilityProjection:
    validate_request(request)
    if max_response_age<0: raise AgeVerificationDenied("invalid freshness policy")
    if response.profile_id!=request.profile_id: raise AgeVerificationDenied("subject binding mismatch")
    if response.policy_version!=request.policy_version: raise AgeVerificationDenied("policy binding mismatch")
    if response.request_nonce!=request.request_nonce: raise AgeVerificationDenied("verification replay/nonce mismatch")
    if response.source!=IDENTITY_AUTHORITY: raise AgeVerificationDenied("untrusted verification authority")
    if not response.source_version: raise AgeVerificationDenied("source version required")
    if response.checked_at_epoch<request.requested_at_epoch: raise AgeVerificationDenied("response predates request")
    if response.checked_at_epoch>now_epoch: raise AgeVerificationDenied("future verification response")
    if now_epoch-response.checked_at_epoch>max_response_age:
        raise AgeVerificationDenied("stale verification response")
    if response.decision==VerificationDecision.UNKNOWN:
        return EligibilityProjection(EligibilityState.UNKNOWN,response.source_version,None)
    if response.expires_at_epoch is None or response.expires_at_epoch<=response.checked_at_epoch:
        raise AgeVerificationDenied("bounded verification expiry required")
    assertion=AdultEligibilityAssertion(
        profile_id=response.profile_id,
        adult=response.decision==VerificationDecision.ELIGIBLE,
        source=response.source,
        source_version=response.source_version,
        issued_at_epoch=response.checked_at_epoch,
        expires_at_epoch=response.expires_at_epoch,
        revoked=response.revoked,
    )
    return consume_adult_eligibility(assertion,profile_id=request.profile_id,now_epoch=now_epoch)
