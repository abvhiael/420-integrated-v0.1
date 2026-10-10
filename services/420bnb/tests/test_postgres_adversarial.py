"""Postgres-backed negative/adversarial booking invariants with signed synthetic ingress."""
import hashlib
import hmac
import importlib.util
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
from pathlib import Path
from uuid import uuid4
import psycopg
import pytest
from fastapi.testclient import TestClient

spec=importlib.util.spec_from_file_location("bnb_api",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
client=TestClient(api.app)

@pytest.fixture()
def fixture_property(monkeypatch):
    if not os.environ.get("BNB_DATABASE_URL"):pytest.skip("Postgres integration requires BNB_DATABASE_URL")
    secret="test-only-"+("x"*40);monkeypatch.setenv("BNB_IDENTITY_ASSERTION_SECRET",secret)
    pid=uuid4()
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,status,capacity,nightly_minor,currency)
        VALUES (%s,'verified-host','Synthetic suite','Public region','published',1,1000,'CAD')""",(pid,))
    yield pid,secret
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("DELETE FROM bnb_outbox WHERE payload->>'hold_id' IN (SELECT id::text FROM bnb_hold WHERE property_id=%s)",(pid,))
        c.execute("DELETE FROM bnb_request_dedupe WHERE actor='guest-fixture'")
        c.execute("DELETE FROM bnb_hold WHERE property_id=%s",(pid,))
        c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))

def auth(secret,subject="guest-fixture",role="guest"):
    at=str(int(time.time()))
    signature=hmac.new(secret.encode(),f"bnb-v1\\n{subject}\\n{role}\\n{at}".encode(),hashlib.sha256).hexdigest()
    return {"x-authenticated-subject":subject,"x-authenticated-role":role,
            "x-authenticated-at":at,"x-authenticated-signature":signature}

def payload(pid):
    start=(datetime.now(timezone.utc)+timedelta(days=8)).replace(microsecond=0)
    return {"property_id":str(pid),"start":start.isoformat(),"end":(start+timedelta(days=2)).isoformat(),
            "units":1,"policy_snapshot":"fixture policy v1"}

def test_forged_identity_fails(fixture_property):
    pid,secret=fixture_property
    headers=auth(secret);headers["x-authenticated-subject"]="other-guest"
    headers["idempotency-key"]="forged-id-123"
    response=client.post("/v1/bnb/holds",headers=headers,json=payload(pid))
    assert response.status_code==401

def test_idempotency_and_capacity(fixture_property):
    pid,secret=fixture_property
    request=payload(pid);headers={**auth(secret),"idempotency-key":"same-hold-key-0001"}
    first=client.post("/v1/bnb/holds",json=request,headers=headers)
    assert first.status_code==201,first.text
    again=client.post("/v1/bnb/holds",json=request,headers=headers)
    assert again.status_code==201 and again.json()==first.json()
    altered=dict(request,units=2)
    reused=client.post("/v1/bnb/holds",json=altered,headers=headers)
    assert reused.status_code==409 and reused.json()["detail"]=="IDEMPOTENCY_CONFLICT"
    full=client.post("/v1/bnb/holds",json=request,headers={**auth(secret),"idempotency-key":"different-key-0002"})
    assert full.status_code==409 and full.json()["detail"]=="CAPACITY_EXHAUSTED"

def test_parallel_holds_cannot_overbook(fixture_property):
    pid,secret=fixture_property
    request=payload(pid)
    def send(i):
        return client.post("/v1/bnb/holds",json=request,
                           headers={**auth(secret),"idempotency-key":f"parallel-key-{i:04d}"})
    with ThreadPoolExecutor(max_workers=5) as pool:
        results=list(pool.map(send,range(5)))
    assert sum(x.status_code==201 for x in results)==1,[r.status_code for r in results]
    assert sum(x.status_code==409 for x in results)==4
