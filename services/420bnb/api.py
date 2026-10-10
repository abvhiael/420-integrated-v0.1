"""420BnB bounded runtime slice. NEVER accepts client financial finality."""
import hashlib
import hmac
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from uuid import UUID,uuid4

import psycopg
sys.path.insert(0,str(Path(__file__).resolve().parent))
from identity import verify_external_token
from authority import verify_authority
from calendar_engine import peak_used,strict_local_instant,local_stay_window
from pricing import quote_breakdown
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
    nightly_minor: int = Field(ge=0, le=10**12, strict=True)
    currency: str = Field(pattern="^[A-Z]{3}$")


def peak_occupied_units(intervals,start,end):
    """Peak concurrent quantity within half-open [start,end), not sum of every overlap."""
    events=[]
    for left,right,units in intervals:
        left=max(start,left)
        right=min(end,right)
        if left<right:
            events.append((left,1,int(units)))
            events.append((right,0,-int(units)))
    active=peak=0
    for _,_,delta in sorted(events):
        active+=delta
        peak=max(peak,active)
    return peak


class SeasonalRate(BaseModel):
    start: str=Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end: str=Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    nightly_minor: int=Field(ge=0,le=10**12,strict=True)


class RatePlanInput(BaseModel):
    expected_property_version: int=Field(ge=1)
    seasonal_rates: list[SeasonalRate]=Field(default_factory=list,max_length=100)
    cleaning_minor: int=Field(ge=0,le=10**12,strict=True)
    service_minor: int=Field(default=0,ge=0,le=10**12,strict=True)
    tax_bps: int=Field(default=0,ge=0,le=10000,strict=True)
    discount_bps: int=Field(default=0,ge=0,le=10000,strict=True)


class QuoteInput(BaseModel):
    property_id: str
    unit_id: str|None=None
    checkin: str=Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    checkout: str=Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    units: int=Field(default=1,ge=1,le=100,strict=True)
    payer_max_minor: int|None=Field(default=None,ge=0,le=10**15,strict=True)
    nonce: str=Field(min_length=8,max_length=128)


@app.put("/v1/bnb/account/properties/{property_id}/rate-plan")
def revise_rate_plan(property_id:str,payload:RatePlanInput,authorization:str|None=Header(None)):
    from datetime import date
    periods=[]
    for item in payload.seasonal_rates:
        try: a,z=date.fromisoformat(item.start),date.fromisoformat(item.end)
        except ValueError:raise HTTPException(422,"INVALID_SEASONAL_DATE")
        if a>=z:raise HTTPException(422,"INVALID_SEASONAL_WINDOW")
        periods.append((a,z))
    periods.sort()
    if any(periods[i][0]<periods[i-1][1] for i in range(1,len(periods))):
        raise HTTPException(422,"OVERLAPPING_SEASONAL_RATES")
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            owner_draft(c,property_id,subject,payload.expected_property_version)
            rates=[x.model_dump() for x in payload.seasonal_rates]
            row=c.execute("""INSERT INTO bnb_rate_plan
                (property_id,seasonal_rates,cleaning_minor,service_minor,tax_bps,discount_bps)
                VALUES (%s,%s::jsonb,%s,%s,%s,%s)
                ON CONFLICT(property_id) DO UPDATE SET
                version=bnb_rate_plan.version+1,seasonal_rates=EXCLUDED.seasonal_rates,
                cleaning_minor=EXCLUDED.cleaning_minor,service_minor=EXCLUDED.service_minor,
                tax_bps=EXCLUDED.tax_bps,discount_bps=EXCLUDED.discount_bps,updated_at=now()
                RETURNING version""",
                (property_id,json.dumps(rates),payload.cleaning_minor,payload.service_minor,
                 payload.tax_bps,payload.discount_bps)).fetchone()
            version=bump_property(c,property_id,subject,"bnb.rate_plan.updated")
    return {"property_id":property_id,"rate_version":row[0],
            "property_version":version,"financial_finality":False}


@app.post("/v1/bnb/quotes",status_code=201)
def issue_quote(payload:QuoteInput,authorization:str|None=Header(None)):
    from datetime import date
    subject=active_subject(authorization)
    try:
        UUID(payload.property_id)
        if payload.unit_id is not None:UUID(payload.unit_id)
    except (TypeError,ValueError):
        raise HTTPException(422,"INVALID_PROPERTY_OR_UNIT_ID")
    try:checkin=date.fromisoformat(payload.checkin);checkout=date.fromisoformat(payload.checkout)
    except ValueError:raise HTTPException(422,"INVALID_LOCAL_DATE")
    digest=hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
    with db() as c:
        with c.transaction():
            # Same-guest nonce collision across distinct properties is serialized
            # before property locking, avoiding unhandled unique-constraint races.
            c.execute("SELECT subject FROM bnb_account WHERE subject=%s FOR UPDATE",(subject,))
            prop=c.execute("""SELECT capacity,nightly_minor,status,version,currency,title
                FROM bnb_property WHERE id=%s FOR UPDATE""",(payload.property_id,)).fetchone()
            if not prop or prop[2]!="published":raise HTTPException(404,"NOT_FOUND")
            prior=c.execute("""SELECT id,request_digest,expires_at,status,calculation
                FROM bnb_price_quote WHERE guest_subject=%s AND nonce=%s FOR UPDATE""",
                (subject,payload.nonce)).fetchone()
            if prior:
                if prior[1]!=digest:raise HTTPException(409,"QUOTE_NONCE_CONFLICT")
                return {"id":str(prior[0]),"status":("expired" if prior[2]<=datetime.now(timezone.utc) else prior[3]),
                        "calculation":prior[4],"financial_finality":False}
            policy=c.execute("""SELECT timezone_id,min_nights,house_rules,cancellation_policy
                FROM bnb_listing_policy WHERE property_id=%s""",
                (payload.property_id,)).fetchone()
            if not policy:raise HTTPException(503,"PRICING_POLICY_UNAVAILABLE")
            try:start,end,nights=local_stay_window(checkin,checkout,policy[0])
            except ValueError as e:raise HTTPException(422,str(e))
            validate_window(start,end)
            if nights<policy[1]:raise HTTPException(422,"MINIMUM_STAY_NOT_MET")
            rate=c.execute("""SELECT version,seasonal_rates,cleaning_minor,service_minor,
                tax_bps,discount_bps FROM bnb_rate_plan WHERE property_id=%s""",
                (payload.property_id,)).fetchone()
            if not rate:raise HTTPException(503,"RATE_PLAN_UNAVAILABLE")
            capacity=prop[0]
            if payload.unit_id:
                unit=c.execute("""SELECT quantity FROM bnb_unit WHERE property_id=%s AND id=%s""",
                               (payload.property_id,payload.unit_id)).fetchone()
                if not unit:raise HTTPException(404,"UNIT_NOT_FOUND")
                capacity=unit[0]
            elif c.execute("SELECT 1 FROM bnb_unit WHERE property_id=%s LIMIT 1",
                           (payload.property_id,)).fetchone():
                raise HTTPException(422,"UNIT_SELECTION_REQUIRED")
            used=occupancy_in_window(c,payload.property_id,payload.unit_id,start,end)
            if used is None or capacity-used<payload.units:
                raise HTTPException(409,"CAPACITY_EXHAUSTED")
            try:
                calculation=quote_breakdown(checkin,checkout,payload.units,prop[1],
                    rate[1],rate[2],rate[4],rate[5],rate[3],policy[1])
            except (ValueError,OverflowError) as e:raise HTTPException(422,str(e))
            if payload.payer_max_minor is not None and calculation["total_minor"]>payload.payer_max_minor:
                raise HTTPException(409,"PAYER_MAX_EXCEEDED")
            snapshot={"property_id":payload.property_id,"unit_id":payload.unit_id,
                "guest":subject,"property_version":prop[3],"rate_version":rate[0],
                "timezone":policy[0],"house_rules":policy[2],"cancellation_policy":policy[3],
                "calculation":calculation,"currency":prop[4],"checkin":payload.checkin,
                "checkout":payload.checkout}
            data=json.dumps(snapshot,sort_keys=True,separators=(",",":"))
            signature=hashlib.sha256(data.encode()).hexdigest()
            uid=uuid4()
            expires=datetime.now(timezone.utc)+timedelta(minutes=10)
            c.execute("""INSERT INTO bnb_price_quote
                (id,guest_subject,property_id,unit_id,property_version,rate_version,
                period,checkin,checkout,currency,quantity,calculation,policy_snapshot,
                snapshot_sha256,expires_at,nonce,request_digest)
                VALUES (%s,%s,%s,%s,%s,%s,tstzrange(%s,%s,'[)'),%s,%s,%s,%s,
                %s::jsonb,%s::jsonb,%s,%s,%s,%s)""",
                (uid,subject,payload.property_id,payload.unit_id,prop[3],rate[0],
                 start,end,checkin,checkout,prop[4],payload.units,json.dumps(calculation),
                 data,signature,expires,payload.nonce,digest))
    return {"id":str(uid),"status":"issued","expires_at":expires.isoformat(),
            "snapshot_sha256":signature,"policy_snapshot":snapshot,
            "policy_snapshot_text":data,"start":start.isoformat(),"end":end.isoformat(),
            "calculation":calculation,"currency":prop[4],
            "financial_finality":False}


