"""BNB-5.4 actual PostgreSQL transactional invalidation, races and recovery."""
import os
from datetime import datetime,timedelta,timezone
from uuid import uuid4,UUID
from concurrent.futures import ThreadPoolExecutor
import threading
import psycopg
import pytest
import projection_refresh as refresh
import availability_projection as availability
from api import occupancy_in_window
from fastapi import HTTPException

@pytest.fixture
def fixture():
    dsn=os.environ.get('BNB_DATABASE_URL')
    if not dsn: pytest.fail('BNB_DATABASE_URL required')
    pid=uuid4()
    def connect(): return psycopg.connect(dsn,connect_timeout=3,options='-c statement_timeout=5000 -c lock_timeout=2000')
    with connect() as c:
        c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,status,capacity,nightly_minor,currency)
            VALUES(%s,'bnb54-fixture','Fixture','Region','published',3,100,'CAD')""",(pid,))
    start=datetime.now(timezone.utc)+timedelta(days=3)
    end=start+timedelta(days=1)
    yield connect,pid,start,end
    with connect() as c:
        for table in ('bnb_availability_projection','bnb_projection_work','bnb_discovery_consumer',
            'bnb_discovery_projection','bnb_reservation','bnb_hold','bnb_block','bnb_unit',
            'bnb_compliance_eligibility','bnb_travel_place_binding'):
            c.execute(f'DELETE FROM {table} WHERE property_id=%s',(pid,))
        c.execute("DELETE FROM bnb_outbox WHERE payload->>'property_id'=%s",(str(pid),))
        c.execute('DELETE FROM bnb_property WHERE id=%s',(pid,))

def project(f):
    connect,pid,start,end=f
    with connect() as c:
        return availability.refresh(c,pid,None,start,end,occupancy=occupancy_in_window)

def run(f,**kw):
    connect,pid,_,_=f
    with connect() as c:
        return refresh.once(c,property_id=pid,occupancy=occupancy_in_window,**kw)

def hold(c,pid,start,end):
    hid=uuid4()
    c.execute("""INSERT INTO bnb_hold(id,property_id,guest_subject,period,status,expires_at,
        quote_total_minor,policy_snapshot) VALUES(%s,%s,'fixture',
        tstzrange(%s,%s,'[)'),'held',clock_timestamp()+interval '10 minutes',100,'fixture')""",
        (hid,pid,start,end))
    return hid

def test_source_write_and_invalidation_rollback_together(fixture):
    connect,pid,start,end=fixture
    project(fixture); run(fixture)
    with connect() as c:
        before=c.execute('SELECT requested_revision FROM bnb_projection_work WHERE property_id=%s',(pid,)).fetchone()
        hold(c,pid,start,end)
        assert c.execute('SELECT invalidated_at IS NOT NULL FROM bnb_availability_projection WHERE property_id=%s',(pid,)).fetchone()==(True,)
        c.rollback()
    with connect() as c:
        assert c.execute('SELECT requested_revision FROM bnb_projection_work WHERE property_id=%s',(pid,)).fetchone()==before
        assert c.execute('SELECT count(*) FROM bnb_hold WHERE property_id=%s',(pid,)).fetchone()==(0,)
        assert c.execute('SELECT invalidated_at FROM bnb_availability_projection WHERE property_id=%s',(pid,)).fetchone()==(None,)

@pytest.mark.parametrize('state',['cancelled','expired','confirmed'])
def test_hold_lifecycle_refresh_is_authoritative_and_nonbinding(fixture,state):
    connect,pid,start,end=fixture
    project(fixture); run(fixture)
    with connect() as c: hid=hold(c,pid,start,end)
    run(fixture)
    with connect() as c:
        assert c.execute('SELECT available FROM bnb_availability_projection WHERE property_id=%s',(pid,)).fetchone()==(2,)
        c.execute('UPDATE bnb_hold SET status=%s WHERE id=%s',(state,hid))
    run(fixture)
    with connect() as c:
        assert c.execute('SELECT available FROM bnb_availability_projection WHERE property_id=%s',(pid,)).fetchone()==(2 if state=='confirmed' else 3,)
        assert c.execute('SELECT status FROM bnb_hold WHERE id=%s',(hid,)).fetchone()==(state,)

def test_time_only_expiry_is_refreshed_without_changing_booking_state(fixture):
    connect,pid,start,end=fixture
    with connect() as c: hid=hold(c,pid,start,end)
    project(fixture);run(fixture)
    with connect() as c:
        c.execute("UPDATE bnb_hold SET expires_at=clock_timestamp()+interval '2 seconds' WHERE id=%s",(hid,))
    run(fixture)
    with connect() as c:
        assert c.execute('SELECT available FROM bnb_availability_projection WHERE property_id=%s',(pid,)).fetchone()==(2,)
        c.execute('SELECT pg_sleep(2.1)')
        # Make the durable periodic timer due after time-only expiry; no source write.
        c.execute("UPDATE bnb_projection_work SET next_refresh_at=clock_timestamp()-interval '1 second' WHERE property_id=%s",(pid,))
    assert run(fixture)
    with connect() as c:
        assert c.execute('SELECT available FROM bnb_availability_projection WHERE property_id=%s',(pid,)).fetchone()==(3,)
        assert c.execute('SELECT status FROM bnb_hold WHERE id=%s',(hid,)).fetchone()==('held',)

def test_competing_refresh_workers_do_not_duplicate_discovery_revision(fixture):
    project(fixture)
    barrier=threading.Barrier(2)
    def work(_): barrier.wait();return run(fixture)
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sum(pool.map(work,range(2)))==1
    connect,pid,_,_=fixture
    with connect() as c:
        assert c.execute('SELECT revision FROM bnb_discovery_projection WHERE property_id=%s',(pid,)).fetchone()==(1,)
        assert c.execute('SELECT requested_revision=completed_revision FROM bnb_projection_work WHERE property_id=%s',(pid,)).fetchone()==(True,)

def test_refresh_rollback_restart_preserves_work_and_no_leaked_event(fixture):
    project(fixture)
    connect,pid,_,_=fixture
    with connect() as c:
        assert refresh.once(c,property_id=pid,occupancy=occupancy_in_window)
        c.rollback()
    with connect() as c:
        assert c.execute('SELECT count(*) FROM bnb_discovery_projection WHERE property_id=%s',(pid,)).fetchone()==(0,)
        assert c.execute('SELECT requested_revision>completed_revision FROM bnb_projection_work WHERE property_id=%s',(pid,)).fetchone()==(True,)
    assert run(fixture)
    assert not run(fixture)

def test_mutation_after_refresh_cannot_lose_wakeup(fixture):
    project(fixture);run(fixture)
    connect,pid,start,end=fixture
    with connect() as c: hold(c,pid,start,end)
    with connect() as c:
        with pytest.raises(HTTPException,match='PROJECTION_STALE'):
            availability.read(c,pid,None,start,end,expected_version=1)
        assert c.execute('SELECT requested_revision>completed_revision FROM bnb_projection_work WHERE property_id=%s',(pid,)).fetchone()==(True,)
    assert run(fixture)

def test_bounded_windows_eventually_complete_without_starvation(fixture):
    connect,pid,start,end=fixture
    for n in range(4):
        with connect() as c:
            availability.refresh(c,pid,None,start+timedelta(days=n),end+timedelta(days=n),occupancy=occupancy_in_window)
    with connect() as c: c.execute('UPDATE bnb_property SET capacity=4 WHERE id=%s',(pid,))
    assert run(fixture,window_limit=1)
    with connect() as c:
        assert c.execute('SELECT requested_revision>completed_revision FROM bnb_projection_work WHERE property_id=%s',(pid,)).fetchone()==(True,)
    for _ in range(3):assert run(fixture,window_limit=1)
    assert not run(fixture)
    with connect() as c:
        assert c.execute('SELECT count(*) FROM bnb_availability_projection WHERE property_id=%s AND available=4 AND invalidated_at IS NULL',(pid,)).fetchone()==(4,)

def test_unpublished_property_retracts_and_discards_cached_capacity(fixture):
    project(fixture);run(fixture)
    connect,pid,_,_=fixture
    with connect() as c:c.execute("UPDATE bnb_property SET status='suspended' WHERE id=%s",(pid,))
    assert run(fixture)
    with connect() as c:
        assert c.execute('SELECT count(*) FROM bnb_availability_projection WHERE property_id=%s',(pid,)).fetchone()==(0,)
        assert c.execute("SELECT payload->>'visible' FROM bnb_discovery_projection WHERE property_id=%s",(pid,)).fetchone()==('false',)

@pytest.mark.parametrize('limit',[0,101,True,1.5])
def test_refresh_bounds_and_autocommit(fixture,limit):
    connect,_,_,_=fixture
    with connect() as c:
        with pytest.raises(ValueError,match='REFRESH_BOUNDS'):
            refresh.once(c,occupancy=occupancy_in_window,window_limit=limit)
        c.autocommit=True
        with pytest.raises(ValueError,match='TRANSACTION_REQUIRED'):
            refresh.once(c,occupancy=occupancy_in_window)

def test_all_required_mutation_owners_have_transactional_triggers(fixture):
    connect,_,_,_=fixture
    expected={'bnb_property','bnb_unit','bnb_block','bnb_hold','bnb_reservation',
        'bnb_calendar_sync_event','bnb_travel_place_binding','bnb_compliance_eligibility',
        'bnb_property_claim','bnb_property_grant','bnb_listing_review','bnb_listing_policy',
        'bnb_listing_media','bnb_rate_plan','bnb_travel_jurisdiction_policy'}
    with connect() as c:
        rows=c.execute("""SELECT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
            JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND t.tgname='bnb_projection_dirty' AND t.tgenabled='O'""").fetchall()
        assert {r[0] for r in rows}==expected

@pytest.mark.parametrize('source',['unit','block','reservation'])
def test_inventory_and_reservation_mutations_enqueue_durable_work(fixture,source):
    project(fixture);run(fixture)
    connect,pid,start,end=fixture
    with connect() as c:
        if source=='unit':
            c.execute("INSERT INTO bnb_unit(id,property_id,label,quantity) VALUES(%s,%s,'fixture',2)",(uuid4(),pid))
        elif source=='block':
            c.execute("""INSERT INTO bnb_block(id,property_id,period,reason,quantity)
                VALUES(%s,%s,tstzrange(%s,%s,'[)'),'fixture',2)""",(uuid4(),pid,start,end))
        else:
            hid=hold(c,pid,start,end)
            c.execute("""INSERT INTO bnb_reservation(id,hold_id,property_id,guest_subject,status)
                VALUES(%s,%s,%s,'fixture','payment_pending')""",(uuid4(),hid,pid))
        assert c.execute('SELECT requested_revision>completed_revision FROM bnb_projection_work WHERE property_id=%s',(pid,)).fetchone()==(True,)
        assert c.execute('SELECT invalidated_at IS NOT NULL FROM bnb_availability_projection WHERE property_id=%s',(pid,)).fetchone()==(True,)
    assert run(fixture)

@pytest.mark.parametrize('source',['location','compliance','jurisdiction','time-expiry'])
def test_authority_revocation_or_expiry_retracts_discovery(fixture,source):
    connect,pid,_,_=fixture
    jurisdiction='fixture_'+uuid4().hex
    with connect() as c:
        c.execute("""INSERT INTO bnb_travel_jurisdiction_policy(jurisdiction_id,decision,issuer,
            proof_jti,effective_at,expires_at,revision) VALUES(%s,'allowed','fixture',%s,
            clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',1)""",
            (jurisdiction,uuid4().hex))
        c.execute("""INSERT INTO bnb_travel_place_binding(property_id,place_id,region,country,
            jurisdiction_id,issuer,proof_jti,proof_expires_at,property_version)
            VALUES(%s,'fixture','region','CA',%s,'fixture',%s,clock_timestamp()+interval '1 hour',1)""",
            (pid,jurisdiction,uuid4().hex))
        c.execute("""INSERT INTO bnb_compliance_eligibility(property_id,jurisdiction_id,decision,
            license_reference,identity_required,issuer,proof_jti,revision,property_version,effective_at,expires_at)
            VALUES(%s,%s,'allowed','fixture',false,'fixture',%s,1,1,
            clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour')""",
            (pid,jurisdiction,uuid4().hex))
    assert run(fixture)
    with connect() as c:
        assert c.execute("SELECT payload->>'visible' FROM bnb_discovery_projection WHERE property_id=%s",(pid,)).fetchone()==('true',)
        if source=='jurisdiction':
            c.execute("UPDATE bnb_travel_jurisdiction_policy SET revoked_at=clock_timestamp() WHERE jurisdiction_id=%s",(jurisdiction,))
        elif source=='location':
            c.execute("UPDATE bnb_travel_place_binding SET revoked_at=clock_timestamp() WHERE property_id=%s",(pid,))
        elif source=='compliance':
            c.execute("UPDATE bnb_compliance_eligibility SET revoked_at=clock_timestamp() WHERE property_id=%s",(pid,))
        else:
            c.execute("UPDATE bnb_travel_place_binding SET proof_expires_at=clock_timestamp()-interval '1 second' WHERE property_id=%s",(pid,))
    # A stale source revision cannot be accepted while its refresh waits.
    import discovery_sync
    with connect() as c:
        old=c.execute('SELECT revision,payload FROM bnb_discovery_projection WHERE property_id=%s',(pid,)).fetchone()
        with pytest.raises(HTTPException,match='SOURCE_AUTHORITY_STALE'):
            discovery_sync.consume(c,pid,'search',old[0],old[1])
    assert run(fixture)
    with connect() as c:
        assert c.execute("SELECT payload->>'visible',revision FROM bnb_discovery_projection WHERE property_id=%s",(pid,)).fetchone()==('false',2)
        c.execute("UPDATE bnb_projection_work SET next_refresh_at=clock_timestamp()-interval '1 second' WHERE property_id=%s",(pid,))
    assert run(fixture)
    with connect() as c:
        assert c.execute('SELECT revision FROM bnb_discovery_projection WHERE property_id=%s',(pid,)).fetchone()==(2,)
        c.execute("DELETE FROM bnb_travel_place_binding WHERE property_id=%s",(pid,))
        c.execute("DELETE FROM bnb_compliance_eligibility WHERE property_id=%s",(pid,))
        c.execute("DELETE FROM bnb_travel_jurisdiction_policy WHERE jurisdiction_id=%s",(jurisdiction,))

