from datetime import datetime, timedelta, timezone
import os
import tempfile
import unittest

from doobtube.api import AuthContext, Backend, ProjectionEvent, Request, RuntimeConfig


class Clock:
    def __init__(self):
        self.value = datetime(2026, 10, 6, 20, 0, tzinfo=timezone.utc)
    def now(self):
        return self.value
    def advance(self, seconds):
        self.value += timedelta(seconds=seconds)


class DoobTubeBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.clock = Clock()
        self.backend = Backend(
            RuntimeConfig(
                chain_id=420,
                network="testnet",
                database_path=os.path.join(self.tmp.name, "doobtube.db"),
                max_job_attempts=3,
                retry_base_seconds=2,
                secret_provider_ref="secret://doobtube/runtime",
            ),
            dependency_probe=lambda: {"420Media": True, "420Registry": True, "420Search": True},
            now=self.clock.now,
        )
        self.auth = AuthContext(
            "0xabc", 420, "testnet",
            frozenset({"doobtube.preferences", "doobtube.operator.rebuild", "doobtube.operator.metrics"}),
        )

    def tearDown(self):
        self.backend.close()
        self.tmp.cleanup()

    def req(self, method, path, *, body=None, query=None, headers=None, auth=None):
        return Request(method, path, query or {}, headers or {}, body or {}, auth)

    def test_health_and_dependency_aware_readiness(self):
        health = self.backend.handle(self.req("GET", "/v1/health"))
        self.assertEqual(health.status, 200)
        self.assertEqual(health.body["version"], "v1")
        ready = self.backend.handle(self.req("GET", "/v1/readiness"))
        self.assertEqual(ready.status, 200)
        self.backend.dependency_probe = lambda: {"420Media": False, "420Registry": True}
        blocked = self.backend.handle(self.req("GET", "/v1/readiness"))
        self.assertEqual(blocked.status, 503)
        self.assertEqual(blocked.body["data"]["status"], "not_ready")

    def test_versioned_api_and_stable_errors(self):
        missing = self.backend.handle(self.req("GET", "/health"))
        self.assertEqual(missing.status, 404)
        self.assertEqual(missing.body["error"]["code"], "NOT_FOUND")
        self.assertEqual(missing.headers["X-DoobTube-API-Version"], "v1")

    def test_mutation_requires_wallet_chain_network_and_capability(self):
        headers = {"Idempotency-Key": "prefs-1"}
        anon = self.backend.handle(self.req("PUT", "/v1/preferences", body={"autoplay": False}, headers=headers))
        self.assertEqual(anon.body["error"]["code"], "UNAUTHORIZED")
        wrong = AuthContext("0xabc", 421, "testnet", frozenset({"doobtube.preferences"}))
        out = self.backend.handle(self.req("PUT", "/v1/preferences", body={"autoplay": False}, headers=headers, auth=wrong))
        self.assertEqual(out.body["error"]["code"], "DEPENDENCY_MISMATCH")
        no_cap = AuthContext("0xabc", 420, "testnet", frozenset())
        out = self.backend.handle(self.req("PUT", "/v1/preferences", body={"autoplay": False}, headers=headers, auth=no_cap))
        self.assertEqual(out.body["error"]["code"], "FORBIDDEN")

    def test_idempotency_exact_replay_and_conflict(self):
        headers = {"Idempotency-Key": "prefs-1"}
        first = self.backend.handle(self.req("PUT", "/v1/preferences", body={"autoplay": False}, headers=headers, auth=self.auth))
        second = self.backend.handle(self.req("PUT", "/v1/preferences", body={"autoplay": False}, headers=headers, auth=self.auth))
        self.assertEqual(first.status, 200)
        self.assertEqual(first.body, second.body)
        conflict = self.backend.handle(self.req("PUT", "/v1/preferences", body={"autoplay": True}, headers=headers, auth=self.auth))
        self.assertEqual(conflict.status, 409)
        self.assertEqual(conflict.body["error"]["code"], "IDEMPOTENCY_CONFLICT")

    def test_preferences_persist_across_restart(self):
        headers = {"Idempotency-Key": "prefs-persist"}
        self.backend.handle(self.req("PUT", "/v1/preferences", body={"reduced_motion": True}, headers=headers, auth=self.auth))
        path = self.backend.config.database_path
        self.backend.close()
        self.backend = Backend(RuntimeConfig(420, "testnet", path, secret_provider_ref="secret://doobtube/runtime"), now=self.clock.now)
        got = self.backend.handle(self.req("GET", "/v1/preferences", auth=self.auth))
        self.assertTrue(got.body["data"]["preferences"]["reduced_motion"])

    def event(self, height, block_hash, parent_hash, *, state="READY", visibility="PUBLIC", rights=True, finalized=0, asset=None):
        return ProjectionEvent(
            asset or f"asset-{height}", height, block_hash, parent_hash, finalized,
            state, visibility, rights, f"title-{height}", f"creator-{height}", self.clock.now()
        )

    def test_projection_public_only_pagination_and_opaque_cursor(self):
        self.backend.apply_projection(self.event(0, "h0", "", finalized=0))
        self.backend.apply_projection(self.event(1, "h1", "h0", visibility="UNLISTED", finalized=0))
        self.backend.apply_projection(self.event(2, "h2", "h1", rights=False, finalized=0))
        self.backend.apply_projection(self.event(3, "h3", "h2", finalized=1))
        page = self.backend.handle(self.req("GET", "/v1/feed", query={"limit": "1"}))
        self.assertEqual(len(page.body["data"]["items"]), 1)
        self.assertNotIn(page.body["data"]["items"][0]["media_asset_id"], {"asset-1", "asset-2"})
        cursor = page.body["data"]["next_cursor"]
        self.assertTrue(cursor)
        self.assertNotEqual(cursor, "1")
        second = self.backend.handle(self.req("GET", "/v1/feed", query={"limit": "1", "cursor": cursor}))
        self.assertEqual(second.status, 200)

    def test_finalized_history_conflict_fails_closed(self):
        self.backend.apply_projection(self.event(0, "h0", "", finalized=0))
        with self.assertRaises(Exception):
            self.backend.apply_projection(self.event(0, "evil", "", finalized=0))

    def test_nonfinalized_replacement_and_rebuild(self):
        self.backend.apply_projection(self.event(0, "h0", "", finalized=0))
        self.backend.apply_projection(self.event(1, "h1", "h0", finalized=0))
        # same-height non-finalized replacement rolls back and is accepted
        self.backend.apply_projection(self.event(1, "h1b", "h0", finalized=0, asset="asset-1b"))
        page = self.backend.handle(self.req("GET", "/v1/feed", query={"limit": "10"}))
        ids = {x["media_asset_id"] for x in page.body["data"]["items"]}
        self.assertIn("asset-1b", ids)
        self.assertNotIn("asset-1", ids)
        count = self.backend.rebuild_projection([
            self.event(0, "r0", "", finalized=0, asset="rebuild-0"),
            self.event(1, "r1", "r0", finalized=0, asset="rebuild-1"),
        ])
        self.assertEqual(count, 2)

    def test_rebuild_requires_strict_order(self):
        with self.assertRaises(Exception):
            self.backend.rebuild_projection([
                self.event(1, "h1", "h0"),
                self.event(0, "h0", ""),
            ])

    def test_rebuild_job_is_replay_safe(self):
        req = self.req("POST", "/v1/control/rebuild", headers={"Idempotency-Key": "rebuild-1"}, auth=self.auth)
        first = self.backend.handle(req)
        second = self.backend.handle(req)
        self.assertEqual(first.body, second.body)
        rows = self.backend.store.db.execute("SELECT COUNT(*) AS n FROM jobs").fetchone()
        self.assertEqual(rows["n"], 1)

    def test_bounded_job_retry_then_success(self):
        req = self.req("POST", "/v1/control/rebuild", headers={"Idempotency-Key": "rebuild-retry"}, auth=self.auth)
        out = self.backend.handle(req)
        job_id = out.body["data"]["job_id"]
        calls = {"n": 0}
        def handler(_payload):
            calls["n"] += 1
            if calls["n"] < 3:
                raise RuntimeError("temporary")
        self.backend.run_due_jobs({"projection_rebuild": handler})
        row = self.backend.store.db.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
        self.assertEqual(row["state"], "RETRY")
        self.clock.advance(2)
        self.backend.run_due_jobs({"projection_rebuild": handler})
        self.clock.advance(4)
        self.backend.run_due_jobs({"projection_rebuild": handler})
        row = self.backend.store.db.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
        self.assertEqual(row["state"], "DONE")
        self.assertEqual(row["attempts"], 3)

    def test_bounded_job_retry_terminal_failure(self):
        req = self.req("POST", "/v1/control/rebuild", headers={"Idempotency-Key": "rebuild-fail"}, auth=self.auth)
        out = self.backend.handle(req)
        job_id = out.body["data"]["job_id"]
        for delay in (0, 2, 4):
            if delay:
                self.clock.advance(delay)
            self.backend.run_due_jobs({"projection_rebuild": lambda _p: (_ for _ in ()).throw(RuntimeError("boom"))})
        row = self.backend.store.db.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
        self.assertEqual(row["state"], "FAILED")
        self.assertEqual(row["attempts"], 3)

    def test_secrets_boundary_rejects_raw_secret(self):
        with self.assertRaises(ValueError):
            RuntimeConfig(420, "testnet", ":memory:", raw_secret="plaintext-secret").validate()

    def test_metrics_are_operator_protected(self):
        denied = self.backend.handle(self.req("GET", "/v1/metrics"))
        self.assertEqual(denied.status, 401)
        allowed = self.backend.handle(self.req("GET", "/v1/metrics", auth=self.auth))
        self.assertEqual(allowed.status, 200)
        self.assertIn("api_requests_total", allowed.body["data"]["counters"])

    def test_migration_version_is_durable(self):
        row = self.backend.store.db.execute("SELECT v FROM meta WHERE k='schema_version'").fetchone()
        self.assertEqual(row["v"], "1")

    def test_unknown_preference_and_bad_cursor_fail_stably(self):
        out = self.backend.handle(self.req(
            "PUT", "/v1/preferences", body={"private_key": "no"}, headers={"Idempotency-Key": "bad-pref"}, auth=self.auth
        ))
        self.assertEqual(out.body["error"]["code"], "INVALID_REQUEST")
        bad = self.backend.handle(self.req("GET", "/v1/feed", query={"cursor": "not-valid***", "limit": "10"}))
        self.assertEqual(bad.body["error"]["code"], "INVALID_REQUEST")


if __name__ == "__main__":
    unittest.main()
