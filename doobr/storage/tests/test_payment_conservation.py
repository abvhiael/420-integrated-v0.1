import unittest
from datetime import datetime,timezone,timedelta
from unittest.mock import Mock
from doobr.auth import Denied
from doobr.retailer import AuthorizedRetailOrder
from doobr.pay_receipt_adapter import PayReceipt
from doobr.payment_conservation import SettlementAccounting,verify_payment_accounting
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
ORDER=AuthorizedRetailOrder("tenant","retailer","order","seller","licence","Vancouver","pay",1000,"CAD")
def fixture(**kw):
 p,a,callbacks=Mock(),Mock(),Mock()
 p.verify_receipt.return_value=PayReceipt("420Pay","seller","order","pay",1000,"CAD","SETTLED",False,NOW)
 fields=dict(issuer="420Pay",payment_ref="pay",currency="CAD",gross_minor=1000,
 retailer_minor=650,delivery_minor=200,dev_vault_minor=100,platform_minor=50,
 vault_ref="canonical-vault",cancelled=False,refunded_minor=0,callback_id="callback",recorded_at=NOW)
 fields.update(kw)
 a.verify_accounting.return_value=SettlementAccounting(**fields)
 a.verify_vault_route.return_value=True;a.verify_refund.return_value=True
 callbacks.record_once.return_value=True
 return p,a,callbacks
def check(x):
 p,a,c=x
 return verify_payment_accounting(retail_order=ORDER,pay_authority=p,
 accounting_authority=a,approved_pay_issuers={"420Pay"},
 approved_accounting_issuers={"420Pay"},canonical_vault_ref="canonical-vault",
 callbacks=c,now=NOW)
class ConservationTests(unittest.TestCase):
 def test_conservation_and_canonical_routes(self):
  x=fixture();self.assertEqual(check(x).gross_minor,1000)
  x[1].verify_vault_route.assert_called_once()
  x[1].verify_refund.assert_called_once()
  x[2].record_once.assert_called_once()
 def test_cancel_full_refund(self):
  x=fixture(retailer_minor=0,delivery_minor=0,dev_vault_minor=0,platform_minor=0,
    refunded_minor=1000,cancelled=True)
  self.assertEqual(check(x).refunded_minor,1000)
 def test_conservation_adversarial(self):
  for key,value in (("issuer","forged"),("payment_ref","other"),("currency","USD"),
    ("gross_minor",1001),("retailer_minor",-1),("retailer_minor",True),
    ("dev_vault_minor",110),("vault_ref","rogue"),("refunded_minor",1),
    ("callback_id",""),("recorded_at",NOW+timedelta(seconds=1)),
    ("cancelled",True)):
   with self.subTest(key=key),self.assertRaises(Denied):check(fixture(**{key:value}))
 def test_duplicate_callback_and_outages(self):
  x=fixture();x[2].record_once.return_value=False
  with self.assertRaises(Denied):check(x)
  x=fixture();x[2].record_once.side_effect=TimeoutError()
  with self.assertRaises(Denied):check(x)
  x=fixture();x[1].verify_vault_route.return_value=False
  with self.assertRaises(Denied):check(x)
  x=fixture();x[1].verify_refund.return_value=False
  with self.assertRaises(Denied):check(x)
  x=fixture();x[1].verify_accounting.side_effect=TimeoutError()
  with self.assertRaises(Denied):check(x)
  x=fixture();x[0].verify_receipt.side_effect=TimeoutError()
  with self.assertRaises(Denied):check(x)
if __name__=="__main__":unittest.main()
