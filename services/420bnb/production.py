"""BNB-3.2 production launch contract. No issuer or operational approval is minted."""
import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path
from urllib.parse import urlsplit

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

PREFIXES = (
    "BNB_IDENTITY", "BNB_RECOVERY", "BNB_PROPERTY", "BNB_MEDIA_REVIEW",
    "BNB_CALENDAR_SYNC", "BNB_PAY", "BNB_LOCATION_AUTHORITY",
    "BNB_JURISDICTION_AUTHORITY", "BNB_COMPLIANCE_AUTHORITY",
    "BNB_GUEST_ELIGIBILITY", "BNB_GUEST_REVIEW", "BNB_REPUTATION",
)
IMAGE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9./_-]*@sha256:[0-9a-f]{64}\Z")
SHA = re.compile(r"[0-9a-f]{40}\Z")


class ConfigurationError(RuntimeError):
    """Only bounded error codes may reach logs; never include secret input."""


def require(condition, code):
    if not condition:
        raise ConfigurationError(code)


def read_mount(name, root, *, secret=False):
    require(isinstance(name, str) and name, "MOUNT_PATH_REQUIRED")
    path = Path(name)
    require(path.is_absolute(), "MOUNT_PATH_REQUIRED")
    try:
        relative = path.relative_to(root)
        require(relative.parts and ".." not in relative.parts, "MOUNT_PATH_ESCAPE")
        current = root
        for part in relative.parts:
            current = current / part
            require(not current.is_symlink(), "MOUNT_SYMLINK_FORBIDDEN")
        info = path.stat()
        require(stat.S_ISREG(info.st_mode), "MOUNT_REGULAR_FILE_REQUIRED")
        require(0 < info.st_size <= 65536, "MOUNT_SIZE_INVALID")
        require(not info.st_mode & 0o022, "MOUNT_WRITABLE_BY_OTHER")
        if secret:
            require(not info.st_mode & 0o077, "SECRET_PERMISSIONS_INVALID")
        return path.read_bytes()
    except (OSError, ValueError, UnicodeError):
        raise ConfigurationError("MOUNT_UNAVAILABLE") from None


def https_origin(value):
    require(isinstance(value, str) and len(value) <= 1024, "ORIGIN_INVALID")
    parsed = urlsplit(value)
    require(parsed.scheme == "https" and parsed.hostname and not parsed.username
            and not parsed.password and not parsed.query and not parsed.fragment
            and parsed.path in ("", "/"), "HTTPS_ORIGIN_REQUIRED")
    try:
        require(parsed.port in (None, 443), "HTTPS_PORT_INVALID")
    except ValueError:
        raise ConfigurationError("HTTPS_PORT_INVALID") from None


