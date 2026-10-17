"""BNB-6.10 deterministic bounded recovery rehearsal measurements, never executes a recovery."""
from dataclasses import dataclass

class RehearsalBlocked(ValueError):pass

@dataclass(frozen=True)
class Observation:
    scenario: str
    elapsed_ms: int
    lost_committed_events: int
    unresolved_deliveries: int
    healthy_instances: int
    required_instances: int
    restored_schema: int
    manually_authorized: bool

SCENARIOS=frozenset({"multi_instance_failure","backup_restore","interrupted_rollout",
                     "consumer_recovery","binary_rollback"})
def evaluate(item,*,rto_limit_ms=300000,rpo_limit_events=0):
    if not isinstance(item,Observation) or item.scenario not in SCENARIOS:
        raise RehearsalBlocked("SCENARIO_INVALID")
    for value in (item.elapsed_ms,item.lost_committed_events,item.unresolved_deliveries,
                  item.healthy_instances,item.required_instances,item.restored_schema,
                  rto_limit_ms,rpo_limit_events):
        if type(value) is not int or value<0 or value>10_000_000:
            raise RehearsalBlocked("MEASUREMENT_INVALID")
    if type(item.manually_authorized) is not bool:
        raise RehearsalBlocked("APPROVAL_INVALID")
    if item.required_instances<2 or not 1<=item.healthy_instances<=item.required_instances:
        raise RehearsalBlocked("INSTANCE_INVENTORY_INVALID")
    failures=[]
    if item.elapsed_ms>rto_limit_ms: failures.append("RTO_EXCEEDED")
    if item.lost_committed_events>rpo_limit_events: failures.append("RPO_EXCEEDED")
    if item.unresolved_deliveries: failures.append("DELIVERY_RECONCILIATION_REQUIRED")
    if item.restored_schema!=30: failures.append("SCHEMA_RESTORE_UNVERIFIED")
    if item.healthy_instances<item.required_instances: failures.append("INSTANCE_DEGRADED")
    if not item.manually_authorized: failures.append("OPERATOR_APPROVAL_REQUIRED")
    # A rehearsal is not a signed production exercise. Never grant live recovery.
    return {"scenario":item.scenario,"rehearsal_pass":not failures,"live_accepted":False,
            "production_recovery_authorized":False,"failures":failures,
            "rto_ms":item.elapsed_ms,"rpo_events":item.lost_committed_events}
