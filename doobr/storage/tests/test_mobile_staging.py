import unittest
from datetime import datetime,timezone
from unittest.mock import Mock
from doobr.mobile_staging_identity import StagingIdentity
from doobr.mobile_staging_ingress import RateLimiter,PrivateTransport
from doobr.auth import Denied
T="00000000-0000-4000-8000-000000000101"
D="00000000-0000-4000-8000-000000000102"
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
def adapter(**override):
 claims=dict(tenant_id=T,device_id=D,sub="courier",jti="nonce",scope="doobr:mobile:replay")
 claims.update(override)
 jwt=Mock();jwt.verify.return_value=claims
 device=Mock();device.verify_bound_device.return_value=True
 revocation=Mock();revocation.is_revoked.return_value=False
 return StagingIdentity(jwt_verifier=jwt,device_verifier=device,revocation=revocation,
 issuer="https://identity.staging.invalid",audience="doobr-replay"),jwt,device,revocation
class StagingSecurity(unittest.TestCase):
 def test_bound_positive_and_rotation_contract(self):
  a,j,d,r=adapter()
  self.assertTrue(a.verify_replay(token="signed",tenant_id=T,device_id=D,at=NOW))
  self.assertEqual(j.verify.call_args.kwargs["audience"],"doobr-replay")
  self.assertEqual(j.verify.call_args.kwargs["issuer"],"https://identity.staging.invalid")
 def test_scope_and_device_denials(self):
  for key,value in [("scope","admin"),("tenant_id",D),("device_id",T),("jti","")]:
   a,*_=adapter(**{key:value})
   self.assertFalse(a.verify_replay(token="signed",tenant_id=T,device_id=D,at=NOW))
  a,j,d,r=adapter();r.is_revoked.return_value=True
  self.assertFalse(a.verify_replay(token="signed",tenant_id=T,device_id=D,at=NOW))
  r.is_revoked.return_value=False;d.verify_bound_device.return_value=False
  self.assertFalse(a.verify_replay(token="signed",tenant_id=T,device_id=D,at=NOW))
  j.verify.side_effect=RuntimeError("JWKS unavailable")
  self.assertFalse(a.verify_replay(token="signed",tenant_id=T,device_id=D,at=NOW))
 def test_ingress_rate_limit_and_spoofing(self):
  clock=Mock(return_value=0.0)
  limiter=RateLimiter(max_requests=1,clock=clock)
  v=Mock();v.verify_connection.return_value=dict(tenant_id=T,device_id=D,bearer_token="signed",
   origin_ok=True,device_ok=True,csrf_ok=True)
  ingress=PrivateTransport(verifier=v,limiter=limiter)
  self.assertEqual(ingress.authenticate(environ={})["device_id"],D)
  with self.assertRaises(Denied):ingress.authenticate(environ={})
  clock.return_value=61.0
  self.assertEqual(ingress.authenticate(environ={})["device_id"],D)
  v.verify_connection.return_value["csrf_ok"]=False
  with self.assertRaises(Denied):ingress.authenticate(environ={})
if __name__=="__main__":unittest.main()
