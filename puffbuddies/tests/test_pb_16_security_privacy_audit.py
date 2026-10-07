import ast
import pathlib
import re
import unittest

from puffbuddies.api.hardening import API_BASE, ApiRequest, ApiTransport, GatewayResult, SessionContext
from puffbuddies.domain.privacy import LeakageDenied, safe_aggregate, wallet_lookup_membership_result
from puffbuddies.domain.types import VisibilityAudience

ROOT=pathlib.Path(__file__).resolve().parents[2]


class _Auth:
    def authenticate(self, bearer_token, *, now_epoch):
        if bearer_token!="good-token":
            return None
        return SessionContext("session:opaque","subject:opaque",now_epoch+60,3)


class _Gateway:
    def dispatch(self, route_id, *, session, payload, request_id):
        return GatewayResult(200,{"ok":True},3)


class _Limiter:
    def allow(self, **kwargs): return True


class _Replay:
    def reserve(self, **kwargs): return True


class _Audit:
    def __init__(self): self.rows=[]
    def record(self, **row): self.rows.append(row)


def _transport(audit=None):
    return ApiTransport(
        authenticator=_Auth(),gateway=_Gateway(),rate_limiter=_Limiter(),
        replay_guard=_Replay(),audit_sink=audit or _Audit(),
        allowed_hosts=frozenset({"puff.example"}),
    )


class PB16SecurityPrivacyAuditTests(unittest.TestCase):
    def test_client_request_id_is_not_audit_authority(self):
        audit=_Audit()
        response=_transport(audit).handle(ApiRequest(
            "GET",API_BASE+"/eligibility",
            {"Authorization":"Bearer good-token","X-Request-Id":"private-profile-relationship-secret"},
            b"","https","puff.example",100,
        ))
        self.assertEqual(response.status,200)
        request_id=response.headers["X-Request-Id"]
        self.assertRegex(request_id,r"^pb-[0-9a-f]{32}$")
        self.assertNotEqual(request_id,"private-profile-relationship-secret")
        self.assertEqual(audit.rows[0]["request_id"],request_id)

    def test_privacy_aggregate_and_wallet_membership_fail_closed(self):
        self.assertEqual(safe_aggregate({"metric":"active","bucket":"coarse","count":2}).fields["count"],2)
        with self.assertRaises(LeakageDenied):
            safe_aggregate({"metric":"active","profile_id":"p1","count":2})
        with self.assertRaises(LeakageDenied):
            wallet_lookup_membership_result("0xabc")

    def test_no_dangerous_dynamic_execution_or_shell_primitives(self):
        forbidden_names={"eval","exec"}
        for path in (ROOT/"puffbuddies").rglob("*.py"):
            tree=ast.parse(path.read_text(),filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node,ast.Call) and isinstance(node.func,ast.Name):
                    self.assertNotIn(node.func.id,forbidden_names,f"{path}: dangerous dynamic execution")
                if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute):
                    target=node.func
                    if isinstance(target.value,ast.Name):
                        self.assertFalse(
                            target.value.id=="os" and target.attr=="system",
                            f"{path}: os.system prohibited"
                        )
                        if target.value.id=="subprocess":
                            self.fail(f"{path}: subprocess execution prohibited in PuffBuddies runtime")

    def test_runtime_source_has_no_secret_or_public_graph_assignments(self):
        source="\n".join(p.read_text(errors="ignore") for p in (ROOT/"puffbuddies").rglob("*") if p.is_file() and p.suffix in {".py",".js",".json",".swift",".kt",".xml",".plist"})
        for pattern in [
            r"(?i)(private_key|mnemonic|seed_phrase|government_id|date_of_birth|provider_secret)\s*[:=]\s*['\"]",
            r"(?i)(public_member_search|public_match_graph|public_block_graph|public_safety_graph|public_moderation_graph)\s*[:=]",
        ]:
            self.assertIsNone(re.search(pattern,source),pattern)

    def test_runtime_configs_do_not_claim_live_release(self):
        for rel in ["puffbuddies/web/runtime-config.json","puffbuddies/mobile/runtime-config.json"]:
            text=(ROOT/rel).read_text()
            self.assertNotRegex(text,r'"(?:deploymentStatus|distributionStatus)"\s*:\s*"(?:live|production|mainnet)"')

    def test_no_puffbuddies_contract_surface_exists(self):
        self.assertFalse((ROOT/"contracts/src/puffbuddies").exists())


if __name__=="__main__":
    unittest.main()
