"""BNB-5.9 operator-only controls; no production approval or automatic recovery.

A separately provisioned RSA issuer and CURRENT database identity session are
required. The authorization is bound to individual action and request nonce.
"""
import hashlib
import json
from uuid import UUID,uuid4
from fastapi import HTTPException
from authority import verify_authority
import outbox
import consumer_delivery
import recovery_operations

ACTIONS=frozenset({"health","dead_letters","reconciliation","replay"})
def operator(conn,token,action):
    if action not in ACTIONS:raise HTTPException(403,"OPERATION_FORBIDDEN")
    if not isinstance(token,str) or not token.startswith("Bearer "):
        raise HTTPException(401,"OPERATOR_TOKEN_REQUIRED")
    proof=verify_authority(token[7:],"BNB_OPERATIONS","bnb-operator")
    subject=proof.get("sub")
    if not isinstance(subject,str) or len(subject)>80 or proof.get("capability")!=action:
        raise HTTPException(403,"OPERATOR_SCOPE_INVALID")
    session=proof.get("issuer_session_id")
    if not isinstance(session,str) or not 1<=len(session)<=256:
        raise HTTPException(403,"OPERATOR_SESSION_REQUIRED")
    row=conn.execute("""SELECT 1 FROM bnb_identity_session s
        JOIN bnb_account a ON a.subject=s.subject
        WHERE s.subject=%s AND s.issuer_session_id=%s AND s.issuer=%s
          AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
          AND a.state='active'""",(subject,session,proof["iss"])).fetchone()
    if not row:raise HTTPException(403,"OPERATOR_SESSION_REVOKED")
    return subject,proof

def counts(conn):
    row=conn.execute("""SELECT
       count(*) FILTER(WHERE completed_at IS NULL AND dead_lettered_at IS NULL),
       count(*) FILTER(WHERE dead_lettered_at IS NOT NULL)
       FROM (
         SELECT delivered_at AS completed_at,dead_lettered_at FROM bnb_outbox
           WHERE NOT consumer_managed
         UNION ALL
         SELECT accepted_at,dead_lettered_at FROM bnb_consumer_delivery
       ) delivery""").fetchone()
    return {"pending":row[0],"dead_letters":row[1],"production_execution":False}

def dead_letters(conn,*,limit=25):
    if type(limit) is not int or not 1<=limit<=50:
        raise HTTPException(422,"OPERATION_BOUNDS")
    rows=conn.execute("""SELECT id,event_type,attempts,dead_lettered_at,consumer
      FROM (
       SELECT b.id,b.event_type,b.attempts,b.dead_lettered_at,
         NULL::text AS consumer FROM bnb_outbox b
         WHERE NOT b.consumer_managed AND b.dead_lettered_at IS NOT NULL
       UNION ALL
       SELECT b.id,b.event_type,d.attempts,d.dead_lettered_at,d.consumer
         FROM bnb_consumer_delivery d JOIN bnb_outbox b ON b.id=d.event_id
         WHERE d.dead_lettered_at IS NOT NULL
      ) work ORDER BY dead_lettered_at,id,consumer NULLS FIRST LIMIT %s""",(limit,)).fetchall()
    return {"events":[{"id":str(r[0]),"type":r[1],"attempts":r[2],
                       "dead_at":r[3].isoformat(),"consumer":r[4]} for r in rows]}

def assess(conn,actor,action):
    if action not in ("restart","restore","rollback","replay"):
        raise HTTPException(422,"OPERATION_INVALID")
    status=recovery_operations.assess(conn,action=action,approved=True)
    conn.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
      VALUES(gen_random_uuid(),%s,%s,NULL)""",(actor,"bnb.ops.assess."+action))
    return recovery_operations.alert_summary(status)

def manual_replay(conn,actor,proof,event_id,reason,*,consumer=None):
    if not isinstance(reason,str) or not 8<=len(reason)<=200:
        raise HTTPException(422,"REPLAY_REASON_INVALID")
    nonce=proof.get("jti")
    if not isinstance(nonce,str) or not 8<=len(nonce)<=128:
        raise HTTPException(403,"OPERATOR_NONCE_INVALID")
    try: target=UUID(str(event_id))
    except(ValueError,TypeError):raise HTTPException(422,"EVENT_INVALID") from None
    # The signed approval is bound to one event and optionally one consumer.
    if proof.get("event_id")!=str(target) or proof.get("consumer")!=consumer:
        raise HTTPException(403,"REPLAY_SCOPE_INVALID")
    if consumer is not None and consumer not in ("search","travel"):
        raise HTTPException(403,"REPLAY_CONSUMER_FORBIDDEN")
    # Atomic unique nonce claim; rolling back the transaction also rolls back the claim.
    digest=hashlib.sha256((str(target)+"|"+str(consumer)+"|"+reason).encode()).hexdigest()
    claim=conn.execute("""INSERT INTO bnb_request_dedupe(actor,operation,key,digest,result)
       VALUES(%s,'bnb-ops-replay',%s,%s,'{}'::jsonb)
       ON CONFLICT DO NOTHING RETURNING key""",(actor,nonce,digest)).fetchone()
    if claim is None:raise HTTPException(409,"OPERATOR_NONCE_REPLAY")
    try:
        if consumer is None:
            outbox.replay(conn,target,actor,reason,authorize=lambda a,r:a==actor and r==reason)
        else:
            consumer_delivery.replay(conn,target,consumer,actor=actor,reason=reason,
                authorize=lambda a,action,target:a==actor and action=="replay" and target==consumer)
    except outbox.DeliveryError as exc:
        raise HTTPException(409,"REPLAY_NOT_ELIGIBLE") from None
    return {"replayed":True,"event_id":str(target),"consumer":consumer,"execution":"queued-only"}


def audit_read(conn,actor,action):
    if action not in ("health","dead_letters"):
        raise HTTPException(403,"OPERATION_FORBIDDEN")
    conn.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
        VALUES(gen_random_uuid(),%s,%s,NULL)""",
        (actor,"bnb.ops.read."+action))