@app.post("/v1/bnb/quotes/{quote_id}/revoke")
def revoke_quote(quote_id:UUID,authorization:str|None=Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            row=c.execute("""SELECT property_id,guest_subject,status,expires_at FROM
                bnb_price_quote WHERE id=%s""",(quote_id,)).fetchone()
            if not row or row[1]!=subject:raise HTTPException(404,"NOT_FOUND")
            owner_property_id=row[0]
            c.execute("SELECT id FROM bnb_property WHERE id=%s FOR UPDATE",(owner_property_id,))
            row=c.execute("""SELECT status,expires_at FROM bnb_price_quote
                WHERE id=%s FOR UPDATE""",(quote_id,)).fetchone()
            if row[0]=="revoked":return {"id":quote_id,"status":"revoked"}
            if row[1]<=datetime.now(timezone.utc):
                raise HTTPException(409,"QUOTE_EXPIRED")
            if c.execute("SELECT 1 FROM bnb_hold WHERE quote_id=%s LIMIT 1",
                         (quote_id,)).fetchone():
                raise HTTPException(409,"QUOTE_ALREADY_USED")
            c.execute("UPDATE bnb_price_quote SET status='revoked' WHERE id=%s",(quote_id,))
            c.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
                VALUES (%s,%s,'bnb.quote.revoked',%s)""",(uuid4(),subject,owner_property_id))
    return {"id":quote_id,"status":"revoked"}


@app.get("/v1/bnb/quotes/{quote_id}")
def get_quote(quote_id:UUID,authorization:str|None=Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        row=c.execute("""SELECT guest_subject,status,expires_at,calculation,currency,
            snapshot_sha256,policy_snapshot,lower(period),upper(period) FROM bnb_price_quote WHERE id=%s""",(quote_id,)).fetchone()
    if not row or row[0]!=subject:raise HTTPException(404,"NOT_FOUND")
    state="expired" if row[2]<=datetime.now(timezone.utc) else row[1]
    return {"id":quote_id,"status":state,"expires_at":row[2].isoformat(),
            "calculation":row[3],"currency":row[4].strip(),
            "snapshot_sha256":row[5],"policy_snapshot":row[6],
            "policy_snapshot_text":json.dumps(row[6],sort_keys=True,separators=(",",":")),
            "start":row[7].isoformat(),"end":row[8].isoformat(),
            "financial_finality":False}


class HoldInput(BaseModel):
    property_id: str
    unit_id: str | None = None
    quote_id: str | None = None
    start: datetime
    end: datetime
    units: int = Field(default=1, ge=1, le=100)
    policy_snapshot: str = Field(min_length=1, max_length=20000)


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


def occupancy_in_window(c,property_id,unit_id,start,end):
    """Count live holds, quantity closures and independently ingested busy events."""
    holds=c.execute("""SELECT lower(period),upper(period),units FROM bnb_hold
        WHERE property_id=%s AND unit_id IS NOT DISTINCT FROM %s
        AND period && tstzrange(%s,%s,'[)')
        AND (status='confirmed' OR (status='held' AND expires_at>now()))""",
        (property_id,unit_id,start,end)).fetchall()
    blocks=c.execute("""SELECT lower(period),upper(period),quantity FROM bnb_block
        WHERE property_id=%s AND (unit_id IS NULL OR unit_id=%s)
        AND period && tstzrange(%s,%s,'[)')""",
        (property_id,unit_id,start,end)).fetchall()
    if any(x[2] is None for x in blocks):
        return None
    synced=c.execute("""SELECT lower(period),upper(period),quantity,received_at FROM bnb_calendar_sync_event
        WHERE property_id=%s AND (unit_id IS NULL OR unit_id=%s)
        AND period && tstzrange(%s,%s,'[)')""",
        (property_id,unit_id,start,end)).fetchall()
    if any(x[3]<datetime.now(timezone.utc)-timedelta(hours=24) for x in synced):
        raise HTTPException(503,"CALENDAR_SYNC_STALE")
    return peak_used([*holds,*blocks,*[(x[0],x[1],x[2]) for x in synced]],start,end)


class CalendarSyncInput(BaseModel):
    property_id: str
    unit_id: str
    source_id: str = Field(min_length=3,max_length=200)
    external_event_id: str = Field(min_length=3,max_length=200)
    source_updated_at: datetime
    start: datetime
    end: datetime
    quantity: int = Field(ge=1,le=1000)


@app.post("/v1/bnb/internal/calendar/import",status_code=202)
def ingest_calendar(payload:CalendarSyncInput,x_calendar_sync_proof:str|None=Header(None)):
    """Independent signed busy-calendar observations. No booking/payment authority."""
    if not x_calendar_sync_proof:raise HTTPException(401,"CALENDAR_AUTHORITY_REQUIRED")
    claim=verify_authority(x_calendar_sync_proof,"BNB_CALENDAR_SYNC","calendar-import")
    if (claim.get("property_id")!=payload.property_id or
        claim.get("unit_id")!=payload.unit_id or
        claim.get("source_id")!=payload.source_id or
        claim.get("external_event_id")!=payload.external_event_id):
        raise HTTPException(403,"CALENDAR_SCOPE_MISMATCH")
    payload_digest=hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
    if claim.get("payload_hash")!=payload_digest:
        raise HTTPException(403,"CALENDAR_PAYLOAD_NOT_SIGNED")
    validate_window(payload.start,payload.end)
    if (payload.source_updated_at.tzinfo is None or
        payload.source_updated_at>datetime.now(timezone.utc)+timedelta(minutes=5) or
        payload.source_updated_at<datetime.now(timezone.utc)-timedelta(hours=24)):
        raise HTTPException(422,"STALE_CALENDAR_SOURCE")
    with db() as c:
        with c.transaction():
            prop=c.execute("SELECT status FROM bnb_property WHERE id=%s FOR UPDATE",
                           (payload.property_id,)).fetchone()
            if not prop:raise HTTPException(404,"NOT_FOUND")
            unit=c.execute("SELECT quantity FROM bnb_unit WHERE id=%s AND property_id=%s",
                           (payload.unit_id,payload.property_id)).fetchone()
            if not unit:raise HTTPException(404,"UNIT_NOT_FOUND")
            if payload.quantity>unit[0]:raise HTTPException(422,"SYNC_QUANTITY_EXCEEDS_CAPACITY")
            if c.execute("""SELECT 1 FROM bnb_calendar_sync_event WHERE
                (external_issuer=%s AND jti=%s) OR
                (external_issuer=%s AND source_id=%s AND external_event_id=%s)""",
                (claim["iss"],claim["jti"],claim["iss"],payload.source_id,payload.external_event_id)).fetchone():
                raise HTTPException(409,"CALENDAR_SYNC_REPLAY")
            prior=occupancy_in_window(c,payload.property_id,payload.unit_id,payload.start,payload.end)
            if prior is None or prior+payload.quantity>unit[0]:
                raise HTTPException(409,"SYNC_CAPACITY_CONFLICT")
            uid=uuid4()
            c.execute("""INSERT INTO bnb_calendar_sync_event
                (id,property_id,unit_id,external_issuer,source_id,external_event_id,
                jti,period,quantity,source_updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,tstzrange(%s,%s,'[)'),%s,%s)""",
                (uid,payload.property_id,payload.unit_id,claim["iss"],payload.source_id,
                 payload.external_event_id,claim["jti"],payload.start,payload.end,
                 payload.quantity,payload.source_updated_at))
    return {"id":str(uid),"state":"busy_imported","booking_authority":False}


@app.get("/v1/bnb/availability")
def guest_availability(property_id:str,start:datetime,end:datetime):
    """Public published-only read. No address, guest identity or booking commitment."""
    validate_window(start,end)
    with db() as c:
        row=c.execute("""SELECT id,title,public_region,capacity,status,version
            FROM bnb_property WHERE id=%s""",(property_id,)).fetchone()
        if not row or row[4]!="published":raise HTTPException(404,"NOT_FOUND")
        units=c.execute("""SELECT id,label,quantity FROM bnb_unit WHERE property_id=%s
            ORDER BY label,id""",(property_id,)).fetchall()
        if not units:units=[(None,"Entire property",row[3])]
        result=[]
        for uid,label,capacity in units:
            peak=occupancy_in_window(c,property_id,uid,start,end)
            result.append({"unit_id":str(uid) if uid else None,"label":label,
                           "capacity":capacity,"available":0 if peak is None else max(0,capacity-peak)})
    return {"property_id":str(row[0]),"title":row[1],"public_region":row[2],
            "start":start.isoformat(),"end":end.isoformat(),"property_version":row[5],
            "units":result,"nonbinding":True,
            "as_of":datetime.now(timezone.utc).isoformat()}


@app.get("/v1/bnb/availability/local")
def guest_local_availability(property_id:str,checkin:str,checkout:str):
    from datetime import date
    try:
        begin=date.fromisoformat(checkin)
        finish=date.fromisoformat(checkout)
    except ValueError:raise HTTPException(422,"INVALID_LOCAL_DATE")
    with db() as c:
        prop=c.execute("SELECT status FROM bnb_property WHERE id=%s",(property_id,)).fetchone()
        if not prop or prop[0]!="published":raise HTTPException(404,"NOT_FOUND")
        policy=c.execute("SELECT timezone_id,min_nights FROM bnb_listing_policy WHERE property_id=%s",
                         (property_id,)).fetchone()
        if not policy:raise HTTPException(503,"PROPERTY_TIMEZONE_UNAVAILABLE")
    try:start,end,nights=local_stay_window(begin,finish,policy[0])
    except ValueError as e:raise HTTPException(422,str(e))
    if nights<policy[1]:raise HTTPException(422,"MINIMUM_STAY_NOT_MET")
    result=guest_availability(property_id,start,end)
    return {**result,"timezone_id":policy[0],"nights":nights,"min_nights":policy[1]}


@app.post("/v1/bnb/properties", status_code=201)
def create_property(payload: PropertyInput, authorization: str | None = Header(None)):
    """Authenticated draft intake only. No verified host or publication grant."""
    subject=active_subject(authorization)
    uid=uuid4()
    with db() as c:
        with c.transaction():
            c.execute("""INSERT INTO bnb_property
                (id,host_subject,title,public_region,capacity,nightly_minor,currency)
                VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                (uid,subject,payload.title,payload.public_region,payload.capacity,
                 payload.nightly_minor,payload.currency))
            c.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
                VALUES (%s,%s,'bnb.property.draft_created',%s)""",(uuid4(),subject,uid))
    return {"id":str(uid),"status":"draft","version":1,"published":False}


class PropertyRevision(PropertyInput):
    expected_version: int = Field(ge=1)


@app.get("/v1/bnb/account/properties")
def my_properties(authorization: str | None = Header(None)):
    """Return own drafts, never any private address or third-party inventory."""
    subject=active_subject(authorization)
    with db() as c:
        rows=c.execute("""SELECT id,title,public_region,status,version FROM bnb_property
            WHERE host_subject=%s ORDER BY created_at,id LIMIT 100""",(subject,)).fetchall()
    return [{"id":str(row[0]),"title":row[1],"public_region":row[2],
             "status":row[3],"version":row[4]} for row in rows]


@app.put("/v1/bnb/account/properties/{property_id}")
def revise_draft_property(property_id: str, payload: PropertyRevision,
                          authorization: str | None = Header(None)):
    """Optimistic version lock; no mutation of externally reviewed/public property."""
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            row=c.execute("""SELECT host_subject,status,version FROM bnb_property
                WHERE id=%s FOR UPDATE""",(property_id,)).fetchone()
            if not row or row[0]!=subject:
                raise HTTPException(404,"NOT_FOUND")
            if row[1]!="draft":
                raise HTTPException(409,"PROPERTY_NOT_DRAFT")
            if row[2]!=payload.expected_version:
                raise HTTPException(409,"VERSION_CONFLICT")
            existing_units=c.execute("SELECT COALESCE(SUM(quantity),0) FROM bnb_unit WHERE property_id=%s",
                                     (property_id,)).fetchone()[0]
            if payload.capacity<existing_units:
                raise HTTPException(409,"UNIT_CAPACITY_EXCEEDED")
            new=c.execute("""UPDATE bnb_property SET title=%s,public_region=%s,
                capacity=%s,nightly_minor=%s,currency=%s,version=version+1
                WHERE id=%s AND host_subject=%s AND status='draft' AND version=%s
                RETURNING version""",(payload.title,payload.public_region,payload.capacity,
                payload.nightly_minor,payload.currency,property_id,subject,
                payload.expected_version)).fetchone()
            if not new:
                raise HTTPException(409,"VERSION_CONFLICT")
            c.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
                VALUES (%s,%s,'bnb.property.draft_updated',%s)""",(uuid4(),subject,property_id))
    return {"id":property_id,"status":"draft","version":new[0],"published":False}


