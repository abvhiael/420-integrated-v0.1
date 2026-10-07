import io
import json
import unittest

from puffbuddies.api.hardening import (
    API_BASE, ApiDenied, ApiRequest, ApiTransport, GatewayResult, SessionContext,
)
from puffbuddies.api.wsgi import create_wsgi_app


class Auth:
    def __init__(self, session=None, fail=False):
        self.session=session; self.fail=fail
    def authenticate(self, bearer_token, *, now_epoch):
        if self.fail: raise RuntimeError("down")
        if bearer_token!="good-token": return None
        return self.session or SessionContext("sess:1","subject:1",now_epoch+60,7)


class Gateway:
    def __init__(self, *, generation=7, fail=False, deny=False):
        self.generation=generation; self.fail=fail; self.deny=deny; self.calls=[]
    def dispatch(self, route_id, *, session, payload, request_id):
        self.calls.append((route_id,session,payload,request_id))
        if self.deny: raise ApiDenied("domain denied")
        if self.fail: raise RuntimeError("down")
        return GatewayResult(200,{"ok":True},self.generation)


class Limiter:
    def __init__(self, allowed=True, fail=False): self.allowed=allowed; self.fail=fail
    def allow(self, **kwargs):
        if self.fail: raise RuntimeError("down")
        return self.allowed


class Replay:
    def __init__(self): self.seen={}
    def reserve(self, *, session_ref, key, fingerprint, now_epoch):
        slot=(session_ref,key)
        if slot in self.seen:
            return False
        self.seen[slot]=fingerprint
        return True


class Audit:
    def __init__(self, fail=False): self.rows=[]; self.fail=fail
    def record(self, **row):
        if self.fail: raise RuntimeError("down")
        self.rows.append(row)


def make_transport(**overrides):
    args=dict(
        authenticator=Auth(),
        gateway=Gateway(),
        rate_limiter=Limiter(),
        replay_guard=Replay(),
        audit_sink=Audit(),
        allowed_hosts=frozenset({"puff.example"}),
    )
    args.update(overrides)
    return ApiTransport(**args)


def request(path="/eligibility", *, method="GET", body=b"", headers=None, scheme="https", host="puff.example", now=100):
    values={"Authorization":"Bearer good-token","X-Request-Id":"request-1234"}
    if headers: values.update(headers)
    return ApiRequest(method,API_BASE+path,values,body,scheme,host,now)


