"""BNB-6.4 deterministic DB lifecycle gates; no destructive operation authority."""
import hashlib
import re
from pathlib import Path

from migrate import MIGRATIONS, LOCK_KEY

class LifecycleBlocked(RuntimeError):
    pass

SCHEMA_VERSION=30

def inventory(directory=MIGRATIONS):
    files=sorted(Path(directory).glob("[0-9][0-9][0-9]_*.sql"))
    if len(files)!=SCHEMA_VERSION or [int(p.name[:3]) for p in files]!=list(range(1,SCHEMA_VERSION+1)):
        raise LifecycleBlocked("MIGRATION_INVENTORY_INVALID")
    return [(i,p.name,hashlib.sha256(p.read_bytes()).hexdigest()) for i,p in enumerate(files,1)]

def validate_ledger(connection,directory=MIGRATIONS):
    expected=inventory(directory)
    actual=connection.execute("SELECT version,filename,sha256 FROM bnb_schema_migration ORDER BY version").fetchall()
    if [(int(v),n,d.strip()) for v,n,d in actual]!=expected:
        raise LifecycleBlocked("MIGRATION_LEDGER_MISMATCH")
    return expected

def deployment_gate(connection, *, serving_version, target_version=SCHEMA_VERSION,
                    minimum_compatible_version=SCHEMA_VERSION, operator_approved=False,
                    live_booking=False, financial_execution=False, directory=MIGRATIONS):
    """Require exact migration ledger and explicit old/new binary compatibility.

    No guessed backwards compatibility: older binaries require separately proven
    compatibility before a rolling upgrade is permitted.
    """
    if type(serving_version) is not int or type(target_version) is not int or type(minimum_compatible_version) is not int:
        raise LifecycleBlocked("COMPATIBILITY_VERSION_INVALID")
    if not (1<=minimum_compatible_version<=serving_version<=target_version==SCHEMA_VERSION):
        raise LifecycleBlocked("ROLLING_COMPATIBILITY_NOT_PROVEN")
    if not operator_approved:
        raise LifecycleBlocked("OPERATOR_APPROVAL_REQUIRED")
    if live_booking or financial_execution:
        raise LifecycleBlocked("ACTIVE_FINANCIAL_DEPLOYMENT_FORBIDDEN")
    validate_ledger(connection,directory)
    return {"schema_version":target_version,"compatible_binary_floor":minimum_compatible_version,
            "automatic_rollback":False,"can_promote":True}

def retention_gate(*, operator_approved=False, immutable_backup_verified=False,
                   restored_ledger_verified=False, live_booking=False,
                   financial_execution=False, pending_deliveries=0):
    """Advisory approval gate; never deletes or truncates data."""
    if not operator_approved:
        raise LifecycleBlocked("OPERATOR_APPROVAL_REQUIRED")
    if live_booking or financial_execution:
        raise LifecycleBlocked("RETENTION_DURING_LIVE_EXECUTION_FORBIDDEN")
    if immutable_backup_verified is not True or restored_ledger_verified is not True:
        raise LifecycleBlocked("RESTORE_PROOF_REQUIRED")
    if type(pending_deliveries) is not int or pending_deliveries!=0:
        raise LifecycleBlocked("PENDING_DELIVERIES_FORBID_RETENTION")
    return {"retention_execution_enabled":False,"manual_approval_required":True}

def interrupted_upgrade_gate(connection, *, operator_approved=False, directory=MIGRATIONS):
    """For an interrupted upgrade, only fully committed known states are accepted.

    PostgreSQL transaction rollback and migration's xact advisory lock provide
    atomicity. A partial ledger is not automatically repaired or backfilled.
    """
    if not operator_approved:
        raise LifecycleBlocked("OPERATOR_APPROVAL_REQUIRED")
    expected=inventory(directory)
    actual=connection.execute("SELECT version,filename,sha256 FROM bnb_schema_migration ORDER BY version").fetchall()
    actual=[(int(v),n,d.strip()) for v,n,d in actual]
    if actual!=expected[:len(actual)]:
        raise LifecycleBlocked("INTERRUPTED_LEDGER_REQUIRES_OPERATOR_RECONCILIATION")
    if len(actual)!=SCHEMA_VERSION:
        raise LifecycleBlocked("INCOMPLETE_UPGRADE_REQUIRES_MIGRATOR")
    return {"schema_version":SCHEMA_VERSION,"recovery":"resume_checked_forward_only",
            "rollback_allowed":False}
