"""BNB-4.10 bounded recovery assessment; never executes destructive recovery.

Operational callers must separately prove authority to run database recovery,
restore, migrations or replay. Only aggregate counts and bounded status leave
this module: no event bodies, addresses, financial metadata or raw exceptions.
"""
from dataclasses import dataclass

class RecoveryBlocked(RuntimeError):
    pass

@dataclass(frozen=True)
class RecoveryAssessment:
    action: str
    ready: bool
    reason: str
    pending: int
    expired_leases: int
    dead_letters: int

def assess(conn, *, action, expected_schema=30, live_booking=False,
           financial_execution=False, approved=False):
    if action not in ("restart","restore","rollback","replay"):
        raise RecoveryBlocked("RECOVERY_ACTION_INVALID")
    if type(expected_schema) is not int or expected_schema!=30:
        raise RecoveryBlocked("RECOVERY_SCHEMA_UNKNOWN")
    if not approved:
        raise RecoveryBlocked("INDEPENDENT_OPERATOR_AUTHORITY_REQUIRED")
    if live_booking or financial_execution:
        raise RecoveryBlocked("LIVE_RECOVERY_APPROVAL_REQUIRED")
    rows=conn.execute("""SELECT version FROM bnb_schema_migration
        ORDER BY version""").fetchall()
    if [r[0] for r in rows]!=list(range(1,31)):
        raise RecoveryBlocked("RECOVERY_SCHEMA_DRIFT")
    pending, expired, dead=conn.execute("""SELECT
        count(*) FILTER (WHERE delivered_at IS NULL AND dead_lettered_at IS NULL),
        count(*) FILTER (WHERE delivered_at IS NULL AND dead_lettered_at IS NULL
             AND lease_owner IS NOT NULL AND lease_expires_at<=now()),
        count(*) FILTER (WHERE dead_lettered_at IS NOT NULL)
        FROM (
          SELECT delivered_at,dead_lettered_at,lease_owner,lease_expires_at
            FROM bnb_outbox WHERE NOT consumer_managed
          UNION ALL
          SELECT accepted_at,dead_lettered_at,lease_owner,lease_expires_at
            FROM bnb_consumer_delivery
        ) delivery_work""").fetchone()
    # Rollback is never an automatic database migration rollback; immutable
    # schema and live event history must be preserved for operator review.
    if action=="rollback":
        return RecoveryAssessment(action,False,"DATABASE_ROLLBACK_FORBIDDEN",
                                  pending,expired,dead)
    if action=="restore" and (pending or expired or dead):
        return RecoveryAssessment(action,False,"OUTBOX_RECONCILIATION_REQUIRED",
                                  pending,expired,dead)
    if action=="replay" and dead==0:
        return RecoveryAssessment(action,False,"NO_DEAD_LETTER_REPLAY",
                                  pending,expired,dead)
    return RecoveryAssessment(action,True,"MANUAL_EXECUTION_REQUIRED",
                              pending,expired,dead)

def alert_summary(assessment):
    """Safe, fixed-label structured signal suitable for private operations."""
    return {"action":assessment.action,"ready":assessment.ready,
            "reason":assessment.reason,"pending_events":assessment.pending,
            "expired_leases":assessment.expired_leases,
            "dead_letters":assessment.dead_letters}
