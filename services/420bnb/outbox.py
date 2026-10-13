"""BNB-4.2 PostgreSQL outbox delivery. No external senders activated.

At-least-once transport with consumer-side idempotency. Leases are fenced by worker
and expiry; stale/competing workers cannot mark or mutate a re-claimed event.
"""
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

MAX_ATTEMPTS=8
EVENT_TYPES=frozenset({
    "bnb.pay.intent_bound","bnb.pay.finalized","bnb.pay.recovery_required",
    "bnb.pay.failure_requires_reconciliation","bnb.booking.replacement_requested",
    "bnb.hold.created","bnb.discovery.changed","bnb.message.created",
})
WORKER=re.compile(r"[a-zA-Z0-9_.:-]{1,80}\Z")
CONSUMER=re.compile(r"[a-z][a-z0-9_.-]{1,63}\Z")

class DeliveryError(RuntimeError):
    pass

def _identity(value, pattern, code):
    if not isinstance(value,str) or not pattern.fullmatch(value):
        raise DeliveryError(code)
    return value

def _event(event):
    if event["event_type"] not in EVENT_TYPES:
        raise DeliveryError("EVENT_NOT_ALLOWLISTED")
    payload=event["payload"]
    if not isinstance(payload,dict) or not payload or len(json.dumps(payload))>4096:
        raise DeliveryError("PAYLOAD_INVALID")
    if any(k.lower() in ("password","secret","token","authorization","address","email","phone","private_key") for k in payload):
        raise DeliveryError("PRIVATE_PAYLOAD_FORBIDDEN")
    for k,v in payload.items():
        if not isinstance(k,str) or len(k)>80 or isinstance(v,(dict,list)) or len(str(v))>256:
            raise DeliveryError("PAYLOAD_INVALID")
    return json.dumps({"id":str(event["id"]),"type":event["event_type"],"payload":payload},sort_keys=True,separators=(",",":"))

def claim(conn,worker,*,limit=10,lease_seconds=60):
    _identity(worker,WORKER,"WORKER_INVALID")
    if type(limit) is not int or not 1<=limit<=100 or type(lease_seconds) is not int or not 10<=lease_seconds<=300:
        raise DeliveryError("CLAIM_BOUNDS")
    rows=conn.execute("""
      WITH due AS (
        SELECT id FROM bnb_outbox
        WHERE delivered_at IS NULL AND dead_lettered_at IS NULL
          AND available_at <= now()
          AND (lease_expires_at IS NULL OR lease_expires_at < now())
        ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT %s
      ) UPDATE bnb_outbox b
        SET lease_owner=%s,lease_expires_at=now()+(%s * interval '1 second'),
            attempts=b.attempts+1
        FROM due WHERE b.id=due.id
        RETURNING b.id,b.event_type,b.payload,b.attempts
    """,(limit,worker,lease_seconds)).fetchall()
    return [{"id":x[0],"event_type":x[1],"payload":x[2],"attempts":x[3]} for x in rows]

def acknowledge(conn,event_id,worker,consumer,receipt):
    _identity(worker,WORKER,"WORKER_INVALID")
    _identity(consumer,CONSUMER,"CONSUMER_INVALID")
    if not isinstance(receipt,str) or not 1<=len(receipt)<=256:
        raise DeliveryError("RECEIPT_INVALID")
    event_id=UUID(str(event_id))
    row=conn.execute("""SELECT event_type,payload FROM bnb_outbox
      WHERE id=%s AND lease_owner=%s AND lease_expires_at>now()
        AND delivered_at IS NULL AND dead_lettered_at IS NULL FOR UPDATE""",(event_id,worker)).fetchone()
    if row is None:
        raise DeliveryError("LEASE_LOST")
    encoded=_event({"id":event_id,"event_type":row[0],"payload":row[1]})
    digest=hashlib.sha256((encoded+"|"+consumer+"|"+receipt).encode()).hexdigest()
    prior=conn.execute("SELECT receipt_digest FROM bnb_outbox_receipt WHERE event_id=%s AND consumer=%s FOR UPDATE",(event_id,consumer)).fetchone()
    if prior and prior[0]!=digest:
        raise DeliveryError("RECEIPT_CONFLICT")
    conn.execute("""INSERT INTO bnb_outbox_receipt(event_id,consumer,receipt_digest)
      VALUES (%s,%s,%s) ON CONFLICT DO NOTHING""",(event_id,consumer,digest))
    conn.execute("""UPDATE bnb_outbox SET delivered_at=now(),delivered_by=%s,
      lease_owner=NULL,lease_expires_at=NULL,failure_code=NULL WHERE id=%s""",(consumer,event_id))
    return digest

