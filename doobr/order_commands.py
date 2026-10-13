"""R02.6 serializable, replay-safe state transitions; cannot execute payment or delivery.

External evidence verifier is REQUIRED for regulated transitions, without fabricating
420Compliance, retailer, courier, custody or Pay authority. Failure closes.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import Protocol
from uuid import UUID
from .auth import Denied, Permission, authorize

# Only narrowly defined edges. Explicitly no rewind from a terminal state.
EDGES={
 "APPROVE_ELIGIBILITY":("ELIGIBILITY_PENDING","ELIGIBLE","OPERATOR"),
 "READY_PICKUP":("ELIGIBLE","RETAILER_READY","RETAILER"),
 "OFFER":("RETAILER_READY","OFFERED","OPERATOR"),
 "ASSIGN":("OFFERED","ASSIGNED","OPERATOR"),
 "PICKUP":("ASSIGNED","PICKED_UP","COURIER"),
 "START_TRANSIT":("PICKED_UP","IN_TRANSIT","COURIER"),
 "START_HANDOFF":("IN_TRANSIT","HANDOFF_PENDING","COURIER"),
 "DELIVER":("HANDOFF_PENDING","DELIVERED","COURIER"),
 "CLOSE":("DELIVERED","CLOSED","OPERATOR"),
 "FAIL_DELIVERY":("HANDOFF_PENDING","DELIVERY_FAILED","COURIER"),
 "REQUIRE_RETURN":("DELIVERY_FAILED","RETURN_REQUIRED","OPERATOR"),
 "RETURN":("RETURN_REQUIRED","RETURNED","COURIER"),
 "RECONCILE":("RETURNED","RECONCILED","OPERATOR"),
 "DISPUTE":("DELIVERED","DISPUTED","OPERATOR")
}
CANCELLABLE=frozenset({"DRAFT","ELIGIBILITY_PENDING","ELIGIBLE"})
EXPIRABLE=frozenset({"DRAFT","ELIGIBILITY_PENDING"})
@dataclass(frozen=True)
class Result:
    order_id: str
    state: str
    revision: int
    replay: bool

class TransitionAuthority(Protocol):
    def approve(self, *, tenant_id: str, order_id: str, actor_id: str,
                action: str, state: str, evidence_ref: str,
                at: datetime) -> bool: ...

def _id(value):
    try:
        return str(UUID(value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise Denied("invalid order or actor identifier") from exc

def command_digest(tenant_id,order_id,actor_id,action,expected_revision,evidence_ref):
    payload=json.dumps([tenant_id,order_id,actor_id,action,expected_revision,evidence_ref],
        separators=(",",":"),ensure_ascii=True).encode()
    return sha256(payload).digest()

def run_command(*, connect, identity_issuer, session_store, signed_token: str,
                tenant_id: str, order_id: str, command_id: str,
                action: str, expected_revision: int, evidence_ref: str,
                evidence_authority: TransitionAuthority,
                at: datetime | None = None) -> Result:
    at=at or datetime.now(timezone.utc)
    if (at.tzinfo is None or type(expected_revision) is not int
        or expected_revision<1 or not isinstance(evidence_ref,str)
        or len(evidence_ref)>256 or not evidence_ref or action not in {*EDGES,"CANCEL","EXPIRE"}):
        raise Denied("invalid order command")
    tenant_id,order_id,command_id=map(_id,(tenant_id,order_id,command_id))
    role=EDGES[action][2] if action in EDGES else ("CONSUMER" if action=="CANCEL" else "OPERATOR")
    # R02.2 independent signed issuer, nonrevoked session and order-specific grant.
    session=authorize(issuer=identity_issuer,store=session_store,
        signed_token=signed_token,tenant_id=tenant_id,
        permission=Permission(role,"TRANSITION_ORDER","order:"+order_id),now=at)
    actor_id=_id(session.actor_id)
    digest=command_digest(tenant_id,order_id,actor_id,action,expected_revision,evidence_ref)
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                    c.execute("SELECT set_config('doobr.tenant_id', %s, true)",(tenant_id,))
                    # Lock parent before checking ledger: serializes same-order races.
                    c.execute("""SELECT consumer_id,retailer_id,state,revision
                                   FROM doobr_private.delivery_orders
                                   WHERE tenant_id=%s AND order_id=%s FOR UPDATE""",(tenant_id,order_id))
                    row=c.fetchone()
                    if row is None:
                        raise Denied("order not found")
                    consumer,retailer,state,revision=row
                    c.execute("""SELECT order_id,actor_id,action,target_state,request_digest,expected_revision,applied_revision
                                   FROM doobr_private.order_commands
                                  WHERE tenant_id=%s AND command_id=%s""",(tenant_id,command_id))
                    prior=c.fetchone()
                    if prior is not None:
                        if (str(prior[0])!=order_id or str(prior[1])!=actor_id
                            or prior[2]!=action or bytes(prior[4])!=digest
                            or prior[5]!=expected_revision):
                            raise Denied("idempotency key reused with different payload")
                        return Result(order_id,prior[3],prior[6],True)
                    if revision!=expected_revision:
                        raise Denied("stale order revision")
                    if role=="CONSUMER" and str(consumer)!=actor_id:
                        raise Denied("consumer does not own order")
                    if role=="RETAILER" and str(retailer)!=actor_id:
                        raise Denied("retailer does not own order")
                    if action=="CANCEL":
                        if state not in CANCELLABLE: raise Denied("late cancellation prohibited")
                        target="CANCELLED"
                    elif action=="EXPIRE":
                        if state not in EXPIRABLE: raise Denied("expiry prohibited")
                        target="EXPIRED"
                    else:
                        source,target,_=EDGES[action]
                        if state!=source:raise Denied("illegal order transition")
                    # The evidence source must be independently authorized, fresh,
                    # specific to this actor/order/action/previous state.
                    if evidence_authority.approve(tenant_id=tenant_id,order_id=order_id,
                           actor_id=actor_id,action=action,state=state,
                           evidence_ref=evidence_ref,at=at) is not True:
                        raise Denied("canonical transition evidence rejected")
                    c.execute("""UPDATE doobr_private.delivery_orders
                                   SET state=%s,revision=revision+1,updated_at=now()
                                 WHERE tenant_id=%s AND order_id=%s AND revision=%s AND state=%s
                                 RETURNING revision""",(target,tenant_id,order_id,revision,state))
                    updated=c.fetchone()
                    if not updated: raise Denied("concurrent transition rejected")
                    c.execute("""INSERT INTO doobr_private.order_commands
                        (tenant_id,command_id,order_id,actor_id,action,target_state,
                         request_digest,expected_revision,applied_revision)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (tenant_id,command_id,order_id,actor_id,action,target,
                         digest,revision,updated[0]))
                    return Result(order_id,target,updated[0],False)
    except Denied:
        raise
    except Exception as exc:
        raise Denied("transaction failed or replay protection unavailable") from exc
