import unittest
from datetime import datetime,timedelta,timezone
from uuid import uuid4
import psycopg
from doobr.operations import heartbeat,snapshot
from doobr.audit_verify import verify_chain
from doobr.auth import Denied
DSN="host=localhost dbname=doobr_r02_12 user=postgres password=ci-only-password"
USER="host=localhost dbname=doobr_r02_12 user=doobr_r0212_user password=ci-only-password"
T="00000000-0000-4000-8000-000000007001"
OTHER="00000000-0000-4000-8000-000000007002"
I="00000000-0000-4000-8000-000000007003"
J="00000000-0000-4000-8000-000000007004"
N=datetime.now(timezone.utc)
class OperationsPG(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.admin=psycopg.connect(DSN,autocommit=True)
  with cls.admin.cursor() as c:
   c.execute("CREATE ROLE doobr_r0212_user LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOBYPASSRLS")
   c.execute("GRANT USAGE ON SCHEMA doobr_private TO doobr_r0212_user")
   c.execute("GRANT SELECT,INSERT,UPDATE ON doobr_private.instance_heartbeats TO doobr_r0212_user")
   c.execute("GRANT SELECT ON doobr_private.event_outbox TO doobr_r0212_user")
   c.execute("INSERT INTO doobr_private.tenants(tenant_id,label) VALUES(%s,'ops'),(%s,'other')",(T,OTHER))
 @classmethod
 def tearDownClass(cls):
  with cls.admin.cursor() as c:
   c.execute("REVOKE ALL ON ALL TABLES IN SCHEMA doobr_private FROM doobr_r0212_user")
   c.execute("REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r0212_user")
   c.execute("DROP ROLE doobr_r0212_user")
  cls.admin.close()
 def connect(self):return psycopg.connect(USER)
 def test_multi_instance_health_and_boundaries(self):
  self.assertFalse(snapshot(connect=self.connect,tenant_id=T,at=N)["ready"])
  heartbeat(connect=self.connect,tenant_id=T,instance_id=I,role="API",started_at=N,at=N)
  heartbeat(connect=self.connect,tenant_id=T,instance_id=J,role="OUTBOX",started_at=N,at=N)
  self.assertTrue(snapshot(connect=self.connect,tenant_id=T,at=N)["ready"])
  self.assertFalse(snapshot(connect=self.connect,tenant_id=OTHER,at=N)["ready"])
  with self.assertRaises(Denied):
   heartbeat(connect=self.connect,tenant_id=T,instance_id=I,role="OUTBOX",started_at=N,at=N+timedelta(seconds=1))
  with self.assertRaises(Denied):
   heartbeat(connect=self.connect,tenant_id=T,instance_id=I,role="API",started_at=N,at=N-timedelta(seconds=1))
  self.assertFalse(snapshot(connect=self.connect,tenant_id=T,at=N+timedelta(hours=1))["ready"])
 def test_chain_and_immutable_audit(self):
  self.assertEqual(verify_chain(connect=self.connect,tenant_id=T)['entries'],0)
  with self.connect() as db:
   with db.transaction():
    with db.cursor() as cur:
     cur.execute("SELECT set_config('doobr.tenant_id',%s,true)",(T,))
     with self.assertRaises(psycopg.errors.InsufficientPrivilege):
      cur.execute("UPDATE doobr_private.operation_audit SET action='FAKE' WHERE tenant_id=%s",(T,))
  self.assertEqual(verify_chain(connect=self.connect,tenant_id=OTHER)['entries'],0)
 def test_audit_tables_forced_rls_and_append_only(self):
  with self.admin.cursor() as c:
   c.execute("""SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='doobr_private' AND c.relname IN ('operation_audit','instance_heartbeats')
      AND c.relrowsecurity AND c.relforcerowsecurity""")
   self.assertEqual(c.fetchone()[0],2)
   c.execute("""SELECT count(*) FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid
      WHERE c.relname='operation_audit' AND t.tgname='deny_operation_audit_mutation'""")
   self.assertEqual(c.fetchone()[0],1)
if __name__=="__main__":unittest.main()
