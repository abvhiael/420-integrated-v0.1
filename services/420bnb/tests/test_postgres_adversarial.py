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


def test_bnb23_dst_fold_gap_and_local_date():
    from calendar_engine import strict_local_instant,local_stay_window
    with pytest.raises(ValueError,match="NONEXISTENT_LOCAL_TIME"):
        strict_local_instant(datetime(2027,3,14,2,30),"America/New_York")
    with pytest.raises(ValueError,match="AMBIGUOUS_LOCAL_TIME"):
        strict_local_instant(datetime(2027,11,7,1,30),"America/New_York")
    earlier=strict_local_instant(datetime(2027,11,7,1,30),"America/New_York",fold=0)
    later=strict_local_instant(datetime(2027,11,7,1,30),"America/New_York",fold=1)
    assert later-earlier==timedelta(hours=1)
    from datetime import date
    a,z,nights=local_stay_window(date(2027,3,13),date(2027,3,15),"America/New_York")
    assert nights==2 and z>a
    with pytest.raises(ValueError,match="MINIMUM_NIGHTS"):
        local_stay_window(date(2027,3,15),date(2027,3,15),"America/New_York")


def test_bnb23_public_availability_partial_closure_release_and_privacy(fixture_property):
    pid,headers=fixture_property
    uid=uuid4()
    request=payload(pid)
    start=datetime.fromisoformat(request["start"])
    end=datetime.fromisoformat(request["end"])
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("UPDATE bnb_property SET capacity=3,private_address='never return this' WHERE id=%s",(pid,))
        c.execute("INSERT INTO bnb_unit(id,property_id,label,quantity) VALUES (%s,%s,'Suite A',3)",(uid,pid))
        c.execute("""INSERT INTO bnb_block(id,property_id,unit_id,period,reason,quantity)
            VALUES (%s,%s,%s,tstzrange(%s,%s,'[)'),'Partial closure',1)""",
            (uuid4(),pid,uid,start,end))
    try:
        route="/v1/bnb/availability"
        params={"property_id":str(pid),"start":request["start"],"end":request["end"]}
        preview=client.get(route,params=params)
        assert preview.status_code==200,preview.text
        assert preview.json()["units"][0]["available"]==2
        assert "never return this" not in preview.text
        hold=client.post("/v1/bnb/holds",headers={**headers,"idempotency-key":"availability-2.3-001"},
            json={**request,"unit_id":str(uid),"units":2})
        assert hold.status_code==201,hold.text
        assert client.get(route,params=params).json()["units"][0]["available"]==0
        overbook=client.post("/v1/bnb/holds",headers={**headers,"idempotency-key":"availability-2.3-002"},
            json={**request,"unit_id":str(uid),"units":1})
        assert overbook.status_code==409
        released=client.post("/v1/bnb/holds/"+hold.json()["id"]+"/release",headers=headers)
        assert released.status_code==200
        assert client.post("/v1/bnb/holds/"+hold.json()["id"]+"/release",headers=headers).status_code==200
        assert client.get(route,params=params).json()["units"][0]["available"]==2
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("UPDATE bnb_property SET status='draft' WHERE id=%s",(pid,))
        assert client.get(route,params=params).status_code==404
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_block WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_outbox WHERE payload->>'hold_id' IN (SELECT id::text FROM bnb_hold WHERE property_id=%s)",(pid,))
            c.execute("DELETE FROM bnb_hold WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_unit WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))


def test_bnb23_calendar_sync_has_no_self_provisioned_authority(fixture_property):
    pid,headers=fixture_property
    request=payload(pid)
    body={"property_id":str(pid),"unit_id":str(uuid4()),"source_id":"source-1",
          "external_event_id":"event-1","source_updated_at":datetime.now(timezone.utc).isoformat(),
          "start":request["start"],"end":request["end"],"quantity":1}
    assert client.post("/v1/bnb/internal/calendar/import",json=body).status_code==401
    no_issuer=client.post("/v1/bnb/internal/calendar/import",
        json=body,headers={"x-calendar-sync-proof":"forged"})
    assert no_issuer.status_code==503


def test_bnb23_authorized_calendar_sync_replay_stale_and_availability(fixture_property,monkeypatch):
    pid,headers=fixture_property
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    issuer="https://calendar-authority.test.invalid"
    monkeypatch.setenv("BNB_CALENDAR_SYNC_ISSUER",issuer)
    monkeypatch.setenv("BNB_CALENDAR_SYNC_AUDIENCE","bnb-calendar")
    monkeypatch.setenv("BNB_CALENDAR_SYNC_PUBLIC_KEY_PEM",
        key.public_key().public_bytes(Encoding.PEM,PublicFormat.SubjectPublicKeyInfo).decode())
    uid=uuid4()
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("INSERT INTO bnb_unit(id,property_id,label,quantity) VALUES (%s,%s,'Suite',1)",(uid,pid))
    start=datetime.fromisoformat(payload(pid)["start"])
    body={"property_id":str(pid),"unit_id":str(uid),
          "source_id":"partner-calendar-01","external_event_id":"event-busy-01",
          "source_updated_at":datetime.now(timezone.utc).isoformat(),
          "start":start.isoformat(),"end":(start+timedelta(days=2)).isoformat(),"quantity":1}
    from pydantic import BaseModel
    payload_digest=hashlib.sha256(api.CalendarSyncInput(**body).model_dump_json().encode()).hexdigest()
    now=int(time.time())
    proof=jwt.encode({"iss":issuer,"aud":"bnb-calendar","sub":"external-reviewer",
        "purpose":"calendar-import","jti":"calendar-"+str(uuid4()),
        "iat":now,"nbf":now,"exp":now+120,
        "property_id":str(pid),"unit_id":str(uid),"source_id":body["source_id"],
        "external_event_id":body["external_event_id"],"payload_hash":payload_digest},key,algorithm="RS256")
    try:
        route="/v1/bnb/internal/calendar/import"
        accepted=client.post(route,json=body,headers={"x-calendar-sync-proof":proof})
        assert accepted.status_code==202,accepted.text
        assert accepted.json()["booking_authority"] is False
        repeated=client.post(route,json=body,headers={"x-calendar-sync-proof":proof})
        assert repeated.status_code==409
        view=client.get("/v1/bnb/availability",params={
            "property_id":str(pid),"start":body["start"],"end":body["end"]})
        assert view.status_code==200 and view.json()["units"][0]["available"]==0
        forged=client.post(route,json={**body,"unit_id":str(uuid4())},
                           headers={"x-calendar-sync-proof":proof})
        assert forged.status_code==403
        tampered=client.post(route,json={**body,"quantity":2},
            headers={"x-calendar-sync-proof":proof})
        assert tampered.status_code==403
        stale=client.post(route,json={**body,"source_updated_at":(
            datetime.now(timezone.utc)-timedelta(days=3)).isoformat()},
            headers={"x-calendar-sync-proof":proof})
        assert stale.status_code==403
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_calendar_sync_event WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_unit WHERE property_id=%s",(pid,))


def test_bnb23_expiry_idempotency_and_capacity_recovery(fixture_property):
    pid,headers=fixture_property
    data=payload(pid)
    key="bnb23-expiry-0001"
    created=client.post("/v1/bnb/holds",json=data,
                        headers={**headers,"idempotency-key":key})
    assert created.status_code==201,created.text
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("UPDATE bnb_hold SET expires_at=now()-interval '1 second' WHERE id=%s",
                  (created.json()["id"],))
    replay=client.post("/v1/bnb/holds",json=data,
                       headers={**headers,"idempotency-key":key})
    assert replay.status_code==201 and replay.json()["status"]=="expired"
    assert client.post("/v1/bnb/holds/"+created.json()["id"]+"/release",
                       headers=headers).status_code==409
    preview=client.get("/v1/bnb/availability",params={
        "property_id":str(pid),"start":data["start"],"end":data["end"]})
    assert preview.status_code==200 and preview.json()["units"][0]["available"]==1
    next_hold=client.post("/v1/bnb/holds",json=data,
                          headers={**headers,"idempotency-key":"bnb23-expiry-0002"})
    assert next_hold.status_code==201
    conflict=client.post("/v1/bnb/holds",json={**data,"units":2},
                         headers={**headers,"idempotency-key":"bnb23-expiry-0002"})
    assert conflict.status_code==409


def test_bnb23_policy_minimum_nights_guest_and_hold(fixture_property):
    pid,headers=fixture_property
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("""INSERT INTO bnb_listing_policy
            (property_id,house_rules,cancellation_policy,timezone_id,min_nights)
            VALUES (%s,'quiet hours','flexible','America/Regina',3)""",(pid,))
    try:
        d=payload(pid)
        short=client.post("/v1/bnb/holds",json=d,
            headers={**headers,"idempotency-key":"min-night-policy-001"})
        assert short.status_code==422
        assert short.json()["detail"]=="MINIMUM_STAY_NOT_MET"
        from zoneinfo import ZoneInfo
        local=(datetime.now(ZoneInfo("America/Regina"))+timedelta(days=12)).date()
        one=client.get("/v1/bnb/availability/local",params={
            "property_id":str(pid),"checkin":local.isoformat(),
            "checkout":(local+timedelta(days=1)).isoformat()})
        assert one.status_code==422
        three=client.get("/v1/bnb/availability/local",params={
            "property_id":str(pid),"checkin":local.isoformat(),
            "checkout":(local+timedelta(days=3)).isoformat()})
        assert three.status_code==200,three.text
        assert three.json()["nights"]==3 and three.json()["min_nights"]==3
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_listing_policy WHERE property_id=%s",(pid,))


def test_bnb24_integer_pricing_rounding_and_bounds():
    from pricing import quote_breakdown
    from datetime import date
    v=quote_breakdown(date(2027,1,1),date(2027,1,4),2,1001,
        [{"start":"2027-01-02","end":"2027-01-03","nightly_minor":2500}],
        300,750,1000,100,1)
    assert v["nightly_rates_minor"]==[1001,2500,1001]
    assert v["subtotal_minor"]==9004
    assert v["discount_minor"]==900
    assert v["taxable_minor"]==8504
    assert v["tax_minor"]==638
    assert v["total_minor"]==9142
    with pytest.raises(ValueError):
        quote_breakdown(date(2027,1,1),date(2027,1,2),1,10**16,[],0,0,0)
    with pytest.raises(ValueError):
        quote_breakdown(date(2027,1,1),date(2027,1,2),1,100,
            [{"start":"2027-01-01","end":"2027-01-03","nightly_minor":200},
             {"start":"2027-01-01","end":"2027-01-04","nightly_minor":300}],0,0,0)


def test_bnb24_immutable_quote_expiry_policy_and_nonce(fixture_property):
    pid,headers=fixture_property
    from zoneinfo import ZoneInfo
    start=(datetime.now(ZoneInfo("America/Regina"))+timedelta(days=11)).date()
    plan={"property_id":str(pid),"checkin":start.isoformat(),
        "checkout":(start+timedelta(days=3)).isoformat(),
        "units":1,"nonce":"quote-repeat-0001"}
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("""INSERT INTO bnb_listing_policy
            (property_id,house_rules,cancellation_policy,timezone_id,min_nights)
            VALUES (%s,'Quiet after 10','Refund policy A','America/Regina',2)""",(pid,))
        c.execute("""INSERT INTO bnb_rate_plan
            (property_id,cleaning_minor,service_minor,tax_bps,discount_bps)
            VALUES (%s,150,10,500,1000)""",(pid,))
    try:
        too_low=client.post("/v1/bnb/quotes",json={
            **plan,"nonce":"quote-low-max-0001","payer_max_minor":1},headers=headers)
        assert too_low.status_code==409
        assert too_low.json()["detail"]=="PAYER_MAX_EXCEEDED"
        malformed=client.post("/v1/bnb/quotes",json={
            **plan,"property_id":"not-a-uuid","nonce":"malformed-quote-0001"},headers=headers)
        assert malformed.status_code==422
        assert client.get("/v1/bnb/quotes/not-a-uuid",headers=headers).status_code==422
        quoted=client.post("/v1/bnb/quotes",json=plan,headers=headers)
        assert quoted.status_code==201,quoted.text
        uid=quoted.json()["id"]
        assert quoted.json()["calculation"]["nights"]==3
        assert quoted.json()["policy_snapshot"]["house_rules"]=="Quiet after 10"
        canonical=__import__("json").dumps(quoted.json()["policy_snapshot"],
            sort_keys=True,separators=(",",":"))
        assert hashlib.sha256(canonical.encode()).hexdigest()==quoted.json()["snapshot_sha256"]
        assert quoted.json()["currency"]=="CAD"
        assert quoted.json()["financial_finality"] is False
        again=client.post("/v1/bnb/quotes",json=plan,headers=headers)
        assert again.status_code==201 and again.json()["id"]==uid
        altered=client.post("/v1/bnb/quotes",json={**plan,"units":2},headers=headers)
        assert altered.status_code==409
        assert client.get("/v1/bnb/quotes/"+uid).status_code==401
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("UPDATE bnb_rate_plan SET cleaning_minor=999,version=version+1 WHERE property_id=%s",(pid,))
            c.execute("UPDATE bnb_listing_policy SET house_rules='Changed rules' WHERE property_id=%s",(pid,))
            saved=c.execute("SELECT policy_snapshot,calculation FROM bnb_price_quote WHERE id=%s",(uid,)).fetchone()
            assert saved[0]["house_rules"]=="Quiet after 10"
            assert saved[1]["cleaning_minor"]==150
            c.execute("UPDATE bnb_price_quote SET expires_at=now()-interval '1 second' WHERE id=%s",(uid,))
        assert client.get("/v1/bnb/quotes/"+uid,headers=headers).json()["status"]=="expired"
        assert client.post("/v1/bnb/quotes",json=plan,headers=headers).json()["status"]=="expired"
        alternate={**plan,"nonce":"quote-revocable-0001"}
        newer=client.post("/v1/bnb/quotes",json=alternate,headers=headers)
        assert newer.status_code==201,newer.text
        revoked=client.post("/v1/bnb/quotes/"+newer.json()["id"]+"/revoke",headers=headers)
        assert revoked.status_code==200 and revoked.json()["status"]=="revoked"
        assert client.post("/v1/bnb/quotes/"+newer.json()["id"]+"/revoke",headers=headers).status_code==200
        assert client.get("/v1/bnb/quotes/"+newer.json()["id"],headers=headers).json()["status"]=="revoked"
        assert client.post("/v1/bnb/quotes",json=alternate,headers=headers).json()["status"]=="revoked"
        assert client.post("/v1/bnb/quotes/"+uid+"/revoke",headers=headers).status_code==409

    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_price_quote WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
            c.execute("DELETE FROM bnb_rate_plan WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_listing_policy WHERE property_id=%s",(pid,))


def test_bnb24_quote_bound_hold_uses_exact_total_and_rejects_reuse(fixture_property):
    pid,headers=fixture_property
    from zoneinfo import ZoneInfo
    beginning=(datetime.now(ZoneInfo("America/Regina"))+timedelta(days=10)).date()
    request={"property_id":str(pid),"checkin":beginning.isoformat(),
             "checkout":(beginning+timedelta(days=2)).isoformat(),
             "nonce":"quoted-hold-00001","units":1}
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("""INSERT INTO bnb_listing_policy
            (property_id,house_rules,cancellation_policy,timezone_id,min_nights)
            VALUES (%s,'Keep quiet','Firm cancellations','America/Regina',1)""",(pid,))
        c.execute("""INSERT INTO bnb_rate_plan
            (property_id,cleaning_minor,service_minor,tax_bps,discount_bps)
            VALUES (%s,1000,200,1000,0)""",(pid,))
    try:
        q=client.post("/v1/bnb/quotes",headers=headers,json=request)
        assert q.status_code==201,q.text
        qid=q.json()["id"]
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            row=c.execute("""SELECT lower(period),upper(period),policy_snapshot FROM bnb_price_quote
                WHERE id=%s""",(qid,)).fetchone()
        window={"property_id":str(pid),"start":row[0].isoformat(),
                "end":row[1].isoformat(),"units":1,
                "policy_snapshot":__import__("json").dumps(row[2],sort_keys=True,separators=(",",":"))}
        assert client.post("/v1/bnb/holds",headers={**headers,"idempotency-key":"without-quote-0001"},
                           json=window).status_code==422
        assert client.post("/v1/bnb/holds",headers={**headers,"idempotency-key":"bad-policy-00001"},
                           json={**window,"quote_id":qid,"policy_snapshot":"forged"}).status_code==409
        accepted=client.post("/v1/bnb/holds",headers={**headers,"idempotency-key":"quote-hold-000001"},
                           json={**window,"quote_id":qid})
        assert accepted.status_code==201,accepted.text
        assert accepted.json()["total_minor"]==q.json()["calculation"]["total_minor"]
        assert accepted.json()["total_minor"]>2000
        another=client.post("/v1/bnb/holds",headers={**headers,"idempotency-key":"quote-hold-000002"},
                            json={**window,"quote_id":qid})
        assert another.status_code==409
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            assert c.execute("SELECT quote_id FROM bnb_hold WHERE id=%s",
                             (accepted.json()["id"],)).fetchone()[0]==__import__("uuid").UUID(qid)
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_outbox WHERE payload->>'hold_id' IN (SELECT id::text FROM bnb_hold WHERE property_id=%s)",(pid,))
            c.execute("DELETE FROM bnb_hold WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_price_quote WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
            c.execute("DELETE FROM bnb_rate_plan WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_listing_policy WHERE property_id=%s",(pid,))


def test_bnb24_concurrent_quote_same_guest_nonce_is_single_immutable_row(fixture_property):
    from concurrent.futures import ThreadPoolExecutor
    from zoneinfo import ZoneInfo
    pid,headers=fixture_property
    start=(datetime.now(ZoneInfo("America/Regina"))+timedelta(days=12)).date()
    payload={"property_id":str(pid),"checkin":start.isoformat(),
             "checkout":(start+timedelta(days=2)).isoformat(),
             "units":1,"nonce":"parallel-quote-0001"}
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("""INSERT INTO bnb_listing_policy
            (property_id,house_rules,cancellation_policy,timezone_id,min_nights)
            VALUES (%s,'Quiet','Refund policy','America/Regina',1)""",(pid,))
        c.execute("""INSERT INTO bnb_rate_plan(property_id,cleaning_minor)
            VALUES (%s,150)""",(pid,))
    try:
        def send(_):
            return client.post("/v1/bnb/quotes",json=payload,headers=headers)
        with ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(send,range(8)))
        assert all(x.status_code==201 for x in results),[x.text for x in results]
        assert len({x.json()["id"] for x in results})==1
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            assert c.execute("SELECT COUNT(*) FROM bnb_price_quote WHERE property_id=%s",
                             (pid,)).fetchone()[0]==1
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_price_quote WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
            c.execute("DELETE FROM bnb_rate_plan WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_listing_policy WHERE property_id=%s",(pid,))


def test_bnb25_request_withdraw_idempotency_and_capability(fixture_property):
    pid,headers=fixture_property
    hold=client.post("/v1/bnb/holds",json=payload(pid),headers={
        **headers,"idempotency-key":"bnb25-hold-0001"})
    assert hold.status_code==201,hold.text
    route="/v1/bnb/booking-requests"
    body={"hold_id":hold.json()["id"],"request_type":"request"}
    sent=client.post(route,json=body,headers={**headers,"idempotency-key":"bnb25-request-0001"})
    assert sent.status_code==201,sent.text
    assert sent.json()["state"]=="requested"
    again=client.post(route,json=body,headers={**headers,"idempotency-key":"bnb25-request-0001"})
    assert again.status_code==201 and again.json()["id"]==sent.json()["id"]
    collision=client.post(route,json={**body,"request_type":"instant"},
        headers={**headers,"idempotency-key":"bnb25-request-0001"})
    assert collision.status_code==409
    assert client.get(route+"/"+sent.json()["id"]).status_code==401
    assert client.post(route+"/"+sent.json()["id"]+"/accept",headers=headers).status_code==404
    abandoned=client.post(route+"/"+sent.json()["id"]+"/withdraw",headers=headers)
    assert abandoned.status_code==200 and abandoned.json()["state"]=="withdrawn"
    assert client.post(route+"/"+sent.json()["id"]+"/withdraw",headers=headers).status_code==409
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        assert c.execute("SELECT status FROM bnb_hold WHERE id=%s",
                         (hold.json()["id"],)).fetchone()[0]=="cancelled"
        assert c.execute("SELECT COUNT(*) FROM bnb_reservation WHERE property_id=%s",
                         (pid,)).fetchone()[0]==0
        c.execute("DELETE FROM bnb_booking_request WHERE property_id=%s",(pid,))
        c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))


