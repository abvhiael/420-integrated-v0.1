import unittest
from datetime import datetime,timezone,timedelta
from unittest.mock import Mock
from dataclasses import replace
from doobr.auth import Denied
from doobr.provider_registry_adapter import ProviderReference,ApprovedProviderAdapter
from doobr.compliance_discovery_adapter import PolicyDecision
from doobr.transition_authority import authorize_transition
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
def fixture():
 issuer=Mock(); registry=Mock(); registry.verify_binding.return_value=True
 issuer.verify_provider.return_value=ProviderReference("tenant","provider","trusted","credential","registry","RETAILER",NOW-timedelta(days=1),NOW+timedelta(days=1),False,"approval")
 provider=ApprovedProviderAdapter(authority=issuer,registry=registry,allowed_issuers={"trusted"},allowed_categories={"RETAILER"})
 compliance=Mock();compliance.verify_decision.return_value=PolicyDecision("tenant","provider","Vancouver","version-1","decision","evidence","Compliance","ALLOW",NOW-timedelta(hours=1),NOW+timedelta(hours=1),False)
 compliance.is_revoked.return_value=False;compliance.verify_evidence.return_value=True;compliance.is_current_policy.return_value=True
 stop=Mock();stop.is_stopped.return_value=False
 return issuer,registry,provider,compliance,stop
def run(f):
 _,_,provider,compliance,stop=f
 return authorize_transition(tenant_id="tenant",provider_id="provider",municipality="Vancouver",
 signed_provider="signed-provider",signed_policy="signed-policy",provider_adapter=provider,
 compliance=compliance,approved_policy_issuers={"Compliance"},emergency_authority=stop,
 transition_ref="order-transition",at=NOW)
class TransitionSecurityTests(unittest.TestCase):
 def test_valid_fresh_transition(self):
  f=fixture();self.assertEqual(run(f)[1].policy_version,"version-1")
  self.assertEqual(f[4].is_stopped.call_count,3)
 def test_expired_revoked_credential_and_registry_denial(self):
  for change in ({"valid_until":NOW},{"revoked":True},{"category":"OTHER"},{"tenant_id":"other"}):
   f=fixture();f[0].verify_provider.return_value=replace(f[0].verify_provider.return_value,**change)
   with self.subTest(change=change),self.assertRaises(Denied):run(f)
  f=fixture();f[1].verify_binding.return_value=False
  with self.assertRaises(Denied):run(f)
 def test_policy_change_mid_order_and_revocation(self):
  for change in ({"expires_at":NOW},{"outcome":"DENY"},{"revoked":True},{"municipality":"other"}):
   f=fixture();f[3].verify_decision.return_value=replace(f[3].verify_decision.return_value,**change)
   with self.subTest(change=change),self.assertRaises(Denied):run(f)
  f=fixture();f[3].is_current_policy.return_value=False
  with self.assertRaises(Denied):run(f)
  f=fixture();f[3].is_revoked.return_value=True
  with self.assertRaises(Denied):run(f)
 def test_stop_between_checks_and_fail_closed_unknown(self):
  for answers in ([True],[None],[False,True],[False,False,True]):
   f=fixture();f[4].is_stopped.side_effect=answers
   with self.subTest(answers=answers),self.assertRaises(Denied):run(f)
  for index,method in ((0,"verify_provider"),(1,"verify_binding"),(3,"verify_decision"),(3,"is_current_policy"),(4,"is_stopped")):
   f=fixture();getattr(f[index],method).side_effect=TimeoutError("canonical unavailable")
   with self.subTest(method=method),self.assertRaises(Denied):run(f)
if __name__=="__main__":unittest.main()
