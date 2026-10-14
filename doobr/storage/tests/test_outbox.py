import unittest
from datetime import datetime,timezone
from doobr.outbox import claim,settle
from doobr.auth import Denied
NOW=datetime(2026,10,10,tzinfo=timezone.utc)
class TestOutbox(unittest.TestCase):
 def test_invalid_claims(self):
  for n in (0,301,True):
   with self.assertRaises(Denied):
    claim(connect=None,tenant_id="x",worker_id="x",at=NOW,lease_seconds=n)
 def test_invalid_receipts(self):
  for kwargs in (dict(receipt_ref=None,error_code=None),
    dict(receipt_ref="ok",error_code="bad"),dict(attempt=0,receipt_ref="ok"),
    dict(attempt=True,receipt_ref="ok")):
   args=dict(connect=None,tenant_id="x",worker_id="x",event_id="x",
       attempt=1,at=NOW,receipt_ref="ok")
   args.update(kwargs)
   with self.subTest(kwargs=kwargs),self.assertRaises(Denied):settle(**args)
if __name__=="__main__":unittest.main()
