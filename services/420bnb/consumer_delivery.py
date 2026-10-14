"""BNB-5.3 independent subscriptions and fenced durable delivery; no network transport."""
import hashlib
import json
from uuid import UUID
import outbox

DeliveryError = outbox.DeliveryError
MAX_CONSUMERS = 64


def _transaction(conn):
    # Multi-statement enrollment/receipt writes must never run piecemeal.
    if conn.autocommit:
        raise DeliveryError('TRANSACTION_REQUIRED')


def _authorize(authorize, actor, action, consumer):
    outbox._identity(actor, outbox.WORKER, 'ACTOR_INVALID')
    outbox._identity(consumer, outbox.CONSUMER, 'CONSUMER_INVALID')
    if not callable(authorize) or authorize(actor, action, consumer) is not True:
        raise DeliveryError('CONSUMER_AUTHORITY_REQUIRED')


def configure(conn, consumer, event_types, *, active, expected_revision, actor, authorize=None):
    """Trusted configuration boundary, not an HTTP authority or external approval.

    No caller-supplied boolean approval. Caller must establish independent authority.
    CAS revision fences concurrent/replayed changes; identical current config is idempotent.
    """
    _transaction(conn)
    _authorize(authorize, actor, 'configure', consumer)
    if (type(active) is not bool or type(expected_revision) is not int or expected_revision < 0
            or not isinstance(event_types, (list, tuple)) or not 1 <= len(event_types) <= 32
            or any(not isinstance(t, str) or t not in outbox.EVENT_TYPES for t in event_types)
            or len(set(event_types)) != len(event_types)):
        raise DeliveryError('SUBSCRIPTION_INVALID')
    kinds = sorted(event_types)
    # Serializes bounded registry mutation without locking events in reverse order.
    conn.execute('SELECT pg_advisory_xact_lock(420503)')
    row = conn.execute('SELECT revision,active,event_types FROM bnb_consumer_subscription WHERE consumer=%s FOR UPDATE', (consumer,)).fetchone()
    actual = row[0] if row else 0
    if actual != expected_revision:
        raise DeliveryError('SUBSCRIPTION_REVISION_CONFLICT')
    if row and row[1] == active and row[2] == kinds:
        return actual
    if not row and conn.execute('SELECT count(*) FROM bnb_consumer_subscription').fetchone()[0] >= MAX_CONSUMERS:
        raise DeliveryError('SUBSCRIPTION_LIMIT')
    revision = actual + 1
    conn.execute('''INSERT INTO bnb_consumer_subscription(consumer,revision,active,event_types)
        VALUES (%s,%s,%s,%s) ON CONFLICT(consumer) DO UPDATE SET revision=excluded.revision,
        active=excluded.active,event_types=excluded.event_types,updated_at=clock_timestamp()''',
        (consumer, revision, active, kinds))
    conn.execute('''INSERT INTO bnb_consumer_subscription_history(consumer,revision,active,event_types,actor)
        VALUES (%s,%s,%s,%s,%s)''', (consumer, revision, active, kinds, actor))
    return revision


def _subscription(conn, consumer):
    outbox._identity(consumer, outbox.CONSUMER, 'CONSUMER_INVALID')
    row = conn.execute('SELECT revision,active FROM bnb_consumer_subscription WHERE consumer=%s FOR SHARE', (consumer,)).fetchone()
    if not row or not row[1]:
        raise DeliveryError('CONSUMER_REVOKED')
    return row[0]


