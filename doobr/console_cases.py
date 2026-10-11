"""R03.7 durable private case proposal, dual review, and idempotent execution.

Execution invokes only a separately authorized, non-transactional-free
internal effect adapter AFTER durable decision lock. Live adapters must fail closed.
"""
from datetime import datetime, timezone, timedelta
from hashlib import sha256
from uuid import UUID
from .auth import Denied, Permission, authorize

PURPOSES={
    "SAFETY_HOLD":("SAFETY","REVIEW_SAFETY"),
    "COMPLIANCE_REVIEW":("COMPLIANCE","REVIEW_COMPLIANCE"),
    "INCIDENT_ESCALATION":("SAFETY","REVIEW_SAFETY"),
}
def uid(v):
    try:return str(UUID(v))
    except (TypeError,ValueError,AttributeError) as exc:raise Denied("invalid console identifier") from exc

def _session(issuer,store,token,tenant,case,role,action,at):
    return authorize(issuer=issuer,store=store,signed_token=token,tenant_id=tenant,
        permission=Permission(role,action,"incident:"+case),now=at)

def propose_case(*,connect,issuer,store,token,tenant_id,case_id,event_id,purpose,
                 proposal_ref,evidence_ref,at=None,ttl_seconds=900):
    at=at or datetime.now(timezone.utc)
    if (at.tzinfo is None or purpose not in PURPOSES or type(ttl_seconds) is not int
        or not 60<=ttl_seconds<=3600 or not isinstance(proposal_ref,str)
        or not 1<=len(proposal_ref)<=128 or not isinstance(evidence_ref,str)
        or not 1<=len(evidence_ref)<=256):
        raise Denied("invalid console proposal")
    tenant_id,case_id,event_id=map(uid,(tenant_id,case_id,event_id))
    s=_session(issuer,store,token,tenant_id,case_id,"OPERATOR","PROPOSE_CASE",at)
    actor=uid(s.actor_id)
    digest=sha256((s.issuer+"|"+s.token_id).encode()).digest()
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("""INSERT INTO doobr_private.console_cases
                        (tenant_id,case_id,purpose,requester_id,requester_subject,proposer_token_digest,
                         proposal_ref,evidence_ref,created_at,expires_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (tenant_id,case_id,purpose,actor,s.subject,digest,proposal_ref,evidence_ref,
                         at,at+timedelta(seconds=ttl_seconds)))
                    c.execute("""INSERT INTO doobr_private.console_case_events
                        (tenant_id,event_id,case_id,operation,actor_id,case_revision,evidence_digest,recorded_at)
                        VALUES (%s,%s,%s,'PROPOSE',%s,1,%s,%s)""",
                        (tenant_id,event_id,case_id,actor,sha256(evidence_ref.encode()).digest(),at))
        return "PENDING"
    except Denied:raise
    except Exception as exc:raise Denied("durable proposal unavailable") from exc

def approve_case(*,connect,issuer,store,token,tenant_id,case_id,event_id,
                 expected_revision,authority,at=None):
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None or type(expected_revision) is not int or expected_revision!=1:
        raise Denied("invalid case revision")
    tenant_id,case_id,event_id=map(uid,(tenant_id,case_id,event_id))
    # Approver is independently authenticated for the SPECIFIC purpose inside transaction.
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("""SELECT purpose,requester_id,requester_subject,proposer_token_digest,
                          evidence_ref,state,revision,expires_at
                          FROM doobr_private.console_cases WHERE tenant_id=%s AND case_id=%s FOR UPDATE""",
                          (tenant_id,case_id))
                    case=c.fetchone()
                    if not case or case[5]!="PENDING" or case[6]!=expected_revision or case[7]<=at:
                        raise Denied("case expired, absent, replayed or already reviewed")
                    purpose,requester,subject,token_digest,evidence=case[:5]
                    role,action=PURPOSES[purpose]
                    s=_session(issuer,store,token,tenant_id,case_id,role,action,at)
                    actor=uid(s.actor_id)
                    if (actor==str(requester) or s.subject==subject
                        or sha256((s.issuer+"|"+s.token_id).encode()).digest()==bytes(token_digest)):
                        raise Denied("independent approver required")
                    if authority.verify_review(tenant_id=tenant_id,case_id=case_id,purpose=purpose,
                        requester_id=str(requester),approver_id=actor,evidence_ref=evidence,at=at) is not True:
                        raise Denied("independent authority denied")
                    c.execute("""UPDATE doobr_private.console_cases SET state='APPROVED',revision=2,
                      approver_id=%s,approver_subject=%s,reviewed_at=%s
                      WHERE tenant_id=%s AND case_id=%s AND state='PENDING' AND revision=1
                      RETURNING revision""",(actor,s.subject,at,tenant_id,case_id))
                    if c.fetchone()!=(2,):raise Denied("concurrent case decision")
                    c.execute("""INSERT INTO doobr_private.console_case_events
                      (tenant_id,event_id,case_id,operation,actor_id,case_revision,evidence_digest,recorded_at)
                      VALUES (%s,%s,%s,'APPROVE',%s,2,%s,%s)""",
                      (tenant_id,event_id,case_id,actor,sha256(evidence.encode()).digest(),at))
        return "APPROVED"
    except Denied:raise
    except Exception as exc:raise Denied("durable approval or authority unavailable") from exc

def execute_case(*,connect,issuer,store,token,tenant_id,case_id,event_id,
                 authority,at=None):
    """Transactional EXECUTED record; external authority must attest a completed safe effect.

    No arbitrary callback supplied by a public caller, payment or policy override.
    """
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None:raise Denied("invalid execution time")
    tenant_id,case_id,event_id=map(uid,(tenant_id,case_id,event_id))
    s=_session(issuer,store,token,tenant_id,case_id,"OPERATOR","ESCALATE_INCIDENT",at)
    actor=uid(s.actor_id)
    try:
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                    c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
                    c.execute("""SELECT purpose,evidence_ref,state,revision,expires_at
                      FROM doobr_private.console_cases WHERE tenant_id=%s AND case_id=%s FOR UPDATE""",
                      (tenant_id,case_id))
                    case=c.fetchone()
                    if not case or case[2]!="APPROVED" or case[3]!=2 or case[4]<=at:
                        raise Denied("case not executable")
                    purpose,evidence=case[0],case[1]
                    # This may only affirm durable, independently executed work (not perform
                    # external side effects inside a transaction liable to rollback).
                    if authority.verify_executed(tenant_id=tenant_id,case_id=case_id,purpose=purpose,
                        evidence_ref=evidence,at=at) is not True:raise Denied("canonical execution absent")
                    c.execute("""UPDATE doobr_private.console_cases SET state='EXECUTED',revision=3,
                      executed_at=%s WHERE tenant_id=%s AND case_id=%s AND state='APPROVED'
                      AND revision=2 RETURNING revision""",(at,tenant_id,case_id))
                    if c.fetchone()!=(3,):raise Denied("concurrent execution")
                    c.execute("""INSERT INTO doobr_private.console_case_events
                      (tenant_id,event_id,case_id,operation,actor_id,case_revision,evidence_digest,recorded_at)
                      VALUES (%s,%s,%s,'EXECUTE',%s,3,%s,%s)""",
                      (tenant_id,event_id,case_id,actor,sha256(evidence.encode()).digest(),at))
        return "EXECUTED"
    except Denied:raise
    except Exception as exc:raise Denied("execution evidence or ledger unavailable") from exc
