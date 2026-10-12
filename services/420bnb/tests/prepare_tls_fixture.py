"""CI-only PostgreSQL TLS fixture. Never deploy these generated keys/certificates."""
import ipaddress
import os
import subprocess
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

container = os.environ["BNB32_POSTGRES_CONTAINER"]
assert container and all(c in "0123456789abcdef" for c in container), "CI_CONTAINER_INVALID"
directory = Path(tempfile.mkdtemp(prefix="bnb32-ci-tls-"))
now = datetime.now(timezone.utc)
ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "BNB32 isolated CI CA")])
ca = (x509.CertificateBuilder().subject_name(ca_name).issuer_name(ca_name)
      .public_key(ca_key.public_key()).serial_number(x509.random_serial_number())
      .not_valid_before(now - timedelta(minutes=1)).not_valid_after(now + timedelta(days=2))
      .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
      .sign(ca_key, hashes.SHA256()))
server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
server = (x509.CertificateBuilder()
          .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")]))
          .issuer_name(ca_name).public_key(server_key.public_key())
          .serial_number(x509.random_serial_number()).not_valid_before(now - timedelta(minutes=1))
          .not_valid_after(now + timedelta(days=2))
          .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
          .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost"),
              x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]), critical=False)
          .sign(ca_key, hashes.SHA256()))
(directory / "ca.pem").write_bytes(ca.public_bytes(serialization.Encoding.PEM))
(directory / "server.crt").write_bytes(server.public_bytes(serialization.Encoding.PEM))
(directory / "server.key").write_bytes(server_key.private_bytes(serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
(directory / "server.key").chmod(0o600)
for name in ("server.crt", "server.key"):
    subprocess.run(["docker", "cp", str(directory / name), f"{container}:/var/lib/postgresql/{name}"], check=True)
subprocess.run(["docker", "exec", container, "chown", "postgres:postgres",
                "/var/lib/postgresql/server.crt", "/var/lib/postgresql/server.key"], check=True)
subprocess.run(["docker", "exec", container, "chmod", "600", "/var/lib/postgresql/server.key"], check=True)
values = conninfo_to_dict(os.environ["BNB_DATABASE_URL"])
with psycopg.connect(**values, autocommit=True) as connection:
    connection.execute("ALTER SYSTEM SET ssl = 'on'")
    connection.execute("ALTER SYSTEM SET ssl_cert_file = '/var/lib/postgresql/server.crt'")
    connection.execute("ALTER SYSTEM SET ssl_key_file = '/var/lib/postgresql/server.key'")
    connection.execute("SELECT pg_reload_conf()")
values.update(host="localhost", sslmode="verify-full", sslrootcert=str(directory / "ca.pem"), channel_binding="require")
for attempt in range(30):
    try:
        with psycopg.connect(**values) as connection:
            assert connection.execute("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()").fetchone() == (True,)
        break
    except psycopg.OperationalError:
        if attempt == 29:
            raise
        time.sleep(0.2)
with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as output:
    output.write("BNB32_TLS_ADMIN_DSN=" + make_conninfo(**values) + "\n")
    output.write("BNB32_TLS_FIXTURE_DIR=" + str(directory) + "\n")
print("BNB32_CI_VERIFIED_TLS=PASS; CI fixtures only, no live authority acceptance")
