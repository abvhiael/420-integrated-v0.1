"""BNB-4.4 independently authorized, privacy-safe Search/Travel projection.

No external notification or live publication. Consumers pull monotone revisions from
this local outbox and must reject stale revisions. Every snapshot rechecks current
property, location and compliance authority; revocation produces a tombstone.
"""
import hashlib
import json
from uuid import UUID
from fastapi import HTTPException

def _eligible(conn, property_id):
    return conn.execute("""SELECT p.id,p.version,p.title,p.public_region,p.capacity,
       b.marker_grid_lat,b.marker_grid_lon,b.place_id,b.jurisdiction_id
       FROM bnb_property p
       JOIN bnb_travel_place_binding b ON b.property_id=p.id
       JOIN bnb_compliance_eligibility e ON e.property_id=p.id AND e.jurisdiction_id=b.jurisdiction_id
       JOIN bnb_travel_jurisdiction_policy j ON j.jurisdiction_id=b.jurisdiction_id
       WHERE p.id=%s AND p.status='published'
         AND b.revoked_at IS NULL AND b.property_version=p.version AND b.proof_expires_at>now()
         AND e.decision='allowed' AND e.revoked_at IS NULL AND e.property_version=p.version
         AND e.effective_at<=now() AND e.expires_at>now()
         AND j.decision='allowed' AND j.revoked_at IS NULL
         AND j.effective_at<=now() AND j.expires_at>now()
       LIMIT 1""",(UUID(str(property_id)),)).fetchone()

def snapshot(conn,property_id):
    """Recheck all independent authorities under the property mutation lock."""
    pid=UUID(str(property_id))
    prop=conn.execute("SELECT version FROM bnb_property WHERE id=%s FOR UPDATE",(pid,)).fetchone()
    if prop is None:raise HTTPException(404,"NOT_FOUND")
    row=_eligible(conn,pid)
    if row is None:
        return {"property_id":str(pid),"visible":False,"property_version":prop[0]}
    coarse=None
    if row[5] is not None and row[6] is not None:
        coarse={"latitude":row[5]+0.5,"longitude":row[6]+0.5,"precision":"coarse_1_degree_grid"}
    return {"property_id":str(pid),"visible":True,"property_version":row[1],
            "title":row[2],"public_region":row[3],"capacity":row[4],
            "map_marker":coarse,"place_id":row[7],"jurisdiction_id":row[8],
            "nonbinding":True,"booking_enabled":False}

def synchronize(conn,property_id):
    if conn.autocommit:raise HTTPException(503,"TRANSACTION_REQUIRED")
    record=snapshot(conn,property_id)
    pid=UUID(record["property_id"])
    canonical=json.dumps(record,sort_keys=True,separators=(",",":"),ensure_ascii=True)
    digest=hashlib.sha256(canonical.encode()).hexdigest()
    prior=conn.execute("""SELECT revision,source_digest,payload FROM bnb_discovery_projection
             WHERE property_id=%s FOR UPDATE""",(pid,)).fetchone()
    if prior and prior[1]==digest:
        return {"revision":prior[0],"changed":False,"payload":prior[2]}
    previous=conn.execute("SELECT COALESCE(max(revision),0) FROM bnb_discovery_change WHERE property_id=%s",(pid,)).fetchone()[0]
    row=conn.execute("""INSERT INTO bnb_discovery_projection
        (property_id,revision,source_digest,payload)
        VALUES(%s,%s,%s,%s::jsonb)
        ON CONFLICT(property_id) DO UPDATE
          SET revision=bnb_discovery_projection.revision+1,
              source_digest=EXCLUDED.source_digest,payload=EXCLUDED.payload,updated_at=now()
        RETURNING revision""",(pid,previous+1,digest,canonical)).fetchone()
    # Immutable redacted event; revisions are per-property strictly monotone.
    event=json.dumps({"property_id":str(pid),"revision":row[0],"visible":record["visible"],
                     "digest":digest},sort_keys=True)
    conn.execute("""INSERT INTO bnb_outbox(id,event_type,payload)
                    VALUES(gen_random_uuid(),'bnb.discovery.changed',%s::jsonb)""",(event,))
    return {"revision":row[0],"changed":True,"payload":record}

def consume(conn,property_id,consumer,revision,payload):
    """Local consumer checkpoint; stale/replayed and forged content cannot publish."""
    if consumer not in ("search","travel"):raise HTTPException(403,"CONSUMER_UNAUTHORIZED")
    if type(revision) is not int or revision<1:raise HTTPException(422,"REVISION_INVALID")
    pid=UUID(str(property_id))
    # Admission must revalidate current authority even while durable refresh is pending.
    # The property lock serializes this check with every source mutation/refresh.
    current=snapshot(conn,pid)
    source=conn.execute("SELECT revision,payload FROM bnb_discovery_projection WHERE property_id=%s",(pid,)).fetchone()
    if source is None or revision!=source[0] or payload!=source[1]:
        raise HTTPException(409,"SOURCE_REVISION_STALE")
    if payload!=current:
        raise HTTPException(409,"SOURCE_AUTHORITY_STALE")
    old=conn.execute("""SELECT revision FROM bnb_discovery_consumer
                       WHERE property_id=%s AND consumer=%s FOR UPDATE""",(pid,consumer)).fetchone()
    if old and revision<=old[0]:
        raise HTTPException(409,"CONSUMER_REPLAY")
    conn.execute("""INSERT INTO bnb_discovery_consumer(property_id,consumer,revision,payload)
        VALUES(%s,%s,%s,%s::jsonb) ON CONFLICT(property_id,consumer) DO UPDATE SET
        revision=EXCLUDED.revision,payload=EXCLUDED.payload,updated_at=now()""",
        (pid,consumer,revision,json.dumps(payload)))
    return {"accepted":True,"revision":revision,"visible":payload["visible"]}

def safe_feed(conn,consumer,after=0,limit=50):
    """Compatibility list; after is now a GLOBAL change cursor, never a property revision."""
    from discovery_feed import page
    return page(conn,consumer,after=after,limit=limit)['items']
