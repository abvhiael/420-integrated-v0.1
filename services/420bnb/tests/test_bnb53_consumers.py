"""BNB-5.3 real PostgreSQL subscription/delivery isolation and worker integration."""
import json
import os
from pathlib import Path
import sys
import threading
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor

import psycopg
from psycopg import sql
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import consumer_delivery as delivery
import outbox
import worker

KIND = 'bnb.hold.created'


@pytest.fixture
def db():
    dsn = os.environ.get('BNB_DATABASE_URL')
    if not dsn:
        pytest.fail('BNB_DATABASE_URL required for independent consumer qualification')
    schema = 'consumers_' + uuid4().hex
    tables = ('bnb_outbox', 'bnb_outbox_receipt', 'bnb_request_dedupe', 'bnb_audit',
              'bnb_consumer_subscription', 'bnb_consumer_subscription_history', 'bnb_consumer_delivery')
    with psycopg.connect(dsn) as c:
        c.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
        for name in tables:
            c.execute(sql.SQL('CREATE TABLE {}.{} (LIKE public.{} INCLUDING ALL)').format(
                sql.Identifier(schema), sql.Identifier(name), sql.Identifier(name)))
    def connect():
        return psycopg.connect(dsn, options='-c search_path=' + schema, connect_timeout=3)
    yield connect
    with psycopg.connect(dsn) as c:
        c.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))


def configure(connect, name, *, active=True, revision=0, kinds=None):
    with connect() as c:
        return delivery.configure(c, name, kinds or [KIND], active=active,
            expected_revision=revision, actor='approved-fixture-operator',
            authorize=lambda actor, action, consumer: actor == 'approved-fixture-operator')


def enqueue(connect, payload=None):
    eid = uuid4()
    with connect() as c:
        c.execute("INSERT INTO bnb_outbox(id,event_type,payload) VALUES(%s,%s,%s::jsonb)",
                  (eid, KIND, json.dumps(payload or {'hold_id': str(uuid4())})))
    return eid


def enrolled(connect, consumers=('search-fixture', 'travel-fixture')):
    for consumer in consumers:
        configure(connect, consumer)
    eid = enqueue(connect)
    with connect() as c:
        assert delivery.enroll(c) == 1
    return eid


def claim(connect, consumer, owner=None):
    owner = owner or 'worker-' + uuid4().hex
    with connect() as c:
        rows = delivery.claim(c, owner, consumer)
    return owner, rows


def ack(connect, eid, consumer, owner, receipt='durable-local-receipt'):
    with connect() as c:
        return delivery.acknowledge(c, eid, owner, consumer, receipt)


def status(connect, eid):
    with connect() as c:
        return c.execute('SELECT delivered_at FROM bnb_outbox WHERE id=%s', (eid,)).fetchone()[0]


def due(connect, eid, consumer):
    with connect() as c:
        c.execute("UPDATE bnb_consumer_delivery SET available_at=clock_timestamp()-interval '1s',lease_expires_at=CASE WHEN lease_owner IS NULL THEN NULL ELSE clock_timestamp()-interval '1s' END WHERE event_id=%s AND consumer=%s", (eid, consumer))


def test_one_ack_does_not_complete_another_consumer_or_event(db):
    eid = enrolled(db)
    a, _ = claim(db, 'search-fixture')
    b, _ = claim(db, 'travel-fixture')
    ack(db, eid, 'search-fixture', a)
    assert status(db, eid) is None
    with db() as c:
        assert c.execute('SELECT consumer FROM bnb_consumer_delivery WHERE accepted_at IS NOT NULL').fetchall() == [('search-fixture',)]
        assert c.execute('SELECT attempts FROM bnb_consumer_delivery WHERE consumer=%s', ('travel-fixture',)).fetchone() == (1,)
    ack(db, eid, 'travel-fixture', b)
    assert status(db, eid) is not None


