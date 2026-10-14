"""BNB-5.5 bounded commit-ordered incremental feeds and authorized resynchronization."""
import hashlib
import json
import re
from uuid import UUID
from fastapi import HTTPException
import discovery_sync

MAX_CURSOR=2**63-1
MAX_CATCHUP=10000

def _consumer(consumer):
    if consumer not in ('search','travel'):
        raise HTTPException(403,'CONSUMER_UNAUTHORIZED')

def _clock(conn):
    row=conn.execute('SELECT value,epoch FROM bnb_discovery_clock WHERE singleton').fetchone()
    if not row:raise HTTPException(503,'DISCOVERY_CLOCK_UNAVAILABLE')
    return row[0],str(row[1])

def _bounds(after,limit):
    if type(after) is not int or not 0<=after<=MAX_CURSOR or type(limit) is not int or not 1<=limit<=50:
        raise HTTPException(422,'PAGE_INVALID')

def _safe(conn,pid,revision,payload):
    # Read-only authority revalidation: no property locks or multi-property writer inversion.
    # Journal identity/revision never changes. A stale visible entry becomes a redacted
    # tombstone; source_digest remains provenance, payload_digest binds returned content.
    row=conn.execute('SELECT version FROM bnb_property WHERE id=%s',(pid,)).fetchone()
    eligible=discovery_sync._eligible(conn,pid) if row else None
    same=eligible and payload.get('visible') is True and (
        payload.get('property_version'),payload.get('title'),payload.get('public_region'),
        payload.get('capacity'),payload.get('place_id'),payload.get('jurisdiction_id')) == (
        eligible[1],eligible[2],eligible[3],eligible[4],eligible[7],eligible[8])
    marker=None if not eligible or eligible[5] is None else {
        'latitude':eligible[5]+.5,'longitude':eligible[6]+.5,'precision':'coarse_1_degree_grid'}
    same=same and payload.get('map_marker')==marker
    if payload.get('visible') and not same:
        return {'property_id':str(pid),'visible':False,
                'property_version':row[0] if row else payload.get('property_version',0)},True
    if same:
        safe={'property_id':str(pid),'visible':True,'property_version':eligible[1],
            'title':eligible[2],'public_region':eligible[3],'capacity':eligible[4],
            'map_marker':marker,'place_id':eligible[7],'jurisdiction_id':eligible[8],
            'nonbinding':True,'booking_enabled':False}
    else:
        safe={'property_id':str(pid),'visible':False,'property_version':payload.get('property_version',row[0] if row else 0)}
    return safe,safe!=payload

def _item(conn,row):
    position,pid,revision,digest,payload=row
    safe,redacted=_safe(conn,pid,revision,payload)
    encoded=json.dumps(safe,sort_keys=True,separators=(',',':'),ensure_ascii=True)
    return {'cursor':position,'property_id':str(pid),'revision':revision,'source_digest':digest,
        'payload':safe,'payload_digest':hashlib.sha256(encoded.encode()).hexdigest(),
        'redacted':redacted}

def page(conn,consumer,*,after=0,limit=50,until=None,epoch=None):
    _consumer(consumer);_bounds(after,limit)
    high,current_epoch=_clock(conn)
    if epoch is not None and epoch!=current_epoch:
        raise HTTPException(409,'DISCOVERY_EPOCH_RESYNC_REQUIRED')
    if until is None:until=high
    if type(until) is not int or not after<=until<=high or after>high:
        raise HTTPException(422,'CURSOR_INVALID')
    if until-after>MAX_CATCHUP:
        raise HTTPException(409,'DISCOVERY_CATCHUP_RESYNC_REQUIRED')
    rows=conn.execute("""SELECT cursor,property_id,revision,source_digest,payload
        FROM bnb_discovery_change WHERE cursor>%s AND cursor<=%s
        ORDER BY cursor LIMIT %s""",(after,until,limit+1)).fetchall()
    selected=rows[:limit]
    more=len(rows)>limit
    # Empty pages advance to captured until; zero rows cannot skip an uncommitted prefix.
    next_cursor=selected[-1][0] if selected else until
    return {'version':'bnb-discovery-feed/v1','consumer':consumer,'epoch':current_epoch,
        'high_watermark':until,'next_cursor':next_cursor,'has_more':more,
        'items':[_item(conn,r) for r in selected],'nonbinding':True,'booking_enabled':False}