class ManagerGrantInput(BaseModel):
    subject: str = Field(min_length=1,max_length=256)
    capability: str
    expires_at: datetime


def require_verified_property_owner(c, property_id: str, subject: str):
    owner=c.execute("""SELECT host_subject FROM bnb_property WHERE id=%s FOR UPDATE""",
                    (property_id,)).fetchone()
    if not owner or owner[0]!=subject:
        raise HTTPException(404,"NOT_FOUND")
    verified=c.execute("""SELECT 1 FROM bnb_property_claim WHERE
        property_id=%s AND subject=%s AND state='verified' AND
        expires_at>now() AND reviewed_at IS NOT NULL LIMIT 1""",
        (property_id,subject)).fetchone()
    if not verified:
        raise HTTPException(403,"PROPERTY_AUTHORITY_NOT_VERIFIED")


@app.post("/v1/bnb/account/properties/{property_id}/managers", status_code=201)
def grant_property_manager(property_id: str, payload: ManagerGrantInput,
                           authorization: str | None = Header(None)):
    """No grants without independently reviewed ownership and fresh actor session."""
    subject=active_subject(authorization)
    if payload.capability not in ("view_reservations","edit_calendar","edit_listing","handle_requests"):
        raise HTTPException(422,"INVALID_CAPABILITY")
    if payload.subject==subject:
        raise HTTPException(422,"SELF_GRANT_NOT_ALLOWED")
    if payload.expires_at.tzinfo is None or not (
        datetime.now(timezone.utc)<payload.expires_at<=datetime.now(timezone.utc)+timedelta(days=90)
    ):
        raise HTTPException(422,"INVALID_GRANT_EXPIRY")
    with db() as c:
        with c.transaction():
            require_verified_property_owner(c,property_id,subject)
            account=c.execute("SELECT state FROM bnb_account WHERE subject=%s FOR UPDATE",
                             (payload.subject,)).fetchone()
            if not account or account[0]!="active":
                raise HTTPException(404,"GRANTEE_NOT_FOUND")
            exists=c.execute("""SELECT 1 FROM bnb_property_grant WHERE property_id=%s
                AND grantee_subject=%s AND capability=%s""",
                (property_id,payload.subject,payload.capability)).fetchone()
            if exists:
                raise HTTPException(409,"GRANT_ALREADY_EXISTS")
            c.execute("""INSERT INTO bnb_property_grant(property_id,grantee_subject,
                capability,expires_at,granted_by) VALUES (%s,%s,%s,%s,%s)""",
                (property_id,payload.subject,payload.capability,payload.expires_at,subject))
            c.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
                VALUES (%s,%s,'bnb.property.manager_granted',%s)""",(uuid4(),subject,property_id))
    return {"property_id":property_id,"capability":payload.capability,
            "grantee_subject":payload.subject,"financial_permissions":[]}


@app.delete("/v1/bnb/account/properties/{property_id}/managers/{grantee_subject}/{capability}")
def revoke_property_manager(property_id: str,grantee_subject: str,capability: str,
                            authorization: str | None = Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            require_verified_property_owner(c,property_id,subject)
            changed=c.execute("""UPDATE bnb_property_grant SET revoked_at=now()
                WHERE property_id=%s AND grantee_subject=%s AND capability=%s
                AND revoked_at IS NULL RETURNING capability""",
                (property_id,grantee_subject,capability)).fetchone()
            if not changed:raise HTTPException(404,"GRANT_NOT_FOUND")
            c.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
                VALUES (%s,%s,'bnb.property.manager_revoked',%s)""",(uuid4(),subject,property_id))
    return {"revoked":True}