def fail(conn,event_id,worker,code):
    _identity(worker,WORKER,"WORKER_INVALID")
    _identity(code,CONSUMER,"FAILURE_CODE_INVALID")
    event_id=UUID(str(event_id))
    row=conn.execute("""SELECT attempts FROM bnb_outbox WHERE id=%s AND lease_owner=%s
      AND lease_expires_at>now() AND delivered_at IS NULL AND dead_lettered_at IS NULL
      FOR UPDATE""",(event_id,worker)).fetchone()
    if row is None: raise DeliveryError("LEASE_LOST")
    attempts=row[0]
    seconds=min(3600,2**min(attempts,12))
    conn.execute("""UPDATE bnb_outbox SET lease_owner=NULL,lease_expires_at=NULL,
       failure_code=%s, available_at=now()+(%s*interval '1 second'),
       dead_lettered_at=CASE WHEN attempts>=%s THEN now() ELSE NULL END
       WHERE id=%s""",(code,seconds,MAX_ATTEMPTS,event_id))
    return "dead_letter" if attempts>=MAX_ATTEMPTS else "retry"

def replay(conn,event_id,actor,reason,*,authorize=None):
    """Manual redrive requires caller's independent operational authorization.

    This primitive does not expose an HTTP endpoint or grant that authorization.
    """
    _identity(actor,WORKER,"ACTOR_INVALID")
    if not isinstance(reason,str) or not 5<=len(reason)<=200: raise DeliveryError("REASON_INVALID")
    if authorize is None or not callable(authorize) or authorize(actor,reason) is not True:
        raise DeliveryError("REPLAY_AUTHORITY_REQUIRED")
    event_id=UUID(str(event_id))
    updated=conn.execute("""UPDATE bnb_outbox SET dead_lettered_at=NULL,attempts=0,
        available_at=now(),lease_owner=NULL,lease_expires_at=NULL,
        failure_code=NULL WHERE id=%s AND delivered_at IS NULL
        AND dead_lettered_at IS NOT NULL RETURNING id""",(event_id,)).fetchone()
    if updated is None: raise DeliveryError("REPLAY_NOT_ELIGIBLE")
    conn.execute("INSERT INTO bnb_audit(id,subject,action,resource_id) VALUES (gen_random_uuid(),%s,'bnb.outbox.manual_replay',%s)",(actor,event_id))
    return True

def process_batch(connect, worker, adapter, *, consumer="bnb-local-projection", limit=10):
    """Commit the claim before any adapter interaction, then fence each receipt.

    `connect` yields fresh psycopg connections; caller controls approved database
    credentials. `adapter.accept` must atomically deduplicate by event_id and
    return an opaque durable receipt. No network provider is configured here.
    """
    _identity(worker,WORKER,"WORKER_INVALID")
    _identity(consumer,CONSUMER,"CONSUMER_INVALID")
    with connect() as c:
        claimed=claim(c,worker,limit=limit)
    results=[]
    for event in claimed:
        try:
            encoded=_event(event)
            receipt=adapter.accept(str(event["id"]),encoded)
            with connect() as c:
                acknowledge(c,event["id"],worker,consumer,receipt)
            results.append((str(event["id"]),"delivered"))
        except DeliveryError as exc:
            # Unknown/unsafe event types and malformed payloads are isolated
            # rather than blocking the remainder of the outbox indefinitely.
            if str(exc)=="LEASE_LOST":
                results.append((str(event["id"]),"lease_lost"))
                continue
            with connect() as c:
                fail(c,event["id"],worker,"invalid_event")
            results.append((str(event["id"]),"retry_or_dead_letter"))
        except Exception:
            # A crash after accept but before ack is at-least-once delivery;
            # consumers must deduplicate the immutable event ID.
            with connect() as c:
                try:
                    fail(c,event["id"],worker,"provider_unavailable")
                except DeliveryError as exc:
                    if str(exc)!="LEASE_LOST": raise
            results.append((str(event["id"]),"retry_or_dead_letter"))
    return results