def test_identical_receipt_is_idempotent_conflict_and_wrong_owner_rejected(db):
    eid = enrolled(db, ('only-fixture',))
    owner, _ = claim(db, 'only-fixture')
    digest = ack(db, eid, 'only-fixture', owner, 'first')
    assert ack(db, eid, 'only-fixture', owner, 'first') == digest
    with pytest.raises(outbox.DeliveryError, match='RECEIPT_CONFLICT'):
        ack(db, eid, 'only-fixture', owner, 'different')
    with pytest.raises(outbox.DeliveryError, match='LEASE_LOST'):
        ack(db, eid, 'only-fixture', 'forged-owner', 'first')
    with db() as c:
        assert c.execute('SELECT count(*) FROM bnb_consumer_delivery WHERE receipt_digest=%s', (digest,)).fetchone() == (1,)


def test_other_consumer_cannot_use_first_consumers_claim_or_receipt(db):
    eid = enrolled(db)
    owner, _ = claim(db, 'search-fixture')
    with pytest.raises(outbox.DeliveryError, match='LEASE_LOST'):
        ack(db, eid, 'travel-fixture', owner)
    assert status(db, eid) is None
    with pytest.raises(outbox.DeliveryError, match='CONSUMER_REVOKED'):
        ack(db, eid, 'unknown-fixture', owner)


def test_revoked_consumer_cannot_claim_renew_ack_or_fail_and_others_continue(db):
    eid = enrolled(db)
    owner, _ = claim(db, 'search-fixture')
    assert configure(db, 'search-fixture', active=False, revision=1) == 2
    actions = [lambda c: delivery.claim(c, 'new-owner', 'search-fixture'),
               lambda c: delivery.renew(c, eid, owner, 'search-fixture'),
               lambda c: delivery.acknowledge(c, eid, owner, 'search-fixture', 'late'),
               lambda c: delivery.fail(c, eid, owner, 'search-fixture', 'late')]
    for action in actions:
        with db() as c:
            with pytest.raises(outbox.DeliveryError, match='CONSUMER_REVOKED'):
                action(c)
    other, rows = claim(db, 'travel-fixture')
    assert rows[0]['id'] == eid
    ack(db, eid, 'travel-fixture', other)
    assert status(db, eid) is None


def test_reenable_does_not_silently_revive_old_claim_requires_authorized_replay(db):
    eid = enrolled(db, ('only-fixture',))
    old, _ = claim(db, 'only-fixture')
    configure(db, 'only-fixture', active=False, revision=1)
    configure(db, 'only-fixture', active=True, revision=2)
    assert claim(db, 'only-fixture')[1] == []
    with pytest.raises(outbox.DeliveryError, match='DELIVERY_NOT_AUTHORIZED'):
        ack(db, eid, 'only-fixture', old)
    with db() as c:
        with pytest.raises(outbox.DeliveryError, match='CONSUMER_AUTHORITY_REQUIRED'):
            delivery.replay(c, eid, 'only-fixture', actor='unverified', reason='fixture replay')
    due(db, eid, 'only-fixture')
    with db() as c:
        assert delivery.replay(c, eid, 'only-fixture', actor='approved', reason='fixture replay', authorize=lambda *_: True)
    new, rows = claim(db, 'only-fixture')
    assert rows[0]['attempts'] == 1
    with pytest.raises(outbox.DeliveryError, match='LEASE_LOST'):
        ack(db, eid, 'only-fixture', old)
    ack(db, eid, 'only-fixture', new)


def test_retry_deadletter_and_replay_are_independent_per_consumer(db):
    eid = enrolled(db)
    good, _ = claim(db, 'travel-fixture')
    ack(db, eid, 'travel-fixture', good)
    for attempt in range(1, outbox.MAX_ATTEMPTS + 1):
        owner, rows = claim(db, 'search-fixture')
        assert rows[0]['attempts'] == attempt
        with db() as c:
            state = delivery.fail(c, eid, owner, 'search-fixture', 'provider_unavailable')
        due(db, eid, 'search-fixture')
    assert state == 'dead_letter' and claim(db, 'search-fixture')[1] == []
    assert status(db, eid) is None
    with db() as c:
        receipt = c.execute('SELECT receipt_digest FROM bnb_consumer_delivery WHERE consumer=%s', ('travel-fixture',)).fetchone()[0]
        assert delivery.replay(c, eid, 'search-fixture', actor='operator', reason='provider recovered', authorize=lambda *_: True)
    owner, _ = claim(db, 'search-fixture')
    ack(db, eid, 'search-fixture', owner)
    assert status(db, eid) is not None
    with db() as c:
        assert c.execute('SELECT receipt_digest FROM bnb_consumer_delivery WHERE consumer=%s', ('travel-fixture',)).fetchone()[0] == receipt
        with pytest.raises(outbox.DeliveryError, match='REPLAY_NOT_ELIGIBLE'):
            delivery.replay(c, eid, 'travel-fixture', actor='operator', reason='repeat accepted event', authorize=lambda *_: True)


