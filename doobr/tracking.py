"""R02.8 private order tracking. Precise location never leaves trusted storage."""
from datetime import datetime,timedelta,timezone
from uuid import UUID
from .auth import Denied,Permission,authorize

ACTIVE=frozenset({"ASSIGNED","PICKED_UP","IN_TRANSIT","HANDOFF_PENDING","DELIVERY_FAILED","RETURN_REQUIRED"})
def uid(value):
    try:return str(UUID(value))
    except (TypeError,ValueError,AttributeError) as exc:raise Denied("invalid tracking identifier") from exc

def permission_change(*,connect,issuer,store,token,tenant_id,order_id,
                      permission_id,grant,authority,expires_at=None,at=None):
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None or type(grant) is not bool:raise Denied("invalid location permission")
    tenant_id,order_id,permission_id=map(uid,(tenant_id,order_id,permission_id))
    session=authorize(issuer=issuer,store=store,signed_token=token,tenant_id=tenant_id,
        permission=Permission("COURIER","MANAGE_LOCATION","order:"+order_id),now=at)
    courier=uid(session.actor_id)
    if grant and (expires_at is None or expires_at.tzinfo is None or not at<expires_at<=at+timedelta(hours=12)):
        raise Denied("location permission expiry required")
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("""SELECT state FROM doobr_private.delivery_orders WHERE tenant_id=%s
                                 AND order_id=%s""",(tenant_id,order_id))
                    row=c.fetchone()
                    if not row or row[0] not in ACTIVE:raise Denied("tracking not allowed in order state")
                    c.execute("""SELECT 1 FROM doobr_private.dispatch_assignments WHERE tenant_id=%s
                        AND order_id=%s AND courier_id=%s AND state='ACTIVE'""",(tenant_id,order_id,courier))
                    if not c.fetchone():raise Denied("courier not assigned")
                    if authority.approve(tenant_id=tenant_id,order_id=order_id,courier_id=courier,
                        permission_id=permission_id,grant=grant,at=at) is not True:
                        raise Denied("independent location permission denied")
                    c.execute("""SELECT permission_id,state FROM doobr_private.location_permissions
                                 WHERE tenant_id=%s AND order_id=%s FOR UPDATE""",(tenant_id,order_id))
                    prior=c.fetchone()
                    if grant:
                        if prior:raise Denied("location permission must not silently reactivate")
                        c.execute("""INSERT INTO doobr_private.location_permissions
                            (tenant_id,order_id,courier_id,permission_id,state,granted_at,expires_at)
                            VALUES(%s,%s,%s,%s,'GRANTED',%s,%s)""",
                            (tenant_id,order_id,courier,permission_id,at,expires_at))
                    else:
                        if not prior or str(prior[0])!=permission_id or prior[1]!="GRANTED":
                            raise Denied("no active matching permission")
                        c.execute("""UPDATE doobr_private.location_permissions
                            SET state='REVOKED',revoked_at=%s WHERE tenant_id=%s AND order_id=%s""",
                            (at,tenant_id,order_id))
        return "GRANTED" if grant else "REVOKED"
    except Denied:raise
    except Exception as exc:raise Denied("location permission unavailable") from exc

def record_location(*,connect,issuer,store,token,tenant_id,order_id,permission_id,
                    sequence,observed_at,latitude,longitude,encrypt,geofence,at=None,
                    retention_seconds=1800):
    at=at or datetime.now(timezone.utc)
    if (at.tzinfo is None or observed_at.tzinfo is None or observed_at>at
        or at-observed_at>timedelta(seconds=90) or type(sequence) is not int or sequence<1
        or type(latitude) not in (int,float) or type(longitude) not in (int,float)
        or not -90<=latitude<=90 or not -180<=longitude<=180
        or not 1<=retention_seconds<=3600):
        raise Denied("invalid or stale tracking sample")
    tenant_id,order_id,permission_id=map(uid,(tenant_id,order_id,permission_id))
    session=authorize(issuer=issuer,store=store,signed_token=token,tenant_id=tenant_id,
        permission=Permission("COURIER","WRITE_LOCATION","order:"+order_id),now=at)
    courier=uid(session.actor_id)
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("""SELECT state,region_id FROM doobr_private.delivery_orders
                        WHERE tenant_id=%s AND order_id=%s FOR UPDATE""",(tenant_id,order_id))
                    order=c.fetchone()
                    if not order or order[0] not in ACTIVE:raise Denied("tracking state not active")
                    c.execute("""SELECT 1 FROM doobr_private.dispatch_assignments
                        WHERE tenant_id=%s AND order_id=%s AND courier_id=%s AND state='ACTIVE'""",
                        (tenant_id,order_id,courier))
                    if not c.fetchone():raise Denied("unassigned courier")
                    c.execute("""SELECT courier_id,permission_id,state,expires_at,last_sequence,last_observed_at
                        FROM doobr_private.location_permissions WHERE tenant_id=%s AND order_id=%s FOR UPDATE""",
                        (tenant_id,order_id))
                    perm=c.fetchone()
                    if (not perm or str(perm[0])!=courier or str(perm[1])!=permission_id
                        or perm[2]!="GRANTED" or perm[3]<=at
                        or sequence<=perm[4] or (perm[5] is not None and observed_at<=perm[5])):
                        raise Denied("location permission expired revoked or replayed")
                    if geofence.approve(tenant_id=tenant_id,order_id=order_id,
                        region_id=str(order[1]),latitude=latitude,longitude=longitude,at=at) is not True:
                        raise Denied("unapproved geospatial boundary")
                    encrypted,key=encrypt(latitude=latitude,longitude=longitude,
                                          tenant_id=tenant_id,order_id=order_id,sequence=sequence)
                    if not isinstance(encrypted,bytes) or len(encrypted)<=28 or not key:
                        raise Denied("authenticated location encryption required")
                    c.execute("""INSERT INTO doobr_private.location_samples
                        (tenant_id,order_id,sequence,courier_id,permission_id,ciphertext,
                         key_version,observed_at,retention_until)
                        VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (tenant_id,order_id,sequence,courier,permission_id,encrypted,key,
                         observed_at,at+timedelta(seconds=retention_seconds)))
                    c.execute("""UPDATE doobr_private.location_permissions SET last_sequence=%s,
                        last_observed_at=%s WHERE tenant_id=%s AND order_id=%s""",
                        (sequence,observed_at,tenant_id,order_id))
        return {"accepted":True,"sequence":sequence} # never return GPS
    except Denied:raise
    except Exception as exc:raise Denied("private tracking unavailable") from exc
