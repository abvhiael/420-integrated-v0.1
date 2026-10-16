"""BNB-5.2 bounded local outbox supervisor. No external transport is enabled."""
import hashlib
import json
import math
import os
import signal
import sys
import threading
import time
from uuid import uuid4

import psycopg
import outbox
import consumer_delivery


class LocalValidationSink:
    """Durable idempotent validation receipt, not Search/Travel/provider acceptance.

    Reuses the existing transactional dedupe store; stores a digest, never payloads.
    Independent consumer delivery state is owned by BNB-5.3.
    """
    def __init__(self, connect):
        self.connect = connect

    def accept(self, event_id, encoded):
        digest = hashlib.sha256(encoded.encode()).hexdigest()
        receipt = "local-validation-" + digest
        with self.connect() as c:
            c.execute("""INSERT INTO bnb_request_dedupe(actor,operation,key,digest,result)
                VALUES ('bnb-worker','local-validation',%s,%s,%s::jsonb)
                ON CONFLICT DO NOTHING""", (event_id, digest, json.dumps({'receipt': receipt})))
            row = c.execute("""SELECT digest,result FROM bnb_request_dedupe
                WHERE actor='bnb-worker' AND operation='local-validation' AND key=%s""",
                (event_id,)).fetchone()
            if row[0] != digest:
                raise outbox.DeliveryError('RECEIPT_CONFLICT')
            return row[1]['receipt']


class Supervisor:
    def __init__(self, connect, adapter, *, lease_seconds=30, poll_seconds=1,
                 grace_seconds=5, delivery_seconds=20, stop=None, consumer=None):
        if any(type(x) not in (int, float) or not math.isfinite(x)
               for x in (poll_seconds, grace_seconds, delivery_seconds)):
            raise ValueError('WORKER_BOUNDS')
        if (type(lease_seconds) is not int or not 10 <= lease_seconds <= 300
                or not 0.05 <= poll_seconds <= 30 or not 0 <= grace_seconds <= 30
                or not 0.05 <= delivery_seconds <= 60):
            raise ValueError('WORKER_BOUNDS')
        if consumer is not None:
            outbox._identity(consumer, outbox.CONSUMER, 'CONSUMER_INVALID')
        self.consumer = consumer
        self.connect, self.adapter = connect, adapter
        self.lease_seconds, self.poll_seconds = lease_seconds, poll_seconds
        self.grace_seconds, self.delivery_seconds = grace_seconds, delivery_seconds
        self.stop = stop if stop is not None else threading.Event()

    def _claim(self, c, owner):
        if self.consumer is None:
            return outbox.claim(c, owner, limit=1, lease_seconds=self.lease_seconds)
        consumer_delivery._subscription(c, self.consumer)
        consumer_delivery.enroll(c)
        return consumer_delivery.claim(c, owner, self.consumer, lease_seconds=self.lease_seconds)

    def _renew(self, c, eid, owner):
        if self.consumer is None:
            return outbox.renew(c, eid, owner, lease_seconds=self.lease_seconds)
        return consumer_delivery.renew(c, eid, owner, self.consumer, lease_seconds=self.lease_seconds)

    def _ack(self, c, eid, owner, receipt):
        if self.consumer is None:
            return outbox.acknowledge(c, eid, owner, 'bnb-local-validation', receipt)
        return consumer_delivery.acknowledge(c, eid, owner, self.consumer, receipt)

    def _fail(self, c, eid, owner, code):
        if self.consumer is None:
            return outbox.fail(c, eid, owner, code)
        return consumer_delivery.fail(c, eid, owner, self.consumer, code)

    def once(self):
        if self.stop.is_set():
            return 'stopped'
        # Unique for every claim, including retries in the same process: no ABA owner reuse.
        owner = 'bnb-' + uuid4().hex
        with self.connect() as c:
            events = self._claim(c, owner)
        if not events:
            return 'idle'
        event = events[0]
        try:
            encoded = outbox._event(event)
            if self.consumer is not None and consumer_delivery.envelope_digest(event) != event['envelope_digest']:
                raise outbox.DeliveryError('EVENT_CHANGED')
        except outbox.DeliveryError:
            with self.connect() as c:
                self._fail(c, event['id'], owner, 'invalid_event')
            return 'invalid_event'
        done = threading.Event()
        result = {}
        def deliver():
            try:
                result['receipt'] = self.adapter.accept(str(event['id']), encoded)
            except Exception:
                result['error'] = True
            finally:
                done.set()
        # A blocked adapter cannot hold process shutdown; its durable acceptance must dedupe.
        thread = threading.Thread(target=deliver, daemon=True)
        thread.start()
        started = time.monotonic()
        renewed = started
        stopping = None
        while not done.wait(0.05):
            now = time.monotonic()
            if self.stop.is_set() and stopping is None:
                stopping = now
            if now - started >= self.delivery_seconds or (
                    stopping is not None and now - stopping >= self.grace_seconds):
                # Do not release a lease while an uncertain accept may still be running.
                # Reclaim after expiry; idempotent sink closes crash-after-accept ambiguity.
                self.stop.set()
                return 'abandoned'
            if now - renewed >= self.lease_seconds / 3:
                try:
                    with self.connect() as c:
                        self._renew(c, event['id'], owner)
                except (psycopg.Error, outbox.DeliveryError):
                    self.stop.set()
                    raise
                renewed = now
        with self.connect() as c:
            if result.get('error'):
                self._fail(c, event['id'], owner, 'provider_unavailable')
                return 'retry'
            self._ack(c, event['id'], owner, result['receipt'])
        return 'delivered'

    def run(self, *, max_cycles=None):
        if max_cycles is not None and (type(max_cycles) is not int or not 1 <= max_cycles <= 10000):
            raise ValueError('WORKER_BOUNDS')
        failures = cycles = 0
        state = 'stopped'
        while not self.stop.is_set() and (max_cycles is None or cycles < max_cycles):
            cycles += 1
            try:
                state = self.once()
                failures = 0
            except outbox.DeliveryError:
                state = 'lease_lost'
            except psycopg.Error:
                # Fresh connection for every operation; never reuse a broken transaction.
                failures = min(failures + 1, 5)
                state = 'database_unavailable'
            print(json.dumps({'component': 'bnb-worker', 'state': state}), flush=True)
            delay = min(30, 2 ** failures) if failures else self.poll_seconds
            self.stop.wait(delay)
        return 1 if self.stop.is_set() and state in ('abandoned', 'database_unavailable', 'lease_lost') else 0


