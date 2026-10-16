"""BNB-5.10 explicit, supervised Pay observation worker entrypoint.

No implicit production activation. External Pay/Wallet issuer and provider
credentials must be separately approved; this CLI is for isolated qualification.
"""
import os
import signal
import ssl
import sys
import threading
from pathlib import Path
import psycopg
import pay_observation_worker as reconciliation
from pay_observation_https import SignedObservationHTTPS

def main():
    if os.getenv("BNB_PAY_OBSERVATION_MODE")!="isolated-ci":
        raise reconciliation.ReconciliationBlocked("EXTERNAL_PAY_PROVIDER_NOT_APPROVED")
    dsn=os.getenv("BNB_DATABASE_URL")
    ca=os.getenv("BNB_PAY_OBSERVATION_CA_FILE")
    origin=os.getenv("BNB_PAY_OBSERVATION_SOURCE")
    target=os.getenv("BNB_PAY_OBSERVATION_BNB")
    token_file=os.getenv("BNB_PAY_OBSERVATION_TOKEN_FILE")
    if not all((dsn,ca,origin,target,token_file)):
        raise reconciliation.ReconciliationBlocked("PROVIDER_CONFIGURATION_MISSING")
    token_path=Path(token_file)
    if not token_path.is_absolute() or token_path.is_symlink():
        raise reconciliation.ReconciliationBlocked("PROVIDER_TOKEN_MOUNT_INVALID")
    import stat
    info=token_path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_size>8192:
        raise reconciliation.ReconciliationBlocked("PROVIDER_TOKEN_MOUNT_INVALID")
    provider=SignedObservationHTTPS(origin,target,ca_file=ca,
                                    source_token=token_path.read_text().strip())
    def connect():
        return psycopg.connect(dsn,connect_timeout=5,
           options="-c statement_timeout=15000 -c lock_timeout=5000",
           sslmode="verify-full")
    stop=threading.Event()
    signal.signal(signal.SIGTERM,lambda *_:stop.set())
    signal.signal(signal.SIGINT,lambda *_:stop.set())
    reconciliation.supervised(connect,"420pay-wallet-canonical",
        provider.fetch,provider.deliver,stop=stop)
    return 0

if __name__=="__main__":
    try:sys.exit(main())
    except (reconciliation.ReconciliationBlocked,OSError,psycopg.Error):
        print("PAY_OBSERVATION_WORKER_NOT_AUTHORIZED_OR_UNAVAILABLE",file=sys.stderr)
        sys.exit(1)
