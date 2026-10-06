"""PB-2.4 privacy-preserving eligibility proof boundary.

PuffBuddies consumes only a verifier-produced minimum-disclosure proof result. Raw
identity evidence and raw cryptographic proof payloads remain outside the app domain.
This module deliberately does not select or invent a production ZK/credential scheme.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Protocol

from .age_verification import VerificationDecision
from .identity import IDENTITY_AUTHORITY
from .types import EligibilityProjection, EligibilityState, ProfileId

PROOF_AUDIENCE = "PuffBuddies"
PROOF_PREDICATE = "adult-eligibility"

class EligibilityProofDenied(PermissionError):
    pass

@dataclass(frozen=True)
class EligibilityProofChallenge:
    profile_id: ProfileId
    policy_version: str
    nonce: str
    audience: str
    predicate: str
    requested_at_epoch: int

@dataclass(frozen=True)
class VerifiedEligibilityProof:
    profile_id: ProfileId
    policy_version: str
    nonce: str
    audience: str
    predicate: str
    verifier_source: str
    verifier_version: str
    proof_scheme: str
    decision: VerificationDecision
    verified_at_epoch: int
    expires_at_epoch: int | None
    revoked: bool = False

class EligibilityProofVerifier(Protocol):
    def verify_eligibility_proof(
        self, challenge: EligibilityProofChallenge
    ) -> VerifiedEligibilityProof: ...

FORBIDDEN_PROOF_FIELDS = frozenset({
    "date_of_birth", "birth_date", "legal_name", "government_id",
    "government_id_image", "raw_identity_document", "wallet_address",
    "wallet_profile_link", "claim_hash", "biometric_template", "home_address",
    "precise_location", "raw_proof", "proof_bytes", "credential_payload",
})

def validate_proof_challenge(challenge: EligibilityProofChallenge) -> None:
    if not challenge.profile_id:
        raise EligibilityProofDenied("profile binding required")
    if not challenge.policy_version:
        raise EligibilityProofDenied("policy binding required")
    if not challenge.nonce or len(challenge.nonce) < 16:
        raise EligibilityProofDenied("strong proof nonce required")
    if challenge.audience != PROOF_AUDIENCE:
        raise EligibilityProofDenied("proof audience mismatch")
    if challenge.predicate != PROOF_PREDICATE:
        raise EligibilityProofDenied("proof predicate mismatch")
    if challenge.requested_at_epoch < 0:
        raise EligibilityProofDenied("invalid proof request time")

def consume_verified_eligibility_proof(
    challenge: EligibilityProofChallenge,
    proof: VerifiedEligibilityProof,
    *,
    now_epoch: int,
    max_proof_age: int = 300,
) -> EligibilityProjection:
    validate_proof_challenge(challenge)
    if max_proof_age < 0:
        raise EligibilityProofDenied("invalid proof freshness policy")
    if proof.profile_id != challenge.profile_id:
        raise EligibilityProofDenied("proof subject binding mismatch")
    if proof.policy_version != challenge.policy_version:
        raise EligibilityProofDenied("proof policy binding mismatch")
    if proof.nonce != challenge.nonce:
        raise EligibilityProofDenied("proof replay/nonce mismatch")
    if proof.audience != challenge.audience:
        raise EligibilityProofDenied("proof audience mismatch")
    if proof.predicate != challenge.predicate:
        raise EligibilityProofDenied("proof predicate mismatch")
    if proof.verifier_source != IDENTITY_AUTHORITY:
        raise EligibilityProofDenied("untrusted proof verifier")
    if not proof.verifier_version:
        raise EligibilityProofDenied("proof verifier version required")
    if not proof.proof_scheme:
        raise EligibilityProofDenied("proof scheme identifier required")
    if proof.verified_at_epoch < challenge.requested_at_epoch:
        raise EligibilityProofDenied("proof predates challenge")
    if proof.verified_at_epoch > now_epoch:
        raise EligibilityProofDenied("future proof result")
    if now_epoch - proof.verified_at_epoch > max_proof_age:
        raise EligibilityProofDenied("stale proof result")
    if proof.decision == VerificationDecision.UNKNOWN:
        return EligibilityProjection(EligibilityState.UNKNOWN, proof.verifier_version, None)
    if proof.expires_at_epoch is None or proof.expires_at_epoch <= proof.verified_at_epoch:
        raise EligibilityProofDenied("bounded proof expiry required")
    if proof.revoked:
        return EligibilityProjection(
            EligibilityState.REVOKED, proof.verifier_version, proof.expires_at_epoch
        )
    if now_epoch >= proof.expires_at_epoch:
        return EligibilityProjection(
            EligibilityState.EXPIRED, proof.verifier_version, proof.expires_at_epoch
        )
    state = (
        EligibilityState.ELIGIBLE
        if proof.decision == VerificationDecision.ELIGIBLE
        else EligibilityState.INELIGIBLE
    )
    return EligibilityProjection(state, proof.verifier_version, proof.expires_at_epoch)