class ListingPolicyInput(BaseModel):
    expected_version: int = Field(ge=1)
    min_nights: int = Field(default=1,ge=1,le=90)
    house_rules: str = Field(min_length=1,max_length=4000)
    cancellation_policy: str = Field(min_length=1,max_length=4000)
    timezone_id: str = Field(min_length=1,max_length=100)


class ListingMediaInput(BaseModel):
    expected_version: int = Field(ge=1)
    asset_url: str = Field(min_length=12,max_length=2000)
    alt_text: str = Field(min_length=8,max_length=300)
    rights_statement: str = Field(min_length=8,max_length=500)


@app.put("/v1/bnb/account/properties/{property_id}/policy")
def update_listing_policy(property_id:str,payload:ListingPolicyInput,
                          authorization:str|None=Header(None)):
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    try:
        zone=ZoneInfo(payload.timezone_id)
    except (ZoneInfoNotFoundError,ValueError,KeyError):
        raise HTTPException(422,"INVALID_IANA_TIMEZONE")
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            owner_draft(c,property_id,subject,payload.expected_version)
            c.execute("""INSERT INTO bnb_listing_policy(property_id,house_rules,cancellation_policy,timezone_id,min_nights)
                VALUES (%s,%s,%s,%s,%s) ON CONFLICT(property_id) DO UPDATE
                SET house_rules=EXCLUDED.house_rules,cancellation_policy=EXCLUDED.cancellation_policy,
                timezone_id=EXCLUDED.timezone_id,min_nights=EXCLUDED.min_nights""",
                (property_id,payload.house_rules,payload.cancellation_policy,payload.timezone_id,payload.min_nights))
            version=bump_property(c,property_id,subject,"bnb.listing.policy_updated")
    return {"version":version,"timezone_id":zone.key,"min_nights":payload.min_nights,"status":"draft"}


@app.post("/v1/bnb/account/properties/{property_id}/media",status_code=201)
def submit_listing_media(property_id:str,payload:ListingMediaInput,
                         authorization:str|None=Header(None)):
    from urllib.parse import urlsplit
    url=urlsplit(payload.asset_url)
    if url.scheme!="https" or not url.netloc or url.username or url.password or url.fragment:
        raise HTTPException(422,"INVALID_MEDIA_URL")
    # Store a reference only; publication and remote fetching require independent
    # rights moderation and a separately approved asset provider.
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            owner_draft(c,property_id,subject,payload.expected_version)
            mid=uuid4()
            c.execute("""INSERT INTO bnb_listing_media(id,property_id,asset_url,alt_text,rights_statement)
                VALUES (%s,%s,%s,%s,%s)""",
                (mid,property_id,payload.asset_url,payload.alt_text,payload.rights_statement))
            version=bump_property(c,property_id,subject,"bnb.listing.media_submitted")
    return {"id":str(mid),"version":version,"moderation_state":"pending","published":False}


class MediaDecisionInput(BaseModel):
    decision: str
    reason: str = Field(min_length=8,max_length=500)