def test_crash_only_attempt_limit_is_independent(db):
    eid = enrolled(db)
    for _ in range(outbox.MAX_ATTEMPTS):
        assert claim(db, 'search-fixture')[1]
        due(db, eid, 'search-fixture')
    assert not claim(db, 'search-fixture')[1]
    owner, rows = claim(db, 'travel-fixture')
    assert rows[0]['attempts'] == 1
    ack(db, eid, 'travel-fixture', owner)
    assert status(db, eid) is None


def test_enrollment_transaction_rollback_and_competing_enrollers(db):
    configure(db, 'only-fixture')
    eid = enqueue(db)
    with db() as c:
        assert delivery.enroll(c) == 1
        c.rollback()
    with db() as c:
        assert c.execute('SELECT count(*) FROM bnb_consumer_delivery').fetchone() == (0,)
        assert c.execute('SELECT consumer_managed FROM bnb_outbox WHERE id=%s', (eid,)).fetchone() == (False,)
    def run(_):
        with db() as c:
            return delivery.enroll(c)
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sum(pool.map(run, range(2))) == 1
    with db() as c:
        assert c.execute('SELECT count(*) FROM bnb_consumer_delivery').fetchone() == (1,)


def test_competing_workers_and_simultaneous_independent_acks(db):
    eid = enrolled(db)
    barrier = threading.Barrier(2)
    def compete(n):
        barrier.wait()
        return claim(db, 'search-fixture', 'competing-' + str(n))[1]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(compete, range(2)))
    assert sum(map(len, results)) == 1
    with db() as c:
        owner = c.execute('SELECT lease_owner FROM bnb_consumer_delivery WHERE consumer=%s', ('search-fixture',)).fetchone()[0]
    other, _ = claim(db, 'travel-fixture')
    barrier = threading.Barrier(2)
    def accept(args):
        barrier.wait()
        return ack(db, eid, *args)
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert len(list(pool.map(accept, [('search-fixture', owner), ('travel-fixture', other)]))) == 2
    assert status(db, eid) is not None


def test_registry_authority_cas_idempotence_and_history(db):
    with db() as c:
        with pytest.raises(outbox.DeliveryError, match='CONSUMER_AUTHORITY_REQUIRED'):
            delivery.configure(c, 'only-fixture', [KIND], active=True, expected_revision=0, actor='unverified')
    assert configure(db, 'only-fixture') == 1
    assert configure(db, 'only-fixture', revision=1) == 1
    with pytest.raises(outbox.DeliveryError, match='REVISION_CONFLICT'):
        configure(db, 'only-fixture', active=False, revision=0)
    with db() as c:
        assert c.execute('SELECT count(*) FROM bnb_consumer_subscription_history').fetchone() == (1,)


def test_late_subscriber_and_no_subscribers_do_not_fabricate_historical_acceptance(db):
    eid = enqueue(db)
    with db() as c:
        assert delivery.enroll(c) == 0
    configure(db, 'first-fixture')
    with db() as c:
        assert delivery.enroll(c) == 1
    configure(db, 'late-fixture')
    with db() as c:
        assert delivery.enroll(c) == 0
        assert c.execute('SELECT consumer FROM bnb_consumer_delivery WHERE event_id=%s', (eid,)).fetchall() == [('first-fixture',)]
    assert claim(db, 'late-fixture')[1] == []
    owner, _ = claim(db, 'first-fixture')
    ack(db, eid, 'first-fixture', owner)
    assert status(db, eid) is not None


