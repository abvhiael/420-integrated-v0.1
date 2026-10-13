import unittest
from doobr.auth import Denied
from doobr.mobile_replay_storage import PostgresReplayLedger
class StagingSchemaTests(unittest.TestCase):
 def test_explicit_schema_selection(self):
  self.assertEqual(PostgresReplayLedger(lambda:None,schema="doobr_staging").table,"doobr_staging.mobile_replay_receipts")
  self.assertEqual(PostgresReplayLedger(lambda:None).table,"doobr_private.mobile_replay_receipts")
 def test_unsafe_schema_rejected(self):
  for name in ("public","420travel","doobr_staging;DROP TABLE x",None):
   with self.assertRaises(Denied):PostgresReplayLedger(lambda:None,schema=name)
if __name__=="__main__":unittest.main()
