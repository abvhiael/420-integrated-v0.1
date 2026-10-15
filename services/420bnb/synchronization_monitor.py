"""BNB-5.11 bounded, payload-free synchronization health.

Database time supplies age measurements, not a client clock. Missing or stale
Search/Travel consumers make the monitored subsystem NOT READY; zero backlog
alone is never evidence of successful synchronization.
"""
from fastapi import HTTPException

REQUIRED=("search","travel")
MAX_SECONDS=3600
def snapshot(conn,*,stale_seconds=300,backlog_limit=100):
    if type(stale_seconds) is not int or not 30<=stale_seconds<=MAX_SECONDS:
        raise HTTPException(422,"MONITOR_STALENESS_BOUNDS")
    if type(backlog_limit) is not int or not 1<=backlog_limit<=10000:
        raise HTTPException(422,"MONITOR_BACKLOG_BOUNDS")
    # No event payloads, user identifiers, addresses or tokens in results.
    row=conn.execute("""SELECT
      count(*) FILTER (WHERE finished IS NULL AND dead_at IS NULL),
      count(*) FILTER (WHERE finished IS NULL AND dead_at IS NULL
          AND lease_until>clock_timestamp()),
      count(*) FILTER (WHERE finished IS NULL AND dead_at IS NULL AND tries>0),
      count(*) FILTER (WHERE dead_at IS NOT NULL),
      coalesce(max(EXTRACT(EPOCH FROM (clock_timestamp()-created_at)))
          FILTER (WHERE finished IS NULL AND dead_at IS NULL),0)::bigint
      FROM (
        SELECT o.delivered_at AS finished,o.dead_lettered_at AS dead_at,
          o.lease_expires_at AS lease_until,o.attempts AS tries,o.created_at
          FROM bnb_outbox o WHERE NOT o.consumer_managed
        UNION ALL
        SELECT d.accepted_at,d.dead_lettered_at,d.lease_expires_at,d.attempts,
          o.created_at FROM bnb_consumer_delivery d JOIN bnb_outbox o ON o.id=d.event_id
      ) work""").fetchone()
    if row is None:raise HTTPException(503,"MONITOR_DATA_UNAVAILABLE")
    clock=conn.execute("""SELECT value FROM bnb_discovery_clock
       WHERE singleton=true""").fetchone()
    if clock is None:raise HTTPException(503,"DISCOVERY_CLOCK_MISSING")
    consumers=conn.execute("""SELECT s.consumer,s.active,s.updated_at,
       (SELECT max(d.accepted_at) FROM bnb_consumer_delivery d
         WHERE d.consumer=s.consumer),
       (SELECT count(*) FROM bnb_consumer_delivery d
         WHERE d.consumer=s.consumer AND d.accepted_at IS NULL
           AND d.dead_lettered_at IS NULL),
       (SELECT count(*) FROM bnb_consumer_delivery d
         WHERE d.consumer=s.consumer AND d.dead_lettered_at IS NOT NULL),
       coalesce((SELECT max(d.subscription_revision) FROM bnb_consumer_delivery d
         WHERE d.consumer=s.consumer AND d.accepted_at IS NOT NULL),0)
       FROM bnb_consumer_subscription s
       WHERE s.consumer=ANY(%s) ORDER BY s.consumer""",(list(REQUIRED),)).fetchall()
    by_name={r[0]:r for r in consumers}
    ack=conn.execute("""SELECT consumer,max(cursor),count(*) FROM bnb_discovery_consumer
      WHERE consumer=ANY(%s) GROUP BY consumer""",(list(REQUIRED),)).fetchall()
    acknowledgments={r[0]:(int(r[1]),int(r[2])) for r in ack}
    alerts=[]
    status={}
    for consumer in REQUIRED:
        rowc=by_name.get(consumer)
        if rowc is None:
            alerts.append(consumer.upper()+"_CONSUMER_MISSING")
            status[consumer]={"configured":False,"active":False,"pending":None,
                "dead_letters":None,"ack_cursor":None,"ack_count":0,"fresh":False}
            continue
        age=conn.execute("""SELECT
          EXTRACT(EPOCH FROM(clock_timestamp()-%s::timestamptz))::bigint,
          CASE WHEN %s::timestamptz IS NULL THEN NULL ELSE
          EXTRACT(EPOCH FROM(clock_timestamp()-%s::timestamptz))::bigint END""",
          (rowc[2],rowc[3],rowc[3])).fetchone()
        last_ack=acknowledgments.get(consumer)
        fresh=bool(rowc[1]) and (int(clock[0])==0 or (
            last_ack is not None and last_ack[0]>=int(clock[0]))) and (
            int(clock[0])==0 or (age[1] is not None and 0<=age[1]<=stale_seconds))
        status[consumer]={"configured":True,"active":bool(rowc[1]),"pending":int(rowc[4]),
            "dead_letters":int(rowc[5]),"ack_cursor":last_ack[0] if last_ack else None,
            "ack_count":last_ack[1] if last_ack else 0,
            "last_accept_age_seconds":age[1],"fresh":fresh}
        if not rowc[1]:alerts.append(consumer.upper()+"_CONSUMER_INACTIVE")
        if int(rowc[5])>0:alerts.append(consumer.upper()+"_DEAD_LETTERS")
        if not fresh:alerts.append(consumer.upper()+"_SYNCHRONIZATION_STALE")
    if int(row[0])>=backlog_limit:alerts.append("DELIVERY_BACKLOG_THRESHOLD")
    if int(row[3])>0:alerts.append("DELIVERY_DEAD_LETTERS")
    if int(row[4])>stale_seconds and int(row[0])>0:alerts.append("DELIVERY_OLDEST_PENDING_STALE")
    alerts=sorted(set(alerts))
    return {"ready":not alerts,"alerts":alerts,"observation_only":True,
        "delivery":{"pending":int(row[0]),"leased":int(row[1]),
        "retrying":int(row[2]),"dead_letters":int(row[3]),
        "oldest_pending_age_seconds":max(0,int(row[4]))},
        "discovery":{"head_cursor":int(clock[0]),"consumers":status},
        "thresholds":{"stale_seconds":stale_seconds,"backlog_limit":backlog_limit}}
