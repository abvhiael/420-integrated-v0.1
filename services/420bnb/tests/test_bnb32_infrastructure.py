"""BNB-3.2 isolated configuration and verified-TLS PostgreSQL qualification."""
import copy
import hashlib
import importlib.util
import json
import os
import stat
import sys
import threading
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import production as p
import web_server as web


@pytest.fixture
def bindings(tmp_path):
    root = tmp_path / "secrets"
    root.mkdir()
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    (root / "issuer.pem").write_bytes(pem)
    (root / "ca.pem").write_text("CA fixture; real handshake is tested separately")
    dsn = root / "runtime.dsn"
    dsn.write_text(f"host=localhost dbname=bnb32 user=bnb_runtime password=test-only sslmode=verify-full sslrootcert={root / 'ca.pem'}")
    dsn.chmod(0o600)
    images = {n: f"example/{n}@sha256:" + "a" * 64 for n in ("api", "web", "ingress")}
    contract = {"schema": "420.bnb.production.v1", "release_sha": "b" * 40,
                "images": images, "booking_enabled": False, "financial_execution": False,
                "origins": {"api": "https://api.example.test", "web": "https://bnb.example.test", "travel": "https://travel.example.test"},
                "issuers": {prefix: {"issuer": "https://issuer.example.test", "audience": "urn:420:bnb:testnet",
                    "public_key_file": str(root / "issuer.pem"), "public_key_sha256": hashlib.sha256(pem).hexdigest(),
                    "approval_reference": "CI-FIXTURE-NOT-INDEPENDENT-APPROVAL"} for prefix in p.PREFIXES}}
    path = root / "deployment.json"
    path.write_text(json.dumps(contract))
    env = {"BNB_ENV": "production", "BNB_DEPLOYMENT_FILE": str(path), "BNB_DATABASE_URL_FILE": str(dsn),
           "BNB_BUILD_SHA": contract["release_sha"], "BNB_RELEASE_IMAGE": images["api"],
           "BNB_WEB_IMAGE": images["web"], "BNB_INGRESS_IMAGE": images["ingress"]}
    return root, path, contract, env


def test_verified_binding_and_no_live_approval(bindings):
    root, _, _, env = bindings
    contract, bound, values = p.load_contract(env, root=root)
    assert values["sslmode"] == "verify-full" and values["channel_binding"] == "require"
    assert values["connect_timeout"] == "5" and values["options"] == "-c search_path=public"
    assert set(p.PREFIXES).issubset({k.removesuffix("_ISSUER") for k in bound if k.endswith("_ISSUER")})
    assert contract["booking_enabled"] is False and "live_accepted" not in contract


def test_root_execution_rejected(bindings, monkeypatch):
    root, _, _, env = bindings
    monkeypatch.setattr(p.os, "geteuid", lambda: 0)
    with pytest.raises(p.ConfigurationError, match="NONROOT_PRODUCTION_REQUIRED"):
        p.load_contract(env, root=root)


def test_hidden_privileged_credential_rejected(bindings):
    root, _, _, env = bindings
    (root / "unreferenced-admin.dsn").write_text("CI-only-hidden-credential")
    with pytest.raises(p.ConfigurationError, match="UNREFERENCED_MOUNT_FILE"):
        p.load_contract(env, root=root)


@pytest.mark.parametrize("field,value,code", [
    ("release_sha", "short", "RELEASE_SHA_INVALID"),
    ("release_sha", "c" * 40, "IMAGE_RELEASE_MISMATCH"),
    ("booking_enabled", True, "ACTIVATION_FORBIDDEN"),
    ("financial_execution", True, "ACTIVATION_FORBIDDEN"),
    ("schema", "other", "CONTRACT_SCHEMA_INVALID"),
    ("images", {"api": "latest"}, "IMAGE_DIGEST_REQUIRED"),
    ("issuers", {}, "ISSUER_INVENTORY_INVALID"),
])
def test_contract_failures(bindings, field, value, code):
    root, path, contract, env = bindings
    contract[field] = value
    path.write_text(json.dumps(contract))
    with pytest.raises(p.ConfigurationError, match=code):
        p.load_contract(env, root=root)


@pytest.mark.parametrize("key,value,code", [
    ("BNB_DATABASE_URL", "password=must-not-print", "INLINE_SECRET_FORBIDDEN"),
    ("BNB_IDENTITY_ASSERTION_SECRET", "retired-secret", "INLINE_SECRET_FORBIDDEN"),
    ("BNB_IDENTITY_PUBLIC_KEY_PEM", "inline", "INLINE_ISSUER_KEY_FORBIDDEN"),
    ("BNB_RELEASE_IMAGE", "example/api@sha256:" + "c" * 64, "API_IMAGE_MISMATCH"),
    ("BNB_WEB_IMAGE", "mutable:latest", "TOPOLOGY_IMAGE_MISMATCH"),
    ("BNB_ENV", "local", "PRODUCTION_MODE_REQUIRED"),
])
def test_environment_failures(bindings, key, value, code):
    root, _, _, env = bindings
    env[key] = value
    with pytest.raises(p.ConfigurationError, match=code):
        p.load_contract(env, root=root)