def test_bnb25_instant_eligibility_pending_payment_and_cancel(fixture_property):
    pid,headers=fixture_property
    first=client.post("/v1/bnb/holds",json=payload(pid),headers={
        **headers,"idempotency-key":"bnb25-instant-hold"})
    assert first.status_code==201
    body={"hold_id":first.json()["id"],"request_type":"instant"}
    assert client.post("/v1/bnb/booking-requests",json=body,
        headers={**headers,"idempotency-key":"bnb25-instant-disabled"}).status_code==403
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("INSERT INTO bnb_booking_policy(property_id,instant_enabled) VALUES (%s,true)",
                  (pid,))
    try:
        accepted=client.post("/v1/bnb/booking-requests",json=body,
            headers={**headers,"idempotency-key":"bnb25-instant-allowed"})
        assert accepted.status_code==201,accepted.text
        assert accepted.json()["state"]=="accepted" and not accepted.json()["confirmed"]
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            row=c.execute("SELECT id,status,pay_proof_id FROM bnb_reservation WHERE property_id=%s",
                          (pid,)).fetchone()
        assert row[1]=="payment_pending" and row[2] is None
        detail=client.get("/v1/bnb/reservations/"+str(row[0]),headers=headers)
        assert detail.status_code==200 and not detail.json()["confirmed"]
        assert client.post("/v1/bnb/reservations/"+str(row[0])+"/modify",
                           headers=headers).status_code==409
        assert client.post("/v1/bnb/reservations/"+str(row[0])+"/expire",
                           headers=headers).status_code==409
        closed=client.post("/v1/bnb/reservations/"+str(row[0])+"/cancel",headers=headers)
        assert closed.status_code==200 and closed.json()["refund_status"]=="not_applicable"
        assert client.post("/v1/bnb/reservations/"+str(row[0])+"/cancel",
                           headers=headers).status_code==200
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            assert c.execute("SELECT status FROM bnb_hold WHERE id=%s",
                             (first.json()["id"],)).fetchone()[0]=="cancelled"
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_reservation WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_booking_request WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_booking_policy WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))