@app.post("/v1/bnb/internal/media/{media_id}/decision")
def decide_media(media_id:str,payload:MediaDecisionInput,
                 x_media_review_proof:str|None=Header(None)):
    """Separate signed reviewer authority; never trust host-controlled claims."""
    if payload.decision not in ("approved","rejected","revoked"):
        raise HTTPException(422,"INVALID_MEDIA_DECISION")
    if not x_media_review_proof:
        raise HTTPException(401,"REVIEW_AUTHORITY_REQUIRED")
    proof=verify_authority(x_media_review_proof,"BNB_MEDIA_REVIEW","media-review")
    if proof.get("media_id")!=media_id or proof.get("decision")!=payload.decision:
        raise HTTPException(403,"REVIEW_SCOPE_MISMATCH")
    with db() as c:
        with c.transaction():
            row=c.execute("""SELECT moderation_state,property_id FROM bnb_listing_media
                WHERE id=%s FOR UPDATE""",(media_id,)).fetchone()
            if not row:raise HTTPException(404,"MEDIA_NOT_FOUND")
            allowed={"pending":("approved","rejected"),"approved":("revoked",),
                     "rejected":(),"revoked":()}
            if payload.decision not in allowed[row[0]]:
                raise HTTPException(409,"MEDIA_REVIEW_TRANSITION_DENIED")
            replay=c.execute("SELECT 1 FROM bnb_media_review_nonce WHERE issuer=%s AND jti=%s",
                             (proof["iss"],proof["jti"])).fetchone()
            if replay:raise HTTPException(409,"MEDIA_REVIEW_REPLAY")
            c.execute("INSERT INTO bnb_media_review_nonce(issuer,jti,media_id) VALUES (%s,%s,%s)",
                      (proof["iss"],proof["jti"],media_id))
            c.execute("""UPDATE bnb_listing_media SET moderation_state=%s
                WHERE id=%s""",(payload.decision,media_id))
            c.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
                VALUES (%s,%s,%s,%s)""",
                (uuid4(),proof["sub"],"bnb.media."+payload.decision,row[1]))
    return {"media_id":media_id,"state":payload.decision}


class UnitInput(BaseModel):
    label: str = Field(min_length=1,max_length=100)
    quantity: int = Field(ge=1,le=1000)
    expected_version: int = Field(ge=1)


class CalendarBlockInput(BaseModel):
    quantity: int | None = Field(default=None,ge=1,le=1000)
    start: datetime
    end: datetime
    reason: str = Field(min_length=1,max_length=160)
    expected_version: int = Field(ge=1)


class ReviewInput(BaseModel):
    expected_version: int = Field(ge=1)


def owner_draft(c,property_id,subject,expected_version):
    row=c.execute("""SELECT host_subject,status,version,capacity FROM bnb_property
        WHERE id=%s FOR UPDATE""",(property_id,)).fetchone()
    if not row or row[0]!=subject:raise HTTPException(404,"NOT_FOUND")
    if row[1]!="draft":raise HTTPException(409,"PROPERTY_NOT_DRAFT")
    if row[2]!=expected_version:raise HTTPException(409,"VERSION_CONFLICT")
    return row


def bump_property(c,property_id,subject,action):
    version=c.execute("""UPDATE bnb_property SET version=version+1
        WHERE id=%s RETURNING version""",(property_id,)).fetchone()[0]
    c.execute("INSERT INTO bnb_audit(id,subject,action,resource_id) VALUES (%s,%s,%s,%s)",
              (uuid4(),subject,action,property_id))
    return version


@app.post("/v1/bnb/account/properties/{property_id}/units",status_code=201)
def create_unit(property_id:str,payload:UnitInput,authorization:str|None=Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            row=owner_draft(c,property_id,subject,payload.expected_version)
            total=c.execute("SELECT COALESCE(SUM(quantity),0) FROM bnb_unit WHERE property_id=%s",
                            (property_id,)).fetchone()[0]
            if total+payload.quantity>row[3]:raise HTTPException(409,"UNIT_CAPACITY_EXCEEDED")
            uid=uuid4()
            if c.execute("SELECT 1 FROM bnb_unit WHERE property_id=%s AND label=%s",
                         (property_id,payload.label)).fetchone():
                raise HTTPException(409,"UNIT_LABEL_EXISTS")
            c.execute("INSERT INTO bnb_unit(id,property_id,label,quantity) VALUES (%s,%s,%s,%s)",
                      (uid,property_id,payload.label,payload.quantity))
            version=bump_property(c,property_id,subject,"bnb.unit.created")
    return {"id":str(uid),"property_id":property_id,"version":version,"status":"draft"}


@app.get("/v1/bnb/account/properties/{property_id}/units")
def host_units(property_id:str,authorization:str|None=Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        owner=c.execute("SELECT 1 FROM bnb_property WHERE id=%s AND host_subject=%s",
                        (property_id,subject)).fetchone()
        if not owner:raise HTTPException(404,"NOT_FOUND")
        rows=c.execute("SELECT id,label,quantity,version FROM bnb_unit WHERE property_id=%s ORDER BY label",
                       (property_id,)).fetchall()
    return [{"id":str(x[0]),"label":x[1],"quantity":x[2],"version":x[3]} for x in rows]


@app.post("/v1/bnb/account/properties/{property_id}/calendar/blocks",status_code=201)
def block_unit_dates(property_id:str,payload:CalendarBlockInput,unit_id:str|None=None,
                     authorization:str|None=Header(None)):
    subject=active_subject(authorization)
    validate_window(payload.start,payload.end)
    with db() as c:
        with c.transaction():
            owner_draft(c,property_id,subject,payload.expected_version)
            policy=c.execute("SELECT timezone_id FROM bnb_listing_policy WHERE property_id=%s",
                             (property_id,)).fetchone()
            if policy:
                from zoneinfo import ZoneInfo
                zone=ZoneInfo(policy[0])
                # UTC instants must correspond to local check-in/check-out times.
                # Clients need the explicit IANA zone to detect DST transitions.
                if ((payload.start.utcoffset()!=timedelta(0) and payload.start.astimezone(zone).utcoffset()!=payload.start.utcoffset()) or
                    (payload.end.utcoffset()!=timedelta(0) and payload.end.astimezone(zone).utcoffset()!=payload.end.utcoffset())):
                    raise HTTPException(422,"PROPERTY_TIMEZONE_OFFSET_MISMATCH")
            if unit_id:
                unit=c.execute("SELECT quantity FROM bnb_unit WHERE id=%s AND property_id=%s",
                               (unit_id,property_id)).fetchone()
                if not unit:raise HTTPException(404,"UNIT_NOT_FOUND")
                capacity=unit[0]
            else:
                # A property-wide closure is all-or-nothing; partial closure is
                # unit scoped because quantity mapping to units is ambiguous.
                if payload.quantity is not None:
                    raise HTTPException(422,"PROPERTY_BLOCK_MUST_BE_FULL")
                capacity=None
            closure=payload.quantity if payload.quantity is not None else capacity
            if unit_id:
                existing=occupancy_in_window(c,property_id,unit_id,payload.start,payload.end)
                if existing is None or existing+closure>capacity:
                    raise HTTPException(409,"CALENDAR_CAPACITY_CONFLICT")
            else:
                other=c.execute("""SELECT 1 FROM bnb_hold WHERE property_id=%s
                    AND period && tstzrange(%s,%s,'[)')
                    AND (status='confirmed' OR (status='held' AND expires_at>now())) LIMIT 1""",
                    (property_id,payload.start,payload.end)).fetchone()
                if other:raise HTTPException(409,"EXISTING_BOOKING_CONFLICT")
            bid=uuid4()
            c.execute("""INSERT INTO bnb_block(id,property_id,unit_id,period,reason,created_by,
                property_version,quantity) VALUES (%s,%s,%s,tstzrange(%s,%s,'[)'),%s,%s,%s,%s)""",
                (bid,property_id,unit_id,payload.start,payload.end,payload.reason,
                 subject,payload.expected_version,closure))
            version=bump_property(c,property_id,subject,"bnb.calendar.block_created")
    return {"id":str(bid),"version":version,"status":"blocked"}


@app.put("/v1/bnb/account/properties/{property_id}/calendar/blocks/{block_id}")
def revise_calendar_block(property_id:str,block_id:str,payload:CalendarBlockInput,
                          authorization:str|None=Header(None)):
    """Atomic rescheduling under the same property-row inventory lock."""
    subject=active_subject(authorization)
    validate_window(payload.start,payload.end)
    with db() as c:
        with c.transaction():
            owner_draft(c,property_id,subject,payload.expected_version)
            old=c.execute("""SELECT unit_id,reason,created_by FROM bnb_block
                WHERE property_id=%s AND id=%s FOR UPDATE""",(property_id,block_id)).fetchone()
            if not old or old[2]!=subject:raise HTTPException(404,"BLOCK_NOT_FOUND")
            unit_id=old[0]
            if unit_id is not None:
                cap=c.execute("SELECT quantity FROM bnb_unit WHERE id=%s AND property_id=%s",
                              (unit_id,property_id)).fetchone()
                if not cap:raise HTTPException(404,"UNIT_NOT_FOUND")
                closure=payload.quantity if payload.quantity is not None else cap[0]
            else:
                if payload.quantity is not None:raise HTTPException(422,"PROPERTY_BLOCK_MUST_BE_FULL")
                closure=None
            # Deleting within a transaction preserves original block on failure.
            c.execute("DELETE FROM bnb_block WHERE id=%s",(block_id,))
            if unit_id is not None:
                used=occupancy_in_window(c,property_id,unit_id,payload.start,payload.end)
                if used is None or used+closure>cap[0]:
                    raise HTTPException(409,"CALENDAR_CAPACITY_CONFLICT")
            elif c.execute("""SELECT 1 FROM bnb_hold WHERE property_id=%s AND
                  period && tstzrange(%s,%s,'[)') AND
                  (status='confirmed' OR (status='held' AND expires_at>now())) LIMIT 1""",
                  (property_id,payload.start,payload.end)).fetchone():
                raise HTTPException(409,"EXISTING_BOOKING_CONFLICT")
            c.execute("""INSERT INTO bnb_block(id,property_id,unit_id,period,reason,
                created_by,property_version,quantity)
                VALUES (%s,%s,%s,tstzrange(%s,%s,'[)'),%s,%s,%s,%s)""",
                (block_id,property_id,unit_id,payload.start,payload.end,payload.reason,
                 subject,payload.expected_version,closure))
            version=bump_property(c,property_id,subject,"bnb.calendar.block_rescheduled")
    return {"id":block_id,"version":version,"status":"blocked"}


@app.get("/v1/bnb/account/properties/{property_id}/calendar")
def property_calendar(property_id:str,authorization:str|None=Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        if not c.execute("SELECT 1 FROM bnb_property WHERE id=%s AND host_subject=%s",
                         (property_id,subject)).fetchone():
            raise HTTPException(404,"NOT_FOUND")
        rows=c.execute("""SELECT id,unit_id,lower(period),upper(period),reason
            FROM bnb_block WHERE property_id=%s ORDER BY lower(period) LIMIT 500""",
            (property_id,)).fetchall()
    return [{"id":str(x[0]),"unit_id":str(x[1]) if x[1] else None,
             "start":x[2].isoformat(),"end":x[3].isoformat(),"reason":x[4]} for x in rows]


@app.delete("/v1/bnb/account/properties/{property_id}/calendar/blocks/{block_id}")
def remove_calendar_block(property_id:str,block_id:str,expected_version:int,
                          authorization:str|None=Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            owner_draft(c,property_id,subject,expected_version)
            deleted=c.execute("""DELETE FROM bnb_block WHERE id=%s AND property_id=%s
                AND created_by=%s RETURNING id""",(block_id,property_id,subject)).fetchone()
            if not deleted:raise HTTPException(404,"BLOCK_NOT_FOUND")
            version=bump_property(c,property_id,subject,"bnb.calendar.block_removed")
    return {"removed":True,"version":version}


@app.post("/v1/bnb/account/properties/{property_id}/review",status_code=202)
def request_listing_review(property_id:str,payload:ReviewInput,authorization:str|None=Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            row=owner_draft(c,property_id,subject,payload.expected_version)
            units=c.execute("SELECT label,quantity FROM bnb_unit WHERE property_id=%s ORDER BY label",
                            (property_id,)).fetchall()
            if not units or sum(x[1] for x in units)!=row[3]:
                raise HTTPException(409,"UNIT_INVENTORY_INCOMPLETE")
            if c.execute("SELECT 1 FROM bnb_listing_review WHERE property_id=%s AND state='pending'",
                         (property_id,)).fetchone():
                raise HTTPException(409,"REVIEW_ALREADY_PENDING")
            details=c.execute("""SELECT title,public_region,capacity,nightly_minor,currency
                FROM bnb_property WHERE id=%s""",(property_id,)).fetchone()
            policy=c.execute("""SELECT house_rules,cancellation_policy,timezone_id
                FROM bnb_listing_policy WHERE property_id=%s""",(property_id,)).fetchone()
            media=c.execute("""SELECT COUNT(*) FROM bnb_listing_media
                WHERE property_id=%s AND moderation_state='approved'""",(property_id,)).fetchone()[0]
            # A pending review may include incomplete moderation evidence; it
            # never represents publication approval or a verified host.
            snapshot={"property_id":property_id,"title":details[0],"public_region":details[1],
                "capacity":details[2],"nightly_minor":details[3],"currency":details[4],
                "version":payload.expected_version,
                "policy":({"house_rules":policy[0],"cancellation_policy":policy[1],"timezone_id":policy[2]} if policy else None),
                "approved_media_count":media,
                "units":[{"label":x[0],"quantity":x[1]} for x in units]}
            encoded=json.dumps(snapshot,sort_keys=True,separators=(",",":"))
            digest=hashlib.sha256(encoded.encode()).hexdigest()
            review_id=uuid4()
            c.execute("""INSERT INTO bnb_listing_review
                (id,property_id,requested_by,property_version,snapshot,snapshot_hash)
                VALUES (%s,%s,%s,%s,%s::jsonb,%s)""",
                (review_id,property_id,subject,payload.expected_version,encoded,digest))
            c.execute("INSERT INTO bnb_audit(id,subject,action,resource_id) VALUES (%s,%s,%s,%s)",
                      (uuid4(),subject,"bnb.listing.review_requested",property_id))
    return {"review_id":str(review_id),"state":"pending","published":False,
            "snapshot_hash":digest}


@app.post("/v1/bnb/account/properties/{property_id}/reviews/{review_id}/withdraw")
def withdraw_listing_review(property_id:str,review_id:str,
                            authorization:str|None=Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            owner=c.execute("SELECT host_subject FROM bnb_property WHERE id=%s FOR UPDATE",
                            (property_id,)).fetchone()
            if not owner or owner[0]!=subject:raise HTTPException(404,"NOT_FOUND")
            result=c.execute("""UPDATE bnb_listing_review SET state='withdrawn'
                WHERE id=%s AND property_id=%s AND requested_by=%s AND state='pending'
                RETURNING id""",(review_id,property_id,subject)).fetchone()
            if not result:raise HTTPException(409,"REVIEW_NOT_PENDING")
            c.execute("INSERT INTO bnb_audit(id,subject,action,resource_id) VALUES (%s,%s,%s,%s)",
                      (uuid4(),subject,"bnb.listing.review_withdrawn",property_id))
    return {"state":"withdrawn","published":False}


@app.get("/v1/bnb/account/properties/{property_id}/reviews")
def my_listing_reviews(property_id:str,authorization:str|None=Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        if not c.execute("SELECT 1 FROM bnb_property WHERE id=%s AND host_subject=%s",
                         (property_id,subject)).fetchone():
            raise HTTPException(404,"NOT_FOUND")
        rows=c.execute("""SELECT id,state,property_version,snapshot_hash FROM
            bnb_listing_review WHERE property_id=%s ORDER BY created_at,id""",
            (property_id,)).fetchall()
    return [{"id":str(x[0]),"state":x[1],"version":x[2],"snapshot_hash":x[3]} for x in rows]


class BookingRequestInput(BaseModel):
    hold_id: UUID
    request_type: str=Field(pattern="^(request|instant)$")


class BookingPolicyInput(BaseModel):
    expected_version: int=Field(ge=1)
    instant_enabled: bool=False


@app.put("/v1/bnb/account/properties/{property_id}/booking-policy")
def set_booking_policy(property_id:UUID,payload:BookingPolicyInput,
                       authorization:str|None=Header(None)):
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            owner_draft(c,str(property_id),subject,payload.expected_version)
            c.execute("""INSERT INTO bnb_booking_policy(property_id,instant_enabled)
                VALUES (%s,%s) ON CONFLICT(property_id) DO UPDATE
                SET instant_enabled=EXCLUDED.instant_enabled,updated_at=now()""",
                (property_id,payload.instant_enabled))
            version=bump_property(c,str(property_id),subject,"bnb.booking_policy.updated")
    return {"property_id":str(property_id),"instant_enabled":payload.instant_enabled,
            "version":version,"publication_approval":False}


@app.post("/v1/bnb/booking-requests",status_code=201)
def submit_booking_request(payload:BookingRequestInput,
                           idempotency_key:str=Header(min_length=8,max_length=128),
                           authorization:str|None=Header(None)):
    guest=active_subject(authorization)
    digest=hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
    with db() as c:
        with c.transaction():
            # Lock ordering mirrors hold admission / cancellation.
            ref=c.execute("SELECT property_id,guest_subject FROM bnb_hold WHERE id=%s",
                          (payload.hold_id,)).fetchone()
            if not ref or ref[1]!=guest:raise HTTPException(404,"HOLD_NOT_FOUND")
            prop=c.execute("""SELECT host_subject,status FROM bnb_property
                WHERE id=%s FOR UPDATE""",(ref[0],)).fetchone()
            if not prop or prop[1]!="published":raise HTTPException(404,"NOT_FOUND")
            prior=c.execute("""SELECT digest,result FROM bnb_request_dedupe
                WHERE actor=%s AND operation='booking_request' AND key=%s FOR UPDATE""",
                (guest,idempotency_key)).fetchone()
            if prior:
                if prior[0]!=digest:raise HTTPException(409,"IDEMPOTENCY_CONFLICT")
                state=c.execute("SELECT state FROM bnb_booking_request WHERE id=%s",
                                (prior[1]["id"],)).fetchone()
                if not state:raise HTTPException(409,"REQUEST_NO_LONGER_AVAILABLE")
                return {**prior[1],"state":state[0]}
            hold=c.execute("""SELECT status,expires_at,quote_id,policy_snapshot FROM bnb_hold
                WHERE id=%s FOR UPDATE""",(payload.hold_id,)).fetchone()
            if hold[0]!="held" or hold[1]<=datetime.now(timezone.utc):
                raise HTTPException(409,"HOLD_INACTIVE")
            if c.execute("SELECT 1 FROM bnb_booking_request WHERE hold_id=%s",
                         (payload.hold_id,)).fetchone():
                raise HTTPException(409,"HOLD_ALREADY_REQUESTED")
            if hold[2]:
                quote=c.execute("""SELECT status,expires_at FROM bnb_price_quote
                    WHERE id=%s""",(hold[2],)).fetchone()
                if not quote or quote[0]!="issued" or quote[1]<=datetime.now(timezone.utc):
                    raise HTTPException(409,"PRICE_QUOTE_INVALID")
            policy=c.execute("SELECT instant_enabled FROM bnb_booking_policy WHERE property_id=%s",
                             (ref[0],)).fetchone()
            if payload.request_type=="instant" and (not policy or not policy[0]):
                raise HTTPException(403,"INSTANT_BOOK_NOT_ENABLED")
            deadline=min(hold[1],datetime.now(timezone.utc)+timedelta(minutes=10))
            request_id=uuid4()
            state="accepted" if payload.request_type=="instant" else "requested"
            c.execute("""INSERT INTO bnb_booking_request
                (id,hold_id,property_id,guest_subject,host_subject,request_type,
                state,deadline,expected_quote_id,decided_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (request_id,payload.hold_id,ref[0],guest,prop[0],payload.request_type,
                 state,deadline,hold[2],datetime.now(timezone.utc) if state=="accepted" else None))
            if state=="accepted":
                c.execute("""INSERT INTO bnb_reservation
                    (id,hold_id,property_id,guest_subject,status,booking_request_id,
                     policy_snapshot,quote_id,booking_public_id)
                    VALUES (%s,%s,%s,%s,'payment_pending',%s,%s,%s,%s)""",
                    (uuid4(),payload.hold_id,ref[0],guest,request_id,hold[3],hold[2],uuid4()))
            response={"id":str(request_id),"hold_id":str(payload.hold_id),
                      "state":state,"payment_status":"unavailable","confirmed":False}
            c.execute("""INSERT INTO bnb_request_dedupe(actor,operation,key,digest,result)
                VALUES (%s,'booking_request',%s,%s,%s::jsonb)""",
                (guest,idempotency_key,digest,json.dumps(response)))
            c.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
                VALUES (%s,%s,'bnb.booking.request_created',%s)""",(uuid4(),guest,ref[0]))
    return response


@app.post("/v1/bnb/booking-requests/{request_id}/{decision}")
def decide_booking_request(request_id:UUID,decision:str,
                           authorization:str|None=Header(None)):
    if decision not in ("accept","decline","withdraw"):
        raise HTTPException(422,"INVALID_BOOKING_DECISION")
    actor=active_subject(authorization)
    with db() as c:
        with c.transaction():
            info=c.execute("""SELECT property_id FROM bnb_booking_request
                WHERE id=%s""",(request_id,)).fetchone()
            if not info:raise HTTPException(404,"NOT_FOUND")
            current_property=c.execute("""SELECT host_subject,status FROM bnb_property
                WHERE id=%s FOR UPDATE""",(info[0],)).fetchone()
            record=c.execute("""SELECT hold_id,guest_subject,host_subject,state,deadline,
                property_id,expected_quote_id FROM bnb_booking_request
                WHERE id=%s FOR UPDATE""",(request_id,)).fetchone()
            if decision=="withdraw":
                if actor!=record[1]:raise HTTPException(404,"NOT_FOUND")
            elif (actor!=record[2] or not current_property or
                  current_property[0]!=actor or current_property[1]!="published"):
                raise HTTPException(404,"NOT_FOUND")
            if record[3]!="requested":
                raise HTTPException(409,"REQUEST_NOT_PENDING")
            h=c.execute("""SELECT status,expires_at,policy_snapshot FROM bnb_hold
                WHERE id=%s FOR UPDATE""",(record[0],)).fetchone()
            now=datetime.now(timezone.utc)
            q_invalid=False
            if record[6] is not None:
                q=c.execute("SELECT status,expires_at FROM bnb_price_quote WHERE id=%s",
                            (record[6],)).fetchone()
                q_invalid=not q or q[0]!="issued" or q[1]<=now
            if now>=record[4] or h[0]!="held" or h[1]<=now or q_invalid:
                c.execute("""UPDATE bnb_booking_request SET state='expired',
                    decided_at=now(),version=version+1 WHERE id=%s""",(request_id,))
                if h[0]=="held":c.execute("UPDATE bnb_hold SET status='expired' WHERE id=%s",(record[0],))
                result="expired"
            else:
                result={"accept":"accepted","decline":"declined","withdraw":"withdrawn"}[decision]
                c.execute("""UPDATE bnb_booking_request SET state=%s,decided_at=now(),
                    version=version+1 WHERE id=%s""",(result,request_id))
                if result=="accepted":
                    c.execute("""INSERT INTO bnb_reservation
                        (id,hold_id,property_id,guest_subject,status,booking_request_id,
                         policy_snapshot,quote_id,booking_public_id)
                        VALUES (%s,%s,%s,%s,'payment_pending',%s,%s,%s,%s)""",
                        (uuid4(),record[0],record[5],record[1],request_id,
                         h[2],record[6],uuid4()))
                else:
                    c.execute("UPDATE bnb_hold SET status='cancelled' WHERE id=%s",(record[0],))
            c.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
                VALUES (%s,%s,%s,%s)""",(uuid4(),actor,"bnb.booking."+result,record[5]))
    return {"id":str(request_id),"state":result,"confirmed":False,
            "payment_status":"unavailable"}


