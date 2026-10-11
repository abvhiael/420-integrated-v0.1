"""R02.12 independent audit-chain verification; never disclose private event payloads."""
from hashlib import sha256
from datetime import timezone
from .auth import Denied

ZERO=b"\x00"*32
def _stamp(value):
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")
def verify_chain(*,connect,tenant_id):
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("""SELECT a.audit_id,a.order_id,a.command_id,a.action,a.occurred_at,
                           a.prev_digest,a.entry_digest,oc.applied_revision,oc.actor_id
                        FROM doobr_private.operation_audit a LEFT JOIN doobr_private.order_commands oc
                          ON oc.tenant_id=a.tenant_id AND oc.command_id=a.command_id
                        WHERE a.tenant_id=%s ORDER BY a.audit_id""",(tenant_id,))
                    last=ZERO
                    n=0
                    for aid,order,command,action,when,prev,digest,revision,actor in c.fetchall():
                        if command is None or revision is None or bytes(prev)!=last:
                            raise Denied("audit chain discontinuity")
                        message=f"{command}:{order}:{action}:{revision}:{_stamp(when)}".encode()
                        expected=sha256(last+message).digest()
                        if bytes(digest)!=expected:
                            raise Denied("audit chain digest mismatch")
                        last=expected
                        n+=1
                    c.execute("""SELECT count(*) FROM doobr_private.order_commands
                         WHERE tenant_id=%s""",(tenant_id,))
                    if c.fetchone()[0]!=n:
                        raise Denied("audit record count mismatch")
                    return {"entries":n,"head_digest":last.hex()}
    except Denied:raise
    except Exception as exc:raise Denied("audit verification unavailable") from exc
