"""R03.5 courier offer and journey read model. Never exposes coordinates or private proof."""
from dataclasses import dataclass
from datetime import datetime,timezone
from uuid import UUID
from .auth import Denied, Permission, authorize

@dataclass(frozen=True)
class CourierJourney:
    order_id: str
    state: str
    offer_state: str
    offer_expires_at: datetime | None
    navigation: str
    custody: str
    proof_of_delivery: str

def _uid(value):
    try:return str(UUID(value))
    except (ValueError,TypeError,AttributeError) as e:raise Denied("invalid journey identifier") from e

def read_journey(*,connect,issuer,store,token,tenant_id,order_id,at=None):
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None:raise Denied("invalid clock")
    tenant_id,order_id=map(_uid,(tenant_id,order_id))
    session=authorize(issuer=issuer,store=store,signed_token=token,tenant_id=tenant_id,
       permission=Permission("COURIER","READ_ASSIGNED","order:"+order_id),now=at)
    courier_id=_uid(session.actor_id)
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION READ ONLY")
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("""SELECT state FROM doobr_private.delivery_orders
                          WHERE tenant_id=%s AND order_id=%s""",(tenant_id,order_id))
                    order=c.fetchone()
                    if not order:raise Denied("journey unavailable")
                    c.execute("""SELECT state,expires_at FROM doobr_private.dispatch_offers
                        WHERE tenant_id=%s AND order_id=%s AND courier_id=%s
                        ORDER BY offered_at DESC LIMIT 1""",(tenant_id,order_id,courier_id))
                    offer=c.fetchone()
                    c.execute("""SELECT 1 FROM doobr_private.dispatch_assignments
                        WHERE tenant_id=%s AND order_id=%s AND courier_id=%s AND state='ACTIVE'""",
                        (tenant_id,order_id,courier_id))
                    assigned=c.fetchone() is not None
                    if not offer and not assigned:raise Denied("courier not offered or assigned")
                    if offer and offer[1].tzinfo is None:raise Denied("invalid offer clock")
                    status="EXPIRED" if offer and offer[0]=="OFFERED" and offer[1]<=at else (offer[0] if offer else "NONE")
                    if not assigned and status!="OFFERED":raise Denied("no active courier journey")
                    # Independently authorized navigation reads and custody evidence are separate.
                    # NEVER expose an address, exact GPS, recipient info, proof or embedded link.
                    return CourierJourney(order_id,order[0],status,
                        offer[1] if offer and status=="OFFERED" else None,
                        "REQUIRES_AUTHORIZED_NAVIGATION",
                        "REQUIRES_SIGNED_CUSTODY_COMMAND",
                        "NOT_DISCLOSED")
    except Denied:raise
    except Exception as exc:raise Denied("courier journey unavailable") from exc