def test_concurrent_writer_waiting_on_refresh_retains_new_revision(fixture):
    connect,pid,start,end=fixture
    project(fixture)
    ready=threading.Event()
    def mutate():
        with connect() as c:
            ready.set()
            c.execute("SELECT id FROM bnb_property WHERE id=%s FOR UPDATE",(pid,))
            hold(c,pid,start,end)
    with connect() as c, ThreadPoolExecutor(max_workers=1) as pool:
        c.execute("SELECT id FROM bnb_property WHERE id=%s FOR UPDATE",(pid,))
        future=pool.submit(mutate)
        try:
            assert ready.wait(1)
            assert refresh.once(c,property_id=pid,occupancy=occupancy_in_window)
            c.commit()
            future.result(timeout=5)
        finally:
            c.rollback()
    assert run(fixture)
    with connect() as c:
        assert c.execute('SELECT available FROM bnb_availability_projection WHERE property_id=%s',(pid,)).fetchone()==(2,)

def test_actual_process_death_before_refresh_commit_recovers_pending_work(fixture):
    import subprocess,sys
    from pathlib import Path
    connect,pid,_,_=fixture
    project(fixture)
    code="""import os,psycopg,projection_refresh
from api import occupancy_in_window
with psycopg.connect(os.environ['BNB_DATABASE_URL']) as c:
 assert projection_refresh.once(c,property_id=os.environ['BNB54_PID'],occupancy=occupancy_in_window)
 os._exit(23)
"""
    child=subprocess.run([sys.executable,'-c',code],cwd=Path(__file__).resolve().parents[1],
        env=dict(os.environ,BNB54_PID=str(pid)),capture_output=True,timeout=8)
    assert child.returncode==23
    with connect() as c:
        assert c.execute('SELECT requested_revision>completed_revision FROM bnb_projection_work WHERE property_id=%s',(pid,)).fetchone()==(True,)
        assert c.execute('SELECT count(*) FROM bnb_discovery_projection WHERE property_id=%s',(pid,)).fetchone()==(0,)
    assert run(fixture)

