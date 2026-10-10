"""R02.11 tenant-scoped at-least-once outbox worker; signed callback adapter required."""
from datetime import datetime,timedelta,timezone
from uuid import UUID
from .auth import Denied

def _id(value):
 try:return str(UUID(value))
 except (TypeError,ValueError,AttributeError) as exc:raise Denied("invalid outbox identity") from exc

def claim(*,connect,tenant_id,worker_id,at=None,lease_seconds=60):
 at=at or datetime.now(timezone.utc)
 if at.tzinfo is None or type(lease_seconds) is not int or not 5<=lease_seconds<=300:
  raise Denied("invalid outbox lease")
 tenant_id,worker_id=map(_id,(tenant_id,worker_id))
 try:
  with connect() as db:
   with db.transaction():
    with db.cursor() as c:
     c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
     c.execute("""SELECT event_id,event_type,payload,attempt_count FROM doobr_private.event_outbox
       WHERE tenant_id=%s AND ((status='PENDING' AND next_attempt_at<=%s)
          OR (status='INFLIGHT' AND lease_until<%s))
       ORDER BY created_at,event_id FOR UPDATE SKIP LOCKED LIMIT 1""",(tenant_id,at,at))
     event=c.fetchone()
     if not event:return None
     if event[3]>=8:
      c.execute("""UPDATE doobr_private.event_outbox SET status='DEAD',lease_owner=NULL,
        lease_until=NULL,last_error_code='MAX_ATTEMPTS' WHERE tenant_id=%s AND event_id=%s""",
        (tenant_id,str(event[0])))
      return None
     c.execute("""UPDATE doobr_private.event_outbox SET status='INFLIGHT',
       lease_owner=%s,lease_until=%s,attempt_count=attempt_count+1
       WHERE tenant_id=%s AND event_id=%s""",
       (worker_id,at+timedelta(seconds=lease_seconds),tenant_id,str(event[0])))
     return dict(event_id=str(event[0]),event_type=event[1],payload=event[2],
                 attempt=event[3]+1,worker_id=worker_id)
 except Denied:raise
 except Exception as exc:raise Denied("outbox claim unavailable") from exc

def settle(*,connect,tenant_id,worker_id,event_id,attempt,receipt_ref=None,
           error_code=None,at=None):
 at=at or datetime.now(timezone.utc)
 if (at.tzinfo is None or type(attempt) is not int or not 1<=attempt<=8 or
   (receipt_ref is None)==(error_code is None) or
   receipt_ref is not None and (not isinstance(receipt_ref,str) or not 1<=len(receipt_ref)<=256) or
   error_code is not None and (not isinstance(error_code,str) or not 1<=len(error_code)<=64)):
  raise Denied("invalid outbox acknowledgement")
 tenant_id,worker_id,event_id=map(_id,(tenant_id,worker_id,event_id))
 try:
  with connect() as db:
   with db.transaction():
    with db.cursor() as c:
     c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
     c.execute("""SELECT status,lease_owner,lease_until,attempt_count FROM doobr_private.event_outbox
       WHERE tenant_id=%s AND event_id=%s FOR UPDATE""",(tenant_id,event_id))
     row=c.fetchone()
     if not row or row[0]!='INFLIGHT' or str(row[1])!=worker_id or row[2]<=at or row[3]!=attempt:
      raise Denied("outbox lease expired or stolen")
     if receipt_ref is not None:
      c.execute("""UPDATE doobr_private.event_outbox SET status='DELIVERED',
       lease_owner=NULL,lease_until=NULL,delivered_at=%s,last_error_code=NULL
       WHERE tenant_id=%s AND event_id=%s""",(at,tenant_id,event_id))
      c.execute("""INSERT INTO doobr_private.event_receipts(tenant_id,event_id,consumer_id,receipt_ref)
        VALUES(%s,%s,'notifications',%s) ON CONFLICT (tenant_id,event_id,consumer_id) DO NOTHING""",
        (tenant_id,event_id,receipt_ref))
      return "DELIVERED"
     dead=attempt>=8
     c.execute("""UPDATE doobr_private.event_outbox SET status=%s,
       lease_owner=NULL,lease_until=NULL,next_attempt_at=%s,last_error_code=%s
       WHERE tenant_id=%s AND event_id=%s""",
       ('DEAD' if dead else 'PENDING',at+timedelta(seconds=min(3600,2**attempt*10)),
        error_code,tenant_id,event_id))
     return 'DEAD' if dead else 'PENDING'
 except Denied:raise
 except Exception as exc:raise Denied("outbox acknowledgement unavailable") from exc

def dispatch_once(*,connect,tenant_id,worker_id,callback,at=None):
 """Callback must sign authenticated payload and return an independently verified receipt."""
 item=claim(connect=connect,tenant_id=tenant_id,worker_id=worker_id,at=at)
 if item is None:return None
 try:
  # A signed callback adapter is required; do not trust a bare HTTP 200.
  receipt=callback.send_signed(event_id=item['event_id'],event_type=item['event_type'],
      payload=item['payload'],deduplication_key=item['event_id'])
  if not isinstance(receipt,str) or not receipt:
   raise Denied("missing signed callback receipt")
  return settle(connect=connect,tenant_id=tenant_id,worker_id=worker_id,
       event_id=item['event_id'],attempt=item['attempt'],receipt_ref=receipt,at=at)
 except Exception:
  return settle(connect=connect,tenant_id=tenant_id,worker_id=worker_id,
       event_id=item['event_id'],attempt=item['attempt'],error_code='CALLBACK_FAILED',at=at)
