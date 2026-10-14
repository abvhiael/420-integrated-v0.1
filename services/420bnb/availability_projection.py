"""BNB-4.3 authoritative-snapshot availability read model.

Projection never admits a hold or publishes independent calendar/legal authority.
A bounded synchronous refresh holds the property row lock shared by inventory writers.
"""
import hashlib
import json
from datetime import datetime,timezone,timedelta
from uuid import UUID
from fastapi import HTTPException

MAX_WINDOW=timedelta(days=90)
MAX_STALENESS=timedelta(seconds=30)

def refresh(c,property_id,unit_id,start,end,*,occupancy):
    if start.tzinfo is None or end.tzinfo is None or not start<end<=start+MAX_WINDOW:
        raise HTTPException(422,"PROJECTION_WINDOW_INVALID")
    pid=UUID(str(property_id))
    row=c.execute("SELECT status,version,capacity FROM bnb_property WHERE id=%s FOR UPDATE",(pid,)).fetchone()
    if not row or row[0]!="published":
        raise HTTPException(404,"NOT_FOUND")
    if unit_id is None:
        unitkey=UUID(int=0)
        cap=row[2]
        source_unit=None
    else:
        unitkey=UUID(str(unit_id))
        item=c.execute("SELECT quantity FROM bnb_unit WHERE id=%s AND property_id=%s",(unitkey,pid)).fetchone()
        if item is None:raise HTTPException(404,"UNIT_NOT_FOUND")
        cap=item[0]
        source_unit=unitkey
    used=occupancy(c,pid,source_unit,start,end)
    available=0 if used is None else max(0,cap-used)
    # Every refresh re-reads authoritative live state, including hold expiry and
    # signed calendar source freshness; no stale cached value can authorize booking.
    source=json.dumps({"property":str(pid),"unit":str(unitkey),"start":start.isoformat(),
      "end":end.isoformat(),"version":row[1],"used":used,"capacity":cap},sort_keys=True)
    digest=hashlib.sha256(source.encode()).hexdigest()
    projection=c.execute("""INSERT INTO bnb_availability_projection
       (property_id,unit_id,window_start,window_end,property_version,source_revision,source_digest,available)
       VALUES (%s,%s,%s,%s,%s,1,%s,%s)
       ON CONFLICT(property_id,unit_id,window_start,window_end) DO UPDATE SET
         property_version=EXCLUDED.property_version,
         source_revision=bnb_availability_projection.source_revision+1,
         source_digest=EXCLUDED.source_digest,
         available=EXCLUDED.available,calculated_at=now(),invalidated_at=NULL
       RETURNING source_revision,calculated_at""",
       (pid,unitkey,start,end,row[1],digest,available)).fetchone()
    return {"unit_id":str(source_unit) if source_unit else None,"capacity":cap,
       "available":available,"property_version":row[1],"revision":projection[0],
       "as_of":projection[1].isoformat(),"nonbinding":True}

def read(c,property_id,unit_id,start,end,*,expected_version,max_age=MAX_STALENESS):
    if max_age>MAX_STALENESS:raise HTTPException(422,"PROJECTION_AGE_INVALID")
    uid=UUID(str(unit_id)) if unit_id else UUID(int=0)
    row=c.execute("""SELECT p.available,p.source_revision,p.property_version,p.calculated_at,
          p.invalidated_at,b.version,b.status FROM bnb_availability_projection p
          JOIN bnb_property b ON b.id=p.property_id
          WHERE p.property_id=%s AND p.unit_id=%s AND p.window_start=%s AND p.window_end=%s""",
          (UUID(str(property_id)),uid,start,end)).fetchone()
    if not row or row[4] is not None or row[6]!="published" or row[2]!=row[5] or row[2]!=expected_version or datetime.now(timezone.utc)-row[3]>max_age:
        raise HTTPException(503,"PROJECTION_STALE")
    return {"available":row[0],"revision":row[1],"property_version":row[2],
            "as_of":row[3].isoformat(),"nonbinding":True}

def invalidate(c,property_id):
    """Call from property-locked inventory mutation or signed revocation."""
    c.execute("""UPDATE bnb_availability_projection SET invalidated_at=now()
      WHERE property_id=%s AND invalidated_at IS NULL""",(UUID(str(property_id)),))