def main():
    from production import load_contract, verify_database
    # Direct worker startup gets the same mount/role/TLS/image/disabled-flag validation as API.
    if os.environ.get('BNB_WORKER_SINK') != 'local-validation':
        raise ValueError('WORKER_SINK_NOT_APPROVED')
    _, _, values = load_contract(purpose="worker")
    values['options'] += ' -c statement_timeout=5000 -c lock_timeout=2000'
    def connect():
        c = psycopg.connect(**values)
        try:
            verify_database(c)
            c.execute("SET statement_timeout='5s'")
            c.execute("SET lock_timeout='2s'")
            c.commit()
            return c
        except Exception:
            c.close()
            raise
    stop = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stop.set())
    # Only the explicitly selected, local rehearsal sink is configured here.
    # Independent network consumers require their own approved configuration/transport.
    with connect() as c:
        row = c.execute("SELECT revision FROM bnb_consumer_subscription WHERE consumer='bnb-local-validation'").fetchone()
        if row:
            consumer_delivery._subscription(c, 'bnb-local-validation')
        else:
            consumer_delivery.configure(c, 'bnb-local-validation', sorted(outbox.EVENT_TYPES),
                active=True, expected_revision=0, actor='local-worker-contract',
                authorize=lambda actor, action, consumer: actor == 'local-worker-contract'
                    and action == 'configure' and consumer == 'bnb-local-validation')
    # Refresh derived views independently of external event acceptance.
    from projection_refresh import once as refresh_once
    from api import occupancy_in_window
    class ProjectionSupervisor(Supervisor):
        def once(self):
            if self.stop.is_set():
                return 'stopped'
            with self.connect() as c:
                refreshed = refresh_once(c, occupancy=occupancy_in_window)
            state = super().once()
            return 'refreshed' if refreshed and state == 'idle' else state
    supervisor = ProjectionSupervisor(connect, LocalValidationSink(connect), stop=stop, consumer='bnb-local-validation')
    return supervisor.run()


def cli():
    try:
        return main()
    except Exception:
        # No exception text, DSN, event payload or credentials in operational output.
        print('WORKER_START_FAILED', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(cli())


def isolated_discovery_worker(connect, consumer, endpoint, proof_provider, *, ssl_context,
                              stop=None, lease_seconds=30):
    """Construct an app-local supervised network consumer, not a production switch.

    Caller explicitly supplies independently provisioned TLS trust and JWT grant
    provider. Production CLI remains local-validation only and fail closed.
    """
    from discovery_network import NetworkDiscoveryDelivery
    adapter=NetworkDiscoveryDelivery(connect,consumer,endpoint,proof_provider,
                                     ssl_context=ssl_context)
    return Supervisor(connect,adapter,consumer=consumer,stop=stop,
                      lease_seconds=lease_seconds)
