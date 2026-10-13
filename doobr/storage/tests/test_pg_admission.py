"""Real PostgreSQL concurrent admission integration, not mocked DB operations."""
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
import psycopg
from doobr.admission import admit_prepaid_order
from doobr.auth import Session,Denied
from doobr.retailer import RetailerClaim,PrepaidProof

T="00000000-0000-4000-8000-000000000601"
C="00000000-0000-4000-8000-000000000602"
R="00000000-0000-4000-8000-000000000603"
G="00000000-0000-4000-8000-000000000604"
O="00000000-0000-4000-8000-000000000605"
O2="00000000-0000-4000-8000-000000000606"
A="00000000-0000-4000-8000-000000000607"
OTHER="00000000-0000-4000-8000-000000000608"
class Licence:
    def verify_current(self,claim,at):return True
class Paid:
    def verify_prepaid(self,*,seller_ref,order_ref,at):
        return PrepaidProof(seller_ref,order_ref,"pay-ref-once",100,"CAD",True,False,at)
class Cases(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin=psycopg.connect("host=localhost dbname=doobr_r02_3 user=postgres password=ci-only-password",autocommit=True)
        with cls.admin.cursor() as c:
            c.execute("CREATE ROLE doobr_r023_admit LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS")
            c.execute("GRANT USAGE ON SCHEMA doobr_private TO doobr_r023_admit")
            c.execute("""GRANT SELECT ON doobr_private.delivery_orders,doobr_private.service_regions,
                        doobr_private.retailer_authorizations TO doobr_r023_admit""")
            c.execute("GRANT UPDATE(state,revision,retailer_order_ref,updated_at) ON doobr_private.delivery_orders TO doobr_r023_admit")
            c.execute("GRANT INSERT ON doobr_private.retailer_prepaid_evidence TO doobr_r023_admit")
            c.execute("GRANT SELECT(revision) ON doobr_private.delivery_orders TO doobr_r023_admit")
            c.execute("INSERT INTO doobr_private.tenants(tenant_id,label) VALUES (%s,'R023 concurrency'),(%s,'R023 foreign')",(T,OTHER))
            c.execute("""INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state) VALUES
                        (%s,%s,'identity:consumer-1','CONSUMER','ACTIVE'),
                        (%s,%s,'identity:retailer-1','RETAILER','ACTIVE')""",(T,C,T,R))
            c.execute("""INSERT INTO doobr_private.service_regions
                        (tenant_id,region_id,region_code,country_code,province_code,municipality_ref,boundary,policy_ref)
                        VALUES (%s,%s,'vancouver-test','CA','BC','Vancouver',
                        ST_Multi(ST_GeomFromText('POLYGON((-123 49,-122 49,-122 50,-123 50,-123 49))',4326)),'not-legal-policy')""",(T,G))
            c.execute("""INSERT INTO doobr_private.delivery_orders
                        (tenant_id,order_id,consumer_id,retailer_id,region_id) VALUES
                        (%s,%s,%s,%s,%s),(%s,%s,%s,%s,%s)""",(T,O,C,R,G,T,O2,C,R,G))
            c.execute("""INSERT INTO doobr_private.retailer_authorizations
                        (tenant_id,authorization_id,retailer_id,legal_seller_ref,licence_ref,municipality_ref,
                        retail_site_ref,issuer_ref,evidence_digest,valid_from,valid_until)
                        VALUES (%s,%s,%s,'seller','licence','Vancouver','shop','issuer',%s,now()-interval '1 day',now()+interval '1 day')""",
                        (T,A,R,bytes.fromhex("aa"*32)))
    @classmethod
    def tearDownClass(cls):
        with cls.admin.cursor() as c:
            c.execute("REVOKE ALL ON ALL TABLES IN SCHEMA doobr_private FROM doobr_r023_admit")
            c.execute("REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r023_admit")
            c.execute("DROP ROLE doobr_r023_admit")
        cls.admin.close()
    def attempt(self,order_id=O,order_ref="retailer-order-1",tenant=T):
        now=datetime.now(timezone.utc)
        claim=RetailerClaim(T,R,"seller","licence","Vancouver","shop",
            "sha256:proof","issuer",now-timedelta(hours=1),now+timedelta(hours=1),False)
        session=Session(T,R,"sub","issuer","jti",now+timedelta(hours=1),False,None)
        return admit_prepaid_order(connect=lambda:psycopg.connect(
            "host=localhost dbname=doobr_r02_3 user=doobr_r023_admit password=ci-only-password"),
            session=session,tenant_id=tenant,order_id=order_id,retailer_id=R,region_id=G,
            municipality_ref="Vancouver",claim=claim,retailer_order_ref=order_ref,
            amount_minor=100,currency="CAD",proof_digest=b"p"*32,
            licence_digest=bytes.fromhex("aa"*32),licensing=Licence(),order_authority=Paid(),now=now)
    def test_parallel_one_winner_and_replay_unique_payment(self):
        with ThreadPoolExecutor(max_workers=6) as pool:
            outcomes=list(pool.map(lambda _:self._result(O),range(6)))
        self.assertEqual(outcomes.count("ADMITTED"),1,outcomes)
        self.assertEqual(outcomes.count("DENIED"),5,outcomes)
        with self.admin.cursor() as c:
            c.execute("SELECT state,revision FROM doobr_private.delivery_orders WHERE tenant_id=%s AND order_id=%s",(T,O))
            self.assertEqual(c.fetchone(),("ELIGIBILITY_PENDING",2))
            c.execute("SELECT count(*) FROM doobr_private.retailer_prepaid_evidence WHERE tenant_id=%s",(T,))
            self.assertEqual(c.fetchone()[0],1)
        with self.assertRaises(Denied):
            self.attempt(O2,"retailer-order-2") # independent order, same payment ref
        with self.admin.cursor() as c:
            c.execute("SELECT state,revision FROM doobr_private.delivery_orders WHERE tenant_id=%s AND order_id=%s",(T,O2))
            self.assertEqual(c.fetchone(),("DRAFT",1))
    def _result(self,order_id):
        try:
            self.attempt(order_id)
            return "ADMITTED"
        except Denied:
            return "DENIED"
    def test_invalid_foreign_tenant_denies(self):
        with self.assertRaises(Denied):self.attempt(O2,tenant=OTHER)
if __name__=="__main__":unittest.main()
