import unittest
from datetime import datetime,timedelta,timezone
from doobr.tracking import record_location,permission_change
from doobr.auth import Denied
N=datetime(2026,10,10,tzinfo=timezone.utc)
class TrackingTests(unittest.TestCase):
 def test_reject_invalid_sample_before_db(self):
  base=dict(connect=None,issuer=None,store=None,token="",tenant_id="x",order_id="x",
   permission_id="x",sequence=1,observed_at=N,latitude=49.3,longitude=-123.1,
   encrypt=None,geofence=None,at=N)
  for change in (dict(latitude=91),dict(longitude=-181),dict(sequence=0),
                 dict(sequence=True),dict(observed_at=N+timedelta(seconds=1)),
                 dict(observed_at=N-timedelta(seconds=91)),
                 dict(retention_seconds=3601)):
   with self.subTest(change=change),self.assertRaises(Denied):
    record_location(**(base|change))
 def test_grant_requires_bounded_expiry(self):
  base=dict(connect=None,issuer=None,store=None,token="",tenant_id="x",order_id="x",
   permission_id="x",grant=True,authority=None,at=N)
  with self.assertRaises(Denied):permission_change(**base)
  with self.assertRaises(Denied):permission_change(**(base|{"expires_at":N+timedelta(days=3)}))
if __name__=="__main__":unittest.main()
