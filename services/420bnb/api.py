"""420BnB bounded runtime slice. NEVER accepts client financial finality."""
import hashlib
import hmac
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import psycopg
sys.path.insert(0,str(Path(__file__).resolve().parent))
from identity import verify_external_token
from authority import verify_authority
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="420BnB", version="0.1.0")
DATABASE_URL = os.getenv("BNB_DATABASE_URL", "")


def db():
    if not DATABASE_URL:
        raise HTTPException(503, "DATABASE_UNAVAILABLE")
    return psycopg.connect(DATABASE_URL)


def active_subject(authorization):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "UNAUTHORIZED")
    proof=verify_external_token(authorization[7:])
    with db() as c:
        row=c.execute("""SELECT a.state,a.recovery_epoch,s.recovery_epoch FROM bnb_account a
            JOIN bnb_identity_session s ON a.subject=s.subject
            WHERE s.subject=%s AND s.issuer=%s AND s.issuer_session_id=%s
            AND s.revoked_at IS NULL AND s.expires_at>now()""",
            (proof["subject"],proof["issuer"],proof["issuer_session_id"])).fetchone()
    if not row or row[0]!="active" or row[1]!=row[2]:
        raise HTTPException(401,"SESSION_NOT_ACTIVE")
    return proof["subject"]


