"""R02.9 atomic regulated custody handoff linked to R02.6 order command receipts."""
from datetime import datetime,timedelta,timezone
from hashlib import sha256
from uuid import UUID
from .auth import Denied,Permission,authorize
from .order_commands import command_digest

EDGES={"PICKUP":("ASSIGNED","PICKED_UP","PICKUP"),
       "DELIVER":("HANDOFF_PENDING","DELIVERED","HANDOFF")}
def uid(v):
    try: return str(UUID(v))
    except (TypeError,ValueError,AttributeError) as exc:raise Denied("invalid custody identifier") from exc

def apply_custody(*,connect,issuer,store,token,tenant_id,order_id,command_id,
    evidence_id,action,expected_revision,package_seal_ref,issuer_evidence_ref,
    recipient_id_ref=None,recipient_name_ref=None,signature_ref=None,
    authority=None,encrypt=None,at=None,retention_seconds=86400):
    """Evidence, command and state change commit or roll back as one transaction."""
    at=at or datetime.now(timezone.utc)
    if (at.tzinfo is None or action not in EDGES or type(expected_revision) is not int
        or expected_revision<1 or type(retention_seconds) is not int
        or not 60<=retention_seconds<=2592000 or not isinstance(package_seal_ref,str)
        or not 1<=len(package_seal_ref)<=128 or not isinstance(issuer_evidence_ref,str)
        or not 1<=len(issuer_evidence_ref)<=256):
        raise Denied("invalid regulated custody request")
    if action=="DELIVER" and any(not isinstance(v,str) or not 1<=len(v)<=256
       for v in (recipient_id_ref,recipient_name_ref,signature_ref)):
        raise Denied("recipient identity name and signature evidence mandatory")
    tenant_id,order_id,command_id,evidence_id=map(uid,(tenant_id,order_id,command_id,evidence_id))
    session=authorize(issuer=issuer,store=store,signed_token=token,tenant_id=tenant_id,
        permission=Permission("COURIER","TRANSITION_ORDER","order:"+order_id),now=at)
    courier=uid(session.actor_id)
    # Digest includes the entire sensitive-proof reference set without leaking proof.
    proof="|".join((package_seal_ref,issuer_evidence_ref,recipient_id_ref or "",
        recipient_name_ref or "",signature_ref or "",evidence_id))
    digest=command_digest(tenant_id,order_id,courier,action,expected_revision,
                          sha256(proof.encode()).hexdigest())
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("""SELECT state,revision FROM doobr_private.delivery_orders
                        WHERE tenant_id=%s AND order_id=%s FOR UPDATE""",(tenant_id,order_id))
                    order=c.fetchone()
                    if not order:raise Denied("order unavailable")
                    c.execute("""SELECT order_id,actor_id,action,target_state,request_digest,expected_revision,applied_revision
                        FROM doobr_private.order_commands WHERE tenant_id=%s AND command_id=%s""",
                        (tenant_id,command_id))
                    prior=c.fetchone()
                    if prior:
                        if (str(prior[0])!=order_id or str(prior[1])!=courier or
                            prior[2]!=action or bytes(prior[4])!=digest or
                            prior[5]!=expected_revision):
                            raise Denied("custody idempotency collision")
                        return {"state":prior[3],"revision":prior[6],"replay":True}
                    origin,destination,kind=EDGES[action]
                    if order!=(origin,expected_revision):raise Denied("invalid custody order transition")
                    c.execute("""SELECT 1 FROM doobr_private.dispatch_assignments
                        WHERE tenant_id=%s AND order_id=%s AND courier_id=%s AND state='ACTIVE'""",
                        (tenant_id,order_id,courier))
                    if not c.fetchone():raise Denied("unassigned courier")
                    decision=authority.approve(tenant_id=tenant_id,order_id=order_id,
                        courier_id=courier,action=action,package_seal_ref=package_seal_ref,
                        issuer_evidence_ref=issuer_evidence_ref,recipient_id_ref=recipient_id_ref,
                        recipient_name_ref=recipient_name_ref,signature_ref=signature_ref,at=at)
                    if decision is not True:raise Denied("independent custody or recipient verification denied")
                    encrypted,key=encrypt(tenant_id=tenant_id,order_id=order_id,
                        action=action,proof_ref=proof,evidence_id=evidence_id)
                    if not isinstance(encrypted,bytes) or len(encrypted)<=28 or not isinstance(key,str) or not key:
                        raise Denied("authenticated custody encryption unavailable")
                    c.execute("""INSERT INTO doobr_private.custody_evidence(tenant_id,evidence_id,order_id,
                        evidence_type,evidence_ciphertext,key_version,recorded_at,retention_until)
                        VALUES(%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (tenant_id,evidence_id,order_id,kind,encrypted,key,at,
                        at+timedelta(seconds=retention_seconds)))
                    c.execute("""UPDATE doobr_private.delivery_orders SET state=%s,revision=revision+1,
                        updated_at=now() WHERE tenant_id=%s AND order_id=%s AND state=%s AND revision=%s
                        RETURNING revision""",(destination,tenant_id,order_id,origin,expected_revision))
                    result=c.fetchone()
                    if not result:raise Denied("custody CAS conflict")
                    c.execute("""INSERT INTO doobr_private.order_commands(tenant_id,command_id,
                        order_id,actor_id,action,target_state,request_digest,expected_revision,applied_revision)
                        VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (tenant_id,command_id,order_id,courier,action,destination,
                        digest,expected_revision,result[0]))
                    return {"state":destination,"revision":result[0],"replay":False}
    except Denied:raise
    except Exception as exc:raise Denied("custody transaction failed") from exc
