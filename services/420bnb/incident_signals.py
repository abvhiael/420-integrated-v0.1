"""BNB-6.7 strictly bounded incident signals; never exposes raw provider data."""
from collections.abc import Mapping
from dataclasses import dataclass

ALLOWED_ALERTS=frozenset({
 "DISCOVERY_STALE","DELIVERY_BACKLOG","DELIVERY_DEAD_LETTERS",
 "DATABASE_UNAVAILABLE","DATABASE_SCHEMA_DRIFT","PROVIDER_NOT_APPROVED",
 "AUDIT_PIPELINE_UNAVAILABLE","RECOVERY_OPERATOR_REQUIRED"
})
LIMIT=1_000_000
class SignalRejected(ValueError): pass

def metric(value):
    if type(value) is not int or not 0<=value<=LIMIT:
        raise SignalRejected("METRIC_INVALID")
    return value

def summarize(*,schema_ready,db_available,discovery_ready,provider_approved,
              pending,dead_letters,audit_ready,stale_after_seconds,
              last_ack_age_seconds=None):
    # Health is fail-closed: a successful process ping says nothing about dependencies.
    for value in (schema_ready,db_available,discovery_ready,provider_approved,audit_ready):
        if type(value) is not bool: raise SignalRejected("HEALTH_VALUE_INVALID")
    pending=metric(pending);dead_letters=metric(dead_letters)
    stale_after_seconds=metric(stale_after_seconds)
    if not 30<=stale_after_seconds<=3600: raise SignalRejected("THRESHOLD_INVALID")
    if last_ack_age_seconds is not None: last_ack_age_seconds=metric(last_ack_age_seconds)
    alerts=set()
    if not db_available: alerts.add("DATABASE_UNAVAILABLE")
    if not schema_ready: alerts.add("DATABASE_SCHEMA_DRIFT")
    if not audit_ready: alerts.add("AUDIT_PIPELINE_UNAVAILABLE")
    if not provider_approved: alerts.add("PROVIDER_NOT_APPROVED")
    if not discovery_ready or last_ack_age_seconds is None or last_ack_age_seconds>stale_after_seconds:
        alerts.add("DISCOVERY_STALE")
    if pending>=100: alerts.add("DELIVERY_BACKLOG")
    if dead_letters: alerts.add("DELIVERY_DEAD_LETTERS")
    ready=not alerts
    return {"ready":ready,"severity":"ok" if ready else "incident",
            "observation_only":True,"production_execution":False,
            "alerts":sorted(alerts),
            "metrics":{"pending":pending,"dead_letters":dead_letters,
                       "last_ack_age_seconds":last_ack_age_seconds}}

def sanitized_event(*,category,request_id,code,elapsed_ms):
    if category not in ("api","database","delivery","provider","incident"):
        raise SignalRejected("CATEGORY_INVALID")
    if code not in ("ok","denied","unavailable","stale","timeout","recovery"):
        raise SignalRejected("CODE_INVALID")
    if type(request_id) is not str or len(request_id)!=32 or any(c not in "0123456789abcdef" for c in request_id):
        raise SignalRejected("TRACE_ID_INVALID")
    if type(elapsed_ms) is not int or not 0<=elapsed_ms<=60000:
        raise SignalRejected("LATENCY_INVALID")
    # Only fixed-enumeration labels, a non-user trace id and bounded timing.
    return {"event":"bnb_observation","category":category,"code":code,
            "request_id":request_id,"elapsed_ms":elapsed_ms}