def test_legacy_owner_cannot_bypass_active_subscriptions_or_managed_delivery(db):
    eid = enqueue(db)
    with db() as c:
        assert outbox.claim(c, 'legacy')[0]['id'] == eid
    configure(db, 'only-fixture')
    with db() as c:
        with pytest.raises(outbox.DeliveryError, match='CONSUMER_DELIVERY_REQUIRED'):
            outbox.acknowledge(c, eid, 'legacy', 'local', 'unsafe-global-ack')
        assert outbox.claim(c, 'other') == []
    with db() as c:
        c.execute("UPDATE bnb_outbox SET lease_expires_at=clock_timestamp()-interval '1s' WHERE id=%s", (eid,))
        assert delivery.enroll(c) == 1
    configure(db, 'only-fixture', active=False, revision=1)
    with db() as c:
        assert outbox.claim(c, 'legacy-after-revoke') == []
        with pytest.raises(outbox.DeliveryError, match='CONSUMER_DELIVERY_REQUIRED'):
            outbox.replay(c, eid, 'operator', 'bypass managed replay', authorize=lambda *_: True)


def test_payload_change_and_poison_isolation_prevent_false_receipts(db):
    eid = enrolled(db, ('only-fixture',))
    owner, _ = claim(db, 'only-fixture')
    with db() as c:
        c.execute("UPDATE bnb_outbox SET payload='{" + '"hold_id":"changed"' + "}'::jsonb WHERE id=%s", (eid,))
    with pytest.raises(outbox.DeliveryError, match='EVENT_CHANGED'):
        ack(db, eid, 'only-fixture', owner)
    assert status(db, eid) is None
    with db() as c:
        assert delivery.fail(c, eid, owner, 'only-fixture', 'invalid_event') == 'retry'
    poison = enqueue(db, {'token': 'DO-NOT-PUBLISH'})
    safe = enqueue(db)
    class Sink:
        def accept(self, event_id, encoded):
            assert 'DO-NOT-PUBLISH' not in encoded
            return 'safe-receipt'
    supervisor = worker.Supervisor(db, Sink(), consumer='only-fixture')
    results = [supervisor.once() for _ in range(3)]
    assert 'invalid_event' in results and 'delivered' in results
    assert status(db, poison) is None and status(db, safe) is not None


def test_supervised_consumer_delivery_restarts_after_accept_before_ack(db):
    eid = enrolled(db)
    class CrashOnce(worker.LocalValidationSink):
        crashed = False
        def accept(self, *args):
            receipt = super().accept(*args)
            if not self.crashed:
                self.crashed = True
                raise RuntimeError('after durable local commit')
            return receipt
    sink = CrashOnce(db)
    assert worker.Supervisor(db, sink, consumer='search-fixture').once() == 'retry'
    due(db, eid, 'search-fixture')
    assert worker.Supervisor(db, sink, consumer='search-fixture').once() == 'delivered'
    assert status(db, eid) is None
    assert worker.Supervisor(db, worker.LocalValidationSink(db), consumer='travel-fixture').once() == 'delivered'
    assert status(db, eid) is not None


@pytest.mark.parametrize('kinds,active,revision', [([],True,0),([KIND,KIND],True,0),
    (['unapproved.event'],True,0),([KIND],1,0),([KIND],True,True)])
def test_subscription_bounds(db, kinds, active, revision):
    with db() as c:
        with pytest.raises(outbox.DeliveryError, match='SUBSCRIPTION_INVALID'):
            delivery.configure(c, 'fixture', kinds, active=active, expected_revision=revision,
                actor='operator', authorize=lambda *_: True)


from test_bnb32_infrastructure import database as tls_database


