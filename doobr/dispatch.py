"""R02.7 tenant-scoped dispatch. Does not authorize real regulated delivery."""
from datetime import datetime, timezone
from uuid import UUID
from .auth import Denied, Permission, authorize

def _uuid(value):
    try: return str(UUID(value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise Denied("invalid dispatch identifier") from exc

def _principal(issuer,store,token,tenant,order,now):
    s=authorize(issuer=issuer,store=store,signed_token=token,tenant_id=tenant,
                permission=Permission("OPERATOR","TRANSITION_ORDER","order:"+order),now=now)
    return _uuid(s.actor_id)

def offer(*, connect, issuer, store, token, tenant_id, order_id, courier_id, offer_id,
          expected_revision, requested_units, expires_at, eligibility, at=None):
    """Server-selected courier; eligibility validates courier, 420Compliance, region, and route."""
    at=at or datetime.now(timezone.utc)
    if (at.tzinfo is None or expires_at.tzinfo is None or expires_at<=at
        or type(expected_revision) is not int or expected_revision<1
        or type(requested_units) is not int or not 1<=requested_units<=100):
        raise Denied("invalid offer request")
    tenant_id,order_id,courier_id,offer_id=map(_uuid,(tenant_id,order_id,courier_id,offer_id))
    actor=_principal(issuer,store,token,tenant_id,order_id,at)
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("SELECT state,revision,region_id FROM doobr_private.delivery_orders WHERE tenant_id=%s AND order_id=%s FOR UPDATE",(tenant_id,order_id))
                    row=c.fetchone()
                    if not row or row[0]!="RETAILER_READY" or row[1]!=expected_revision:
                        raise Denied("order not schedulable")
                    region=str(row[2])
                    c.execute("SELECT state FROM doobr_private.actors WHERE tenant_id=%s AND actor_id=%s AND kind='COURIER'",(tenant_id,courier_id))
                    if c.fetchone()!=("ACTIVE",): raise Denied("courier inactive")
                    c.execute("""SELECT capacity FROM doobr_private.courier_region_presence
                                  WHERE tenant_id=%s AND courier_id=%s AND region_id=%s
                                    AND updated_at<=%s AND expires_at>%s AND eligibility_verified_at<=%s
                                  FOR UPDATE""",(tenant_id,courier_id,region,at,at,at))
                    present=c.fetchone()
                    if not present: raise Denied("stale presence")
                    c.execute("""SELECT COALESCE(sum(reserved_units),0) FROM doobr_private.dispatch_assignments
                                 WHERE tenant_id=%s AND courier_id=%s AND state='ACTIVE'""",(tenant_id,courier_id))
                    used=c.fetchone()[0]
                    if requested_units>present[0]-used: raise Denied("capacity unavailable")
                    if eligibility.approve(tenant_id=tenant_id,order_id=order_id,courier_id=courier_id,
                                           actor_id=actor,region_id=region,at=at) is not True:
                        raise Denied("dispatch eligibility not verified")
                    c.execute("""INSERT INTO doobr_private.dispatch_offers
                      (tenant_id,offer_id,order_id,courier_id,region_id,requested_units,offered_at,expires_at,state)
                      VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'OFFERED')""",
                      (tenant_id,offer_id,order_id,courier_id,region,requested_units,at,expires_at))
                    c.execute("""UPDATE doobr_private.delivery_orders SET state='OFFERED',
                        revision=revision+1,updated_at=now() WHERE tenant_id=%s AND order_id=%s
                        AND state='RETAILER_READY' AND revision=%s RETURNING revision""",
                        (tenant_id,order_id,expected_revision))
                    if not c.fetchone():raise Denied("concurrent offer")
        return offer_id
    except Denied:raise
    except Exception as exc:raise Denied("dispatch offer unavailable") from exc

def decide(*, connect, issuer, store, token, tenant_id, order_id, offer_id,
           accept, eligibility, at=None):
    """Courier accepts exact unexpired offer; rejects/expiry returns order to ready."""
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None or type(accept) is not bool:raise Denied("invalid decision")
    tenant_id,order_id,offer_id=map(_uuid,(tenant_id,order_id,offer_id))
    s=authorize(issuer=issuer,store=store,signed_token=token,tenant_id=tenant_id,
                permission=Permission("COURIER","ACCEPT_OFFER","order:"+order_id),now=at)
    courier_id=_uuid(s.actor_id)
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("""SELECT state,region_id FROM doobr_private.delivery_orders
                      WHERE tenant_id=%s AND order_id=%s FOR UPDATE""",(tenant_id,order_id))
                    order=c.fetchone()
                    if not order or order[0]!="OFFERED":raise Denied("order no longer offered")
                    c.execute("""SELECT courier_id,region_id,requested_units,expires_at,state
                        FROM doobr_private.dispatch_offers WHERE tenant_id=%s AND offer_id=%s
                        AND order_id=%s FOR UPDATE""",(tenant_id,offer_id,order_id))
                    item=c.fetchone()
                    if not item or str(item[0])!=courier_id or item[4]!="OFFERED":
                        raise Denied("offer not owned or already decided")
                    valid=accept and item[3]>at
                    if valid:
                        c.execute("""SELECT capacity FROM doobr_private.courier_region_presence
                           WHERE tenant_id=%s AND courier_id=%s AND region_id=%s
                           AND expires_at>%s FOR UPDATE""",(tenant_id,courier_id,str(item[1]),at))
                        row=c.fetchone()
                        if not row:raise Denied("courier presence expired")
                        c.execute("""SELECT COALESCE(sum(reserved_units),0) FROM doobr_private.dispatch_assignments
                            WHERE tenant_id=%s AND courier_id=%s AND state='ACTIVE'""",(tenant_id,courier_id))
                        if item[2]>row[0]-c.fetchone()[0]:raise Denied("capacity conflict")
                        if eligibility.approve(tenant_id=tenant_id,order_id=order_id,courier_id=courier_id,
                                               region_id=str(item[1]),at=at) is not True:
                            raise Denied("current courier eligibility denied")
                        c.execute("""INSERT INTO doobr_private.dispatch_assignments
                          (tenant_id,order_id,courier_id,offer_id,reserved_units,state)
                          VALUES(%s,%s,%s,%s,%s,'ACTIVE')""",
                          (tenant_id,order_id,courier_id,offer_id,item[2]))
                    c.execute("""UPDATE doobr_private.dispatch_offers SET state=%s,decided_at=%s
                         WHERE tenant_id=%s AND offer_id=%s""",
                         ("ACCEPTED" if valid else "DECLINED" if not accept else "EXPIRED",at,tenant_id,offer_id))
                    c.execute("""UPDATE doobr_private.delivery_orders SET state=%s,
                         revision=revision+1,updated_at=now()
                         WHERE tenant_id=%s AND order_id=%s""",
                         ("ASSIGNED" if valid else "RETAILER_READY",tenant_id,order_id))
        return "ASSIGNED" if valid else "RETAILER_READY"
    except Denied:raise
    except Exception as exc:raise Denied("dispatch acceptance unavailable") from exc