def test_bnb25_independent_host_approval_decline_and_expiry(fixture_property,monkeypatch):
    pid,_=fixture_property
    private=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    monkeypatch.setenv("BNB_IDENTITY_PUBLIC_KEY_PEM",private.public_key().public_bytes(
        Encoding.PEM,PublicFormat.SubjectPublicKeyInfo).decode())
    issuer="https://identity.test.invalid"
    guest="guest25-"+str(uuid4())
    host="host25-"+str(uuid4())
    now=int(time.time())
    def bearer(subject):
        jti="session-"+str(uuid4())
        token=jwt.encode({"sub":subject,"iss":issuer,"aud":"420bnb",
            "iat":now,"nbf":now,"exp":now+300,"jti":jti},private,algorithm="RS256")
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("INSERT INTO bnb_account(subject) VALUES (%s)",(subject,))
            c.execute("""INSERT INTO bnb_identity_session
                (id,subject,issuer,issuer_session_id,expires_at)
                VALUES (%s,%s,%s,%s,now()+interval '5 minutes')""",
                (uuid4(),subject,issuer,jti))
        return {"authorization":"Bearer "+token}
    guest_headers=bearer(guest)
    host_headers=bearer(host)
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("UPDATE bnb_property SET host_subject=%s WHERE id=%s",(host,pid))
    def make_request(suffix):
        hold=client.post("/v1/bnb/holds",json=payload(pid),headers={
            **guest_headers,"idempotency-key":"bnb25-host-hold-"+suffix})
        assert hold.status_code==201,hold.text
        req=client.post("/v1/bnb/booking-requests",json={
            "hold_id":hold.json()["id"],"request_type":"request"},headers={
            **guest_headers,"idempotency-key":"bnb25-host-req-"+suffix})
        assert req.status_code==201,req.text
        return hold.json()["id"],req.json()["id"]
    try:
        held,rid=make_request("a")
        assert client.post("/v1/bnb/booking-requests/"+rid+"/accept",
                           headers=guest_headers).status_code==404
        accepted=client.post("/v1/bnb/booking-requests/"+rid+"/accept",
                             headers=host_headers)
        assert accepted.status_code==200 and accepted.json()["state"]=="accepted"
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            booking=c.execute("SELECT id,status FROM bnb_reservation WHERE booking_request_id=%s",
                              (rid,)).fetchone()
        assert booking[1]=="payment_pending"
        assert client.get("/v1/bnb/reservations/"+str(booking[0]),headers=host_headers).status_code==200
        assert client.post("/v1/bnb/booking-requests/"+rid+"/accept",
                           headers=host_headers).status_code==409
        assert client.post("/v1/bnb/reservations/"+str(booking[0])+"/cancel",
                           headers=guest_headers).status_code==200
        _,second=make_request("b")
        reject=client.post("/v1/bnb/booking-requests/"+second+"/decline",
                           headers=host_headers)
        assert reject.status_code==200 and reject.json()["state"]=="declined"
        _,third=make_request("c")
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("UPDATE bnb_booking_request SET deadline=now()-interval '1 second' WHERE id=%s",
                      (third,))
        expired=client.post("/v1/bnb/booking-requests/"+third+"/accept",
                            headers=host_headers)
        assert expired.status_code==200 and expired.json()["state"]=="expired"
        assert client.get("/v1/bnb/booking-requests/"+third,headers=guest_headers).json()["state"]=="expired"
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_reservation WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_booking_request WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
            c.execute("DELETE FROM bnb_identity_session WHERE subject IN (%s,%s)",(guest,host))
            c.execute("DELETE FROM bnb_account WHERE subject IN (%s,%s)",(guest,host))
            c.execute("UPDATE bnb_property SET host_subject='verified-host' WHERE id=%s",(pid,))


