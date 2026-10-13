"""R03.3 authenticated consumer view: fail-closed, no local identity or payment authority."""
from dataclasses import dataclass
from datetime import datetime,timezone
from uuid import UUID
from .auth import Denied, Permission, authorize

@dataclass(frozen=True)
class ConsumerView:
    order_id: str
    state: str
    revision: int
    receipt_status: str
    wallet_consent_active: bool

def read_own_order(*,connect,identity_issuer,session_store,signed_token,tenant_id,order_id,at=None):
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None: raise Denied("invalid clock")
    try:
        tenant_id=str(UUID(tenant_id))
        order_id=str(UUID(order_id))
    except (ValueError,AttributeError,TypeError) as exc:
        raise Denied("invalid order reference") from exc
    session=authorize(issuer=identity_issuer,store=session_store,signed_token=signed_token,
                      tenant_id=tenant_id,permission=Permission("CONSUMER","READ_OWN_ORDER","order:"+order_id),now=at)
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as cur:
                    cur.execute("SET TRANSACTION READ ONLY")
                    cur.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    cur.execute("""SELECT consumer_id,state,revision FROM doobr_private.delivery_orders
                                   WHERE tenant_id=%s AND order_id=%s""",(tenant_id,order_id))
                    row=cur.fetchone()
                    if not row or str(row[0])!=session.actor_id:
                        raise Denied("order not found or not owned")
                    # Receipt MUST be authenticated by the canonical retailer/Pay adapter.
                    # Never manufacture a receipt from state, purchase totals or wallet state.
                    return ConsumerView(order_id,row[1],row[2],"NOT_VERIFIED",
                        session.wallet_consent_until is not None and session.wallet_consent_until>at)
    except Denied: raise
    except Exception as exc: raise Denied("consumer order read unavailable") from exc