from test_bnb32_infrastructure import database as tls_database

def test_packaged_worker_entrypoint_runs_refresh_and_local_receipt_over_verified_tls(tls_database,monkeypatch):
    import production,worker,signal
    _,_,runtime=tls_database
    values=dict(runtime,options='-c search_path=public')
    pid=uuid4()
    start=datetime.now(timezone.utc)+timedelta(days=3);end=start+timedelta(days=1)
    with psycopg.connect(**values) as c:
        c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,status,capacity,nightly_minor,currency)
            VALUES(%s,'fixture','Fixture','Region','published',3,100,'CAD')""",(pid,))
        availability.refresh(c,pid,None,start,end,occupancy=occupancy_in_window)
        hold(c,pid,start,end)
    monkeypatch.setattr(production,'load_contract',lambda:({}, {}, dict(values)))
    monkeypatch.setenv('BNB_WORKER_SINK','local-validation')
    original=worker.Supervisor.run
    monkeypatch.setattr(worker.Supervisor,'run',lambda self:original(self,max_cycles=1))
    prior={sig:signal.getsignal(sig) for sig in (signal.SIGTERM,signal.SIGINT)}
    try:
        assert worker.main()==0
    finally:
        for sig,handler in prior.items():signal.signal(sig,handler)
    with psycopg.connect(**values) as c:
        assert c.execute('SELECT available,invalidated_at FROM bnb_availability_projection WHERE property_id=%s',(pid,)).fetchone()==(2,None)
        assert c.execute('SELECT requested_revision=completed_revision FROM bnb_projection_work WHERE property_id=%s',(pid,)).fetchone()==(True,)
        assert c.execute('SELECT count(*) FROM bnb_consumer_delivery WHERE accepted_at IS NOT NULL').fetchone()==(1,)
