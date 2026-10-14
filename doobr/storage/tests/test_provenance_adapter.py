import unittest
from datetime import datetime,timedelta,timezone
from unittest.mock import Mock
from doobr.auth import Denied
from doobr.provenance_adapter import Provenance,verify_provenance
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
def fixture(**changes):
 fields=dict(tenant_id="tenant",subject_ref="subject",credential_id="cred",
 identity_issuer="420Identity",verify_issuer="420Verify",registry_ref="registry:1",
 category="PROVIDER",issued_at=NOW-timedelta(days=1),
 expires_at=NOW+timedelta(days=1),revoked=False,evidence_ref="digest:ref")
 fields.update(changes)
 identity,verify,registry=Mock(),Mock(),Mock()
 identity.verify_binding.return_value=True
 registry.verify_binding.return_value=True
 verify.is_revoked.return_value=False
 verify.verify_credential.return_value=Provenance(**fields)
 return identity,verify,registry
def check(services):
 identity,verify,registry=services
 return verify_provenance(tenant_id="tenant",subject_ref="subject",
   credential_id="cred",signed_credential="signed",identity=identity,
   verify=verify,registry=registry,trusted_identity_issuers={"420Identity"},
   trusted_verify_issuers={"420Verify"},approved_categories={"PROVIDER"},now=NOW)
class ProvenanceTests(unittest.TestCase):
 def test_valid_and_canonical_revalidation(self):
  i,v,r=fixture();self.assertEqual(check((i,v,r)).registry_ref,"registry:1")
  i.verify_binding.assert_called_once();r.verify_binding.assert_called_once();v.is_revoked.assert_called_once()
 def test_mismatch_revoked_expired(self):
  cases=(("tenant_id","other"),("subject_ref","other"),("credential_id","other"),
   ("identity_issuer","rogue"),("verify_issuer","rogue"),("registry_ref",""),
   ("category","UNAPPROVED"),("revoked",True),("evidence_ref",""),
   ("issued_at",NOW+timedelta(seconds=1)),("expires_at",NOW))
  for k,v in cases:
   with self.subTest(field=k),self.assertRaises(Denied):check(fixture(**{k:v}))
 def test_independent_denials(self):
  for adapter,method,return_value in ((0,"verify_binding",False),
    (2,"verify_binding",False),(1,"is_revoked",True)):
   p=list(fixture());getattr(p[adapter],method).return_value=return_value
   with self.subTest(adapter=adapter),self.assertRaises(Denied):check(p)
  p=list(fixture());p[1].verify_credential.side_effect=TimeoutError()
  with self.assertRaises(Denied):check(p)
  p=list(fixture());p[2].verify_binding.side_effect=TimeoutError()
  with self.assertRaises(Denied):check(p)
 def test_missing_trust(self):
  i,v,r=fixture()
  with self.assertRaises(Denied):
   verify_provenance(tenant_id="tenant",subject_ref="subject",credential_id="cred",
      signed_credential="signed",identity=i,verify=v,registry=r,
      trusted_identity_issuers=set(),trusted_verify_issuers={"420Verify"},
      approved_categories={"PROVIDER"},now=NOW)
if __name__=="__main__":unittest.main()
