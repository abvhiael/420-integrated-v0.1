"""BNB-4.3: revisioned read-model invariants; never booking authorization."""
import importlib.util
import os
from datetime import datetime,timedelta,timezone
from pathlib import Path
from uuid import uuid4
import pytest
import psycopg
from fastapi import HTTPException

spec=importlib.util.spec_from_file_location("bnb43_projection",Path(__file__).resolve().parents[1]/"availability_projection.py")
model=importlib.util.module_from_spec(spec);spec.loader.exec_module(model)

@pytest.fixture
def conn():
    if not os.getenv("BNB_DATABASE_URL"):pytest.skip("PostgreSQL required")
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        yield c

def property_fixture(c):
    pid=uuid4()
    c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,capacity,nightly_minor,currency,status)
      VALUES(%s,'projection-fixture','Fixture','West',2,100,'CAD','published')""",(pid,))
    return pid

def window():
    start=datetime.now(timezone.utc)+timedelta(days=1)
    return start,start+timedelta(days=2)

def test_revision_recompute_expiry_and_nonbinding(conn):
    pid=property_fixture(conn)
    start,end=window()
    first=model.refresh(conn,pid,None,start,end,occupancy=lambda *args:0)
    assert first["available"]==2 and first["nonbinding"] and first["revision"]==1
    second=model.refresh(conn,pid,None,start,end,occupancy=lambda *args:1)
    assert second["available"]==1 and second["revision"]==2
    assert model.read(conn,pid,None,start,end,expected_version=1)["revision"]==2
    with pytest.raises(HTTPException) as e:
        model.read(conn,pid,None,start,end,expected_version=2)
    assert e.value.status_code==503
    model.invalidate(conn,pid)
    with pytest.raises(HTTPException) as e:
        model.read(conn,pid,None,start,end,expected_version=1)
    assert e.value.status_code==503

def test_revoked_source_fails_closed_without_revision_advance(conn):
    pid=property_fixture(conn)
    start,end=window()
    model.refresh(conn,pid,None,start,end,occupancy=lambda *args:0)
    row=conn.execute("SELECT source_revision FROM bnb_availability_projection WHERE property_id=%s",(pid,)).fetchone()
    def stale(*args):raise HTTPException(503,"CALENDAR_SYNC_STALE")
    with pytest.raises(HTTPException,match="CALENDAR_SYNC_STALE"):
        model.refresh(conn,pid,None,start,end,occupancy=stale)
    conn.rollback()
    assert row==(1,)

def test_zero_capacity_and_half_open_boundaries(conn):
    pid=property_fixture(conn)
    start,end=window()
    result=model.refresh(conn,pid,None,start,end,occupancy=lambda *args:None)
    assert result["available"]==0
    result=model.refresh(conn,pid,None,start,end,occupancy=lambda *args:99)
    assert result["available"]==0
    with pytest.raises(HTTPException):
        model.refresh(conn,pid,None,end,start,occupancy=lambda *args:0)
    with pytest.raises(HTTPException):
        model.refresh(conn,pid,None,start,start+timedelta(days=91),occupancy=lambda *args:0)

def test_suspension_prevents_refresh_and_read(conn):
    pid=property_fixture(conn)
    start,end=window()
    model.refresh(conn,pid,None,start,end,occupancy=lambda *args:0)
    conn.execute("UPDATE bnb_property SET status='suspended' WHERE id=%s",(pid,))
    with pytest.raises(HTTPException):
        model.read(conn,pid,None,start,end,expected_version=1)
    with pytest.raises(HTTPException):
        model.refresh(conn,pid,None,start,end,occupancy=lambda *args:0)

def test_dst_gap_and_fold_already_fail_closed():
    spec=importlib.util.spec_from_file_location("bnb43_calendar",Path(__file__).resolve().parents[1]/"calendar_engine.py")
    calendar=importlib.util.module_from_spec(spec);spec.loader.exec_module(calendar)
    with pytest.raises(ValueError,match="NONEXISTENT_LOCAL_TIME"):
        calendar.strict_local_instant(datetime(2026,3,8,2,30),"America/Toronto")
    with pytest.raises(ValueError,match="AMBIGUOUS_LOCAL_TIME"):
        calendar.strict_local_instant(datetime(2026,11,1,1,30),"America/Toronto")
