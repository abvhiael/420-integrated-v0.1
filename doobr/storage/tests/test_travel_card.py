import unittest
from datetime import datetime,timedelta,timezone
from doobr.auth import Denied
from doobr.travel_card import presence_card,deep_link,block_checkout
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
class Verifier:
 def __init__(self,ok=True):self.ok=ok
 def verify_projection(self,**kwargs):return self.ok
def record(**change):
 x=dict(region_id="CA-BC-VANCOUVER",state="LIMITED",issued_at=NOW,
  expires_at=NOW+timedelta(minutes=2),privacy_threshold_met=True,signature="opaque-signature")
 x.update(change);return x
class TravelCardTests(unittest.TestCase):
 def test_minimal_read_only_card(self):
  c=presence_card(record=record(),verifier=Verifier(),at=NOW)
  self.assertFalse(c["checkout_enabled"])
  self.assertFalse(c["booking_enabled"])
  self.assertNotIn("signature",c)
 def test_denial_branches(self):
  for change in (dict(region_id="lat=50"),dict(state="READY"),dict(privacy_threshold_met=False),
    dict(expires_at=NOW),dict(expires_at=NOW+timedelta(minutes=6)),dict(issued_at=NOW+timedelta(seconds=2)),
    dict(address="private")):
   with self.assertRaises(Denied):presence_card(record=record(**change),verifier=Verifier(),at=NOW)
  with self.assertRaises(Denied):presence_card(record=record(),verifier=Verifier(False),at=NOW)
 def test_link_denial_and_checkout(self):
  self.assertEqual(deep_link(url="https://doobr.420integrated.org/coverage"),"https://doobr.420integrated.org/coverage")
  for link in ("http://doobr.420integrated.org/coverage","https://evil.org/coverage",
    "https://doobr.420integrated.org/checkout","https://doobr.420integrated.org/coverage?order=1",
    "https://doobr.420integrated.org@evil.org/coverage"):
   with self.assertRaises(Denied):deep_link(url=link)
  with self.assertRaises(Denied):block_checkout()
if __name__=="__main__":unittest.main()
