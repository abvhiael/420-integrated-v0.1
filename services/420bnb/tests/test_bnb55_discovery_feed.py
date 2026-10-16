"""BNB-5.5 real verified-TLS PostgreSQL journal, paging, resync and HTTP authority."""
import os,time,json,threading
from uuid import uuid4,UUID
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone,timedelta
import psycopg
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from test_bnb32_infrastructure import database as tls_database
import discovery_sync as sync
import discovery_feed as feed
import production

@pytest.fixture
def database(request):
    if not os.environ.get('BNB32_TLS_ADMIN_DSN'):
        pytest.fail('Verified-TLS database fixture required for BNB-5.5')
    admin,migrator,runtime=request.getfixturevalue('tls_database')
    def connect():return psycopg.connect(**dict(runtime,options='-c search_path=public -c statement_timeout=5000 -c lock_timeout=2000'))
    return connect,admin,migrator

def property_row(c,pid=None):
    pid=pid or uuid4()
    c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,private_address,
        status,capacity,nightly_minor,currency) VALUES(%s,'fixture','Listing','Region',
        'NEVER_EXPORT_PRIVATE_ADDRESS','published',2,100,'CAD')""",(pid,))
    return pid

def authorize(*_):return True

def test_cross_property_cursors_and_equal_timestamps_do_not_skip_revisions(database):
    connect,_,_=database
    with connect() as c:
        a=property_row(c);b=property_row(c)
        sync.synchronize(c,a);sync.synchronize(c,b)
        assert c.execute('SELECT count(DISTINCT updated_at) FROM bnb_discovery_projection').fetchone()==(1,)
    with connect() as c:
        first=feed.page(c,'search',limit=1)
        second=feed.page(c,'search',after=first['next_cursor'],limit=1,
            until=first['high_watermark'],epoch=first['epoch'])
        assert [first['items'][0]['revision'],second['items'][0]['revision']]==[1,1]
        assert first['next_cursor']==1 and second['next_cursor']==2
        assert first['has_more'] and not second['has_more']
        assert {i['property_id'] for i in first['items']+second['items']}=={str(a),str(b)}
        assert sync.safe_feed(c,'travel',after=1,limit=1)[0]['property_id']==str(b)

def test_stable_high_watermark_interleaved_updates_and_resume(database):
    connect,_,_=database
    with connect() as c:
        a=property_row(c);b=property_row(c);sync.synchronize(c,a);sync.synchronize(c,b)
    with connect() as c: first=feed.page(c,'search',limit=1)
    with connect() as c:
        c.execute('UPDATE bnb_property SET version=version+1 WHERE id=%s',(a,))
        sync.synchronize(c,a)
    with connect() as c:
        old=feed.page(c,'search',after=1,until=first['high_watermark'],epoch=first['epoch'])
        assert [r['cursor'] for r in old['items']]==[2]
        later=feed.page(c,'search',after=old['next_cursor'])
        assert [(r['cursor'],r['revision']) for r in later['items']]==[(3,2)]
        assert feed.page(c,'search',after=3)['items']==[]

def test_commit_order_fences_uncommitted_lower_cursor(database):
    connect,_,_=database
    with connect() as c:a=property_row(c);b=property_row(c)
    ready=threading.Event()
    def write():
        with connect() as c:
            ready.set()
            return sync.synchronize(c,b)
    with connect() as owner,ThreadPoolExecutor(max_workers=1) as pool:
        sync.synchronize(owner,a)
        future=pool.submit(write)
        try:
            assert ready.wait(1)
            with connect() as reader:
                assert feed.page(reader,'search')['high_watermark']==0
                assert feed.page(reader,'search')['items']==[]
            assert not future.done()
            owner.commit();assert future.result(timeout=4)['revision']==1
        finally:owner.rollback()
    with connect() as c:
        assert [r['cursor'] for r in feed.page(c,'search')['items']]==[1,2]

def test_rollback_does_not_leak_or_advance_cursor_and_restart_reads_durable_history(database):
    connect,_,_=database
    with connect() as c:pid=property_row(c)
    with connect() as c:sync.synchronize(c,pid);c.rollback()
    with connect() as c:
        assert feed.page(c,'travel')['high_watermark']==0
        sync.synchronize(c,pid)
    with connect() as restarted:
        result=feed.page(restarted,'travel')
        assert len(result['items'])==1 and result['next_cursor']==1
        assert sync.synchronize(restarted,pid)['changed'] is False
        assert feed.page(restarted,'travel')['high_watermark']==1

def test_delete_tombstone_and_recreation_keep_property_revision_monotone(database):
    connect,_,_=database
    with connect() as c:pid=property_row(c);sync.synchronize(c,pid)
    with connect() as c:c.execute('DELETE FROM bnb_discovery_projection WHERE property_id=%s',(pid,))
    with connect() as c:
        deleted=feed.page(c,'search',after=1)['items'][0]
        assert deleted['revision']==2 and deleted['payload']['visible'] is False
        assert sync.synchronize(c,pid)['revision']==3
    with connect() as c:
        assert [(i['cursor'],i['revision']) for i in feed.page(c,'search')['items']]==[(1,1),(2,2),(3,3)]

@pytest.mark.parametrize('after,limit',[(True,1),(-1,1),(0,0),(0,51),(0,True),(2**63,1)])
def test_cursor_and_page_bounds(database,after,limit):
    connect,_,_=database
    with connect() as c:
        with pytest.raises(HTTPException,match='PAGE_INVALID'):
            feed.page(c,'search',after=after,limit=limit)

def test_future_cursor_unknown_consumer_and_epoch_requirements(database):
    connect,_,_=database
    with connect() as c:
        for action,code in [
            (lambda:feed.page(c,'search',after=1),'CURSOR_INVALID'),
            (lambda:feed.page(c,'unknown'),'CONSUMER_UNAUTHORIZED'),
            (lambda:feed.page(c,'search',epoch=str(uuid4())),'EPOCH_RESYNC_REQUIRED')]:
            with pytest.raises(HTTPException,match=code):action()

def test_bounded_catchup_requires_authorized_resync(database,monkeypatch):
    connect,_,_=database
    with connect() as c:
        for _ in range(3):sync.synchronize(c,property_row(c))
    monkeypatch.setattr(feed,'MAX_CATCHUP',2)
    with connect() as c:
        with pytest.raises(HTTPException,match='CATCHUP_RESYNC_REQUIRED'):feed.page(c,'search')
        with pytest.raises(HTTPException,match='RESYNC_AUTHORITY_REQUIRED'):
            feed.begin_resync(c,'search',actor='fixture',request_key='test-nonce')
        session=feed.begin_resync(c,'search',actor='fixture',request_key='test-nonce',authorize=authorize)
    with connect() as c:
        result=feed.resync_page(c,'search',session['id'],actor='fixture',authorize=authorize)
        assert len(result['items'])==3 and result['resume_after']==3

def test_resync_snapshot_paging_replay_and_post_snapshot_catchup(database):
    connect,_,_=database
    with connect() as c:
        a=property_row(c,UUID(int=0));b=property_row(c);sync.synchronize(c,a);sync.synchronize(c,b)
        session=feed.begin_resync(c,'search',actor='fixture',request_key='resync-fixture',authorize=authorize)
    with connect() as c:
        assert feed.begin_resync(c,'search',actor='fixture',request_key='resync-fixture',authorize=authorize)==session
        first=feed.resync_page(c,'search',session['id'],actor='fixture',limit=1,authorize=authorize)
        assert first['items'][0]['property_id']==str(UUID(int=0)) and first['has_more']
        assert feed.resync_page(c,'search',session['id'],actor='fixture',limit=1,authorize=authorize)==first
    with connect() as c:
        c.execute('UPDATE bnb_property SET version=version+1 WHERE id=%s',(b,));sync.synchronize(c,b)
    with connect() as c:
        last=feed.resync_page(c,'search',session['id'],actor='fixture',
            after_property=first['next_property'],limit=1,authorize=authorize)
        assert last['items'][0]['revision']==1 and last['resume_after']==2
        assert [(i['cursor'],i['revision']) for i in feed.page(c,'search',after=last['resume_after'])['items']]==[(3,2)]

def test_resync_scope_revocation_expiration_and_epoch_fail_closed(database):
    connect,admin,_=database
    with connect() as c:
        session=feed.begin_resync(c,'search',actor='fixture',request_key='scope-fixture',authorize=authorize)
    with connect() as c:
        for consumer,actor,auth in [('travel','fixture',authorize),('search','other',authorize),('search','fixture',lambda *_:False)]:
            with pytest.raises(HTTPException):
                feed.resync_page(c,consumer,session['id'],actor=actor,authorize=auth)
    with psycopg.connect(**admin) as c:
        c.execute("UPDATE bnb_discovery_resync SET expires_at=clock_timestamp()-interval '1 second'")
    with connect() as c:
        with pytest.raises(HTTPException,match='SESSION_NOT_AUTHORIZED'):
            feed.resync_page(c,'search',session['id'],actor='fixture',authorize=authorize)
        with pytest.raises(HTTPException,match='EXPIRED_OR_EPOCH_CHANGED'):
            feed.begin_resync(c,'search',actor='fixture',request_key='scope-fixture',authorize=authorize)

def test_runtime_cannot_forge_delete_or_reset_journal(database):
    connect,admin,_=database
    with connect() as c:
        pid=property_row(c);assert sync.synchronize(c,pid)['revision']==1
        production.verify_database(c)
    for statement in ["DELETE FROM bnb_discovery_change","UPDATE bnb_discovery_clock SET value=0",
        "INSERT INTO bnb_discovery_change VALUES(9,gen_random_uuid(),1,'forged','{}')",
        "UPDATE bnb_discovery_resync SET watermark=999"]:
        with connect() as c:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):c.execute(statement)
    with psycopg.connect(**admin) as c:c.execute('GRANT UPDATE ON bnb_discovery_change TO bnb_runtime')
    with connect() as c:
        with pytest.raises(production.ConfigurationError,match='DISCOVERY_JOURNAL_WRITE'):
            production.verify_database(c)

def test_append_only_upgrade_seeds_existing_revision_without_fabricating_history(database):
    connect,_,migrator=database
    with psycopg.connect(**migrator) as c:
        c.execute('SET LOCAL ROLE bnb_owner')
        c.execute('DROP TABLE bnb_message_notice,bnb_message_device')
        c.execute('DELETE FROM bnb_schema_migration WHERE version=30')
        c.execute('DROP FUNCTION bnb_append_discovery_change() CASCADE')
        c.execute('DROP TABLE bnb_discovery_resync,bnb_discovery_change,bnb_discovery_clock')
        c.execute('DELETE FROM bnb_schema_migration WHERE version=29')
        pid=property_row(c)
        c.execute("""INSERT INTO bnb_discovery_projection(property_id,revision,source_digest,payload)
            VALUES(%s,7,'historical',%s::jsonb)""",(pid,json.dumps({'property_id':str(pid),'visible':False,'property_version':1})))
    with psycopg.connect(**migrator) as c:assert production.controlled_migration(c)==30
    with connect() as c:
        assert [(r['cursor'],r['revision']) for r in feed.page(c,'search')['items']]==[(1,7)]
        assert c.execute('SELECT count(*) FROM bnb_discovery_consumer').fetchone()==(0,)

def test_visible_history_rechecks_authority_and_never_exports_unknown_private_fields(database,monkeypatch):
    connect,_,_=database
    with connect() as c:pid=property_row(c)
    eligible=(pid,1,'Listing','Region',2,49,-124,'place','jurisdiction')
    monkeypatch.setattr(sync,'_eligible',lambda *_:eligible)
    with connect() as c:sync.synchronize(c,pid)
    with connect() as c:
        first=feed.page(c,'search');assert first['items'][0]['payload']['visible']
        assert 'NEVER_EXPORT_PRIVATE_ADDRESS' not in str(first)
    monkeypatch.setattr(sync,'_eligible',lambda *_:None)
    with connect() as c:
        redacted=feed.page(c,'search')['items'][0]
        assert redacted['cursor']==1 and redacted['redacted']
        assert set(redacted['payload'])=={'property_id','visible','property_version'}
        assert redacted['payload']['visible'] is False
        sync.synchronize(c,pid)
    with connect() as c:
        assert feed.page(c,'search',after=1)['items'][0]['revision']==2

def test_autocommit_cannot_split_source_and_journal_or_resync(database):
    connect,_,_=database
    with connect() as c:
        c.autocommit=True
        with pytest.raises(HTTPException,match='TRANSACTION_REQUIRED'):
            sync.synchronize(c,uuid4())
        with pytest.raises(HTTPException,match='TRANSACTION_REQUIRED'):
            feed.begin_resync(c,'search',actor='fixture',request_key='autocommit',authorize=authorize)

@pytest.fixture
def signed_http(database,monkeypatch):
    import api,jwt
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    connect,_,_=database
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    public=key.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    monkeypatch.setenv('BNB_DISCOVERY_CONSUMER_ISSUER','https://fixture.invalid')
    monkeypatch.setenv('BNB_DISCOVERY_CONSUMER_AUDIENCE','fixture-discovery')
    monkeypatch.setenv('BNB_DISCOVERY_CONSUMER_PUBLIC_KEY_PEM',public)
    monkeypatch.setattr(api,'db',connect)
    def token(purpose,**scope):
        now=int(time.time())
        claims={'iss':'https://fixture.invalid','aud':'fixture-discovery','sub':'fixture',
            'iat':now,'nbf':now,'exp':now+120,'jti':uuid4().hex,'purpose':purpose,
            'consumer':'search','current_consumer_grant_verified':True,'consumer_revoked':False,**scope}
        return jwt.encode(claims,key,algorithm='RS256')
    return TestClient(api.app),token,connect

def test_http_signed_feed_scope_resync_and_forgery_rejection(signed_http):
    client,token,connect=signed_http
    path='/v1/bnb/internal/discovery-feeds/search'
    assert client.get(path).status_code==401
    assert client.get(path,headers={'x-discovery-proof':'forged'}).status_code==401
    signed=token('discovery-feed',after=0,limit=1,until=None,epoch=None)
    assert client.get(path+'?limit=1',headers={'x-discovery-proof':signed}).status_code==200
    assert client.get(path+'?limit=2',headers={'x-discovery-proof':signed}).status_code==403
    revoked=token('discovery-feed',after=0,limit=1,until=None,epoch=None,consumer_revoked=True)
    assert client.get(path+'?limit=1',headers={'x-discovery-proof':revoked}).status_code==403
    created=client.post(path+'/resync',headers={'x-discovery-proof':token('discovery-resync',resync_requested=True)})
    assert created.status_code==201,created.text
    sid=created.json()['id']
    read=token('discovery-resync-read',resync_id=sid,after_property=None,limit=1)
    assert client.get(path+'/resync/'+sid+'?limit=1',headers={'x-discovery-proof':read}).status_code==200
    assert client.get(path+'/resync/'+str(uuid4())+'?limit=1',headers={'x-discovery-proof':read}).status_code==403

def test_concurrent_independent_properties_have_contiguous_commit_order(database):
    connect,_,_=database
    with connect() as c:pids=[property_row(c) for _ in range(4)]
    def write(pid):
        with connect() as c:return sync.synchronize(c,pid)
    with ThreadPoolExecutor(max_workers=4) as pool:
        assert all(r['revision']==1 for r in pool.map(write,pids))
    with connect() as c:
        result=feed.page(c,'search')
        assert [r['cursor'] for r in result['items']]==[1,2,3,4]
        assert {r['property_id'] for r in result['items']}=={str(pid) for pid in pids}

def test_journal_unknown_payload_fields_cannot_escape_public_allowlist(database,monkeypatch):
    connect,_,_=database
    with connect() as c:pid=property_row(c)
    monkeypatch.setattr(sync,'_eligible',lambda *_:(pid,1,'Listing','Region',2,None,None,'place','jurisdiction'))
    with connect() as c:
        sync.synchronize(c,pid)
        c.execute("""UPDATE bnb_discovery_projection SET revision=revision+1,
            payload=payload || '{"private_address":"NEVER_EXPORT_EXTRA_SECRET"}'::jsonb
            WHERE property_id=%s""",(pid,))
    with connect() as c:
        result=feed.page(c,'search')
        assert 'NEVER_EXPORT_EXTRA_SECRET' not in str(result)
        assert result['items'][-1]['payload']['booking_enabled'] is False

def test_resync_epoch_change_invalidates_session_and_cursor(database):
    connect,admin,_=database
    with connect() as c:
        session=feed.begin_resync(c,'search',actor='fixture',request_key='epoch-fixture',authorize=authorize)
    with psycopg.connect(**admin) as c:c.execute('UPDATE bnb_discovery_clock SET epoch=gen_random_uuid()')
    with connect() as c:
        with pytest.raises(HTTPException,match='EPOCH_RESYNC_REQUIRED'):
            feed.resync_page(c,'search',session['id'],actor='fixture',authorize=authorize)
        with pytest.raises(HTTPException,match='EPOCH_RESYNC_REQUIRED'):
            feed.page(c,'search',epoch=session['epoch'])
