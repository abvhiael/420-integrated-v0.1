"""R03.6 private retailer intake, dispatch and exception queue projection.

Seller-of-record admission remains under retailer.py; order state commands,
dispatch, and returns remain controlled by their canonical R02 authorities.
This service is read-only and never activates a regulated transaction.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID
from .auth import Denied, Permission, authorize

RETAILER_STATES=frozenset({"ELIGIBLE","RETAILER_READY","OFFERED","ASSIGNED","PICKED_UP","IN_TRANSIT","HANDOFF_PENDING","DELIVERY_FAILED","RETURN_REQUIRED","RETURNED","RECONCILED","CANCELLED","EXPIRED","DELIVERED","CLOSED","DISPUTED"})

@dataclass(frozen=True)
class RetailerQueueItem:
    order_id: str
    state: str
    revision: int
    intake: str
    dispatch: str
    exception: str

def _uid(value):
    try: return str(UUID(value))
    except (TypeError,ValueError,AttributeError) as exc:
        raise Denied("invalid retailer queue identifier") from exc

def read_retailer_order(*,connect,issuer,store,token,tenant_id,retailer_id,order_id,at=None):
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None: raise Denied("invalid retailer clock")
    tenant_id,retailer_id,order_id=map(_uid,(tenant_id,retailer_id,order_id))
    session=authorize(issuer=issuer,store=store,signed_token=token,tenant_id=tenant_id,
        permission=Permission("RETAILER","READ_STORE_ORDER","order:"+order_id),now=at)
    if _uid(session.actor_id)!=retailer_id: raise Denied("retailer identity mismatch")
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION READ ONLY")
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("""SELECT retailer_id,state,revision FROM doobr_private.delivery_orders
                        WHERE tenant_id=%s AND order_id=%s AND retailer_id=%s""",
                        (tenant_id,order_id,retailer_id))
                    row=c.fetchone()
                    if row is None or str(row[0])!=retailer_id: raise Denied("retailer order unavailable")
                    state,revision=row[1],row[2]
                    if state not in RETAILER_STATES or type(revision) is not int or revision<1:
                        raise Denied("invalid stored retailer order state")
                    return RetailerQueueItem(order_id,state,revision,
                        "VERIFIED_ADMISSION_REQUIRED",
                        "OPERATOR_CONTROLLED" if state in {"RETAILER_READY","OFFERED","ASSIGNED"} else "NOT_SCHEDULABLE",
                        "ESCALATION_REQUIRED" if state in {"DELIVERY_FAILED","RETURN_REQUIRED","DISPUTED"} else "NONE")
    except Denied: raise
    except Exception as exc: raise Denied("retailer order queue unavailable") from exc
