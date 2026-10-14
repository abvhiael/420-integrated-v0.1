"""R05.4 external finality, rollback and fee conservation threat matrix."""
import unittest
from dataclasses import replace
from datetime import timedelta
from doobr.auth import Denied
from doobr.storage.tests.test_payment_conservation import NOW,fixture,check
class FinancialFinalityTests(unittest.TestCase):
 def test_canonical_pay_finality_rollback_and_currency(self):
  for changes in ({"status":"PENDING"},{"status":"AUTHORIZED"},{"status":"FAILED"},
                  {"status":"REFUNDED"},{"status":"REVERSED"},{"reversed":True},
                  {"amount_minor":999},{"amount_minor":1001},{"currency":"USD"},
                  {"payment_ref":"other"},{"seller_ref":"other"},
                  {"retailer_order_ref":"other"},{"issuer":"unknown"},
                  {"verified_at":NOW+timedelta(seconds=1)}):
   p,a,c=fixture();p.verify_receipt.return_value=replace(p.verify_receipt.return_value,**changes)
   with self.subTest(changes=changes),self.assertRaises(Denied):check((p,a,c))
   c.record_once.assert_not_called()
 def test_nonconserving_fee_distribution_never_records(self):
  for field in ("retailer_minor","delivery_minor","dev_vault_minor","platform_minor","refunded_minor"):
   for difference in (-1,1):
    p,a,c=fixture();a.verify_accounting.return_value=replace(
      a.verify_accounting.return_value,
      **{field:getattr(a.verify_accounting.return_value,field)+difference})
    with self.subTest(field=field,difference=difference),self.assertRaises(Denied):check((p,a,c))
    c.record_once.assert_not_called()
 def test_external_authority_rollback_and_vault_denials(self):
  for method in ("verify_vault_route","verify_refund"):
   for failure in (False,None,TimeoutError("authority offline")):
    p,a,c=fixture()
    if isinstance(failure,Exception):getattr(a,method).side_effect=failure
    else:getattr(a,method).return_value=failure
    with self.subTest(method=method,failure=str(failure)),self.assertRaises(Denied):check((p,a,c))
    c.record_once.assert_not_called()
 def test_signed_accounting_invalid_or_replayed(self):
  for updates in ({"issuer":"unapproved"},{"vault_ref":"wrong"},
                  {"callback_id":""},{"callback_id":"x"*129},
                  {"gross_minor":True},{"cancelled":True}):
   p,a,c=fixture()
   a.verify_accounting.return_value=replace(a.verify_accounting.return_value,**updates)
   with self.subTest(updates=updates),self.assertRaises(Denied):check((p,a,c))
   c.record_once.assert_not_called()
  p,a,c=fixture();c.record_once.return_value=False
  with self.assertRaises(Denied):check((p,a,c))
 def test_refund_full_conservation_and_no_double_custody(self):
  p,a,c=fixture(retailer_minor=0,delivery_minor=0,dev_vault_minor=0,
                platform_minor=0,refunded_minor=1000,cancelled=True)
  self.assertEqual(check((p,a,c)).refunded_minor,1000)
  a.verify_refund.assert_called_once()
  a.verify_vault_route.assert_called_once()
if __name__=="__main__":unittest.main()
