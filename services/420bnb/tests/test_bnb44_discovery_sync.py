"""BNB-4.4 consumer sync: current authority, tombstone, privacy and revision fencing."""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4
import psycopg
import pytest
from fastapi import HTTPException
spec=importlib.util.spec_from_file_location("bnb44",Path(__file__).resolve().parents[1]/"discovery_sync.py")
sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)

@pytest.fixture
def conn():
    if not os.environ.get("BNB_DATABASE_URL"):pytest.skip("PostgreSQL required")
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:yield c

def property_fixture(c):
    pid=uuid4()
    c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,private_address,capacity,nightly_minor,currency,status)
      VALUES (%s,'bn b44','Safe Listing','BC','SECRET_ADDRESS',2,150,'CAD','published')""",(pid,))
    return pid

def test_forbidden_publication_defaults_to_tombstone(conn):
    pid=property_fixture(conn)
    first=sync.synchronize(conn,pid)
    assert first["revision"]==1 and not first["payload"]["visible"]
    assert "SECRET_ADDRESS" not in str(first)
    again=sync.synchronize(conn,pid)
    assert again["changed"] is False and again["revision"]==1
    assert conn.execute("SELECT count(*) FROM bnb_outbox WHERE event_type='bnb.discovery.changed' AND payload->>'property_id'=%s",(str(pid),)).fetchone()[0]==1

def test_retraction_and_monotone_consumer_ack(conn,monkeypatch):
    pid=property_fixture(conn)
    sample={"property_id":str(pid),"visible":True,"property_version":1,
            "title":"Safe Listing","public_region":"BC","capacity":2,
            "map_marker":{"latitude":49.5,"longitude":-123.5,"precision":"coarse_1_degree_grid"},
            "place_id":"test-location","jurisdiction_id":"BC","nonbinding":True,"booking_enabled":False}
    monkeypatch.setattr(sync,"_eligible",lambda *args:(pid,1,"Safe Listing","BC",2,49,-124,"test-location","BC"))
    first=sync.synchronize(conn,pid)
    assert first["revision"]==1 and first["payload"]["visible"]
    assert first["payload"]["map_marker"]["precision"]=="coarse_1_degree_grid"
    assert "SECRET_ADDRESS" not in str(first)
    assert sync.consume(conn,pid,"search",1,first["payload"])["accepted"]
    with pytest.raises(HTTPException,match="CONSUMER_REPLAY"):
        sync.consume(conn,pid,"search",1,first["payload"])
    monkeypatch.setattr(sync,"_eligible",lambda *args:None)
    tombstone=sync.synchronize(conn,pid)
    assert tombstone["revision"]==2 and not tombstone["payload"]["visible"]
    with pytest.raises(HTTPException,match="SOURCE_REVISION_STALE"):
        sync.consume(conn,pid,"travel",1,first["payload"])
    assert sync.consume(conn,pid,"travel",2,tombstone["payload"])["visible"] is False
    assert sync.consume(conn,pid,"search",2,tombstone["payload"])["visible"] is False
    with pytest.raises(HTTPException,match="CONSUMER_UNAUTHORIZED"):
        sync.consume(conn,pid,"unauthorized",2,tombstone["payload"])

def test_invalid_property_cannot_publish(conn):
    with pytest.raises(HTTPException) as e:
        sync.synchronize(conn,uuid4())
    assert e.value.status_code==404