def principal(subject: str | None, role: str | None, signed_at: str | None, signature: str | None):
    # This is a service-to-service adapter, not a raw user session verifier.
    # Deploy only behind an ingress that verifies the real Identity issuer and
    # signs these scoped assertions; strip incoming x-authenticated-* headers.
    raise HTTPException(503, "IDENTITY_SESSION_REQUIRED")
    secret = os.getenv("BNB_IDENTITY_ASSERTION_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(503, "IDENTITY_NOT_CONFIGURED")
    if not subject or not role or role not in ("host", "guest"):
        raise HTTPException(401, "UNAUTHORIZED")
    try:
        timestamp = int(signed_at or "")
        if abs(datetime.now(timezone.utc).timestamp() - timestamp) > 30:
            raise ValueError("stale")
    except ValueError:
        raise HTTPException(401, "UNAUTHORIZED")
    expected = hmac.new(secret.encode(), f"bnb-v1\\n{subject}\\n{role}\\n{timestamp}".encode(), hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(expected, signature):
        raise HTTPException(401, "UNAUTHORIZED")
    return subject, role


class PropertyInput(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    public_region: str = Field(min_length=2, max_length=100)
    capacity: int = Field(ge=1, le=1000)
    nightly_minor: int = Field(ge=0, le=10**12)
    currency: str = Field(pattern="^[A-Z]{3}$")


class HoldInput(BaseModel):
    property_id: str
    start: datetime
    end: datetime
    units: int = Field(default=1, ge=1, le=100)
    policy_snapshot: str = Field(min_length=1, max_length=4000)


def validate_window(start, end):
    if start.tzinfo is None or end.tzinfo is None:
        raise HTTPException(422, "TIMEZONE_REQUIRED")
    if not (datetime.now(timezone.utc) < start < end <= start + timedelta(days=90)):
        raise HTTPException(422, "INVALID_WINDOW")


@app.get("/health/live")
def live():
    return {"status": "live"}


@app.get("/health/ready")
def ready():
    with db() as c:
        c.execute("SELECT 1").fetchone()
    return {"status": "ready", "transactions_enabled": False}


@app.get("/v1/bnb/listings")
def listings():
    with db() as c:
        rows = c.execute("""SELECT id,title,public_region,capacity,nightly_minor,currency,version
            FROM bnb_property WHERE status='published' ORDER BY id LIMIT 50""").fetchall()
    return [{"id":str(x[0]),"title":x[1],"public_region":x[2],"capacity":x[3],
             "nightly_minor":x[4],"currency":x[5],"version":x[6]} for x in rows]


@app.post("/v1/bnb/properties", status_code=201)
def create_property(payload: PropertyInput, x_authenticated_subject: str | None = Header(None),
                    x_authenticated_role: str | None = Header(None),
                    x_authenticated_at: str | None = Header(None),
                    x_authenticated_signature: str | None = Header(None), authorization: str | None = Header(None)):
    subject=active_subject(authorization)
    role="guest"
    raise HTTPException(503,"PROPERTY_CLAIM_AUTHORITY_UNAVAILABLE")
    uid=uuid4()
    with db() as c:
        c.execute("""INSERT INTO bnb_property
            (id,host_subject,title,public_region,capacity,nightly_minor,currency)
            VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (uid,subject,payload.title,payload.public_region,payload.capacity,
             payload.nightly_minor,payload.currency))
    return {"id":str(uid),"status":"draft"}


@app.post("/v1/bnb/holds", status_code=201)
def hold(payload: HoldInput, idempotency_key: str = Header(min_length=8,max_length=128),
         x_authenticated_subject: str | None = Header(None),
         x_authenticated_role: str | None = Header(None),
                    x_authenticated_at: str | None = Header(None),
                    x_authenticated_signature: str | None = Header(None), authorization: str | None = Header(None)):
    subject=active_subject(authorization)
    role="guest"
    if role!="guest": raise HTTPException(403,"FORBIDDEN")
    validate_window(payload.start,payload.end)
    digest=hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
    with db() as c:
        with c.transaction():
            # Serialize all inventory mutations via property-scoped lock.
            property_row=c.execute("""SELECT capacity, nightly_minor, status FROM bnb_property
                WHERE id=%s FOR UPDATE""",(payload.property_id,)).fetchone()
            if not property_row or property_row[2]!="published":
                raise HTTPException(404,"NOT_FOUND")
            old=c.execute("""SELECT digest,result FROM bnb_request_dedupe
                WHERE actor=%s AND operation='hold' AND key=%s FOR UPDATE""",
                (subject,idempotency_key)).fetchone()
            if old:
                if old[0]!=digest:raise HTTPException(409,"IDEMPOTENCY_CONFLICT")
                return old[1]
            if c.execute("""SELECT 1 FROM bnb_block WHERE property_id=%s
                 AND period && tstzrange(%s,%s,'[)') LIMIT 1""",
                 (payload.property_id,payload.start,payload.end)).fetchone():
                raise HTTPException(409,"PROPERTY_BLOCKED")
            used=c.execute("""SELECT COALESCE(SUM(units),0) FROM bnb_hold
                WHERE property_id=%s AND period && tstzrange(%s,%s,'[)')
                AND (status='confirmed' OR (status='held' AND expires_at>now()))""",
                (payload.property_id,payload.start,payload.end)).fetchone()[0]
            if used+payload.units>property_row[0]:
                raise HTTPException(409,"CAPACITY_EXHAUSTED")
            uid=uuid4()
            # Explicitly nonbinding quote; no payments permitted in this stage.
            nights=(payload.end.date()-payload.start.date()).days
            if nights<=0:raise HTTPException(422,"MINIMUM_NIGHTS")
            total=nights*property_row[1]*payload.units
            c.execute("""INSERT INTO bnb_hold
                (id,property_id,guest_subject,period,units,status,expires_at,quote_total_minor,policy_snapshot)
                VALUES (%s,%s,%s,tstzrange(%s,%s,'[)'),%s,'held',now()+interval '15 minutes',%s,%s)""",
                (uid,payload.property_id,subject,payload.start,payload.end,
                 payload.units,total,payload.policy_snapshot))
            result={"id":str(uid),"status":"held","total_minor":total,
                    "payment_status":"unavailable","confirmed":False}
            c.execute("""INSERT INTO bnb_request_dedupe(actor,operation,key,digest,result)
                VALUES (%s,'hold',%s,%s,%s::jsonb)""",
                (subject,idempotency_key,digest,json.dumps(result)))
            c.execute("INSERT INTO bnb_outbox(id,event_type,payload) VALUES (%s,%s,%s::jsonb)",
                      (uuid4(),"bnb.hold.created",json.dumps({"hold_id":str(uid)})))
            return result


@app.get("/v1/bnb/holds/{hold_id}")
def get_hold(hold_id: str,x_authenticated_subject: str | None=Header(None),
             x_authenticated_role: str | None=Header(None),
             x_authenticated_at: str | None=Header(None),
             x_authenticated_signature: str | None=Header(None), authorization: str | None=Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        h=c.execute("SELECT guest_subject,status,expires_at FROM bnb_hold WHERE id=%s",
                    (hold_id,)).fetchone()
    if not h or h[0]!=subject:raise HTTPException(404,"NOT_FOUND")
    return {"id":hold_id,"status":("expired" if h[1]=="held" and h[2]<datetime.now(timezone.utc) else h[1])}


@app.post("/v1/bnb/payments/intents")
def payment_disabled():
    # Never infer financial authority from a local reservation, caller or callback.
    raise HTTPException(503,"PAYMENT_UNAVAILABLE")


@app.post("/v1/bnb/account/session", status_code=201)
def establish_session(authorization: str | None = Header(None)):
    """Exchange independently signed Identity assertion for scoped local session."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401,"UNAUTHORIZED")
    proof=verify_external_token(authorization[7:])
    sid=uuid4()
    with db() as c:
        with c.transaction():
            c.execute("""INSERT INTO bnb_account(subject) VALUES (%s)
                ON CONFLICT (subject) DO NOTHING""",(proof["subject"],))
            state=c.execute("SELECT state FROM bnb_account WHERE subject=%s FOR UPDATE",
                            (proof["subject"],)).fetchone()
            if not state or state[0]!="active":
                raise HTTPException(403,"ACCOUNT_DISABLED")
            existing=c.execute("""SELECT id,revoked_at,subject,recovery_epoch FROM bnb_identity_session
                WHERE issuer=%s AND issuer_session_id=%s FOR UPDATE""",
                (proof["issuer"],proof["issuer_session_id"])).fetchone()
            if existing:
                # Never resurrect a revoked issuer session.
                if existing[1]:raise HTTPException(401,"SESSION_REVOKED")
                if existing[2]!=proof["subject"]:
                    raise HTTPException(401,"SESSION_SUBJECT_MISMATCH")
                epoch=c.execute("SELECT recovery_epoch FROM bnb_account WHERE subject=%s",(proof["subject"],)).fetchone()[0]
                if existing[3]!=epoch:
                    raise HTTPException(401,"SESSION_EPOCH_REVOKED")
                sid=existing[0]
            else:
                c.execute("""INSERT INTO bnb_identity_session
                  (id,subject,issuer,issuer_session_id,expires_at)
                  VALUES (%s,%s,%s,%s,%s)""",
                  (sid,proof["subject"],proof["issuer"],proof["issuer_session_id"],proof["expires_at"]))
                c.execute("UPDATE bnb_identity_session SET recovery_epoch=(SELECT recovery_epoch FROM bnb_account WHERE subject=%s) WHERE id=%s",(proof["subject"],sid))
    return {"session_id":str(sid),"subject":proof["subject"],"expires_at":proof["expires_at"].isoformat(),
            "host_verified":False,"financial_permissions":[]}


@app.post("/v1/bnb/account/sessions/{session_id}/revoke")
def revoke_session(session_id: str,authorization: str | None = Header(None)):
    """Revocation may only be requested by the bearer of independent Identity proof."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401,"UNAUTHORIZED")
    subject=active_subject(authorization)
    proof=verify_external_token(authorization[7:])
    with db() as c:
        result=c.execute("""UPDATE bnb_identity_session SET revoked_at=now()
            WHERE id=%s AND subject=%s AND revoked_at IS NULL
              AND issuer=%s AND expires_at>now() RETURNING id""",
              (session_id,proof["subject"],proof["issuer"])).fetchone()
    if not result:raise HTTPException(404,"NOT_FOUND")
    return {"revoked":True}


@app.get("/v1/bnb/account/property/{property_id}/access")
def check_property_access(property_id: str,capability: str,
                          authorization: str | None = Header(None)):
    """Read-only property permission check; never grants ownership or payouts."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401,"UNAUTHORIZED")
    subject=active_subject(authorization)
    proof=verify_external_token(authorization[7:])
    if capability not in ("view_reservations","edit_calendar","edit_listing","handle_requests"):
        raise HTTPException(422,"INVALID_CAPABILITY")
    with db() as c:
        active=c.execute("""SELECT 1 FROM bnb_identity_session WHERE
            issuer=%s AND issuer_session_id=%s AND subject=%s
            AND revoked_at IS NULL AND expires_at>now()""",
            (proof["issuer"],proof["issuer_session_id"],proof["subject"])).fetchone()
        if not active:raise HTTPException(401,"SESSION_NOT_ACTIVE")
        # A locally entered host_subject is an unverified claim, not authority.
        # Both owner and manager permissions require an independently reviewed,
        # currently valid property-control claim for the recorded controller.
        verified=c.execute("""SELECT 1 FROM bnb_property p JOIN bnb_property_claim pc
            ON pc.property_id=p.id AND pc.subject=p.host_subject
            WHERE p.id=%s AND pc.state='verified' AND pc.expires_at>now()
              AND pc.reviewed_at IS NOT NULL LIMIT 1""",(property_id,)).fetchone()
        host=c.execute("""SELECT 1 FROM bnb_property WHERE id=%s AND host_subject=%s""",
                       (property_id,proof["subject"])).fetchone() if verified else None
        delegated=c.execute("""SELECT 1 FROM bnb_property_grant WHERE property_id=%s
            AND grantee_subject=%s AND capability=%s AND revoked_at IS NULL AND expires_at>now()""",
            (property_id,proof["subject"],capability)).fetchone() if verified else None
    return {"allowed":bool(host or delegated),"capability":capability,"property_id":property_id}


@app.post("/v1/bnb/account/recover")
def recover_account(authorization: str | None = Header(None),
                    x_recovery_proof: str | None = Header(None)):
    """Fresh separate recovery credential invalidates every old local session."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401,"UNAUTHORIZED")
    identity=verify_external_token(authorization[7:])
    if not x_recovery_proof:
        raise HTTPException(401,"RECOVERY_PROOF_REQUIRED")
    claim=verify_authority(x_recovery_proof,"BNB_RECOVERY","account-recovery",identity["subject"])
    with db() as c:
        with c.transaction():
            state=c.execute("SELECT state FROM bnb_account WHERE subject=%s FOR UPDATE",
                            (identity["subject"],)).fetchone()
            if not state or state[0]!="active":
                raise HTTPException(403,"ACCOUNT_DISABLED")
            inserted=c.execute("""INSERT INTO bnb_authority_proof_used(authority,issuer,proof_jti,subject)
                  VALUES ('recovery',%s,%s,%s) ON CONFLICT DO NOTHING RETURNING proof_jti""",
                  (claim["iss"],claim["jti"],identity["subject"])).fetchone()
            if not inserted:
                raise HTTPException(409,"RECOVERY_PROOF_REPLAY")
            c.execute("UPDATE bnb_account SET recovery_epoch=recovery_epoch+1 WHERE subject=%s",
                      (identity["subject"],))
            c.execute("UPDATE bnb_identity_session SET revoked_at=now() WHERE subject=%s AND revoked_at IS NULL",
                      (identity["subject"],))
    return {"recovered":True,"sessions_revoked":True}


@app.post("/v1/bnb/account/properties/{property_id}/claims",status_code=202)
def submit_property_claim(property_id: str, authorization: str | None = Header(None),
                          x_property_proof: str | None = Header(None)):
    """Record external proof only; never auto-publish or grant financial rights."""
    subject=active_subject(authorization)
    if not x_property_proof:
        raise HTTPException(401,"PROPERTY_PROOF_REQUIRED")
    claim=verify_authority(x_property_proof,"BNB_PROPERTY","property-control",subject)
    if claim.get("property_id")!=property_id:
        raise HTTPException(403,"PROPERTY_MISMATCH")
    with db() as c:
        with c.transaction():
            owner=c.execute("SELECT host_subject FROM bnb_property WHERE id=%s FOR UPDATE",
                            (property_id,)).fetchone()
            if not owner or owner[0]!=subject:
                raise HTTPException(404,"NOT_FOUND")
            used=c.execute("""INSERT INTO bnb_authority_proof_used(authority,issuer,proof_jti,subject)
               VALUES ('property',%s,%s,%s) ON CONFLICT DO NOTHING RETURNING proof_jti""",
               (claim["iss"],claim["jti"],subject)).fetchone()
            if not used:raise HTTPException(409,"PROPERTY_PROOF_REPLAY")
            c.execute("""INSERT INTO bnb_property_claim(property_id,subject,external_issuer,
                  external_claim_id,state,expires_at)
                  VALUES (%s,%s,%s,%s,'pending',to_timestamp(%s))""",
                  (property_id,subject,claim["iss"],claim["jti"],claim["exp"]))
    return {"status":"pending","published":False}