def load_contract(environment=None, *, root=Path("/run/secrets"), purpose="runtime"):
    env = dict(os.environ if environment is None else environment)
    require(os.geteuid() != 0, "NONROOT_PRODUCTION_REQUIRED")
    require(purpose in ("runtime", "migration"), "PURPOSE_INVALID")
    require(env.get("BNB_ENV") == "production", "PRODUCTION_MODE_REQUIRED")
    require(not env.get("BNB_DATABASE_URL") and not env.get("BNB_IDENTITY_ASSERTION_SECRET"),
            "INLINE_SECRET_FORBIDDEN")
    require(all(not env.get(p + "_PUBLIC_KEY_PEM") for p in PREFIXES),
            "INLINE_ISSUER_KEY_FORBIDDEN")
    root = Path(root)
    require(root.is_absolute() and not root.is_symlink(), "MOUNT_ROOT_INVALID")
    forbidden = "migrator.dsn" if purpose == "runtime" else "runtime.dsn"
    require(not (root / forbidden).exists(), "DATABASE_CREDENTIAL_SEPARATION_REQUIRED")
    try:
        contract = json.loads(read_mount(env.get("BNB_DEPLOYMENT_FILE", ""), root))
    except (json.JSONDecodeError, UnicodeError):
        raise ConfigurationError("CONTRACT_INVALID") from None
    require(isinstance(contract, dict) and contract.get("schema") == "420.bnb.production.v1",
            "CONTRACT_SCHEMA_INVALID")
    require(isinstance(contract.get("release_sha"), str) and SHA.fullmatch(contract["release_sha"]),
            "RELEASE_SHA_INVALID")
    require(contract["release_sha"] == env.get("BNB_BUILD_SHA"), "IMAGE_RELEASE_MISMATCH")
    images = contract.get("images", {})
    require(isinstance(images, dict) and set(images) == {"api", "web", "ingress"}
            and all(isinstance(v, str) and IMAGE.fullmatch(v) for v in images.values()),
            "IMAGE_DIGEST_REQUIRED")
    require(images["api"] == env.get("BNB_RELEASE_IMAGE"), "API_IMAGE_MISMATCH")
    require(images["web"] == env.get("BNB_WEB_IMAGE")
            and images["ingress"] == env.get("BNB_INGRESS_IMAGE"), "TOPOLOGY_IMAGE_MISMATCH")
    require(contract.get("booking_enabled") is False and contract.get("financial_execution") is False,
            "ACTIVATION_FORBIDDEN")
    origins = contract.get("origins", {})
    require(isinstance(origins, dict) and set(origins) == {"api", "web", "travel"}, "ORIGINS_REQUIRED")
    for origin in origins.values():
        https_origin(origin)
    require(origins["api"] != origins["web"], "DISTINCT_ORIGINS_REQUIRED")
    issuers = contract.get("issuers", {})
    require(isinstance(issuers, dict) and set(issuers) == set(PREFIXES), "ISSUER_INVENTORY_INVALID")
    bindings = {}
    allowed_files = {Path(env["BNB_DEPLOYMENT_FILE"])}
    for prefix, item in issuers.items():
        require(isinstance(item, dict), "ISSUER_BINDING_INVALID")
        https_origin(item.get("issuer"))
        audience = item.get("audience")
        require(isinstance(audience, str) and 1 <= len(audience) <= 256
                and not any(c.isspace() for c in audience), "AUDIENCE_INVALID")
        # References bind operator-supplied configuration; references alone never verify approval.
        reference = item.get("approval_reference")
        require(isinstance(reference, str) and 1 <= len(reference) <= 512, "ISSUER_REFERENCE_REQUIRED")
        raw = read_mount(item.get("public_key_file", ""), root)
        allowed_files.add(Path(item["public_key_file"]))
        require(hashlib.sha256(raw).hexdigest() == item.get("public_key_sha256"), "ISSUER_KEY_DIGEST_MISMATCH")
        try:
            key = serialization.load_pem_public_key(raw)
        except (ValueError, TypeError):
            raise ConfigurationError("PUBLIC_KEY_INVALID") from None
        require(isinstance(key, rsa.RSAPublicKey) and key.key_size >= 2048, "RSA_KEY_REQUIRED")
        bindings[prefix + "_ISSUER"] = item["issuer"]
        bindings[prefix + "_AUDIENCE"] = audience
        bindings[prefix + "_PUBLIC_KEY_PEM"] = raw.decode("ascii")
    try:
        dsn = read_mount(env.get("BNB_DATABASE_URL_FILE", ""), root, secret=True).decode().strip()
        values = conninfo_to_dict(dsn)
    except (psycopg.Error, UnicodeError):
        raise ConfigurationError("DATABASE_DSN_INVALID") from None
    expected_user = "bnb_runtime" if purpose == "runtime" else "bnb_migrator"
    require(values.get("user") == expected_user and values.get("password"), "DATABASE_ROLE_INVALID")
    require(values.get("host") and values.get("dbname") and not values.get("hostaddr"), "DATABASE_HOST_REQUIRED")
    require(values.get("sslmode") == "verify-full", "DATABASE_TLS_REQUIRED")
    require(not any(k in values for k in ("options", "service", "passfile", "sslkey", "sslpassword")),
            "DATABASE_OVERRIDE_FORBIDDEN")
    read_mount(values.get("sslrootcert", ""), root)
    allowed_files.update((Path(env["BNB_DATABASE_URL_FILE"]), Path(values["sslrootcert"])))
    try:
        present = set(root.rglob("*"))
        require(len(present) <= 64 and not any(path.is_symlink() for path in present), "MOUNT_INVENTORY_INVALID")
        require({path for path in present if path.is_file()} == allowed_files, "UNREFERENCED_MOUNT_FILE")
    except OSError:
        raise ConfigurationError("MOUNT_UNAVAILABLE") from None
    values["connect_timeout"] = "5"
    values["application_name"] = "420bnb-" + purpose
    values["channel_binding"] = "require"
    values["options"] = "-c search_path=public"
    bindings["BNB_TRAVEL_PUBLIC_URL"] = origins["travel"]
    return contract, bindings, values


