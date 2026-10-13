import unittest
from datetime import datetime,timedelta,timezone
from unittest.mock import Mock
from doobr.auth import Denied
from doobr.provider_registry_adapter import ApprovedProviderAdapter,ProviderReference
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
def setup(**changes):
 ref=dict(tenant_id="tenant",provider_id="provider",issuer="canonical-verify",
  credential_id="credential",registry_ref="registry:provider",category="DELIVERY_PERSON",
  valid_from=NOW-timedelta(days=1),valid_until=NOW+timedelta(days=1),
  revoked=False,approval_id="approved-record")
 ref.update(changes)
 authority=Mock();authority.verify_provider.return_value=ProviderReference(**ref)
 registry=Mock();registry.verify_binding.return_value=True
 adapter=ApprovedProviderAdapter(authority=authority,registry=registry,
  allowed_issuers={"canonical-verify"},allowed_categories={"DELIVERY_PERSON"})
 return adapter,authority,registry
class ProviderAdapterTests(unittest.TestCase):
 def test_approved_and_registry_revalidation(self):
  adapter,authority,registry=setup()
  result=adapter.verify_reference(tenant_id="tenant",provider_id="provider",signed_evidence="signed",at=NOW)
  self.assertEqual(result.registry_ref,"registry:provider")
  registry.verify_binding.assert_called_once()
 def test_denied_reference_fields(self):
  for key,value in (("tenant_id","elsewhere"),("provider_id","elsewhere"),
    ("issuer","unapproved"),("category","UNKNOWN"),("revoked",True),
    ("approval_id",""),("credential_id",""),("registry_ref",""),
    ("valid_from",NOW+timedelta(seconds=1)),("valid_until",NOW)):
   adapter,*_=setup(**{key:value})
   with self.subTest(key=key),self.assertRaises(Denied):
    adapter.verify_reference(tenant_id="tenant",provider_id="provider",signed_evidence="signed",at=NOW)
 def test_registry_and_issuer_fail_closed(self):
  a,issuer,registry=setup()
  registry.verify_binding.return_value=False
  with self.assertRaises(Denied):a.verify_reference(tenant_id="tenant",provider_id="provider",signed_evidence="signed",at=NOW)
  registry.verify_binding.side_effect=TimeoutError()
  with self.assertRaises(Denied):a.verify_reference(tenant_id="tenant",provider_id="provider",signed_evidence="signed",at=NOW)
  issuer.verify_provider.side_effect=ValueError("bad signature")
  with self.assertRaises(Denied):a.verify_reference(tenant_id="tenant",provider_id="provider",signed_evidence="signed",at=NOW)
 def test_absent_trust_config(self):
  a,issuer,registry=setup()
  with self.assertRaises(Denied):ApprovedProviderAdapter(authority=issuer,registry=registry,allowed_issuers=set(),allowed_categories={"DELIVERY_PERSON"})
if __name__=="__main__":unittest.main()
