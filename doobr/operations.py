"""R02.12 private operational health and tenant-scoped multi-instance heartbeats.

No raw address, identity proof, location, signature or arbitrary payload enters metrics.
"""
from datetime import datetime,timedelta,timezone
from uuid import UUID
from .auth import Denied

def _id(s):
 try:return str(UUID(s))
 except (ValueError,TypeError,AttributeError) as exc:raise Denied("invalid operations identifier") from exc

def heartbeat(*,connect,tenant_id,instance_id,role,started_at,at=None):
 at=at or datetime.now(timezone.utc)
 if (role not in {"API","OUTBOX","SCHEDULER","MAINTENANCE"} or
    started_at.tzinfo is None or at.tzinfo is None or started_at>at):
  raise Denied("invalid instance heartbeat")
 tenant_id,instance_id=map(_id,(tenant_id,instance_id))
 try:
  with connect() as db:
   with db.transaction():
    with db.cursor() as c:
     c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
     c.execute("""INSERT INTO doobr_private.instance_heartbeats
        (tenant_id,instance_id,role,started_at,last_seen_at) VALUES(%s,%s,%s,%s,%s)
        ON CONFLICT(tenant_id,instance_id) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at
        WHERE doobr_private.instance_heartbeats.role=EXCLUDED.role
          AND doobr_private.instance_heartbeats.started_at=EXCLUDED.started_at
          AND doobr_private.instance_heartbeats.last_seen_at<=EXCLUDED.last_seen_at
        RETURNING instance_id""",(tenant_id,instance_id,role,started_at,at))
     if not c.fetchone():raise Denied("instance identity reuse or time rewind")
 except Denied:raise
 except Exception as exc:raise Denied("instance heartbeat unavailable") from exc

def snapshot(*,connect,tenant_id,at=None,max_age_seconds=90):
 at=at or datetime.now(timezone.utc)
 if at.tzinfo is None or type(max_age_seconds) is not int or not 5<=max_age_seconds<=3600:
  raise Denied("invalid operations probe")
 tenant_id=_id(tenant_id)
 try:
  with connect() as db:
   with db.transaction():
    with db.cursor() as c:
     c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
     c.execute("""SELECT role,count(*) FROM doobr_private.instance_heartbeats
       WHERE tenant_id=%s AND last_seen_at>=%s GROUP BY role""",
       (tenant_id,at-timedelta(seconds=max_age_seconds)))
     roles={name:count for name,count in c.fetchall()}
     c.execute("""SELECT status,count(*) FROM doobr_private.event_outbox
       WHERE tenant_id=%s GROUP BY status""",(tenant_id,))
     queue={name:count for name,count in c.fetchall()}
     c.execute("""SELECT count(*) FROM doobr_private.event_outbox
       WHERE tenant_id=%s AND status='INFLIGHT' AND lease_until<%s""",(tenant_id,at))
     stale=c.fetchone()[0]
     return {"healthy_instances":roles,"outbox_counts":queue,"expired_leases":stale,
       "ready":roles.get("API",0)>0 and roles.get("OUTBOX",0)>0 and stale==0}
 except Denied:raise
 except Exception as exc:raise Denied("operations probe unavailable") from exc
