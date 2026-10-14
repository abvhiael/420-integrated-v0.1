"""Real PostgreSQL, competing processes, lease and supervisor failure qualification."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time
from uuid import uuid4

import psycopg
from psycopg import sql
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import worker
import outbox


@pytest.fixture
def db():
    dsn = os.environ.get('BNB_DATABASE_URL')
    if not dsn:
        pytest.fail('BNB_DATABASE_URL required: worker qualification must execute')
    schema = 'worker_' + uuid4().hex
    with psycopg.connect(dsn) as c:
        c.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
        for name in ('bnb_outbox', 'bnb_outbox_receipt', 'bnb_request_dedupe', 'bnb_audit',
                     'bnb_consumer_subscription', 'bnb_consumer_delivery'):
            c.execute(sql.SQL('CREATE TABLE {}.{} (LIKE public.{} INCLUDING ALL)').format(
                sql.Identifier(schema), sql.Identifier(name), sql.Identifier(name)))
    def connect():
        return psycopg.connect(dsn, options='-c search_path=' + schema, connect_timeout=3)
    yield connect, dsn, schema
    with psycopg.connect(dsn) as c:
        c.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))


def enqueue(connect, payload=None):
    eid = uuid4()
    with connect() as c:
        c.execute("INSERT INTO bnb_outbox(id,event_type,payload) VALUES (%s,'bnb.hold.created',%s::jsonb)",
                  (eid, json.dumps(payload or {'hold_id': str(uuid4())})))
    return eid


def expire(connect, eid):
    with connect() as c:
        c.execute("UPDATE bnb_outbox SET lease_expires_at=clock_timestamp()-interval '1s' WHERE id=%s", (eid,))


def test_local_sink_durable_idempotence_and_conflicting_payload(db):
    connect, _, _ = db
    eid = enqueue(connect)
    a = worker.LocalValidationSink(connect)
    with connect() as c:
        payload = c.execute('SELECT payload FROM bnb_outbox WHERE id=%s', (eid,)).fetchone()[0]
    encoded = outbox._event({'id': eid, 'event_type': 'bnb.hold.created', 'payload': payload})
    first = a.accept(str(eid), encoded)
    assert worker.LocalValidationSink(connect).accept(str(eid), encoded) == first
    with pytest.raises(outbox.DeliveryError, match='RECEIPT_CONFLICT'):
        a.accept(str(eid), 'different-envelope')
    with connect() as c:
        assert c.execute('SELECT count(*) FROM bnb_request_dedupe').fetchone() == (1,)
    assert worker.Supervisor(connect, a).once() == 'delivered'
    with connect() as c:
        assert c.execute('SELECT delivered_by FROM bnb_outbox WHERE id=%s', (eid,)).fetchone() == ('bnb-local-validation',)


def test_competing_supervisors_only_one_durable_delivery(db):
    connect, _, _ = db
    ids = {enqueue(connect) for _ in range(8)}
    barrier = threading.Barrier(2)
    def work():
        supervisor = worker.Supervisor(connect, worker.LocalValidationSink(connect))
        barrier.wait()
        for _ in range(8):
            supervisor.once()
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(work) for _ in range(2)]
        for future in futures:
            future.result(timeout=10)
    with connect() as c:
        assert set(r[0] for r in c.execute('SELECT id FROM bnb_outbox WHERE delivered_at IS NOT NULL')) == ids
        assert c.execute('SELECT count(*) FROM bnb_request_dedupe').fetchone() == (8,)
        assert c.execute('SELECT max(attempts) FROM bnb_outbox').fetchone() == (1,)


def test_renewal_is_live_and_fences_wrong_expired_reclaimed_owners(db):
    connect, _, _ = db
    eid = enqueue(connect)
    with connect() as c:
        outbox.claim(c, 'old', lease_seconds=10)
        assert outbox.renew(c, eid, 'old', lease_seconds=30)
        with pytest.raises(outbox.DeliveryError, match='LEASE_LOST'):
            outbox.renew(c, eid, 'wrong')
    expire(connect, eid)
    with connect() as c:
        with pytest.raises(outbox.DeliveryError, match='LEASE_LOST'):
            outbox.renew(c, eid, 'old')
        assert outbox.claim(c, 'new')[0]['id'] == eid
    with connect() as c:
        for action in (lambda: outbox.renew(c, eid, 'old'),
                       lambda: outbox.acknowledge(c, eid, 'old', 'local', 'stale'),
                       lambda: outbox.fail(c, eid, 'old', 'stale')):
            with pytest.raises(outbox.DeliveryError, match='LEASE_LOST'):
                action()
        assert outbox.acknowledge(c, eid, 'new', 'local', 'good')


def test_supervisor_heartbeats_while_delivery_is_in_flight(db):
    connect, _, _ = db
    eid = enqueue(connect)
    entered, release = threading.Event(), threading.Event()
    class Slow:
        def accept(self, event_id, encoded):
            entered.set()
            assert release.wait(7)
            return worker.LocalValidationSink(connect).accept(event_id, encoded)
    supervisor = worker.Supervisor(connect, Slow(), lease_seconds=10)
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(supervisor.once)
        assert entered.wait(2)
        with connect() as c:
            before = c.execute('SELECT lease_expires_at FROM bnb_outbox WHERE id=%s', (eid,)).fetchone()[0]
        deadline = time.monotonic() + 6
        while True:
            with connect() as c:
                after = c.execute('SELECT lease_expires_at FROM bnb_outbox WHERE id=%s', (eid,)).fetchone()[0]
            if after > before:
                break
            assert time.monotonic() < deadline
            time.sleep(.05)
        release.set()
        assert future.result(timeout=3) == 'delivered'


def test_shutdown_finishes_current_event_and_does_not_claim_next(db):
    connect, _, _ = db
    enqueue(connect); enqueue(connect)
    stop = threading.Event()
    class Sink(worker.LocalValidationSink):
        def accept(self, *args):
            stop.set()
            return super().accept(*args)
    supervisor = worker.Supervisor(connect, Sink(connect), stop=stop)
    assert supervisor.run(max_cycles=3) == 0
    with connect() as c:
        assert c.execute('SELECT count(*) FROM bnb_outbox WHERE delivered_at IS NOT NULL').fetchone() == (1,)
        assert c.execute('SELECT count(*) FROM bnb_outbox WHERE attempts=0').fetchone() == (1,)


def test_bounded_blocked_adapter_leaves_claim_for_crash_recovery(db):
    connect, _, _ = db
    eid = enqueue(connect)
    release = threading.Event()
    class Blocked:
        def accept(self, *args):
            release.wait(2)
            return 'uncertain'
    supervisor = worker.Supervisor(connect, Blocked(), delivery_seconds=.1, poll_seconds=.05)
    try:
        assert supervisor.run(max_cycles=4) == 1
        assert supervisor.stop.is_set()
        with connect() as c:
            assert c.execute('SELECT attempts,delivered_at FROM bnb_outbox WHERE id=%s', (eid,)).fetchone() == (1, None)
    finally:
        release.set()


def test_connection_outage_reconnects_with_bounded_backoff_and_no_secret_logs(db, capsys):
    connect, _, _ = db
    enqueue(connect)
    calls = 0
    def flaky():
        nonlocal calls
        calls += 1
        if calls < 3:
            raise psycopg.OperationalError('password=DO-NOT-PRINT')
        return connect()
    stop = threading.Event()
    waits = []
    stop.wait = lambda delay: waits.append(delay)
    s = worker.Supervisor(flaky, worker.LocalValidationSink(connect), stop=stop)
    assert s.run(max_cycles=3) == 0
    assert waits[:2] == [2, 4] and calls >= 3
    output = capsys.readouterr().out
    assert 'database_unavailable' in output and 'DO-NOT-PRINT' not in output


def test_poison_payload_never_reaches_adapter_and_retries(db):
    connect, _, _ = db
    eid = enqueue(connect, {'token': 'DO-NOT-PRINT'})
    class Forbidden:
        def accept(self, *_):
            pytest.fail('poison payload reached adapter')
    assert worker.Supervisor(connect, Forbidden()).once() == 'invalid_event'
    with connect() as c:
        assert c.execute('SELECT delivered_at,failure_code FROM bnb_outbox WHERE id=%s', (eid,)).fetchone() == (None, 'invalid_event')


def test_repeated_crashes_are_bounded_by_dead_letter_attempt_limit(db):
    connect, _, _ = db
    eid = enqueue(connect)
    for n in range(outbox.MAX_ATTEMPTS):
        with connect() as c:
            assert outbox.claim(c, 'crash-' + str(n))[0]['id'] == eid
        expire(connect, eid)
    with connect() as c:
        assert outbox.claim(c, 'restart') == []
        row = c.execute('SELECT attempts,dead_lettered_at,failure_code FROM bnb_outbox WHERE id=%s', (eid,)).fetchone()
        assert row[0] == outbox.MAX_ATTEMPTS and row[1] is not None and row[2] == 'attempts_exhausted'


def test_process_crash_after_commit_before_ack_is_idempotently_recovered(db):
    connect, dsn, schema = db
    eid = enqueue(connect)
    code = '''import os,psycopg,worker
connect=lambda:psycopg.connect(os.environ['BNB_DATABASE_URL'],options='-c search_path='+os.environ['WORKER_TEST_SCHEMA'])
class Crash(worker.LocalValidationSink):
 def accept(self,*args):
  super().accept(*args)
  os._exit(17)
worker.Supervisor(connect,Crash(connect)).once()
'''
    result = subprocess.run([sys.executable, '-c', code], cwd=ROOT,
                            env=dict(os.environ, WORKER_TEST_SCHEMA=schema), timeout=8, capture_output=True)
    assert result.returncode == 17
    with connect() as c:
        assert c.execute('SELECT count(*) FROM bnb_request_dedupe').fetchone() == (1,)
        assert c.execute('SELECT delivered_at FROM bnb_outbox WHERE id=%s', (eid,)).fetchone() == (None,)
    expire(connect, eid)
    assert worker.Supervisor(connect, worker.LocalValidationSink(connect)).once() == 'delivered'
    with connect() as c:
        assert c.execute('SELECT count(*) FROM bnb_request_dedupe').fetchone() == (1,)
        assert c.execute('SELECT attempts FROM bnb_outbox WHERE id=%s', (eid,)).fetchone() == (2,)


def test_actual_sigterm_stops_blocked_process_within_grace(db):
    connect, _, schema = db
    eid = enqueue(connect)
    code = '''import os,signal,threading,time,psycopg,worker
stop=threading.Event()
signal.signal(signal.SIGTERM,lambda *_:stop.set())
connect=lambda:psycopg.connect(os.environ['BNB_DATABASE_URL'],options='-c search_path='+os.environ['WORKER_TEST_SCHEMA'])
class Blocked:
 def accept(self,*args):
  print('ENTERED',flush=True)
  time.sleep(60)
s=worker.Supervisor(connect,Blocked(),stop=stop,grace_seconds=.1,poll_seconds=.05)
raise SystemExit(s.run())
'''
    p = subprocess.Popen([sys.executable, '-c', code], cwd=ROOT, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True, env=dict(os.environ, WORKER_TEST_SCHEMA=schema))
    try:
        import selectors
        selector = selectors.DefaultSelector(); selector.register(p.stdout, selectors.EVENT_READ)
        assert selector.select(timeout=5), 'child did not begin delivery'
        assert p.stdout.readline().strip() == 'ENTERED'
        p.send_signal(signal.SIGTERM)
        p.communicate(timeout=3)
        assert p.returncode == 1
    finally:
        if p.poll() is None:
            p.kill(); p.communicate()
    with connect() as c:
        assert c.execute('SELECT delivered_at FROM bnb_outbox WHERE id=%s', (eid,)).fetchone() == (None,)


@pytest.mark.parametrize('kwargs', [{'lease_seconds': 9}, {'lease_seconds': True},
    {'poll_seconds': 0}, {'grace_seconds': 31}, {'delivery_seconds': 0}])
def test_configuration_bounds(kwargs):
    with pytest.raises(ValueError, match='WORKER_BOUNDS'):
        worker.Supervisor(None, None, **kwargs)


def test_packaged_entry_rejects_unapproved_sink_and_redacts(monkeypatch, capsys):
    monkeypatch.delenv('BNB_WORKER_SINK', raising=False)
    assert worker.cli() == 1
    assert capsys.readouterr().err == 'WORKER_START_FAILED\n'
    monkeypatch.setattr(worker, 'main', lambda: (_ for _ in ()).throw(RuntimeError('secret=DO-NOT-PRINT')))
    assert worker.cli() == 1
    assert capsys.readouterr().err == 'WORKER_START_FAILED\n'


# Reuse the existing isolated verified-TLS role/migration fixture without weakening it.
from test_bnb32_infrastructure import database as tls_database


def test_production_entry_wires_verified_tls_least_privilege_worker(tls_database, monkeypatch):
    import production
    _, _, runtime = tls_database
    values = dict(runtime, options='-c search_path=public')
    with psycopg.connect(**values) as c:
        c.execute("INSERT INTO bnb_outbox(id,event_type,payload) VALUES (%s,'bnb.hold.created','{\"hold_id\":\"fixture\"}')", (uuid4(),))
    # Contract validation itself is independently exercised by the retained infrastructure suite.
    monkeypatch.setattr(production, 'load_contract', lambda: ({}, {}, values))
    monkeypatch.setenv('BNB_WORKER_SINK', 'local-validation')
    original = worker.Supervisor.run
    def bounded(self):
        return original(self, max_cycles=1)
    monkeypatch.setattr(worker.Supervisor, 'run', bounded)
    prior = {sig: signal.getsignal(sig) for sig in (signal.SIGTERM, signal.SIGINT)}
    try:
        assert worker.main() == 0
    finally:
        for sig, handler in prior.items():
            signal.signal(sig, handler)
    with psycopg.connect(**values) as c:
        production.verify_database(c)
        assert c.execute('SELECT count(*) FROM bnb_outbox WHERE delivered_at IS NOT NULL').fetchone() == (1,)
        assert c.execute('SELECT count(*) FROM bnb_request_dedupe').fetchone() == (1,)


def test_lease_renewal_cannot_revive_after_waiting_for_row_lock(db):
    connect, _, _ = db
    eid = enqueue(connect)
    with connect() as c:
        outbox.claim(c, 'waiting')
    from concurrent.futures import ThreadPoolExecutor
    with connect() as holder, ThreadPoolExecutor(max_workers=1) as pool:
        holder.execute("UPDATE bnb_outbox SET lease_expires_at=clock_timestamp()+interval '0.2s' WHERE id=%s", (eid,))
        def renew():
            with connect() as c:
                with pytest.raises(outbox.DeliveryError, match='LEASE_LOST'):
                    outbox.renew(c, eid, 'waiting')
        future = pool.submit(renew)
        time.sleep(.3)
        holder.commit()
        future.result(timeout=3)
    with connect() as c:
        assert outbox.claim(c, 'replacement')[0]['id'] == eid
