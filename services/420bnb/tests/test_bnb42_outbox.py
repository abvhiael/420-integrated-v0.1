"""BNB-4.2 PostgreSQL qualification: competing claims, replay, recovery and poison payloads."""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest

SPEC=importlib.util.spec_from_file_location("bnb42_outbox",Path(__file__).resolve().parents[1]/"outbox.py")
outbox=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(outbox)

@pytest.fixture
def database():
    dsn=os.getenv("BNB_DATABASE_URL")
    if not dsn: pytest.skip("needs local PostgreSQL")
    return dsn

def enqueue(conn,payload=None,event_type="bnb.hold.created"):
    eid=uuid4()
    conn.execute("INSERT INTO bnb_outbox(id,event_type,payload) VALUES (%s,%s,%s::jsonb)",
                 (eid,event_type,__import__("json").dumps(payload or {"hold_id":str(uuid4())})))
    return eid

def test_competing_worker_reclaim_and_fencing(database):
    with psycopg.connect(database) as c:
        eid=enqueue(c)
    with psycopg.connect(database) as a,psycopg.connect(database) as b:
        got=outbox.claim(a,"worker-one",limit=100)
        assert eid in [x["id"] for x in got]
        a.commit()
        assert eid not in [x["id"] for x in outbox.claim(b,"worker-two",limit=100)]
        b.commit()
        with pytest.raises(outbox.DeliveryError,match="LEASE_LOST"):
            outbox.acknowledge(b,eid,"worker-two","local","receipt")
        b.rollback()
        a.execute("UPDATE bnb_outbox SET lease_expires_at=now()-interval '1 second' WHERE id=%s",(eid,))
        a.commit()
        assert eid in [x["id"] for x in outbox.claim(b,"worker-two",limit=100)]
        b.commit()
        with pytest.raises(outbox.DeliveryError,match="LEASE_LOST"):
            outbox.acknowledge(a,eid,"worker-one","local","receipt")
        a.rollback()
        assert outbox.acknowledge(b,eid,"worker-two","local","receipt")
        b.commit()
        assert eid not in [x["id"] for x in outbox.claim(a,"worker-one",limit=100)]
        a.commit()

def test_retry_dead_letter_and_manual_replay(database):
    with psycopg.connect(database) as c:
        eid=enqueue(c)
        assert eid in [x["id"] for x in outbox.claim(c,"retry-worker",limit=100)]
        for attempt in range(1,outbox.MAX_ATTEMPTS+1):
            if attempt>1:
                c.execute("UPDATE bnb_outbox SET available_at=now()-interval '1 second' WHERE id=%s",(eid,))
                assert eid in [x["id"] for x in outbox.claim(c,"retry-worker",limit=100)]
            state=outbox.fail(c,eid,"retry-worker","provider_unavailable")
        assert state=="dead_letter"
        assert not outbox.claim(c,"retry-worker",limit=100)
        with pytest.raises(outbox.DeliveryError,match="REPLAY_AUTHORITY_REQUIRED"):\n            outbox.replay(c,eid,"unverified-operator","documented incident recovery")\n        assert outbox.replay(c,eid,"approved-local-operator","documented incident recovery",authorize=lambda actor,reason: actor=="approved-local-operator" and reason=="documented incident recovery")
        assert eid in [x["id"] for x in outbox.claim(c,"retry-worker",limit=100)]
        assert outbox.acknowledge(c,eid,"retry-worker","local","durable-receipt")
        with pytest.raises(outbox.DeliveryError,match="REPLAY_NOT_ELIGIBLE"):
            outbox.replay(c,eid,"approved-local-operator","documented incident recovery",authorize=lambda actor,reason:True)

def test_poison_payload_rejected_and_unapproved_consumer(database):
    with psycopg.connect(database) as c:
        eid=enqueue(c,{"secret":"never-publish"})
        events=outbox.claim(c,"redactor-worker",limit=100)
        event=next(x for x in events if x["id"]==eid)
        with pytest.raises(outbox.DeliveryError,match="PRIVATE_PAYLOAD_FORBIDDEN"):
            outbox._event(event)
        with pytest.raises(outbox.DeliveryError,match="CONSUMER_INVALID"):
            outbox.acknowledge(c,eid,"redactor-worker","https://untrusted.example","receipt")
        assert outbox.fail(c,eid,"redactor-worker","payload_invalid")=="retry"

def test_wrong_worker_out_of_order_receipt_protection(database):
    with psycopg.connect(database) as c:
        eid=enqueue(c)
        assert eid in [x["id"] for x in outbox.claim(c,"fence-worker",limit=100)]
        with pytest.raises(outbox.DeliveryError,match="LEASE_LOST"):
            outbox.acknowledge(c,eid,"wrong-worker","local","receipt")
        c.rollback()
        assert eid in [x["id"] for x in outbox.claim(c,"fence-worker",limit=100)]
        assert outbox.acknowledge(c,eid,"fence-worker","local","receipt")
