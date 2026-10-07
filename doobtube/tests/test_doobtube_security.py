from datetime import datetime, timedelta, timezone
import os, tempfile, unittest

from doobtube.api import AuthContext, Backend, Request, RuntimeConfig
from doobtube.integration import EcosystemMilestone, EcosystemInput, IdentitySnapshot, RightsSnapshot, SearchSnapshot, IntegrationDenied
from doobtube.integrations.ecosystem import (
    CANONICAL_OWNERS, MediaCompatibility, NotificationSubscription, PublicProjection,
    RegistrySnapshot, SERVICE_IDS, StorageReadiness,
)
from doobtube.security import AbuseGuard, AbusePolicy, SecurityDenied, assert_no_secret_fields, redact_sensitive_text


class Clock:
    def __init__(self): self.value=datetime(2026,10,7,4,30,tzinfo=timezone.utc)
    def now(self): return self.value
    def advance(self,seconds): self.value+=timedelta(seconds=seconds)


class DoobTubeSecurityTests(unittest.TestCase):
    def setUp(self):
        self.clock=Clock()
        self.tmp=tempfile.TemporaryDirectory()
        self.guard=AbuseGuard({
            "preferences.write":AbusePolicy(2,60),
            "control.rebuild":AbusePolicy(1,60),
            "operator.metrics":AbusePolicy(2,60),
        },now=self.clock.now)
        self.backend=Backend(
            RuntimeConfig(420,"testnet",os.path.join(self.tmp.name,"db.sqlite"),secret_provider_ref="secret://runtime"),
            dependency_probe=lambda:{"420Media":True,"420Registry":True},
            now=self.clock.now,
            abuse_guard=self.guard,
        )
        self.auth=AuthContext("0xabc",420,"testnet",frozenset({"doobtube.preferences","doobtube.operator.rebuild","doobtube.operator.metrics"}))

    def tearDown(self):
        self.backend.close();self.tmp.cleanup()

    def req(self,method,path,*,body=None,headers=None,auth=None):
        return Request(method,path,{},headers or {},body or {},auth)

    def test_broken_access_control_and_privilege_escalation_fail_closed(self):
        no_cap=AuthContext("0xabc",420,"testnet",frozenset())
        out=self.backend.handle(self.req("POST","/v1/control/rebuild",headers={"Idempotency-Key":"r1"},auth=no_cap))
        self.assertEqual(out.status,403)
        wrong=AuthContext("0xabc",421,"testnet",frozenset({"doobtube.operator.rebuild"}))
        out=self.backend.handle(self.req("POST","/v1/control/rebuild",headers={"Idempotency-Key":"r2"},auth=wrong))
        self.assertEqual(out.status,409)

    def test_actor_operation_rate_limit_and_window_reset(self):
        for i in range(2):
            out=self.backend.handle(self.req("PUT","/v1/preferences",body={"autoplay":bool(i)},headers={"Idempotency-Key":f"p{i}"},auth=self.auth))
            self.assertEqual(out.status,200)
        denied=self.backend.handle(self.req("PUT","/v1/preferences",body={"autoplay":True},headers={"Idempotency-Key":"p3"},auth=self.auth))
        self.assertEqual(denied.status,429)
        self.assertEqual(denied.body["error"]["code"],"RATE_LIMITED")
        self.clock.advance(60)
        ok=self.backend.handle(self.req("PUT","/v1/preferences",body={"autoplay":True},headers={"Idempotency-Key":"p4"},auth=self.auth))
        self.assertEqual(ok.status,200)

    def test_replay_same_key_does_not_consume_second_abuse_slot(self):
        req=self.req("PUT","/v1/preferences",body={"autoplay":False},headers={"Idempotency-Key":"same"},auth=self.auth)
        first=self.backend.handle(req);second=self.backend.handle(req)
        self.assertEqual(first.status,200);self.assertEqual(second.status,200)
        third=self.backend.handle(self.req("PUT","/v1/preferences",body={"autoplay":True},headers={"Idempotency-Key":"other"},auth=self.auth))
        self.assertEqual(third.status,200)

    def test_rebuild_spam_is_bounded(self):
        first=self.backend.handle(self.req("POST","/v1/control/rebuild",headers={"Idempotency-Key":"r1"},auth=self.auth))
        self.assertEqual(first.status,202)
        second=self.backend.handle(self.req("POST","/v1/control/rebuild",headers={"Idempotency-Key":"r2"},auth=self.auth))
        self.assertEqual(second.status,429)

    def test_privacy_redactor_removes_tokens_secret_refs_url_credentials_and_query_secrets(self):
        raw="Bearer abc.def secret://stream/s1 https://user:pass@edge.example/x?token=abc&key=def"
        value=redact_sensitive_text(raw)
        for forbidden in ("abc.def","stream/s1","user:pass","token=abc","key=def"):
            self.assertNotIn(forbidden,value)
        self.assertIn("[REDACTED]",value)

    def test_secret_like_persistence_fields_are_rejected(self):
        for payload in [
            {"privateKey":"x"},{"seed_phrase":"x"},{"nested":{"apiKey":"x"}},{"items":[{"password":"x"}]}
        ]:
            with self.assertRaises(SecurityDenied): assert_no_secret_fields(payload)
        assert_no_secret_fields({"wallet":"0xabc","credential_ref":"opaque-ref","media_asset_id":"asset-1"})

    def test_job_error_persistence_redacts_sensitive_exception_text(self):
        out=self.backend.handle(self.req("POST","/v1/control/rebuild",headers={"Idempotency-Key":"job-redact"},auth=self.auth))
        job_id=out.body["data"]["job_id"]
        def bad(_payload): raise RuntimeError("Bearer TOPSECRET secret://job/raw https://u:p@edge.example/?token=LEAK")
        self.backend.run_due_jobs({"projection_rebuild":bad})
        row=self.backend.store.db.execute("SELECT last_error FROM jobs WHERE job_id=?",(job_id,)).fetchone()
        value=row["last_error"]
        for forbidden in ("TOPSECRET","job/raw","u:p","token=LEAK"): self.assertNotIn(forbidden,value)

    def test_content_rights_abuse_cannot_publish_revoked_asset(self):
        wallet="0x1111111111111111111111111111111111111111";now=1000
        names=("420Registry","420Wallet","420SmartAccounts","420Media","420Identity","420Rights","420Storage","420Search","420Notifications","420Pay","420Compute")
        registry={n:RegistrySnapshot(n,SERVICE_IDS[n],1,True,False,420,now-1,f"ref:{n}") for n in names}
        value=EcosystemInput(
            420,"testnet",now,wallet,registry,
            MediaCompatibility(SERVICE_IDS["420Media"],"v1",1,420,"testnet",frozenset({"media.uploads","media.livestreaming"})),
            IdentitySnapshot(False,wallet),
            RightsSnapshot("asset-1","prov",True,True),
            StorageReadiness("o","m",0,"r",1,"c",True,True,True),
            SearchSnapshot("asset-1",SERVICE_IDS["420Search"],False,10,9),
            PublicProjection("asset-1","READY","PUBLIC",True,420,10,9,False),
            NotificationSubscription(wallet,"creator",True,False,False,False,False),
            dict(CANONICAL_OWNERS),
        )
        with self.assertRaises(IntegrationDenied): EcosystemMilestone().qualify(value)


if __name__=="__main__": unittest.main()
