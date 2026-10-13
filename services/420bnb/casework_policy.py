"""BNB-4.8 conservative app-only retention policy; never grants legal approval."""
import os
from datetime import timedelta

def report_retention_days() -> int:
    value=os.environ.get("BNB_REPORT_RETENTION_DAYS","90")
    if not value.isdecimal() or len(value)>4:
        raise ValueError("RETENTION_POLICY_INVALID")
    days=int(value)
    # Operator configuration may lengthen preservation but must not shorten
    # the previously qualified 90-day baseline without independent legal gate.
    if not 90<=days<=3650:
        raise ValueError("RETENTION_POLICY_INVALID")
    return days

def report_retention_interval() -> timedelta:
    return timedelta(days=report_retention_days())