@app.get("/v1/bnb/account/booking-requests")
def list_my_booking_requests(role:str="guest",authorization:str|None=Header(None)):
    actor=active_subject(authorization)
    if role not in ("guest","host"):raise HTTPException(422,"INVALID_ROLE")
    column="guest_subject" if role=="guest" else "host_subject"
    with db() as c:
        records=c.execute("""SELECT id,state,request_type,deadline,property_id,hold_id
            FROM bnb_booking_request WHERE """+column+"""=%s
            ORDER BY created_at DESC LIMIT 100""",(actor,)).fetchall()
    return [{"id":str(x[0]),"state":("expired" if x[1]=="requested" and
            x[3]<=datetime.now(timezone.utc) else x[1]),
            "type":x[2],"deadline":x[3].isoformat(),
            "property_id":str(x[4]),"hold_id":str(x[5]),
            "confirmed":False} for x in records]


@app.get("/v1/bnb/booking-requests/{request_id}")
def read_booking_request(request_id:UUID,authorization:str|None=Header(None)):
    actor=active_subject(authorization)
    with db() as c:
        row=c.execute("""SELECT guest_subject,host_subject,state,request_type,
            deadline,hold_id FROM bnb_booking_request WHERE id=%s""",(request_id,)).fetchone()
    if not row or actor not in (row[0],row[1]):raise HTTPException(404,"NOT_FOUND")
    effective="expired" if row[2]=="requested" and row[4]<=datetime.now(timezone.utc) else row[2]
    return {"id":str(request_id),"state":effective,"type":row[3],
            "hold_id":str(row[5]),"confirmed":False,"payment_status":"unavailable"}


