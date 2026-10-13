"""R04.10 deterministic property/adversarial testing for off-chain canonical adapters.
No new Solidity ABI exists at R04; this tests Python interface shapes instead.
"""
import inspect
import random
import unittest
from datetime import datetime,timezone,timedelta
from unittest.mock import Mock
from doobr.auth import Denied
from doobr.payment_conservation import SettlementAccounting,verify_payment_accounting
from doobr.provenance_adapter import verify_provenance
from doobr.compliance_discovery_adapter import require_compliance,read_only_region
from doobr.wallet_consent import authorize_wallet_action
from doobr.canonical_routing import route_reference
from doobr.storage.tests.test_payment_conservation import fixture,check,NOW

class ProtocolSecurity(unittest.TestCase):
 def test_interface_contracts_are_keyword_only(self):
  for fn,required in (
   (verify_payment_accounting,{"callbacks","accounting_authority","canonical_vault_ref"}),
   (verify_provenance,{"identity","verify","registry","signed_credential"}),
   (require_compliance,{"compliance","signed_decision","approved_issuers"}),
   (read_only_region,{"location","search","projection_verifier"}),
   (authorize_wallet_action,{"wallet","nonces","signed_consent"}),
   (route_reference,{"router","approved_issuers","service"})):
   sig=inspect.signature(fn)
   self.assertTrue(required.issubset(sig.parameters))
   for key in required:
    self.assertEqual(sig.parameters[key].kind,inspect.Parameter.KEYWORD_ONLY)

 def test_conservation_randomized_partition_and_one_minor_mutations(self):
  rng=random.Random(42049)
  for n in range(300):
   # Generate a constrained partition of the fixed 1,000 minor units.
   cuts=sorted([0,1000]+[rng.randint(0,1000) for _ in range(4)])
   parts=[cuts[i+1]-cuts[i] for i in range(5)]
   x=fixture(retailer_minor=parts[0],delivery_minor=parts[1],
     dev_vault_minor=parts[2],platform_minor=parts[3],refunded_minor=parts[4])
   with self.subTest(trial=n):self.assertEqual(check(x).gross_minor,1000)
   fields=["retailer_minor","delivery_minor","dev_vault_minor","platform_minor","refunded_minor"]
   altered=dict(zip(fields,parts))
   altered[fields[n%5]]+=1
   with self.assertRaises(Denied):check(fixture(**altered))
   altered=dict(zip(fields,parts))
   altered[fields[n%5]]=-1
   with self.assertRaises(Denied):check(fixture(**altered))

 def test_callback_does_not_record_if_authority_denies(self):
  for authority in ("verify_receipt","verify_accounting","verify_vault_route","verify_refund"):
   x=fixture()
   if authority=="verify_receipt":x[0].verify_receipt.return_value=None
   elif authority=="verify_accounting":x[1].verify_accounting.return_value=None
   else:getattr(x[1],authority).return_value=False
   with self.subTest(authority=authority),self.assertRaises(Denied):check(x)
   x[2].record_once.assert_not_called()

 def test_callback_true_only_and_cancellation_conservation(self):
  for response in (None,0,1,"true",False):
   x=fixture();x[2].record_once.return_value=response
   with self.subTest(response=response),self.assertRaises(Denied):check(x)
  for rest in (1,10,1000):
   with self.subTest(remaining=rest),self.assertRaises(Denied):
    check(fixture(cancelled=True,retailer_minor=rest,delivery_minor=0,
                  dev_vault_minor=0,platform_minor=0,refunded_minor=1000-rest))

if __name__=="__main__":unittest.main()
