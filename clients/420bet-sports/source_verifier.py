"""Strict Ed25519 source-evidence authentication for local sportsbook odds.

The trusted SourcePolicy must be independently approved and provisioned by an
operator. A matching signature alone cannot prove licensing or provider
independence. This module verifies a signed, market-bound source observation.
"""
from dataclasses import dataclass
from hashlib import sha256
from typing import Mapping

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.exceptions import InvalidSignature

from app import AdmissionRejected, VerifiedEvidence, canonical, nonzero_hex

@dataclass(frozen=True)
class SourcePolicy:
    provider: str
    key_hex: str
    source_digest: str
    max_age_seconds: int
    entitlement_expires_at: int

class SourceVerifier:
    def __init__(self, policy: SourcePolicy):
        if (not policy.provider or len(policy.key_hex) != 64
            or not nonzero_hex(policy.source_digest, 32)
            or policy.max_age_seconds <= 0 or policy.entitlement_expires_at <= 0):
            raise AdmissionRejected("invalid trusted source policy")
        try:
            self.key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(policy.key_hex))
        except ValueError as exc:
            raise AdmissionRejected("invalid trusted provider key") from exc
        self.policy = policy

    def verify(self, envelope: Mapping, *, now: int) -> VerifiedEvidence:
        """Require detached provider signature covering all immutable report facts."""
        report = envelope.get("report")
        signature = envelope.get("signature")
        if not isinstance(report, dict) or not isinstance(signature, str):
            raise AdmissionRejected("unsigned source observation")
        if set(report) != {"provider", "marketId", "sequence", "observedAt", "validUntil", "sourceDigest", "evidence"}:
            raise AdmissionRejected("unexpected source report schema")
        if report["provider"] != self.policy.provider or report["sourceDigest"] != self.policy.source_digest:
            raise AdmissionRejected("untrusted source or policy")
        market, sequence = report["marketId"], report["sequence"]
        observed, expiry = report["observedAt"], report["validUntil"]
        if (not nonzero_hex(market, 32) or not isinstance(sequence, int) or isinstance(sequence, bool)
            or sequence <= 0 or not isinstance(observed, int) or isinstance(observed, bool)
            or not isinstance(expiry, int) or isinstance(expiry, bool)
            or observed <= 0 or observed > now or expiry <= now
            or now - observed > self.policy.max_age_seconds or expiry > self.policy.entitlement_expires_at):
            raise AdmissionRejected("stale, invalid or out-of-entitlement observation")
        evidence = report["evidence"]
        if not isinstance(evidence, dict) or not evidence:
            raise AdmissionRejected("missing verifiable raw evidence")
        message = b"420.BET.SPORT.SOURCE.V1\x00" + canonical(report)
        try:
            sig = bytes.fromhex(signature)
            self.key.verify(sig, message)
        except (ValueError, InvalidSignature) as exc:
            raise AdmissionRejected("invalid provider signature") from exc
        # A commitment to the signed source payload, not a caller-supplied hash.
        return VerifiedEvidence(
            self.policy.source_digest, "0x" + sha256(canonical(evidence)).hexdigest(),
            market, sequence, observed, expiry, self.policy.provider
        )

    def __call__(self, envelope):
        # Callers must supply a frozen evaluation time, not implicitly use the
        # workstation wall clock or trust a timestamp in the report.
        raise AdmissionRejected("call verify(envelope, now=trusted_chain_time)")