class PB14TransportTests(unittest.TestCase):
    def test_read_request_is_hardened_and_generation_bound(self):
        transport=make_transport()
        response=transport.handle(request())
        self.assertEqual(response.status,200)
        payload=json.loads(response.body)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["authorityGeneration"],7)
        self.assertEqual(response.headers["Cache-Control"],"no-store, max-age=0")
        self.assertEqual(response.headers["X-Frame-Options"],"DENY")
        self.assertEqual(response.headers["X-Content-Type-Options"],"nosniff")

    def test_https_host_origin_and_cross_site_fail_closed(self):
        transport=make_transport()
        self.assertEqual(transport.handle(request(scheme="http")).status,403)
        self.assertEqual(transport.handle(request(host="evil.example")).status,403)
        self.assertEqual(transport.handle(request(headers={"Origin":"https://evil.example"})).status,403)
        self.assertEqual(transport.handle(request(headers={"Sec-Fetch-Site":"cross-site"})).status,403)

    def test_missing_revoked_expired_and_dependency_failed_session_deny(self):
        self.assertEqual(make_transport(authenticator=Auth()).handle(
            request(headers={"Authorization":"Bearer wrong-token"})).status,401)
        revoked=SessionContext("s","u",200,1,True)
        self.assertEqual(make_transport(authenticator=Auth(revoked)).handle(request()).status,401)
        expired=SessionContext("s","u",100,1,False)
        self.assertEqual(make_transport(authenticator=Auth(expired)).handle(request()).status,401)
        self.assertEqual(make_transport(authenticator=Auth(fail=True)).handle(request()).status,503)

    def test_mutations_require_json_and_idempotency_and_replay_is_rejected(self):
        replay=Replay(); gateway=Gateway()
        transport=make_transport(replay_guard=replay,gateway=gateway)
        body=b'{"profile":{"intent":"BOTH"}}'
        base={"Content-Type":"application/json","Idempotency-Key":"idem-123456789012"}
        first=transport.handle(request("/profile",method="PUT",body=body,headers=base))
        second=transport.handle(request("/profile",method="PUT",body=body,headers=base))
        self.assertEqual(first.status,200)
        self.assertEqual(second.status,409)
        self.assertEqual(len(gateway.calls),1)
        self.assertEqual(make_transport().handle(
            request("/profile",method="PUT",body=body,headers={"Content-Type":"application/json"})).status,400)
        self.assertEqual(make_transport().handle(
            request("/profile",method="PUT",body=body,headers={"Content-Type":"text/plain","Idempotency-Key":"idem-123456789012"})).status,415)

    def test_duplicate_json_keys_and_oversized_bodies_fail_before_gateway(self):
        gateway=Gateway(); transport=make_transport(gateway=gateway)
        dup=b'{"action":"LIKE","action":"PASS"}'
        headers={"Content-Type":"application/json","Idempotency-Key":"idem-123456789012"}
        self.assertEqual(transport.handle(request("/relationships/action",method="POST",body=dup,headers=headers)).status,403)
        huge=b"x"*(64*1024+1)
        self.assertEqual(transport.handle(request("/relationships/action",method="POST",body=huge,headers=headers)).status,413)
        self.assertEqual(gateway.calls,[])

    def test_media_boundary_and_size_are_enforced(self):
        headers={"Content-Type":"multipart/form-data; boundary=abc","Idempotency-Key":"idem-123456789012"}
        self.assertEqual(make_transport().handle(
            request("/profile/media",method="POST",body=b"--abc--",headers=headers)).status,200)
        bad={"Content-Type":"multipart/form-data","Idempotency-Key":"idem-123456789012"}
        self.assertEqual(make_transport().handle(
            request("/profile/media",method="POST",body=b"x",headers=bad)).status,403)

    def test_rate_limit_and_dependency_failures_do_not_broaden_access(self):
        self.assertEqual(make_transport(rate_limiter=Limiter(False)).handle(request()).status,429)
        self.assertEqual(make_transport(rate_limiter=Limiter(fail=True)).handle(request()).status,503)
        self.assertEqual(make_transport(gateway=Gateway(fail=True)).handle(request()).status,503)
        self.assertEqual(make_transport(gateway=Gateway(deny=True)).handle(request()).status,403)

    def test_stale_gateway_generation_is_rejected(self):
        self.assertEqual(make_transport(gateway=Gateway(generation=6)).handle(request()).status,409)

    def test_unknown_routes_and_methods_do_not_dispatch(self):
        gateway=Gateway(); transport=make_transport(gateway=gateway)
        self.assertEqual(transport.handle(request("/admin")).status,404)
        self.assertEqual(transport.handle(request(method="POST")).status,405)
        self.assertEqual(gateway.calls,[])

    def test_audit_metadata_excludes_body_token_and_subject(self):
        audit=Audit(); transport=make_transport(audit_sink=audit)
        transport.handle(request())
        self.assertEqual(set(audit.rows[0]),{"request_id","route_id","status"})
        rendered=repr(audit.rows)
        self.assertNotIn("good-token",rendered)
        self.assertNotIn("subject:1",rendered)

    def test_wsgi_adapter_uses_effective_scheme_and_does_not_trust_forwarded_proto(self):
        transport=make_transport()
        app=create_wsgi_app(transport)
        status=[]
        env={
            "REQUEST_METHOD":"GET","PATH_INFO":API_BASE+"/eligibility",
            "wsgi.url_scheme":"http","HTTP_HOST":"puff.example",
            "HTTP_AUTHORIZATION":"Bearer good-token","HTTP_X_FORWARDED_PROTO":"https",
            "CONTENT_LENGTH":"0","wsgi.input":io.BytesIO(b""),
            "puffbuddies.now_epoch":100,
        }
        body=b"".join(app(env,lambda s,h:status.append(s)))
        self.assertTrue(status[0].startswith("403"))
        self.assertIn(b"request_denied",body)


if __name__=="__main__":
    unittest.main()
