"""R02.11 actual PostgreSQL trigger, leasing, retry and receipt integration."""
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
import psycopg
from doobr.outbox import claim,settle
from doobr.auth import Denied
DSN="host=localhost dbname=doobr_r02_11 user=postgres password=ci-only-password"
USR="host=localhost dbname=doobr_r02_11 user=doobr_r0211_user password=ci-only-password"
T="00000000-0000-4000-8000-000000006001"
W="00000000-0000-4000-8000-000000006002"
W2="00000000-0000-4000-8000-000000006003"
C="00000000-0000-4000-8000-000000006004"
B="00000000-0000-4000-8000-000000006005"
S="00000000-0000-4000-8000-000000006006"
R="00000000-0000-4000-8000-000000006007"
O="00000000-0000-4000-8000-000000006008"
CMD="00000000-0000-4000-8000-000000006009"
NOW=datetime.now(timezone.utc)
class PG(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.admin=psycopg.connect(DSN,autocommit=True)
  with cls.admin.cursor() as c:
   c.execute("CREATE ROLE doobr_r0211_user LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOBYPASSRLS")
   c.execute("GRANT USAGE ON SCHEMA doobr_private TO doobr_r0211_user")
   c.execute("GRANT SELECT,UPDATE ON doobr_private.event_outbox TO doobr_r0211_user")
   c.execute("GRANT INSERT ON doobr_private.event_receipts TO doobr_r0211_user")
   c.execute("INSERT INTO doobr_private.tenants(tenant_id,label) VALUES (%s,'outbox')",(T,))
   for actor,kind in ((C,'COURIER'),(B,'CONSUMER'),(S,'RETAILER')):
    c.execute("INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state) VALUES(%s,%s,%s,%s,'ACTIVE')",(T,actor,kind+actor,kind))
   c.execute("""INSERT INTO doobr_private.service_regions(tenant_id,region_id,region_code,country_code,province_code,municipality_ref,boundary,policy_ref)
      VALUES(%s,%s,'test','CA','BC','Vancouver',ST_Multi(ST_GeomFromText('POLYGON((-123 49,-122 49,-122 50,-123 50,-123 49))',4326)),'policy')""",(T,R))
   c.execute("""INSERT INTO doobr_private.delivery_orders(tenant_id,order_id,consumer_id,retailer_id,region_id,state)
     VALUES(%s,%s,%s,%s,%s,'PICKED_UP')""",(T,O,B,S,R))
 @classmethod
 def tearDownClass(cls):
  with cls.admin.cursor() as c:
   c.execute("REVOKE ALL ON ALL TABLES IN SCHEMA doobr_private FROM doobr_r0211_user")
   c.execute("REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r0211_user")
   c.execute("DROP ROLE doobr_r0211_user")
  cls.admin.close()
 def conn(self):return psycopg.connect(USR)
 def test_trigger_atomicity_and_concurrent_workers(self):
  with self.admin.transaction():
   with self.admin.cursor() as c:
    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(T,))
    c.execute("""INSERT INTO doobr_private.order_commands(tenant_id,command_id,order_id,actor_id,
       action,target_state,request_digest,expected_revision,applied_revision)
       VALUES(%s,%s,%s,%s,'PICKUP','PICKED_UP',%s,1,2)""",(T,CMD,O,C,b'd'*32))
  with self.admin.cursor() as c:
   c.execute("SELECT count(*),max(payload->>'state') FROM doobr_private.event_outbox WHERE tenant_id=%s",(T,))
   self.assertEqual(c.fetchone(),(1,'PICKED_UP'))
  now=datetime.now(timezone.utc)+timedelta(seconds=1)
  def take(w):return claim(connect=self.conn,tenant_id=T,worker_id=w,at=now)
  with ThreadPoolExecutor(max_workers=2) as pool:
   items=list(pool.map(take,[W,W2]))
  self.assertEqual(sum(i is not None for i in items),1)
  item=next(i for i in items if i)
  winner=item['worker_id']
  with self.assertRaises(Denied):
   settle(connect=self.conn,tenant_id=T,worker_id=W2 if winner==W else W,
     event_id=item['event_id'],attempt=item['attempt'],receipt_ref='forged',at=now)
  self.assertEqual(settle(connect=self.conn,tenant_id=T,worker_id=winner,
    event_id=item['event_id'],attempt=item['attempt'],error_code='RETRY',at=now),'PENDING')
  self.assertIsNone(claim(connect=self.conn,tenant_id=T,worker_id=W,at=now))
  later=now+timedelta(minutes=1)
  item2=claim(connect=self.conn,tenant_id=T,worker_id=W2,at=later)
  self.assertEqual(item2['attempt'],2)
  with self.assertRaises(Denied):
   settle(connect=self.conn,tenant_id=T,worker_id=winner,event_id=item['event_id'],
       attempt=1,receipt_ref='stale',at=later)
  self.assertEqual(settle(connect=self.conn,tenant_id=T,worker_id=W2,
    event_id=item2['event_id'],attempt=2,receipt_ref='signed-ack',at=later),'DELIVERED')
  self.assertIsNone(claim(connect=self.conn,tenant_id=T,worker_id=W,at=later))
  with self.admin.cursor() as c:
   c.execute("SELECT status,attempt_count FROM doobr_private.event_outbox WHERE tenant_id=%s",(T,))
   self.assertEqual(c.fetchone(),('DELIVERED',2))
   c.execute("SELECT count(*) FROM doobr_private.event_receipts WHERE tenant_id=%s",(T,))
   self.assertEqual(c.fetchone()[0],1)
if __name__=="__main__":unittest.main()
