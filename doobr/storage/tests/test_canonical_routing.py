import unittest
from datetime import datetime,timedelta,timezone
from unittest.mock import Mock
from doobr.auth import Denied
from doobr.canonical_routing import RouteReceipt,route_reference
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
def setup(service="NOTIFICATIONS",**changes):
 d=dict(issuer="420Notifications" if service=="NOTIFICATIONS" else "420Arbitration",
        tenant_id="tenant",case_ref="case_abc",event_ref="event_abc",
        service=service,status="ACCEPTED",issued_at=NOW)
 d.update(changes)
 router=Mock();router.submit_reference.return_value=RouteReceipt(**d)
 return router
def send(router,service="NOTIFICATIONS",category=None,**kwargs):
 return route_reference(service=service,tenant_id=kwargs.get("tenant_id","tenant"),
   case_ref=kwargs.get("case_ref","case_abc"),event_ref=kwargs.get("event_ref","event_abc"),
   category=category or ("ORDER_STATE" if service=="NOTIFICATIONS" else "DELIVERY_DISPUTE"),
   router=router,approved_issuers={"420Notifications" if service=="NOTIFICATIONS" else "420Arbitration"},now=NOW)
class CanonicalRoutingTests(unittest.TestCase):
 def test_notifications_and_arbitration(self):
  for service in ("NOTIFICATIONS","ARBITRATION"):
   with self.subTest(service=service):
    p=setup(service);self.assertEqual(send(p,service).service,service)
    p.submit_reference.assert_called_once()
 def test_reject_authority_spoof_and_cross_tenant(self):
  for key,val in (("issuer","rogue"),("tenant_id","other"),("case_ref","wrong"),
    ("event_ref","wrong"),("service","ARBITRATION"),("status","PENDING"),
    ("issued_at",NOW+timedelta(seconds=1))):
   with self.subTest(key=key),self.assertRaises(Denied):send(setup(**{key:val}))
 def test_sensitive_content_and_unknown_category_denied(self):
  p=setup()
  for x in ("john@example.com","123 main street","a/b"):
   with self.subTest(value=x),self.assertRaises(Denied):send(p,case_ref=x)
  with self.assertRaises(Denied):send(p,category="PAYMENT")
  with self.assertRaises(Denied):send(p,service="ARBITRATION",category="ORDER_STATE")
 def test_outage_fail_closed(self):
  p=setup();p.submit_reference.side_effect=TimeoutError()
  with self.assertRaises(Denied):send(p)
if __name__=="__main__":unittest.main()
