"""PB-2.10 privacy and information-leakage hardening.

PB-2 authorization internals contain highly sensitive eligibility, relationship and
freshness metadata. This module defines minimum-disclosure external conclusions and
uniform denial behavior so protected state is not exposed through payload shape,
reason strings, identifiers, or derived/public surfaces.
"""
from dataclasses import dataclass
from typing import Mapping

from puffbuddies.domain.privacy import LeakageDenied, assert_derived_payload_minimal

UNIFORM_DENIAL_CODE = "NOT_AUTHORIZED"

# PB-2 internal authorization/eligibility metadata must not escape to public or generic
# derived surfaces, even if a field name is not already covered by PB-1.10 tokens.
PB2_PRIVATE_KEYS=frozenset({
    "profile_id","subject_id","actor_id","eligibility","eligibility_state","decision",
    "source_version","policy_version","record_sequence","sequence","checked_at_epoch",
    "expires_at","expires_at_epoch","revoked","revoked_at_epoch","relationship",
    "relationship_state","blocked","lifecycle","messenger_native_denied","reason",
    "reason_code","match_id","conversation_id","wallet","wallet_address","identity_ref",
    "proof","proof_bytes","credential_payload","date_of_birth",
})

@dataclass(frozen=True)
class PrivateAuthorizationConclusion:
    allowed: bool

def uniform_denial_code() -> str:
    return UNIFORM_DENIAL_CODE

def private_authorization_conclusion(*, allowed: bool) -> PrivateAuthorizationConclusion:
    # Intentionally carries no subject, reason, eligibility state, source/policy version,
    # expiry, relationship, block or identity material.
    return PrivateAuthorizationConclusion(bool(allowed))

def assert_pb2_external_payload_minimal(payload: Mapping[str,object]) -> None:
    for key in payload:
        low=str(key).lower()
        if low in PB2_PRIVATE_KEYS:
            raise LeakageDenied("PB-2 authorization metadata is private")
    assert_derived_payload_minimal(payload)

def public_eligibility_lookup(*args,**kwargs):
    raise LeakageDenied("public eligibility/membership lookup is prohibited")

def public_authorization_probe(*args,**kwargs):
    raise LeakageDenied("public authorization probing is prohibited")
