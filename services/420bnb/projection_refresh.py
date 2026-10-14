"""BNB-5.4 transactional refresh. No transport, publication approval or admission."""
from uuid import UUID
from fastapi import HTTPException
import availability_projection
import discovery_sync

def once(conn, *, occupancy, property_id=None, window_limit=50):
    if conn.autocommit:
        raise ValueError('TRANSACTION_REQUIRED')
    if type(window_limit) is not int or not 1 <= window_limit <= 100:
        raise ValueError('REFRESH_BOUNDS')
    # Lock the property BEFORE the queue: source writers use the same order.
    # SKIP LOCKED permits independent properties and avoids a busy writer stall.
    pid = UUID(str(property_id)) if property_id is not None else None
    row = conn.execute("""SELECT p.id,p.status FROM bnb_property p
        JOIN bnb_projection_work w ON w.property_id=p.id
        WHERE w.next_refresh_at<=clock_timestamp()
          AND (%s::uuid IS NULL OR p.id=%s)
        ORDER BY w.next_refresh_at,p.id LIMIT 1 FOR UPDATE OF p SKIP LOCKED""",
        (pid,pid)).fetchone()
    if not row:
        return False
    pid,status = row
    work = conn.execute("""SELECT requested_revision,completed_revision FROM bnb_projection_work
        WHERE property_id=%s FOR UPDATE""",(pid,)).fetchone()
    # Periodic refresh handles time-only hold expiry and authority/calendar freshness.
    if work[0] == work[1]:
        conn.execute("UPDATE bnb_projection_work SET requested_revision=requested_revision+1 WHERE property_id=%s",(pid,))
        work = (work[0]+1,work[1])
        conn.execute("""UPDATE bnb_availability_projection SET invalidated_at=clock_timestamp()
            WHERE property_id=%s AND invalidated_at IS NULL""",(pid,))
    windows = conn.execute("""SELECT unit_id,window_start,window_end FROM bnb_availability_projection
        WHERE property_id=%s AND invalidated_at IS NOT NULL
        ORDER BY window_start,window_end,unit_id LIMIT %s""",(pid,window_limit)).fetchall()
    retry = False
    for uid,start,end in windows:
        try:
            # Savepoint keeps a stale calendar/suspended listing safely invalidated.
            with conn.transaction():
                availability_projection.refresh(conn,pid,None if uid.int==0 else uid,
                    start,end,occupancy=occupancy)
        except HTTPException as error:
            if error.status_code not in (404,503):
                raise
            if error.status_code == 503:
                # Retain the invalidated window for autonomous recovery; avoid a hot retry loop.
                retry = True
                continue
            # Terminal unavailable view is removed; no stale capacity is advertised.
            conn.execute("""DELETE FROM bnb_availability_projection WHERE property_id=%s
                AND unit_id=%s AND window_start=%s AND window_end=%s""",(pid,uid,start,end))
    discovery_sync.synchronize(conn,pid)
    remaining = conn.execute("""SELECT EXISTS(SELECT 1 FROM bnb_availability_projection
        WHERE property_id=%s AND invalidated_at IS NOT NULL)""",(pid,)).fetchone()[0]
    conn.execute("""UPDATE bnb_projection_work SET completed_revision=CASE WHEN %s
        THEN completed_revision ELSE %s END,
        next_refresh_at=clock_timestamp()+(CASE WHEN %s THEN 0 ELSE 30 END)*interval '1 second'
        WHERE property_id=%s""",(remaining,work[0],remaining and not retry,pid))
    return True