def _authorize(consumer,actor,action,authorize):
    _consumer(consumer)
    if not isinstance(actor,str) or not re.fullmatch(r'[A-Za-z0-9_.:@/-]{1,200}',actor):
        raise HTTPException(422,'RESYNC_ACTOR_INVALID')
    if not callable(authorize) or authorize(actor,action,consumer) is not True:
        raise HTTPException(403,'RESYNC_AUTHORITY_REQUIRED')

def begin_resync(conn,consumer,*,actor,request_key,authorize=None):
    _authorize(consumer,actor,'resync',authorize)
    if conn.autocommit:raise HTTPException(503,'TRANSACTION_REQUIRED')
    if not isinstance(request_key,str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{8,200}',request_key):
        raise HTTPException(422,'RESYNC_KEY_INVALID')
    high,epoch=_clock(conn)
    conn.execute("""INSERT INTO bnb_discovery_resync(consumer,actor,request_key,epoch,watermark)
        VALUES(%s,%s,%s,%s,%s) ON CONFLICT(consumer,actor,request_key) DO NOTHING""",
        (consumer,actor,request_key,epoch,high))
    row=conn.execute("""SELECT id,watermark,epoch,expires_at,
        expires_at>clock_timestamp() FROM bnb_discovery_resync
        WHERE consumer=%s AND actor=%s AND request_key=%s""",(consumer,actor,request_key)).fetchone()
    if not row[4] or str(row[2])!=epoch:raise HTTPException(409,'RESYNC_EXPIRED_OR_EPOCH_CHANGED')
    return {'id':str(row[0]),'consumer':consumer,'epoch':epoch,'high_watermark':row[1],
        'expires_at':row[3].isoformat(),'reset_required':True,'nonbinding':True}

def resync_page(conn,consumer,resync_id,*,actor,after_property=None,limit=50,authorize=None):
    _authorize(consumer,actor,'resync-read',authorize);_bounds(0,limit)
    try:
        sid=UUID(str(resync_id));last=UUID(str(after_property)) if after_property else None
    except (ValueError,TypeError):raise HTTPException(422,'RESYNC_CURSOR_INVALID') from None
    _,epoch=_clock(conn)
    session=conn.execute("""SELECT watermark,epoch FROM bnb_discovery_resync
        WHERE id=%s AND consumer=%s AND actor=%s AND expires_at>clock_timestamp()""",
        (sid,consumer,actor)).fetchone()
    if not session:raise HTTPException(403,'RESYNC_SESSION_NOT_AUTHORIZED')
    if str(session[1])!=epoch:raise HTTPException(409,'DISCOVERY_EPOCH_RESYNC_REQUIRED')
    rows=conn.execute("""SELECT cursor,property_id,revision,source_digest,payload FROM
        (SELECT DISTINCT ON(property_id) cursor,property_id,revision,source_digest,payload
         FROM bnb_discovery_change WHERE cursor<=%s AND (%s::uuid IS NULL OR property_id>%s)
         ORDER BY property_id,cursor DESC) latest ORDER BY property_id LIMIT %s""",
        (session[0],last,last,limit+1)).fetchall()
    selected=rows[:limit];more=len(rows)>limit
    return {'version':'bnb-discovery-resync/v1','id':str(sid),'consumer':consumer,'epoch':epoch,
        'high_watermark':session[0],'next_property':str(selected[-1][1]) if selected else after_property,
        'has_more':more,'items':[_item(conn,r) for r in selected],
        'resume_after':None if more else session[0],'reset_required':True,'nonbinding':True}
