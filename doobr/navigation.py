"""Private courier-only navigation request; never published to Travel/Maps.

Navigation authority must be externally approved, with encrypted destinations
read from the tenant-scoped vault. No raw recipient coordinates are logged.
"""
from datetime import datetime, timezone
from .auth import Denied, Permission, authorize
from .tracking import uid, ACTIVE

def navigate(*,connect,issuer,store,token,tenant_id,order_id,
             location_permission_id,route_authority,at=None):
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None:raise Denied("invalid navigation time")
    tenant_id,order_id,location_permission_id=map(uid,(tenant_id,order_id,location_permission_id))
    session=authorize(issuer=issuer,store=store,signed_token=token,tenant_id=tenant_id,
        permission=Permission("COURIER","READ_NAVIGATION","order:"+order_id),now=at)
    courier=uid(session.actor_id)
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("""SELECT state FROM doobr_private.delivery_orders
                        WHERE tenant_id=%s AND order_id=%s""",(tenant_id,order_id))
                    order=c.fetchone()
                    if not order or order[0] not in ACTIVE:raise Denied("navigation lifecycle closed")
                    c.execute("""SELECT 1 FROM doobr_private.dispatch_assignments
                        WHERE tenant_id=%s AND order_id=%s AND courier_id=%s AND state='ACTIVE'""",
                        (tenant_id,order_id,courier))
                    if not c.fetchone():raise Denied("not assigned")
                    c.execute("""SELECT 1 FROM doobr_private.location_permissions WHERE tenant_id=%s
                        AND order_id=%s AND courier_id=%s AND permission_id=%s
                        AND state='GRANTED' AND expires_at>%s""",
                        (tenant_id,order_id,courier,location_permission_id,at))
                    if not c.fetchone():raise Denied("navigation permission revoked or expired")
                    c.execute("""SELECT address_ciphertext,address_key_version FROM
                        doobr_private.private_delivery_data WHERE tenant_id=%s AND order_id=%s
                        AND retention_until>%s""",(tenant_id,order_id,at))
                    destination=c.fetchone()
                    if not destination:raise Denied("private destination unavailable")
                    # Route adapter itself must restrict disclosures to authenticated
                    # courier ephemeral sessions; it owns map-provider credentials.
                    result=route_authority.plan(tenant_id=tenant_id,order_id=order_id,
                        courier_id=courier,encrypted_destination=destination[0],
                        key_version=destination[1],at=at)
                    if not isinstance(result,dict) or result.get("authorized") is not True:
                        raise Denied("approved navigation provider unavailable")
                    return {"authorized":True,"route_ref":result.get("route_ref"),
                            "expires_at":result.get("expires_at")}
    except Denied:raise
    except Exception as exc:raise Denied("private navigation unavailable") from exc