def test_append_only_migration_preserves_old_events_and_runtime_consumer_dml(tls_database):
    import production
    _, migrator, runtime = tls_database
    old = uuid4()
    with psycopg.connect(**migrator) as c:
        c.execute('SET LOCAL ROLE bnb_owner')
        c.execute('DROP TABLE bnb_consumer_delivery,bnb_consumer_subscription_history,bnb_consumer_subscription')
        c.execute('DROP INDEX bnb_outbox_consumer_enrollment')
        c.execute('ALTER TABLE bnb_outbox DROP COLUMN consumer_managed')
        c.execute('DELETE FROM bnb_schema_migration WHERE version=27')
        c.execute("INSERT INTO bnb_outbox(id,event_type,payload,delivered_at) VALUES(%s,%s,'{}',now())", (old, KIND))
    with psycopg.connect(**migrator) as c:
        assert production.controlled_migration(c) == 27
    with psycopg.connect(**runtime) as c:
        production.verify_database(c)
        assert c.execute('SELECT delivered_at IS NOT NULL,consumer_managed FROM bnb_outbox WHERE id=%s', (old,)).fetchone() == (True,False)
        assert delivery.configure(c, 'runtime-fixture', [KIND], active=True, expected_revision=0, actor='operator', authorize=lambda *_: True) == 1
        assert delivery.enroll(c) == 0
        assert c.execute('SELECT count(*) FROM bnb_consumer_delivery').fetchone() == (0,)


def test_live_renewal_expiry_and_reclaim_cannot_cross_consumer_fences(db):
    eid = enrolled(db)
    old, _ = claim(db, 'search-fixture')
    with db() as c:
        assert delivery.renew(c, eid, old, 'search-fixture')
        with pytest.raises(outbox.DeliveryError, match='LEASE_LOST'):
            delivery.renew(c, eid, old, 'travel-fixture')
    due(db, eid, 'search-fixture')
    with db() as c:
        with pytest.raises(outbox.DeliveryError, match='LEASE_LOST'):
            delivery.renew(c, eid, old, 'search-fixture')
    new, _ = claim(db, 'search-fixture')
    with pytest.raises(outbox.DeliveryError, match='LEASE_LOST'):
        ack(db, eid, 'search-fixture', old)
    ack(db, eid, 'search-fixture', new)
    assert status(db, eid) is None


def test_revocation_during_adapter_accept_cannot_commit_receipt(db):
    eid = enrolled(db)
    class RevokingSink:
        def accept(self, *_):
            configure(db, 'search-fixture', active=False, revision=1)
            return 'arrived-after-revocation'
    with pytest.raises(outbox.DeliveryError, match='CONSUMER_REVOKED'):
        worker.Supervisor(db, RevokingSink(), consumer='search-fixture').once()
    with db() as c:
        assert c.execute('SELECT count(*) FROM bnb_consumer_delivery WHERE accepted_at IS NOT NULL').fetchone() == (0,)
    assert status(db, eid) is None


def test_replay_cannot_restore_removed_event_scope(db):
    eid = enrolled(db, ('only-fixture',))
    configure(db, 'only-fixture', revision=1, kinds=['bnb.discovery.changed'])
    with db() as c:
        with pytest.raises(outbox.DeliveryError, match='DELIVERY_NOT_AUTHORIZED'):
            delivery.replay(c, eid, 'only-fixture', actor='operator', reason='scope removed', authorize=lambda *_: True)
    assert claim(db, 'only-fixture')[1] == [] and status(db, eid) is None


def test_actual_consumer_process_crash_after_accept_recovers_only_own_delivery(db):
    import subprocess
    eid = enrolled(db)
    with db() as c:
        schema = c.execute('SELECT current_schema()').fetchone()[0]
    code = '''import os,psycopg,worker
connect=lambda:psycopg.connect(os.environ['BNB_DATABASE_URL'],options='-c search_path='+os.environ['BNB53_TEST_SCHEMA'],connect_timeout=3)
class Crash(worker.LocalValidationSink):
 def accept(self,*args):
  super().accept(*args)
  os._exit(23)
worker.Supervisor(connect,Crash(connect),consumer='search-fixture').once()
'''
    result = subprocess.run([sys.executable, '-c', code], cwd=ROOT,
        env=dict(os.environ, BNB53_TEST_SCHEMA=schema), capture_output=True, timeout=8)
    assert result.returncode == 23
    due(db, eid, 'search-fixture')
    assert worker.Supervisor(db, worker.LocalValidationSink(db), consumer='search-fixture').once() == 'delivered'
    assert status(db, eid) is None
    with db() as c:
        assert c.execute('SELECT attempts,accepted_at FROM bnb_consumer_delivery WHERE consumer=%s', ('travel-fixture',)).fetchone() == (0, None)


