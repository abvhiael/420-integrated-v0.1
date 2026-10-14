"""R02.3 fail-closed retailer and prepaid seller-of-record verification.

No software-verification status, applicant declaration, wallet balance or
unverified checkout receipt constitutes legal retail or payment authority.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
from .auth import Denied

@dataclass(frozen=True)
class RetailerClaim:
    tenant_id: str
    retailer_id: str
    legal_entity_ref: str
    licence_id: str
    municipality_ref: str
    retail_site_ref: str
    evidence_digest: str
    issued_by: str
    valid_from: datetime
    valid_until: datetime
    revoked: bool

@dataclass(frozen=True)
class PrepaidProof:
    seller_ref: str
    retailer_order_ref: str
    payment_ref: str
    amount_minor: int
    currency: str
    settled: bool
    reversed: bool
    verified_at: datetime

@dataclass(frozen=True)
class AuthorizedRetailOrder:
    tenant_id: str
    retailer_id: str
    retailer_order_ref: str
    seller_ref: str
    licence_ref: str
    municipality_ref: str
    payment_ref: str
    amount_minor: int
    currency: str

class AuthoritativeRetailLicensing(Protocol):
    def verify_current(self, claim: RetailerClaim, at: datetime) -> bool: ...

class CanonicalRetailerOrder(Protocol):
    def verify_prepaid(self, *, seller_ref: str, order_ref: str, at: datetime) -> PrepaidProof: ...

def authorize_retail_order(*, claim: RetailerClaim, expected_tenant: str,
                          expected_retailer: str, expected_municipality: str,
                          order_ref: str, claimed_amount_minor: int,
                          claimed_currency: str,
                          licensing: AuthoritativeRetailLicensing,
                          order_authority: CanonicalRetailerOrder,
                          now: datetime | None = None) -> AuthorizedRetailOrder:
    """Admission gate only. Does not dispatch, debit, mint a licence, or move funds."""
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise Denied("untrusted local timestamp")
    if (not expected_tenant or not expected_retailer or not expected_municipality
        or not order_ref or not claimed_currency or claimed_amount_minor <= 0):
        raise Denied("missing order context")
    if (claim.tenant_id != expected_tenant or claim.retailer_id != expected_retailer
        or claim.municipality_ref != expected_municipality or claim.revoked
        or not all((claim.legal_entity_ref, claim.licence_id, claim.retail_site_ref,
                    claim.evidence_digest, claim.issued_by))
        or claim.valid_from.tzinfo is None or claim.valid_until.tzinfo is None
        or not claim.valid_from <= now < claim.valid_until):
        raise Denied("retailer evidence invalid or outside licensed scope")
    try:
        if licensing.verify_current(claim, now) is not True:
            raise Denied("independent licensing authority denied")
        proof = order_authority.verify_prepaid(
            seller_ref=claim.legal_entity_ref, order_ref=order_ref, at=now)
    except Denied:
        raise
    except Exception as exc:
        raise Denied("retail or prepaid authority unavailable") from exc
    if (not isinstance(proof, PrepaidProof) or proof.seller_ref != claim.legal_entity_ref
        or proof.retailer_order_ref != order_ref or not proof.payment_ref
        or not proof.settled or proof.reversed
        or proof.amount_minor != claimed_amount_minor
        or proof.currency != claimed_currency
        or proof.verified_at.tzinfo is None or proof.verified_at > now):
        raise Denied("prepaid proof missing, mismatched or reversed")
    return AuthorizedRetailOrder(expected_tenant,expected_retailer,order_ref,
                                 claim.legal_entity_ref,claim.licence_id,
                                 expected_municipality,proof.payment_ref,
                                 proof.amount_minor,proof.currency)
