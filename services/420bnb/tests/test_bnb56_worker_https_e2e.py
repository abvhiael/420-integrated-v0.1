"""BNB-5.6 supervised outbox to isolated Search+Travel service over real TLS."""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
import socket
import ssl
import threading
import time
from uuid import uuid4

import jwt
import pytest
import uvicorn
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

from test_bnb55_discovery_feed import database, property_row
from test_bnb32_infrastructure import database as tls_database
import consumer_delivery
import discovery_consumer_service
import discovery_sync
import worker


@contextmanager
def independent_server(app, tmp_path, suffix):
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,"localhost")])
    cert=(x509.CertificateBuilder().subject_name(subject).issuer_name(subject)
          .public_key(key.public_key()).serial_number(x509.random_serial_number())
          .not_valid_before(datetime.now(timezone.utc)-timedelta(minutes=5))
          .not_valid_after(datetime.now(timezone.utc)+timedelta(days=1))
          .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost")]),False)
          .sign(key,hashes.SHA256()))
    certfile=tmp_path/("consumer-"+suffix+".pem")
    keyfile=tmp_path/("consumer-"+suffix+".key")
    certfile.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    keyfile.write_bytes(key.private_bytes(serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
    with socket.socket() as sock:
        sock.bind(("127.0.0.1",0));port=sock.getsockname()[1]
    server=uvicorn.Server(uvicorn.Config(app,host="127.0.0.1",port=port,
        log_level="critical",ssl_certfile=str(certfile),ssl_keyfile=str(keyfile),
        access_log=False))
    thread=threading.Thread(target=server.run,daemon=True)
    thread.start()
    for _ in range(100):
        if server.started:break
        time.sleep(.05)
    assert server.started
    context=ssl.create_default_context(cafile=str(certfile))
    try:
        yield "https://localhost:"+str(port)+"/v1/discovery/accept",context
    finally:
        server.should_exit=True
        thread.join(timeout=5)
        assert not thread.is_alive()


def test_two_independent_https_consumers_durable_worker_delivery(database,monkeypatch,tmp_path):
    connect,_,_=database
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    public=key.public_key().public_bytes(serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    monkeypatch.setenv("BNB_DISCOVERY_CONSUMER_ISSUER","https://fixture.invalid")
    monkeypatch.setenv("BNB_DISCOVERY_CONSUMER_AUDIENCE","bnb-isolated-ci")
    monkeypatch.setenv("BNB_DISCOVERY_CONSUMER_PUBLIC_KEY_PEM",public)
    def proof(consumer,body):
        now=int(time.time())
        return jwt.encode({"iss":"https://fixture.invalid","aud":"bnb-isolated-ci",
            "sub":"isolated-worker","iat":now,"nbf":now,"exp":now+90,"jti":uuid4().hex,
            "purpose":"discovery-accept","consumer":consumer,
            "current_consumer_grant_verified":True,"consumer_revoked":False,
            **{k:body[k] for k in ("transport_digest","epoch","cursor",
                                    "property_id","revision")}},key,algorithm="RS256")
    def authorize(actor,action,consumer):
        return actor=="isolated-ci" and action=="configure" and consumer in ("search","travel")
    with connect() as conn:
        for consumer in ("search","travel"):
            consumer_delivery.configure(conn,consumer,["bnb.discovery.changed"],
                active=True,expected_revision=0,actor="isolated-ci",authorize=authorize)
        pid=property_row(conn)
        discovery_sync.synchronize(conn,pid)
    with independent_server(discovery_consumer_service.create_consumer_app("search",connect),tmp_path,"search") as search:
        with independent_server(discovery_consumer_service.create_consumer_app("travel",connect),tmp_path,"travel") as travel:
            for consumer,(url,ctx) in (("search",search),("travel",travel)):
                supervisor=worker.isolated_discovery_worker(connect,consumer,url,proof,
                    ssl_context=ctx)
                assert supervisor.once()=="delivered"
            with connect() as conn:
                recipients=conn.execute("SELECT consumer,revision,payload FROM bnb_discovery_consumer ORDER BY consumer").fetchall()
                receipts=conn.execute("SELECT consumer,accepted_at FROM bnb_consumer_delivery ORDER BY consumer").fetchall()
                assert [x[0] for x in recipients]==["search","travel"]
                assert all(row[1] is not None for row in receipts)
                assert all(row[2]["visible"] is False for row in recipients)
                event=conn.execute("SELECT delivered_at FROM bnb_outbox WHERE event_type='bnb.discovery.changed' ORDER BY created_at DESC LIMIT 1").fetchone()
                assert event[0] is not None
            # Source revision changes must independently reach both consumers.
            with connect() as conn:
                conn.execute("UPDATE bnb_property SET version=version+1 WHERE id=%s",(pid,))
                discovery_sync.synchronize(conn,pid)
            for consumer,(url,ctx) in (("search",search),("travel",travel)):
                supervisor=worker.isolated_discovery_worker(connect,consumer,url,proof,
                    ssl_context=ctx)
                assert supervisor.once()=="delivered"
            with connect() as conn:
                rows=conn.execute("SELECT consumer,revision,payload FROM bnb_discovery_consumer ORDER BY consumer").fetchall()
                assert [x[1] for x in rows]==[2,2]
                assert all(x[2]["visible"] is False for x in rows)
                receipts=conn.execute("""SELECT consumer,count(*) FROM bnb_consumer_delivery
                    WHERE accepted_at IS NOT NULL GROUP BY consumer ORDER BY consumer""").fetchall()
                assert receipts==[("search",2),("travel",2)]


def test_tls_delivery_failure_then_recovery_preserves_durable_consumer_receipt(database,monkeypatch,tmp_path):
    connect,_,_=database
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    public=key.public_key().public_bytes(serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    monkeypatch.setenv("BNB_DISCOVERY_CONSUMER_ISSUER","https://fixture.invalid")
    monkeypatch.setenv("BNB_DISCOVERY_CONSUMER_AUDIENCE","bnb-isolated-ci")
    monkeypatch.setenv("BNB_DISCOVERY_CONSUMER_PUBLIC_KEY_PEM",public)
    def proof(consumer,body):
        now=int(time.time())
        return jwt.encode({"iss":"https://fixture.invalid","aud":"bnb-isolated-ci",
            "sub":"isolated-worker","iat":now,"nbf":now,"exp":now+90,"jti":uuid4().hex,
            "purpose":"discovery-accept","consumer":consumer,
            "current_consumer_grant_verified":True,"consumer_revoked":False,
            **{k:body[k] for k in ("transport_digest","epoch","cursor","property_id","revision")}},
            key,algorithm="RS256")
    with connect() as conn:
        consumer_delivery.configure(conn,"search",["bnb.discovery.changed"],active=True,
            expected_revision=0,actor="isolated-ci",
            authorize=lambda actor,action,target:actor=="isolated-ci" and action=="configure" and target=="search")
        pid=property_row(conn)
        discovery_sync.synchronize(conn,pid)
    with independent_server(discovery_consumer_service.create_consumer_app("search",connect),tmp_path,"recovery") as (url,trusted):
        untrusted=ssl.create_default_context()
        assert worker.isolated_discovery_worker(connect,"search",url,proof,
            ssl_context=untrusted).once()=="retry"
        with connect() as conn:
            assert conn.execute("SELECT count(*) FROM bnb_discovery_consumer").fetchone()[0]==0
            assert conn.execute("SELECT count(*) FROM bnb_consumer_delivery WHERE accepted_at IS NOT NULL").fetchone()[0]==0
            conn.execute("UPDATE bnb_consumer_delivery SET available_at=clock_timestamp()-interval '1 second' WHERE consumer='search'")
        assert worker.isolated_discovery_worker(connect,"search",url,proof,
            ssl_context=trusted).once()=="delivered"
        with connect() as conn:
            assert conn.execute("SELECT count(*) FROM bnb_discovery_consumer WHERE consumer='search'").fetchone()[0]==1
            assert conn.execute("SELECT attempts FROM bnb_consumer_delivery WHERE consumer='search'").fetchone()[0]==2