def test_bnb25_expired_pending_payment_releases_capacity_once(fixture_property):
    pid,headers=fixture_property
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("INSERT INTO bnb_booking_policy(property_id,instant_enabled) VALUES (%s,true)",
                  (pid,))
    try:
        hold=client.post("/v1/bnb/holds",json=payload(pid),headers={
            **headers,"idempotency-key":"bnb25-expire-hold-1"})
        assert hold.status_code==201
        booking=client.post("/v1/bnb/booking-requests",json={
            "hold_id":hold.json()["id"],"request_type":"instant"},headers={
            **headers,"idempotency-key":"bnb25-expire-request-1"})
        assert booking.status_code==201
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            rid=c.execute("SELECT id FROM bnb_reservation WHERE booking_request_id=%s",
                          (booking.json()["id"],)).fetchone()[0]
            c.execute("UPDATE bnb_hold SET expires_at=now()-interval '2 seconds' WHERE id=%s",
                      (hold.json()["id"],))
        expired=client.post(f"/v1/bnb/reservations/{rid}/expire",headers=headers)
        assert expired.status_code==200,expired.text
        assert expired.json()["state"]=="expired" and not expired.json()["confirmed"]
        assert client.post(f"/v1/bnb/reservations/{rid}/expire",headers=headers).status_code==200
        assert client.post(f"/v1/bnb/reservations/{rid}/cancel",headers=headers).status_code==409
        view=client.get(f"/v1/bnb/reservations/{rid}",headers=headers)
        assert view.status_code==200 and view.json()["status"]=="expired"
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            assert c.execute("SELECT status FROM bnb_hold WHERE id=%s",
                             (hold.json()["id"],)).fetchone()[0]=="expired"
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_reservation WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_booking_request WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_booking_policy WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