def test_production_restart_never_reactivates_revoked_local_consumer(tls_database, monkeypatch):
    import production
    _, _, runtime = tls_database
    values = dict(runtime, options='-c search_path=public')
    with psycopg.connect(**values) as c:
        delivery.configure(c, 'bnb-local-validation', sorted(outbox.EVENT_TYPES), active=False,
            expected_revision=0, actor='operator', authorize=lambda *_: True)
    monkeypatch.setattr(production, 'load_contract', lambda: ({}, {}, values))
    monkeypatch.setenv('BNB_WORKER_SINK', 'local-validation')
    import signal
    prior = {s: signal.getsignal(s) for s in (signal.SIGTERM, signal.SIGINT)}
    try:
        with pytest.raises(outbox.DeliveryError, match='CONSUMER_REVOKED'):
            worker.main()
    finally:
        for sig, handler in prior.items():
            signal.signal(sig, handler)
    with psycopg.connect(**values) as c:
        assert c.execute("SELECT active,revision FROM bnb_consumer_subscription WHERE consumer='bnb-local-validation'").fetchone() == (False, 1)


@pytest.mark.parametrize('operation', ['configure','enroll','claim','renew','acknowledge','fail','replay'])
def test_autocommit_cannot_create_partial_enrollment_or_receipt_state(db, operation):
    eid = uuid4()
    actions = {
        'configure': lambda c: delivery.configure(c, 'fixture', [KIND], active=True,
            expected_revision=0, actor='operator', authorize=lambda *_: True),
        'enroll': lambda c: delivery.enroll(c),
        'claim': lambda c: delivery.claim(c, 'owner', 'fixture'),
        'renew': lambda c: delivery.renew(c, eid, 'owner', 'fixture'),
        'acknowledge': lambda c: delivery.acknowledge(c, eid, 'owner', 'fixture', 'receipt'),
        'fail': lambda c: delivery.fail(c, eid, 'owner', 'fixture', 'failure'),
        'replay': lambda c: delivery.replay(c, eid, 'fixture', actor='operator',
            reason='fixture replay', authorize=lambda *_: True),
    }
    with db() as c:
        c.autocommit = True
        with pytest.raises(outbox.DeliveryError, match='TRANSACTION_REQUIRED'):
            actions[operation](c)
        assert c.execute('SELECT count(*) FROM bnb_consumer_subscription').fetchone() == (0,)
        assert c.execute('SELECT count(*) FROM bnb_consumer_delivery').fetchone() == (0,)


def test_configure_and_worker_claim_use_consistent_registry_lock_order(db):
    import time
    enrolled(db, ('only-fixture',))
    label = 'bnb53-lock-' + uuid4().hex
    def connect_worker():
        c = db()
        c.execute("SELECT set_config('application_name',%s,false)", (label,))
        c.commit()
        return c
    def run_worker():
        with pytest.raises(outbox.DeliveryError, match='CONSUMER_REVOKED'):
            worker.Supervisor(connect_worker, worker.LocalValidationSink(connect_worker), consumer='only-fixture').once()
    with db() as operator, ThreadPoolExecutor(max_workers=1) as pool:
        operator.execute('SELECT pg_advisory_xact_lock(420503)')
        future = pool.submit(run_worker)
        try:
            deadline = time.monotonic() + 4
            while True:
                operator.execute('SELECT pg_stat_clear_snapshot()')
                if operator.execute("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=%s AND wait_event='advisory')", (label,)).fetchone()[0]:
                    break
                assert time.monotonic() < deadline
                time.sleep(.02)
            # Worker must not hold the consumer row while it waits for the registry lock.
            assert delivery.configure(operator, 'only-fixture', [KIND], active=False,
                expected_revision=1, actor='operator', authorize=lambda *_: True) == 2
            operator.commit()
            future.result(timeout=5)
        finally:
            # Release the database lock before joining the test thread on any failure.
            operator.rollback()