@pytest.mark.parametrize("field,value,code", [
    ("issuer", "http://issuer.example.test", "HTTPS_ORIGIN_REQUIRED"),
    ("issuer", "https://user:secret@issuer.example.test", "HTTPS_ORIGIN_REQUIRED"),
    ("audience", "wrong audience with whitespace", "AUDIENCE_INVALID"),
    ("public_key_sha256", "0" * 64, "ISSUER_KEY_DIGEST_MISMATCH"),
    ("approval_reference", "", "ISSUER_REFERENCE_REQUIRED"),
])
def test_issuer_failures(bindings, field, value, code):
    root, path, contract, env = bindings
    contract["issuers"]["BNB_IDENTITY"][field] = value
    path.write_text(json.dumps(contract))
    with pytest.raises(p.ConfigurationError, match=code):
        p.load_contract(env, root=root)


@pytest.mark.parametrize("mode,code", [(0o644, "SECRET_PERMISSIONS_INVALID"), (0o666, "MOUNT_WRITABLE_BY_OTHER")])
def test_secret_modes(bindings, mode, code):
    root, _, _, env = bindings
    Path(env["BNB_DATABASE_URL_FILE"]).chmod(mode)
    with pytest.raises(p.ConfigurationError, match=code):
        p.load_contract(env, root=root)


def test_mount_escape_symlink_and_credential_separation(bindings, tmp_path):
    root, _, _, env = bindings
    with pytest.raises(p.ConfigurationError, match="MOUNT"):
        p.read_mount(str(root / ".." / "outside"), root)
    (root / "link").symlink_to(root / "issuer.pem")
    with pytest.raises(p.ConfigurationError, match="MOUNT_SYMLINK"):
        p.read_mount(str(root / "link"), root)
    (root / "migrator.dsn").write_text("separate credential")
    with pytest.raises(p.ConfigurationError, match="CREDENTIAL_SEPARATION"):
        p.load_contract(env, root=root)


@pytest.mark.parametrize("replace,code", [
    (("sslmode=verify-full", "sslmode=prefer"), "DATABASE_TLS_REQUIRED"),
    (("user=bnb_runtime", "user=postgres"), "DATABASE_ROLE_INVALID"),
    (("host=localhost", "host=localhost hostaddr=127.0.0.1"), "DATABASE_HOST_REQUIRED"),
    (("host=localhost", "host=localhost options='-c search_path=evil'"), "DATABASE_OVERRIDE_FORBIDDEN"),
])
def test_database_configuration_failures(bindings, replace, code):
    root, _, _, env = bindings
    path = Path(env["BNB_DATABASE_URL_FILE"])
    path.write_text(path.read_text().replace(*replace))
    with pytest.raises(p.ConfigurationError, match=code):
        p.load_contract(env, root=root)


def test_public_key_private_key_and_weak_key_rejected(bindings):
    root, path, contract, env = bindings
    for private in (True, False):
        key = rsa.generate_private_key(public_exponent=65537, key_size=1024)
        raw = (key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption()) if private else
               key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
        (root / "issuer.pem").write_bytes(raw)
        for item in contract["issuers"].values():
            item["public_key_sha256"] = hashlib.sha256(raw).hexdigest()
        path.write_text(json.dumps(contract))
        with pytest.raises(p.ConfigurationError, match="PUBLIC_KEY_INVALID|RSA_KEY_REQUIRED"):
            p.load_contract(env, root=root)


def test_start_failure_does_not_log_credentials(monkeypatch, capsys):
    def fail():
        raise psycopg.OperationalError("password=never-print-this")
    monkeypatch.setattr(p, "main", fail)
    assert p.cli() == 1
    captured = capsys.readouterr()
    assert captured.err == "PRODUCTION_START_FAILED\n"
    assert "never-print-this" not in captured.out + captured.err


def test_static_web_does_not_serve_files_or_log_private_paths():
    html = b"<html><script>window.example=1</script></html>"
    web.UI.html, web.UI.csp = html, web.policy(html)
    server = web.ThreadingHTTPServer(("127.0.0.1", 0), web.UI)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    try:
        with urllib.request.urlopen(origin) as response:
            assert response.read() == html
            assert "'sha256-" in response.headers["Content-Security-Policy"]
            assert response.headers["X-Frame-Options"] == "DENY"
            assert response.headers["Cache-Control"] == "no-store"
        for path in ("/production.py", "/../runtime.dsn", "/run/secrets/deployment.json"):
            with pytest.raises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(origin + path)
            assert error.value.code == 404
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=3)


