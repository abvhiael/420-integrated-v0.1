"""BNB-5.10 supervised canonical Pay/Wallet observation reconciliation.

A trusted adapter supplies SIGNED original 420Pay observations; BnB never
generates payment claims, signs, broadcasts, holds assets or infers finality.
Cursor state commits only after the existing canonical ingress accepted an
observation. Bounded polling with crash/retry preserves at-least-once delivery.
"""
import hashlib
import json
import time
from uuid import UUID
from fastapi import HTTPException
import psycopg

KINDS={"intent":"/v1/bnb/internal/pay/intents",
       "finality":"/v1/bnb/internal/pay/finality",
       "failure":"/v1/bnb/internal/pay/failures",
       "case-event":"/v1/bnb/internal/pay/cases",
       "settlement-split":"/v1/bnb/internal/pay/settlement-splits",
       "disbursement":"/v1/bnb/internal/pay/disbursements"}
NAMESPACE="bnb-pay-observation-v1"
MAX_PAGE=32

class ReconciliationBlocked(RuntimeError):pass

def _observation(item,expected):
    if not isinstance(item,dict) or set(item)!={"sequence","kind","payload","proof","provider_id"}:
        raise ReconciliationBlocked("OBSERVATION_INVALID")
    seq=item["sequence"]
    if type(seq) is not int or seq!=expected or seq<1:
        raise ReconciliationBlocked("OBSERVATION_SEQUENCE_GAP")
    if item["kind"] not in KINDS or not isinstance(item["payload"],dict):
        raise ReconciliationBlocked("OBSERVATION_DOMAIN_INVALID")
    if not isinstance(item["proof"],str) or not 20<=len(item["proof"])<=8192:
        raise ReconciliationBlocked("CANONICAL_PROOF_REQUIRED")
    if not isinstance(item["provider_id"],str) or not 1<=len(item["provider_id"])<=128:
        raise ReconciliationBlocked("PROVIDER_ID_INVALID")
    try:
        encoded=json.dumps(item["payload"],sort_keys=True,allow_nan=False,separators=(",",":"))
    except (TypeError,ValueError):
        raise ReconciliationBlocked("OBSERVATION_PAYLOAD_INVALID") from None
    if len(encoded)>8192:raise ReconciliationBlocked("OBSERVATION_PAYLOAD_OVERSIZE")
    return hashlib.sha256((item["kind"]+"|"+encoded+"|"+item["proof"]).encode()).hexdigest()

def checkpoint(conn,stream):
    if not isinstance(stream,str) or not 1<=len(stream)<=64 or not all(
        ch.isascii() and (ch.isalnum() or ch in "-_.") for ch in stream):
        raise ReconciliationBlocked("STREAM_INVALID")
    # Existing canonical dedupe table gives a durable, scoped cursor without
    # schema/privilege widening. Both identity and operation are fixed.
    row=conn.execute("""SELECT key,result FROM bnb_request_dedupe
      WHERE actor=%s AND operation=%s""",(NAMESPACE,stream)).fetchone()
    if row is None:return 0
    if row[1].get("sequence")!=int(row[0]):raise ReconciliationBlocked("CURSOR_TAMPERED")
    return int(row[0])

def advance(conn,stream,sequence,digest):
    if type(sequence) is not int or sequence<1:raise ReconciliationBlocked("CURSOR_INVALID")
    prior=conn.execute("""SELECT key,result FROM bnb_request_dedupe
        WHERE actor=%s AND operation=%s FOR UPDATE""",(NAMESPACE,stream)).fetchone()
    previous=int(prior[0]) if prior else 0
    if sequence!=previous+1:raise ReconciliationBlocked("CURSOR_ADVANCE_CONFLICT")
    if prior:
        conn.execute("""DELETE FROM bnb_request_dedupe WHERE actor=%s AND operation=%s""",
                     (NAMESPACE,stream))
    conn.execute("""INSERT INTO bnb_request_dedupe(actor,operation,key,digest,result)
        VALUES(%s,%s,%s,%s,%s::jsonb)""",
        (NAMESPACE,stream,str(sequence),digest,json.dumps({"sequence":sequence,"digest":digest})))

def once(connect,stream,fetch_signed,deliver,*,limit=16):
    if type(limit) is not int or not 1<=limit<=MAX_PAGE:
        raise ReconciliationBlocked("PAGE_BOUNDS")
    if not callable(fetch_signed) or not callable(deliver):
        raise ReconciliationBlocked("ADAPTER_UNAVAILABLE")
    with connect() as c:
        # Advisory lock serializes concurrent pollers without relying on
        # external identity or optimistic cursor reuse.
        c.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 420510))",
                  (NAMESPACE+"|"+stream,))
        cursor=checkpoint(c,stream)
        batch=fetch_signed(cursor,limit)
        if not isinstance(batch,list) or len(batch)>limit:
            raise ReconciliationBlocked("OBSERVATION_PAGE_INVALID")
        for item in batch:
            digest=_observation(item,cursor+1)
            # deliver MUST call existing signed Pay ingress unchanged and
            # reject all non-2xx responses; no locally fabricated success.
            outcome=deliver(KINDS[item["kind"]],item["payload"],item["proof"])
            if not isinstance(outcome,dict) or outcome.get("accepted") is not True:
                raise ReconciliationBlocked("PROVIDER_ACCEPTANCE_REQUIRED")
            advance(c,stream,item["sequence"],digest)
            cursor+=1
    return {"cursor":cursor,"consumed":len(batch),"settlement_authority":False}

def supervised(connect,stream,fetch_signed,deliver,*,stop,poll_seconds=2):
    if type(poll_seconds) not in (int,float) or not .1<=poll_seconds<=60:
        raise ReconciliationBlocked("POLL_BOUNDS")
    if not hasattr(stop,"wait"):raise ReconciliationBlocked("STOP_REQUIRED")
    while not stop.is_set():
        try:once(connect,stream,fetch_signed,deliver)
        except (ReconciliationBlocked,psycopg.Error,TimeoutError,ConnectionError):
            # No blind replay of locally synthesized success; retain cursor.
            pass
        stop.wait(poll_seconds)
