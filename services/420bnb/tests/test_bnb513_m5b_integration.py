"""BNB-5.13 accumulated M5-B cross-domain witness.

Real verified-TLS PostgreSQL shared across guest/host, Search/Travel,
notification, signed-observation cursor and independently gated operations.
The browser/axe and network acceptance suites run alongside this test in
bnb-runtime.yml; no fixture proof constitutes independent provider approval.
"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest
from fastapi import HTTPException
from test_bnb55_discovery_feed import database, property_row
from test_bnb32_infrastructure import database as tls_database
import consumer_delivery
import discovery_feed
import discovery_sync
import notification_delivery as notifications
import operational_controls as operations
import pay_observation_worker as pay
import recovery_operations as recovery
import outbox
import worker


def test_m5b_guest_host_consumer_notification_financial_operator_recovery(database, monkeypatch):
    connect, _, _ = database
    guest, host = ("m5b-guest-" + uuid4().hex, "m5b-host-" + uuid4().hex)
    device = "browser-" + uuid4().hex
    hold, request, message, event = (uuid4() for _ in range(4))
    future = datetime.now(timezone.utc) + timedelta(days=4)
    def authorize(actor, action, target):
        return actor == "m5b-fixture" and action == "configure" and target in ("search", "travel")

    # One persisted guest-to-host request under a real PostgreSQL transaction.
    with connect() as c:
        c.execute("INSERT INTO bnb_account(subject) VALUES (%s),(%s)", (guest, host))
        pid = property_row(c)
        c.execute("UPDATE bnb_property SET host_subject=%s WHERE id=%s", (host, pid))
        c.execute("""INSERT INTO bnb_hold
          (id,property_id,guest_subject,period,status,expires_at,quote_total_minor,policy_snapshot)
          VALUES (%s,%s,%s,tstzrange(%s,%s,'[)'),'held',%s,100,'fixture')""",
          (hold,pid,guest,future,future+timedelta(days=1),future))
        c.execute("""INSERT INTO bnb_booking_request
          (id,hold_id,property_id,guest_subject,host_subject,request_type,state,deadline)
          VALUES (%s,%s,%s,%s,%s,'request','requested',%s)""",
          (request,hold,pid,guest,host,future))
        for consumer in ("search","travel"):
            consumer_delivery.configure(c,consumer,["bnb.discovery.changed"],
                active=True,expected_revision=0,actor="m5b-fixture",authorize=authorize)
        assert notifications.register(c,host,device,future)["registered"]
        c.execute("""INSERT INTO bnb_guest_message
          (id,booking_request_id,sender_subject,body,client_nonce)
          VALUES (%s,%s,%s,'private-M5B-must-not-escape','nonce-12345678')""",
          (message,request,guest))
        notifications.enqueue_message(c,request,message,guest)
        initial = discovery_sync.synchronize(c,pid)
        assert initial["revision"] >= 1

    # Different connections mimic process restart and independent consumers.
    with connect() as c:
        notices = notifications.pending(c,host,device)
        assert notices["external_provider"] is False
        assert len(notices["notices"]) == 1
        assert "private-M5B-must-not-escape" not in repr(notices)
        with pytest.raises(HTTPException,match="DEVICE_AUTHORITY_EXPIRED_OR_REVOKED"):
            notifications.pending(c,guest,device)
        nid = notices["notices"][0]["id"]
        assert notifications.ack(c,host,device,nid)["acknowledged"]
        assert notifications.ack(c,host,device,nid)["replayed"]
        for consumer in ("search","travel"):
            item = [x for x in discovery_feed.page(c,consumer)["items"]
                    if x["property_id"] == str(pid)][-1]
            assert "NEVER_EXPORT_PRIVATE_ADDRESS" not in repr(item)
            discovery_sync.consume(c,pid,consumer,item["revision"],item["payload"])

    # Explicit device revocation survives a fresh database connection.
    with connect() as c:
        assert notifications.revoke(c,host,device)["revoked"]
    with connect() as c:
        with pytest.raises(HTTPException,match="DEVICE_AUTHORITY_EXPIRED_OR_REVOKED"):
            notifications.pending(c,host,device)

    # Supervised financial observation is cursor-only until canonical ingress
    # accepts it: no locally fabricated settlement or wallet execution.
    stream = "m5b-" + uuid4().hex
    observation = {"sequence":1,"kind":"finality",
        "payload":{"reservation_id":str(uuid4())},
        "proof":"synthetic-test-proof-no-authority",
        "provider_id":"canonical-420Pay-fixture"}
    with pytest.raises(pay.ReconciliationBlocked,match="PROVIDER_ACCEPTANCE_REQUIRED"):
        pay.once(connect,stream,lambda *_:[observation],lambda *_:{"accepted":False})
    with connect() as c:
        assert pay.checkpoint(c,stream) == 0
    assert pay.once(connect,stream,lambda *_:[observation],
        lambda path,payload,proof:{"accepted":path=="/v1/bnb/internal/pay/finality"})["cursor"] == 1
    with connect() as c:
        assert pay.checkpoint(c,stream) == 1

    # Operator replay is scoped to exactly one dead letter and nonce.
    with connect() as c:
        c.execute("""INSERT INTO bnb_outbox(id,event_type,payload,dead_lettered_at,attempts)
          VALUES(%s,'bnb.hold.created','{"hold_id":"fixture"}'::jsonb,clock_timestamp(),%s)""",
          (event,outbox.MAX_ATTEMPTS))
    with connect() as c:
        assert not recovery.assess(c,action="restore",approved=True).ready
        proof = {"jti":uuid4().hex,"event_id":str(event),"consumer":None}
        assert operations.manual_replay(c,"m5b-operator",proof,event,
            "approved isolated recovery")["replayed"]
        with pytest.raises(HTTPException,match="OPERATOR_NONCE_REPLAY"):
            operations.manual_replay(c,"m5b-operator",proof,event,
                "approved isolated recovery")
    assert worker.Supervisor(connect,worker.LocalValidationSink(connect)).once() == "delivered"
    with connect() as c:
        assert c.execute("SELECT delivered_at IS NOT NULL FROM bnb_outbox WHERE id=%s",
            (event,)).fetchone() == (True,)
        assert c.execute("SELECT state FROM bnb_booking_request WHERE id=%s",
            (request,)).fetchone() == ("requested",)
        assert operations.counts(c)["production_execution"] is False
