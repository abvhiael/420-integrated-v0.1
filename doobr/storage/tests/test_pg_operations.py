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
   c.execute("GRANT SELECT ON doobr_private.operation_audit,doobr_private.order_commands TO doobr_r0212_user")
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
 def test_committed_order_audit_and_tamper_denial(self):
  actor='00000000-0000-4000-8000-000000007011'
  buyer='00000000-0000-4000-8000-000000007012'
  retailer='00000000-0000-4000-8000-000000007013'
  region='00000000-0000-4000-8000-000000007014'
  order='00000000-0000-4000-8000-000000007015'
  cmd='00000000-0000-4000-8000-000000007016'
  with self.admin.transaction():
   with self.admin.cursor() as q:
    q.execute("SELECT set_config('doobr.tenant_id',%s,true)",(T,))
    for aid,kind in ((actor,'OPERATOR'),(buyer,'CONSUMER'),(retailer,'RETAILER')):
     q.execute("INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state) VALUES(%s,%s,%s,%s,'ACTIVE')",(T,aid,aid,kind))
    q.execute("""INSERT INTO doobr_private.service_regions(tenant_id,region_id,region_code,country_code,province_code,municipality_ref,boundary,policy_ref)
     VALUES(%s,%s,'ops','CA','BC','Vancouver',ST_Multi(ST_GeomFromText('POLYGON((-123 49,-122 49,-122 50,-123 50,-123 49))',4326)),'policy')""",(T,region))
    q.execute("""INSERT INTO doobr_private.delivery_orders(tenant_id,order_id,consumer_id,retailer_id,region_id,state)
     VALUES(%s,%s,%s,%s,%s,'ELIGIBLE')""",(T,order,buyer,retailer,region))
    q.execute("""INSERT INTO doobr_private.order_commands(tenant_id,command_id,order_id,actor_id,action,target_state,request_digest,expected_revision,applied_revision)
     VALUES(%s,%s,%s,%s,'APPROVE_ELIGIBILITY','ELIGIBLE',%s,1,2)""",(T,cmd,order,actor,b'c'*32))
  self.assertEqual(verify_chain(connect=self.connect,tenant_id=T)['entries'],1)
  with self.admin.cursor() as q:
   with self.assertRaises(psycopg.errors.RaiseException):
    q.execute("UPDATE doobr_private.operation_audit SET action='TAMPER' WHERE tenant_id=%s",(T,))
  self.assertEqual(verify_chain(connect=self.connect,tenant_id=T)['entries'],1)
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
