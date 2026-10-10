"""R02.3 durable admission; non-owner PostgreSQL, authoritative upstream adapters only.

Operator provisions a dedicated server-side connection. NEVER expose tenant GUC or this
connection to a browser. No locally minted regulatory or Pay authority.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID
from .auth import Session, Denied
from .retailer import RetailerClaim, AuthoritativeRetailLicensing, CanonicalRetailerOrder, authorize_retail_order

@dataclass(frozen=True)
class Admission:
    order_id: str
    seller_ref: str
    payment_ref: str
    revision: int

def admit_prepaid_order(*, connect, session: Session, tenant_id: str,
                        order_id: str, retailer_id: str, region_id: str,
                        municipality_ref: str, claim: RetailerClaim,
                        retailer_order_ref: str, amount_minor: int, currency: str,
                        proof_digest: bytes, licence_digest: bytes,
                        licensing: AuthoritativeRetailLicensing,
                        order_authority: CanonicalRetailerOrder,
                        now: datetime | None = None) -> Admission:
    """Only DRAFT -> ELIGIBILITY_PENDING; DOES NOT declare legal delivery eligible.

    Trusted API must authorize RETAILER's exact order resource with R02.2 before invoking.
    Row lock serializes attempts, uniqueness prevents payment/order-reference reuse.
    """
    now = now or datetime.now(timezone.utc)
    if (now.tzinfo is None or session.revoked or session.expires_at <= now
        or session.tenant_id != tenant_id or session.actor_id != retailer_id
        or len(proof_digest) != 32 or len(licence_digest) != 32):
        raise Denied("invalid authenticated admission context")
    try:
        ids = tuple(str(UUID(x)) for x in (tenant_id, order_id, retailer_id, region_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise Denied("invalid database identifiers") from exc
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SELECT set_config('doobr.tenant_id', %s, true)", (ids[0],))
                    c.execute("""SELECT retailer_id,region_id,state,revision,retailer_order_ref
                                   FROM doobr_private.delivery_orders
                                  WHERE tenant_id=%s AND order_id=%s FOR UPDATE""",
                              (ids[0],ids[1]))
                    row=c.fetchone()
                    if row is None or str(row[0])!=ids[2] or str(row[1])!=ids[3]:
                        raise Denied("order missing or retailer/region mismatch")
                    if row[2] != 'DRAFT' or row[4] is not None:
                        raise Denied("order already admitted or not DRAFT")
                    c.execute("""SELECT municipality_ref FROM doobr_private.service_regions
                                   WHERE tenant_id=%s AND region_id=%s""",(ids[0],ids[3]))
                    region=c.fetchone()
                    if region is None or region[0]!=municipality_ref:
                        raise Denied("municipal region mismatch")
                    c.execute("""SELECT authorization_id,legal_seller_ref,licence_ref,retail_site_ref,
                                         issuer_ref,evidence_digest,valid_from,valid_until,revoked_at
                                   FROM doobr_private.retailer_authorizations
                                  WHERE tenant_id=%s AND retailer_id=%s AND licence_ref=%s
                                    AND municipality_ref=%s FOR UPDATE""",
                              (ids[0],ids[2],claim.licence_id,municipality_ref))
                    license_row=c.fetchone()
                    if (license_row is None or license_row[1]!=claim.legal_entity_ref
                        or license_row[3]!=claim.retail_site_ref or license_row[4]!=claim.issued_by
                        or bytes(license_row[5])!=licence_digest or license_row[6]>now
                        or license_row[7]<=now or license_row[8] is not None):
                        raise Denied("persisted retailer authority absent or expired")
                    approved=authorize_retail_order(
                        claim=claim,expected_tenant=ids[0],expected_retailer=ids[2],
                        expected_municipality=municipality_ref,order_ref=retailer_order_ref,
                        claimed_amount_minor=amount_minor,claimed_currency=currency,
                        licensing=licensing,order_authority=order_authority,now=now)
                    # One transaction: no admission if either evidence row/update conflicts.
                    c.execute("""INSERT INTO doobr_private.retailer_prepaid_evidence
                        (tenant_id,order_id,authorization_id,retailer_order_ref,
                         canonical_payment_ref,amount_minor,currency,proof_digest,verified_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (ids[0],ids[1],license_row[0],retailer_order_ref,
                         approved.payment_ref,amount_minor,currency,proof_digest,now))
                    c.execute("""UPDATE doobr_private.delivery_orders
                                    SET retailer_order_ref=%s,state='ELIGIBILITY_PENDING',
                                        revision=revision+1,updated_at=now()
                                  WHERE tenant_id=%s AND order_id=%s AND state='DRAFT'
                                    RETURNING revision""",(retailer_order_ref,ids[0],ids[1]))
                    result=c.fetchone()
                    if result is None:
                        raise Denied("concurrent state transition")
                    return Admission(ids[1],approved.seller_ref,approved.payment_ref,result[0])
    except Denied:
        raise
    except Exception as exc:
        raise Denied("atomic retailer admission unavailable or replayed") from exc