@pytest.fixture
def database(tmp_path):
    admin = os.environ.get("BNB32_TLS_ADMIN_DSN")
    if not admin:
        pytest.skip("Verified-TLS PostgreSQL integration requires its explicit CI fixture")
    from psycopg.conninfo import conninfo_to_dict
    values = conninfo_to_dict(admin)
    with psycopg.connect(**values, autocommit=True) as connection:
        connection.execute("DROP DATABASE IF EXISTS bnb32_infrastructure WITH (FORCE)")
        connection.execute("CREATE DATABASE bnb32_infrastructure")
    values["dbname"] = "bnb32_infrastructure"
    with psycopg.connect(**values, autocommit=True) as connection:
        connection.execute((ROOT / "database-roles.sql").read_text())
        connection.execute("ALTER ROLE bnb_migrator PASSWORD 'CI-only-migrator'")
        connection.execute("ALTER ROLE bnb_runtime PASSWORD 'CI-only-runtime'")
    migrator = dict(values, user="bnb_migrator", password="CI-only-migrator", channel_binding="require")
    runtime = dict(values, user="bnb_runtime", password="CI-only-runtime", channel_binding="require")
    with psycopg.connect(**migrator) as connection:
        assert p.controlled_migration(connection) == 29
    yield values, migrator, runtime
    with psycopg.connect(**values, autocommit=True) as connection:
        connection.execute("SELECT 1")


def test_verified_tls_runtime_dml_and_denied_ddl_ledger(database):
    _, _, runtime = database
    with psycopg.connect(**runtime) as connection:
        p.verify_database(connection)
        connection.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,capacity,nightly_minor,currency)
            VALUES('00000000-0000-0000-0000-000000000032','CI-only-subject','CI fixture','Region',1,100,'CAD')""")
        assert connection.execute("SELECT count(*) FROM bnb_property").fetchone() == (1,)
    for statement in ("CREATE TABLE forbidden(id integer)", "UPDATE bnb_schema_migration SET filename='tampered'",
                      "TRUNCATE bnb_property", "SET ROLE bnb_owner"):
        with psycopg.connect(**runtime) as connection:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                connection.execute(statement)


def test_controlled_migration_repeatability_and_runtime_role_rejection(database):
    _, migrator, runtime = database
    with psycopg.connect(**migrator) as connection:
        assert p.controlled_migration(connection) == 29
    with psycopg.connect(**runtime) as connection:
        with pytest.raises(p.ConfigurationError, match="DATABASE_ROLE_ELEVATED"):
            p.controlled_migration(connection)


def test_database_privilege_drift_fails_closed(database):
    admin, _, runtime = database
    with psycopg.connect(**admin) as connection:
        connection.execute("GRANT CREATE ON SCHEMA public TO bnb_runtime")
    try:
        with psycopg.connect(**runtime) as connection:
            with pytest.raises(p.ConfigurationError, match="DATABASE_RUNTIME_DDL"):
                p.verify_database(connection)
    finally:
        with psycopg.connect(**admin) as connection:
            connection.execute("REVOKE CREATE ON SCHEMA public FROM bnb_runtime")


def test_wrong_database_ca_rejected(database, tmp_path):
    _, _, runtime = database
    bad = tmp_path / "bad-ca.pem"
    bad.write_text("not a trusted CA")
    with pytest.raises(psycopg.OperationalError):
        psycopg.connect(**dict(runtime, sslrootcert=str(bad)))


def test_wrong_database_hostname_rejected(database):
    _, _, runtime = database
    with pytest.raises(psycopg.OperationalError):
        psycopg.connect(**dict(runtime, host="wrong.example.test", hostaddr="127.0.0.1"))


def test_elevated_runtime_role_rejected(database):
    admin, _, runtime = database
    with psycopg.connect(**admin) as connection:
        connection.execute("ALTER ROLE bnb_runtime SUPERUSER")
    try:
        with psycopg.connect(**runtime) as connection:
            with pytest.raises(p.ConfigurationError, match="DATABASE_ROLE_ELEVATED"):
                p.verify_database(connection)
    finally:
        with psycopg.connect(**admin) as connection:
            connection.execute("ALTER ROLE bnb_runtime NOSUPERUSER")


def test_concurrent_controlled_migrations(database):
    from concurrent.futures import ThreadPoolExecutor
    _, migrator, _ = database
    def run(_):
        with psycopg.connect(**migrator) as connection:
            return p.controlled_migration(connection)
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(run, range(2))) == [29, 29]


@pytest.mark.parametrize("table,privilege", [
    ("bnb_schema_migration", "TRUNCATE"),
    ("bnb_schema_migration", "REFERENCES"),
    ("bnb_schema_migration", "TRIGGER"),
    ("bnb_property", "TRUNCATE"),
    ("bnb_property", "REFERENCES"),
    ("bnb_property", "TRIGGER"),
])
def test_extra_table_privilege_drift_rejected(database, table, privilege):
    admin, _, runtime = database
    # Both identifiers and privileges come only from this fixed test inventory.
    with psycopg.connect(**admin) as connection:
        connection.execute(f"GRANT {privilege} ON TABLE {table} TO bnb_runtime")
    try:
        with psycopg.connect(**runtime) as connection:
            with pytest.raises(p.ConfigurationError, match="DATABASE_LEDGER_WRITE|DATABASE_RUNTIME_EXTRA_PRIVILEGE"):
                p.verify_database(connection)
    finally:
        with psycopg.connect(**admin) as connection:
            connection.execute(f"REVOKE {privilege} ON TABLE {table} FROM bnb_runtime")