def envelope_digest(event):
    # Hash only: poison payloads can be isolated/retried by each worker without blocking enrollment.
    encoded = json.dumps({'id': str(event['id']), 'type': event['event_type'], 'payload': event['payload']},
                         sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(encoded.encode()).hexdigest()


def enroll(conn, *, limit=100):
    """Snapshot all current subscriptions once, atomically with managed admission.

    No empty fanout, no historical acceptance/backfill, no automatic late-subscriber replay.
    Registry SHARE locks and event locks serialize against revocation and other enrollments.
    """
    _transaction(conn)
    if type(limit) is not int or not 1 <= limit <= 100:
        raise DeliveryError('CLAIM_BOUNDS')
    conn.execute('SELECT pg_advisory_xact_lock_shared(420503)')
    rows = conn.execute('''SELECT b.id,b.event_type,b.payload FROM bnb_outbox b
        WHERE NOT b.consumer_managed AND b.delivered_at IS NULL AND b.dead_lettered_at IS NULL
          AND (b.lease_expires_at IS NULL OR b.lease_expires_at<clock_timestamp())
          AND EXISTS(SELECT 1 FROM bnb_consumer_subscription s WHERE s.active AND b.event_type=ANY(s.event_types))
        ORDER BY b.created_at,b.id LIMIT %s FOR UPDATE OF b SKIP LOCKED''', (limit,)).fetchall()
    count = 0
    for eid, kind, payload in rows:
        subscribers = conn.execute('''SELECT consumer,revision FROM bnb_consumer_subscription
            WHERE active AND %s=ANY(event_types) ORDER BY consumer FOR SHARE''', (kind,)).fetchall()
        if not subscribers:
            continue
        digest = envelope_digest({'id': eid, 'event_type': kind, 'payload': payload})
        for consumer, revision in subscribers:
            conn.execute('''INSERT INTO bnb_consumer_delivery(event_id,consumer,subscription_revision,envelope_digest)
                VALUES (%s,%s,%s,%s)''', (eid, consumer, revision, digest))
        conn.execute('''UPDATE bnb_outbox SET consumer_managed=true,lease_owner=NULL,lease_expires_at=NULL
            WHERE id=%s''', (eid,))
        count += 1
    return count


def claim(conn, worker, consumer, *, limit=1, lease_seconds=30):
    _transaction(conn)
    outbox._identity(worker, outbox.WORKER, 'WORKER_INVALID')
    if (type(limit) is not int or not 1 <= limit <= 100 or type(lease_seconds) is not int
            or not 10 <= lease_seconds <= 300):
        raise DeliveryError('CLAIM_BOUNDS')
    revision = _subscription(conn, consumer)
    # Each consumer owns its own retry budget, including crashes without explicit fail.
    conn.execute('''UPDATE bnb_consumer_delivery SET dead_lettered_at=clock_timestamp(),
        failure_code='attempts_exhausted',lease_owner=NULL,lease_expires_at=NULL
        WHERE consumer=%s AND subscription_revision=%s AND accepted_at IS NULL
          AND dead_lettered_at IS NULL AND attempts>=%s
          AND (lease_expires_at IS NULL OR lease_expires_at<clock_timestamp())''',
        (consumer, revision, outbox.MAX_ATTEMPTS))
    rows = conn.execute('''SELECT b.id,b.event_type,b.payload,d.attempts,d.envelope_digest
        FROM bnb_consumer_delivery d JOIN bnb_outbox b ON b.id=d.event_id
        WHERE d.consumer=%s AND d.subscription_revision=%s AND b.consumer_managed
          AND d.accepted_at IS NULL AND d.dead_lettered_at IS NULL
          AND d.available_at<=clock_timestamp()
          AND (d.lease_expires_at IS NULL OR d.lease_expires_at<clock_timestamp())
        ORDER BY d.available_at,d.event_id LIMIT %s FOR UPDATE OF b,d SKIP LOCKED''',
        (consumer, revision, limit)).fetchall()
    result = []
    for eid, kind, payload, attempts, digest in rows:
        conn.execute('''UPDATE bnb_consumer_delivery SET lease_owner=%s,
            lease_expires_at=clock_timestamp()+(%s*interval '1 second'),attempts=attempts+1
            WHERE event_id=%s AND consumer=%s''', (worker, lease_seconds, eid, consumer))
        result.append({'id': eid, 'event_type': kind, 'payload': payload,
                       'attempts': attempts+1, 'envelope_digest': digest})
    return result


def _locked(conn, event_id, consumer, worker, *, verify_envelope=True):
    outbox._identity(worker, outbox.WORKER, 'WORKER_INVALID')
    revision = _subscription(conn, consumer)
    eid = UUID(str(event_id))
    event = conn.execute('SELECT event_type,payload,consumer_managed FROM bnb_outbox WHERE id=%s FOR UPDATE', (eid,)).fetchone()
    row = conn.execute('''SELECT subscription_revision,envelope_digest,attempts,lease_owner,
        lease_expires_at,accepted_at,receipt_digest,completed_by,dead_lettered_at
        FROM bnb_consumer_delivery WHERE event_id=%s AND consumer=%s FOR UPDATE''', (eid, consumer)).fetchone()
    if not event or not event[2] or not row or row[0] != revision:
        raise DeliveryError('DELIVERY_NOT_AUTHORIZED')
    if not conn.execute('SELECT %s=ANY(event_types) FROM bnb_consumer_subscription WHERE consumer=%s', (event[0], consumer)).fetchone()[0]:
        raise DeliveryError('DELIVERY_NOT_AUTHORIZED')
    if verify_envelope and envelope_digest({'id': eid, 'event_type': event[0], 'payload': event[1]}) != row[1]:
        raise DeliveryError('EVENT_CHANGED')
    return eid, row


def renew(conn, event_id, worker, consumer, *, lease_seconds=30):
    _transaction(conn)
    if type(lease_seconds) is not int or not 10 <= lease_seconds <= 300:
        raise DeliveryError('CLAIM_BOUNDS')
    eid, _ = _locked(conn, event_id, consumer, worker)
    updated = conn.execute('''UPDATE bnb_consumer_delivery
        SET lease_expires_at=clock_timestamp()+(%s*interval '1 second')
        WHERE event_id=%s AND consumer=%s AND lease_owner=%s AND lease_expires_at>clock_timestamp()
          AND accepted_at IS NULL AND dead_lettered_at IS NULL RETURNING event_id''',
        (lease_seconds, eid, consumer, worker)).fetchone()
    if not updated:
        raise DeliveryError('LEASE_LOST')
    return True


def acknowledge(conn, event_id, worker, consumer, receipt):
    _transaction(conn)
    if not isinstance(receipt, str) or not 1 <= len(receipt) <= 256:
        raise DeliveryError('RECEIPT_INVALID')
    eid, row = _locked(conn, event_id, consumer, worker)
    digest = hashlib.sha256((row[1]+'|'+consumer+'|'+receipt).encode()).hexdigest()
    if row[5] is not None:
        if row[7] != worker:
            raise DeliveryError('LEASE_LOST')
        if row[6] != digest:
            raise DeliveryError('RECEIPT_CONFLICT')
        return digest
    updated = conn.execute('''UPDATE bnb_consumer_delivery SET accepted_at=clock_timestamp(),
        receipt_digest=%s,completed_by=%s,lease_owner=NULL,lease_expires_at=NULL,failure_code=NULL
        WHERE event_id=%s AND consumer=%s AND lease_owner=%s AND lease_expires_at>clock_timestamp()
          AND accepted_at IS NULL AND dead_lettered_at IS NULL RETURNING event_id''',
        (digest, worker, eid, consumer, worker)).fetchone()
    if not updated:
        raise DeliveryError('LEASE_LOST')
    # An event is complete only if every snapshotted delivery has its own durable receipt.
    conn.execute('''UPDATE bnb_outbox b SET delivered_at=clock_timestamp(),delivered_by='all-consumers'
        WHERE id=%s AND consumer_managed AND delivered_at IS NULL
          AND EXISTS(SELECT 1 FROM bnb_consumer_delivery d WHERE d.event_id=b.id)
          AND NOT EXISTS(SELECT 1 FROM bnb_consumer_delivery d WHERE d.event_id=b.id AND d.accepted_at IS NULL)''', (eid,))
    return digest


def fail(conn, event_id, worker, consumer, code):
    _transaction(conn)
    outbox._identity(code, outbox.CONSUMER, 'FAILURE_CODE_INVALID')
    eid, row = _locked(conn, event_id, consumer, worker, verify_envelope=False)
    delay = min(3600, 2**min(row[2], 12))
    updated = conn.execute('''UPDATE bnb_consumer_delivery SET lease_owner=NULL,lease_expires_at=NULL,
        failure_code=%s,available_at=clock_timestamp()+(%s*interval '1 second'),
        dead_lettered_at=CASE WHEN attempts>=%s THEN clock_timestamp() ELSE NULL END
        WHERE event_id=%s AND consumer=%s AND lease_owner=%s AND lease_expires_at>clock_timestamp()
          AND accepted_at IS NULL AND dead_lettered_at IS NULL RETURNING event_id''',
        (code, delay, outbox.MAX_ATTEMPTS, eid, consumer, worker)).fetchone()
    if not updated:
        raise DeliveryError('LEASE_LOST')
    return 'dead_letter' if row[2] >= outbox.MAX_ATTEMPTS else 'retry'


def replay(conn, event_id, consumer, *, actor, reason, authorize=None):
    _transaction(conn)
    _authorize(authorize, actor, 'replay', consumer)
    if not isinstance(reason, str) or not 5 <= len(reason) <= 200:
        raise DeliveryError('REASON_INVALID')
    revision = _subscription(conn, consumer)
    eid = UUID(str(event_id))
    event = conn.execute('SELECT event_type FROM bnb_outbox WHERE id=%s FOR UPDATE', (eid,)).fetchone()
    if not event or not conn.execute('SELECT %s=ANY(event_types) FROM bnb_consumer_subscription WHERE consumer=%s', (event[0], consumer)).fetchone()[0]:
        raise DeliveryError('DELIVERY_NOT_AUTHORIZED')
    row = conn.execute('''SELECT subscription_revision,accepted_at,dead_lettered_at,lease_expires_at
        FROM bnb_consumer_delivery WHERE event_id=%s AND consumer=%s FOR UPDATE''', (eid, consumer)).fetchone()
    if not row or row[1] is not None or (row[2] is None and row[0] == revision):
        raise DeliveryError('REPLAY_NOT_ELIGIBLE')
    if conn.execute('SELECT %s::timestamptz>clock_timestamp()', (row[3],)).fetchone()[0]:
        raise DeliveryError('LEASE_STILL_ACTIVE')
    conn.execute('''UPDATE bnb_consumer_delivery SET subscription_revision=%s,attempts=0,
        available_at=clock_timestamp(),lease_owner=NULL,lease_expires_at=NULL,
        dead_lettered_at=NULL,failure_code=NULL WHERE event_id=%s AND consumer=%s''', (revision, eid, consumer))
    conn.execute("INSERT INTO bnb_audit(id,subject,action,resource_id) VALUES(gen_random_uuid(),%s,%s,%s)",
                 (actor, 'bnb.consumer.replay.'+consumer, eid))
    return True