def verify_database(connection, purpose="runtime"):
    row = connection.execute("""SELECT current_user, rolsuper, rolcreatedb, rolcreaterole,
        rolreplication, rolbypassrls FROM pg_roles WHERE rolname=current_user""").fetchone()
    expected = "bnb_runtime" if purpose == "runtime" else "bnb_migrator"
    require(row and row[0] == expected and not any(row[1:]), "DATABASE_ROLE_ELEVATED")
    owner = connection.execute("""SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
        rolreplication, rolbypassrls FROM pg_roles WHERE rolname='bnb_owner'""").fetchone()
    require(owner and not any(owner), "DATABASE_OWNER_ROLE_INVALID")
    require(connection.execute("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()").fetchone() == (True,),
            "DATABASE_TLS_NOT_NEGOTIATED")
    if purpose == "runtime":
        require(connection.execute("""SELECT count(*) FROM pg_auth_members
            WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)""").fetchone()[0] == 0,
                "DATABASE_RUNTIME_MEMBERSHIP_FORBIDDEN")
        privileges = connection.execute("""SELECT has_schema_privilege(current_user,'public','CREATE'),
            has_database_privilege(current_user,current_database(),'CREATE'),
            has_database_privilege(current_user,current_database(),'TEMP'),
            pg_has_role(current_user,'bnb_owner','MEMBER')""").fetchone()
        require(not any(privileges), "DATABASE_RUNTIME_DDL_FORBIDDEN")
        require(connection.execute("SELECT to_regclass('public.bnb_schema_migration')").fetchone()[0],
                "DATABASE_SCHEMA_NOT_MIGRATED")
        ledger = connection.execute("""SELECT has_table_privilege(current_user,'public.bnb_schema_migration','SELECT'),
            has_table_privilege(current_user,'public.bnb_schema_migration','INSERT'),
            has_table_privilege(current_user,'public.bnb_schema_migration','UPDATE'),
            has_table_privilege(current_user,'public.bnb_schema_migration','DELETE'),
            has_table_privilege(current_user,'public.bnb_schema_migration','TRUNCATE'),
            has_table_privilege(current_user,'public.bnb_schema_migration','REFERENCES'),
            has_table_privilege(current_user,'public.bnb_schema_migration','TRIGGER')""").fetchone()
        require(ledger[0] and not any(ledger[1:]), "DATABASE_LEDGER_WRITE_FORBIDDEN")
        require(not connection.execute("""SELECT EXISTS(SELECT 1 FROM pg_tables
            WHERE schemaname='public' AND tablename ~ '^bnb_' AND
            (has_table_privilege(current_user,format('%I.%I',schemaname,tablename),'TRUNCATE')
             OR has_table_privilege(current_user,format('%I.%I',schemaname,tablename),'REFERENCES')
             OR has_table_privilege(current_user,format('%I.%I',schemaname,tablename),'TRIGGER')))""").fetchone()[0],
                "DATABASE_RUNTIME_EXTRA_PRIVILEGE_FORBIDDEN")
        require(not connection.execute("""SELECT EXISTS(SELECT 1 FROM pg_tables
            WHERE schemaname='public' AND tablename ~ '^bnb_'
            AND tableowner <> 'bnb_owner')""").fetchone()[0], "DATABASE_TABLE_OWNER_INVALID")
        require(connection.execute("SELECT count(*) FROM bnb_schema_migration").fetchone()[0] == 22,
                "DATABASE_SCHEMA_VERSION_INVALID")
    else:
        require(connection.execute("SELECT pg_has_role(current_user,'bnb_owner','MEMBER')").fetchone()[0],
                "DATABASE_MIGRATOR_OWNER_BINDING_REQUIRED")


def controlled_migration(connection):
    from migrate import apply
    verify_database(connection, "migration")
    with connection.transaction():
        connection.execute("SET LOCAL ROLE bnb_owner")
        version = apply(connection)
        tables = connection.execute("""SELECT tablename FROM pg_tables WHERE schemaname='public'
            AND tablename ~ '^bnb_'""").fetchall()
        for (name,) in tables:
            actions = sql.SQL("SELECT") if name == "bnb_schema_migration" else sql.SQL("SELECT, INSERT, UPDATE, DELETE")
            connection.execute(sql.SQL("REVOKE ALL ON TABLE public.{} FROM bnb_runtime").format(sql.Identifier(name)))
            connection.execute(sql.SQL("GRANT {} ON TABLE public.{} TO bnb_runtime").format(actions, sql.Identifier(name)))
        connection.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bnb_runtime")
    return version


def main():
    purpose = "migration" if sys.argv[1:] == ["migrate"] else "runtime"
    require(sys.argv[1:] in ([], ["serve"], ["validate"], ["migrate"]), "COMMAND_INVALID")
    contract, bindings, values = load_contract(purpose=purpose)
    with psycopg.connect(**values) as connection:
        if purpose == "migration":
            controlled_migration(connection)
        else:
            verify_database(connection)
    # Do not print DSNs, payloads, approval references, paths or issuer key material.
    print(json.dumps({"status": "CONFIGURATION_PASS", "release_sha": contract["release_sha"],
                      "purpose": purpose, "operator_approval_verified": False,
                      "live_accepted": False}), flush=True)
    if purpose == "runtime" and sys.argv[1:] != ["validate"]:
        # API import independently loads the mounted contract, even if launched directly.
        # Do not forward credentials or issuer keys through container environment metadata.
        os.execvp("uvicorn", ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080", "--no-proxy-headers"])


def cli():
    try:
        main()
        return 0
    except ConfigurationError as error:
        print(str(error), file=sys.stderr)
        return 1
    except Exception:
        print("PRODUCTION_START_FAILED", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(cli())
