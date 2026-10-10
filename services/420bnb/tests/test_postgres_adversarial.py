"""Postgres-backed negative/adversarial booking invariants with signed synthetic ingress."""
import hashlib
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import Encoding,PublicFormat
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
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    monkeypatch.setenv("BNB_IDENTITY_PUBLIC_KEY_PEM",key.public_key().public_bytes(Encoding.PEM,PublicFormat.SubjectPublicKeyInfo).decode())
    monkeypatch.setenv("BNB_IDENTITY_ISSUER","https://identity.test.invalid")
    monkeypatch.setenv("BNB_IDENTITY_AUDIENCE","420bnb")
    now=int(time.time())
    token=jwt.encode(dict(sub="guest-fixture",iss="https://identity.test.invalid",aud="420bnb",iat=now,nbf=now,exp=now+300,jti="bnb-fixture-session"),key,algorithm="RS256")
    headers={"authorization":"Bearer "+token}
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("INSERT INTO bnb_account(subject) VALUES ('guest-fixture') ON CONFLICT DO NOTHING")
        c.execute("INSERT INTO bnb_identity_session(id,subject,issuer,issuer_session_id,expires_at) VALUES (%s,'guest-fixture','https://identity.test.invalid','bnb-fixture-session',now()+interval '5 minutes') ON CONFLICT(issuer,issuer_session_id) DO UPDATE SET expires_at=excluded.expires_at,revoked_at=NULL",(uuid4(),))
    pid=uuid4()
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,status,capacity,nightly_minor,currency)
        VALUES (%s,'verified-host','Synthetic suite','Public region','published',1,1000,'CAD')""",(pid,))
    yield pid,headers
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("DELETE FROM bnb_outbox WHERE payload->>'hold_id' IN (SELECT id::text FROM bnb_hold WHERE property_id=%s)",(pid,))
        c.execute("DELETE FROM bnb_request_dedupe WHERE actor='guest-fixture'")
        c.execute("DELETE FROM bnb_hold WHERE property_id=%s",(pid,))
        c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))
        c.execute("DELETE FROM bnb_identity_session WHERE subject='guest-fixture'")
        c.execute("DELETE FROM bnb_account WHERE subject='guest-fixture'")

def auth(headers,subject="guest-fixture",role="guest"):
    return dict(headers)

def payload(pid):
    start=(datetime.now(timezone.utc)+timedelta(days=8)).replace(microsecond=0)
    return {"property_id":str(pid),"start":start.isoformat(),"end":(start+timedelta(days=2)).isoformat(),
            "units":1,"policy_snapshot":"fixture policy v1"}

def test_forged_identity_fails(fixture_property):
    pid,secret=fixture_property
    headers={"x-authenticated-subject":"other-guest"}
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


def test_independent_http_clients_share_postgresql_capacity_lock(fixture_property):
    """Separate HTTP test clients, concurrent DB connections, one capacity slot."""
    pid,headers=fixture_property
    request=payload(pid)
    clients=[TestClient(api.app) for _ in range(8)]
    def send(i):
        return clients[i].post("/v1/bnb/holds",json=request,
            headers={**headers,"idempotency-key":f"independent-client-{i:03d}"})
    with ThreadPoolExecutor(max_workers=8) as executor:
        outcomes=list(executor.map(send,range(8)))
    assert sorted(x.status_code for x in outcomes)==[201]+[409]*7
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as connection:
        allocated=connection.execute("SELECT COALESCE(SUM(units),0) FROM bnb_hold WHERE property_id=%s",
                                     (pid,)).fetchone()[0]
        assert allocated==1


def test_two_actual_server_processes_share_postgres_lock(fixture_property):
    """Two distinct uvicorn OS processes race on one PostgreSQL capacity slot."""
    import subprocess
    import sys
    import socket
    import urllib.request
    import urllib.error
    import json
    pid,headers=fixture_property
    def free_port():
        with socket.socket() as sock:
            sock.bind(("127.0.0.1",0))
            return sock.getsockname()[1]
    ports=[free_port(),free_port()]
    processes=[]
    service_dir=str(Path(__file__).resolve().parents[1])
    try:
        for port in ports:
            processes.append(subprocess.Popen([sys.executable,"-m","uvicorn","api:app",
                "--host","127.0.0.1","--port",str(port)],
                cwd=service_dir,env=os.environ.copy(),stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL))
        for port in ports:
            for attempt in range(60):
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{port}/health/ready",timeout=1) as ready:
                        if ready.status==200:break
                except (OSError,urllib.error.URLError):
                    time.sleep(.2)
            else:pytest.fail(f"uvicorn instance on {port} not ready")
        body=json.dumps(payload(pid)).encode()
        def send(i):
            request=urllib.request.Request(
                f"http://127.0.0.1:{ports[i%2]}/v1/bnb/holds",data=body,
                headers={**headers,"idempotency-key":f"multiproc-lock-{i:03d}",
                         "content-type":"application/json"},method="POST")
            try:
                with urllib.request.urlopen(request,timeout=20) as response:return response.status
            except urllib.error.HTTPError as error:return error.code
        with ThreadPoolExecutor(max_workers=8) as executor:
            outcomes=list(executor.map(send,range(8)))
        assert sorted(outcomes)==[201]+[409]*7,outcomes
    finally:
        for process in processes:
            process.terminate()
        for process in processes:
            try:process.wait(timeout=5)
            except subprocess.TimeoutExpired:process.kill();process.wait()


def test_unit_specific_capacity_and_cross_unit_isolation(fixture_property):
    pid,headers=fixture_property
    unit_a,unit_b=uuid4(),uuid4()
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("UPDATE bnb_property SET capacity=3 WHERE id=%s",(pid,))
        c.execute("INSERT INTO bnb_unit(id,property_id,label,quantity) VALUES (%s,%s,'Cabin A',1),(%s,%s,'Cabin B',2)",
                  (unit_a,pid,unit_b,pid))
    try:
        base=payload(pid)
        assert client.post("/v1/bnb/holds",json=base,
            headers={**headers,"idempotency-key":"unit-missing-0001"}).status_code==422
        first=client.post("/v1/bnb/holds",json={**base,"unit_id":str(unit_a)},
            headers={**headers,"idempotency-key":"unit-a-first-0001"})
        assert first.status_code==201,first.text
        full=client.post("/v1/bnb/holds",json={**base,"unit_id":str(unit_a)},
            headers={**headers,"idempotency-key":"unit-a-full-00002"})
        assert full.status_code==409 and full.json()["detail"]=="CAPACITY_EXHAUSTED"
        second=client.post("/v1/bnb/holds",json={**base,"unit_id":str(unit_b),"units":2},
            headers={**headers,"idempotency-key":"unit-b-second-0001"})
        assert second.status_code==201,second.text
        third=client.post("/v1/bnb/holds",json={**base,"unit_id":str(unit_b)},
            headers={**headers,"idempotency-key":"unit-b-overbook-001"})
        assert third.status_code==409
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            rows=c.execute("SELECT unit_id,SUM(units) FROM bnb_hold WHERE property_id=%s GROUP BY unit_id",
                           (pid,)).fetchall()
            assert {str(unit):count for unit,count in rows}=={str(unit_a):1,str(unit_b):2}
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_outbox WHERE payload->>'hold_id' IN (SELECT id::text FROM bnb_hold WHERE property_id=%s)",(pid,))
            c.execute("DELETE FROM bnb_hold WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_unit WHERE property_id=%s",(pid,))


def test_bnb23_peak_concurrent_quantity_half_open_boundaries():
    start=datetime(2027,1,10,tzinfo=timezone.utc)
    end=start+timedelta(days=4)
    intervals=[
        (start,start+timedelta(days=2),2),
        (start+timedelta(days=2),end,2),
    ]
    assert api.peak_occupied_units(intervals,start,end)==2
    assert api.peak_occupied_units(intervals,start+timedelta(days=1),
                                   start+timedelta(days=3))==2
    assert api.peak_occupied_units([
        (start,start+timedelta(days=3),1),
        (start+timedelta(days=1),end,2),
    ],start,end)==3
    assert api.peak_occupied_units([(end,end+timedelta(days=1),5)],start,end)==0