@app.post("/v1/bnb/reservations/{reservation_id}/expire")
def expire_payment_pending_reservation(reservation_id:UUID,
                                       authorization:str|None=Header(None)):
    actor=active_subject(authorization)
    with db() as c:
        with c.transaction():
            ref=c.execute("SELECT property_id FROM bnb_reservation WHERE id=%s",
                          (reservation_id,)).fetchone()
            if not ref:raise HTTPException(404,"NOT_FOUND")
            host=c.execute("SELECT host_subject FROM bnb_property WHERE id=%s FOR UPDATE",
                           (ref[0],)).fetchone()
            row=c.execute("""SELECT r.hold_id,r.guest_subject,r.status,r.pay_proof_id,
                h.expires_at FROM bnb_reservation r
                JOIN bnb_hold h ON h.id=r.hold_id
                WHERE r.id=%s FOR UPDATE OF r,h""",(reservation_id,)).fetchone()
            if actor not in (row[1],host[0]):raise HTTPException(404,"NOT_FOUND")
            if row[2]=="expired":return {"id":str(reservation_id),"state":"expired",
                                         "confirmed":False}
            if row[2]!="payment_pending" or row[3] is not None:
                raise HTTPException(409,"PAY_FINALITY_RECONCILIATION_REQUIRED")
            if row[4]>datetime.now(timezone.utc):
                raise HTTPException(409,"PAYMENT_DEADLINE_NOT_REACHED")
            c.execute("UPDATE bnb_reservation SET status='expired' WHERE id=%s",
                      (reservation_id,))
            c.execute("""UPDATE bnb_hold SET status='expired'
                WHERE id=%s AND status='held'""",(row[0],))
            c.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
                VALUES (%s,%s,'bnb.reservation.expired',%s)""",
                (uuid4(),actor,ref[0]))
    return {"id":str(reservation_id),"state":"expired","confirmed":False}


@app.post("/v1/bnb/reservations/{reservation_id}/cancel")
def cancel_pending_reservation(reservation_id:UUID,authorization:str|None=Header(None)):
    """Pre-payment cancellation only; canonical funded refunds require 420Pay."""
    actor=active_subject(authorization)
    with db() as c:
        with c.transaction():
            ref=c.execute("SELECT property_id FROM bnb_reservation WHERE id=%s",
                          (reservation_id,)).fetchone()
            if not ref:raise HTTPException(404,"NOT_FOUND")
            prop=c.execute("SELECT host_subject FROM bnb_property WHERE id=%s FOR UPDATE",
                           (ref[0],)).fetchone()
            row=c.execute("""SELECT hold_id,guest_subject,status,booking_request_id
                FROM bnb_reservation WHERE id=%s FOR UPDATE""",(reservation_id,)).fetchone()
            if actor not in (row[1],prop[0]):raise HTTPException(404,"NOT_FOUND")
            if row[2]=="cancelled":return {"id":str(reservation_id),"state":"cancelled",
                                            "refund_status":"not_applicable"}
            if row[2]!="payment_pending":
                raise HTTPException(409,"CANONICAL_PAY_CANCELLATION_REQUIRED")
            c.execute("UPDATE bnb_reservation SET status='cancelled' WHERE id=%s",
                      (reservation_id,))
            c.execute("""UPDATE bnb_hold SET status='cancelled'
                WHERE id=%s AND status='held'""",(row[0],))
            c.execute("""INSERT INTO bnb_audit(id,subject,action,resource_id)
                VALUES (%s,%s,'bnb.reservation.prepayment_cancelled',%s)""",
                (uuid4(),actor,ref[0]))
    return {"id":str(reservation_id),"state":"cancelled",
            "refund_status":"not_applicable","confirmed":False}


@app.post("/v1/bnb/reservations/{reservation_id}/modify")
def modification_requires_new_quote(reservation_id:UUID,authorization:str|None=Header(None)):
    """Never mutate an accepted frozen stay or price in place."""
    actor=active_subject(authorization)
    with db() as c:
        row=c.execute("""SELECT r.guest_subject,p.host_subject FROM bnb_reservation r
            JOIN bnb_property p ON p.id=r.property_id WHERE r.id=%s""",
            (reservation_id,)).fetchone()
    if not row or actor not in row:raise HTTPException(404,"NOT_FOUND")
    raise HTTPException(409,"NEW_QUOTE_AND_REQUEST_REQUIRED")


@app.get("/v1/bnb/reservations/{reservation_id}")
def read_booking_reservation(reservation_id:UUID,authorization:str|None=Header(None)):
    actor=active_subject(authorization)
    with db() as c:
        row=c.execute("""SELECT r.guest_subject,p.host_subject,r.status,
            r.booking_request_id,r.policy_snapshot,r.booking_public_id FROM bnb_reservation r
            JOIN bnb_property p ON p.id=r.property_id WHERE r.id=%s""",
            (reservation_id,)).fetchone()
    if not row or actor not in (row[0],row[1]):raise HTTPException(404,"NOT_FOUND")
    return {"id":str(reservation_id),"booking_public_id":str(row[5]),
            "request_id":str(row[3]),"status":row[2],"confirmed":False,
            "payment_status":"unavailable","policy_snapshot":row[4]}


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
                cached=old[1]
                prior=c.execute("""SELECT status,expires_at FROM bnb_hold
                    WHERE id=%s AND guest_subject=%s""",
                    (cached["id"],subject)).fetchone()
                if not prior:raise HTTPException(409,"IDEMPOTENCY_RESOURCE_MISSING")
                if prior[0]=="held" and prior[1]<=datetime.now(timezone.utc):
                    return {**cached,"status":"expired","confirmed":False}
                if prior[0]=="cancelled":
                    return {**cached,"status":"cancelled","confirmed":False}
                return cached
            configured=c.execute("SELECT 1 FROM bnb_rate_plan WHERE property_id=%s",
                                 (payload.property_id,)).fetchone()
            if configured:
                if not payload.quote_id:raise HTTPException(422,"PRICE_QUOTE_REQUIRED")
                quote=c.execute("""SELECT guest_subject,unit_id,lower(period),upper(period),
                    quantity,expires_at,status,property_version,rate_version,
                    policy_snapshot,calculation FROM bnb_price_quote
                    WHERE id=%s AND property_id=%s FOR UPDATE""",
                    (payload.quote_id,payload.property_id)).fetchone()
                if not quote or quote[0]!=subject:raise HTTPException(404,"QUOTE_NOT_FOUND")
                if quote[5]<=datetime.now(timezone.utc) or quote[6]!="issued":
                    raise HTTPException(409,"QUOTE_EXPIRED_OR_REVOKED")
                if (str(quote[1]) if quote[1] else None)!=payload.unit_id or (
                    quote[2]!=payload.start.astimezone(timezone.utc) or
                    quote[3]!=payload.end.astimezone(timezone.utc) or quote[4]!=payload.units
                ):raise HTTPException(409,"QUOTE_STAY_MISMATCH")
                if payload.policy_snapshot!=json.dumps(quote[9],sort_keys=True,separators=(",",":")):
                    raise HTTPException(409,"QUOTE_POLICY_SNAPSHOT_MISMATCH")
            elif payload.quote_id:
                raise HTTPException(409,"QUOTE_NOT_CONFIGURED")
            unit_capacity=property_row[0]
            if payload.unit_id:
                unit=c.execute("""SELECT quantity FROM bnb_unit
                    WHERE property_id=%s AND id=%s""",
                    (payload.property_id,payload.unit_id)).fetchone()
                if not unit:raise HTTPException(404,"UNIT_NOT_FOUND")
                unit_capacity=unit[0]
            elif c.execute("SELECT 1 FROM bnb_unit WHERE property_id=%s LIMIT 1",
                           (payload.property_id,)).fetchone():
                raise HTTPException(422,"UNIT_SELECTION_REQUIRED")
            used=occupancy_in_window(c,payload.property_id,payload.unit_id,
                                      payload.start,payload.end)
            if used is None:
                raise HTTPException(409,"PROPERTY_BLOCKED")
            if used+payload.units>unit_capacity:
                raise HTTPException(409,"CAPACITY_EXHAUSTED")
            if configured and c.execute("SELECT 1 FROM bnb_hold WHERE quote_id=%s LIMIT 1",
                                        (payload.quote_id,)).fetchone():
                raise HTTPException(409,"QUOTE_ALREADY_CONSUMED")
            uid=uuid4()
            # Explicitly nonbinding quote; no payments permitted in this stage.
            policy=c.execute("SELECT timezone_id,min_nights FROM bnb_listing_policy WHERE property_id=%s",
                             (payload.property_id,)).fetchone()
            if policy:
                from zoneinfo import ZoneInfo
                nights=(payload.end.astimezone(ZoneInfo(policy[0])).date()-
                        payload.start.astimezone(ZoneInfo(policy[0])).date()).days
                if nights<policy[1]:raise HTTPException(422,"MINIMUM_STAY_NOT_MET")
            else:
                nights=(payload.end.date()-payload.start.date()).days
            if nights<=0:raise HTTPException(422,"MINIMUM_NIGHTS")
            total=quote[10]["total_minor"] if configured else nights*property_row[1]*payload.units
            c.execute("""INSERT INTO bnb_hold
                (id,property_id,unit_id,guest_subject,period,units,status,expires_at,
                quote_total_minor,policy_snapshot,quote_id)
                VALUES (%s,%s,%s,%s,tstzrange(%s,%s,'[)'),%s,'held',now()+interval '15 minutes',%s,%s,%s)""",
                (uid,payload.property_id,payload.unit_id,subject,payload.start,payload.end,
                 payload.units,total,payload.policy_snapshot,payload.quote_id))
            result={"id":str(uid),"status":"held","total_minor":total,
                    "payment_status":"unavailable","confirmed":False}
            c.execute("""INSERT INTO bnb_request_dedupe(actor,operation,key,digest,result)
                VALUES (%s,'hold',%s,%s,%s::jsonb)""",
                (subject,idempotency_key,digest,json.dumps(result)))
            c.execute("INSERT INTO bnb_outbox(id,event_type,payload) VALUES (%s,%s,%s::jsonb)",
                      (uuid4(),"bnb.hold.created",json.dumps({"hold_id":str(uid)})))
            return result


@app.post("/v1/bnb/holds/{hold_id}/release")
def release_hold(hold_id:str,authorization:str|None=Header(None)):
    """Owner releases a nonbinding hold atomically; cannot cancel confirmed stays."""
    subject=active_subject(authorization)
    with db() as c:
        with c.transaction():
            ref=c.execute("SELECT property_id,guest_subject FROM bnb_hold WHERE id=%s",
                          (hold_id,)).fetchone()
            if not ref or ref[1]!=subject:raise HTTPException(404,"NOT_FOUND")
            c.execute("SELECT id FROM bnb_property WHERE id=%s FOR UPDATE",(ref[0],))
            row=c.execute("""SELECT status,expires_at FROM bnb_hold WHERE id=%s FOR UPDATE""",
                          (hold_id,)).fetchone()
            if c.execute("""SELECT 1 FROM bnb_booking_request
                WHERE hold_id=%s AND state IN ('requested','accepted') LIMIT 1""",
                (hold_id,)).fetchone():
                raise HTTPException(409,"BOOKING_REQUEST_MUST_BE_RESOLVED")
            if row[0]=="confirmed":raise HTTPException(409,"CONFIRMED_HOLD_PROTECTED")
            if row[0]=="cancelled":return {"id":hold_id,"status":"cancelled"}
            if row[0]!="held" or row[1]<=datetime.now(timezone.utc):
                raise HTTPException(409,"HOLD_NOT_ACTIVE")
            c.execute("UPDATE bnb_hold SET status='cancelled' WHERE id=%s",(hold_id,))
            c.execute("INSERT INTO bnb_audit(id,subject,action,resource_id) VALUES (%s,%s,%s,%s)",
                      (uuid4(),subject,"bnb.hold.released",ref[0]))
    return {"id":hold_id,"status":"cancelled"}


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
