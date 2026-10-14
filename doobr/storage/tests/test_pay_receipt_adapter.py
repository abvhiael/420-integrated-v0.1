import unittest
from datetime import datetime,timezone,timedelta
from unittest.mock import Mock
from doobr.auth import Denied
from doobr.retailer import AuthorizedRetailOrder
from doobr.pay_receipt_adapter import PayReceipt,verify_prepaid_settlement
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
ORDER=AuthorizedRetailOrder("tenant","retailer","order","licensed-seller","licence","Vancouver","pay-ref",1250,"CAD")
def fixture(**kw):
 fields=dict(issuer="420Pay",seller_ref="licensed-seller",retailer_order_ref="order",
 payment_ref="pay-ref",amount_minor=1250,currency="CAD",status="SETTLED",
 reversed=False,verified_at=NOW)
 fields.update(kw);provider=Mock();provider.verify_receipt.return_value=PayReceipt(**fields)
 return provider
class PayTests(unittest.TestCase):
 def verify(self,provider,order=ORDER):
  return verify_prepaid_settlement(retail_order=order,pay_authority=provider,approved_issuers={"420Pay"},now=NOW)
 def test_authorized_canonical_receipt(self):
  p=fixture();self.assertEqual(self.verify(p).status,"SETTLED")
  p.verify_receipt.assert_called_once_with(seller_ref="licensed-seller",retailer_order_ref="order",payment_ref="pay-ref",at=NOW)
 def test_fail_closed_cases(self):
  for field,val in (("issuer","unauthorized"),("seller_ref","other"),("retailer_order_ref","other"),
    ("payment_ref","other"),("amount_minor",1200),("amount_minor",True),
    ("currency","USD"),("status","AUTHORIZED"),("reversed",True),
    ("verified_at",NOW+timedelta(seconds=1))):
   with self.subTest(field=field),self.assertRaises(Denied):self.verify(fixture(**{field:val}))
 def test_unavailable_and_no_trust(self):
  p=fixture();p.verify_receipt.side_effect=TimeoutError()
  with self.assertRaises(Denied):self.verify(p)
  with self.assertRaises(Denied):verify_prepaid_settlement(retail_order=ORDER,pay_authority=p,approved_issuers=set(),now=NOW)
if __name__=="__main__":unittest.main()
