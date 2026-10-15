"""BNB-5.8 durable account-scoped device and notification lifecycle.

All functions require an already-verified active account and thread scope at the
API boundary. No external provider or device token collection.
"""
from datetime import datetime,timezone,timedelta
from fastapi import HTTPException

def device_id_ok(device):
    return isinstance(device,str) and 8<=len(device)<=128 and all(
        ch.isascii() and (ch.isalnum() or ch in "-_.") for ch in device)

def active_device(conn,subject,device,*,lock=False):
    if not device_id_ok(device):raise HTTPException(422,"DEVICE_INVALID")
    row=conn.execute("""SELECT notifications_enabled FROM bnb_message_device
      WHERE subject=%s AND device_id=%s AND revoked_at IS NULL
        AND authority_expires_at>clock_timestamp() """+("FOR UPDATE" if lock else ""),
      (subject,device)).fetchone()
    if row is None:raise HTTPException(403,"DEVICE_AUTHORITY_EXPIRED_OR_REVOKED")
    return row[0]

def register(conn,subject,device,expires_at):
    if not device_id_ok(device):raise HTTPException(422,"DEVICE_INVALID")
    if not isinstance(expires_at,datetime) or expires_at.tzinfo is None:
        raise HTTPException(422,"DEVICE_EXPIRY_INVALID")
    now=datetime.now(timezone.utc)
    if not now+timedelta(minutes=1)<expires_at<=now+timedelta(days=30):
        raise HTTPException(422,"DEVICE_EXPIRY_INVALID")
    existing=conn.execute("""SELECT 1 FROM bnb_message_device
      WHERE subject=%s AND device_id=%s AND revoked_at IS NOT NULL""",
      (subject,device)).fetchone()
    if existing:raise HTTPException(409,"DEVICE_REENROLLMENT_REQUIRES_NEW_ID")
    conn.execute("""INSERT INTO bnb_message_device(subject,device_id,authority_expires_at)
        VALUES(%s,%s,%s) ON CONFLICT(subject,device_id) DO UPDATE
        SET authority_expires_at=EXCLUDED.authority_expires_at,updated_at=clock_timestamp()
        WHERE bnb_message_device.revoked_at IS NULL""",(subject,device,expires_at))
    return {"device_id":device,"registered":True,"external_provider":False}

def preferences(conn,subject,device,enabled):
    if type(enabled) is not bool:raise HTTPException(422,"PREFERENCE_INVALID")
    active_device(conn,subject,device,lock=True)
    conn.execute("""UPDATE bnb_message_device
        SET notifications_enabled=%s,updated_at=clock_timestamp()
        WHERE subject=%s AND device_id=%s""",(enabled,subject,device))
    return {"device_id":device,"notifications_enabled":enabled}

def revoke(conn,subject,device):
    active_device(conn,subject,device,lock=True)
    conn.execute("""UPDATE bnb_message_device SET revoked_at=clock_timestamp(),
        updated_at=clock_timestamp() WHERE subject=%s AND device_id=%s""",(subject,device))
    return {"device_id":device,"revoked":True}

def pending(conn,subject,device,*,limit=50):
    enabled=active_device(conn,subject,device)
    if type(limit) is not int or not 1<=limit<=100:
        raise HTTPException(422,"DELIVERY_WINDOW_INVALID")
    if not enabled:return {"notifications_enabled":False,"notices":[],"external_provider":False}
    rows=conn.execute("""SELECT n.id,n.request_id,n.message_id,n.created_at
        FROM bnb_message_notice n
        JOIN bnb_guest_message m ON m.id=n.message_id
        WHERE n.recipient_subject=%s AND n.device_id=%s
          AND n.acknowledged_at IS NULL AND m.moderation_status='visible'
        ORDER BY n.created_at,n.id LIMIT %s""",(subject,device,limit)).fetchall()
    return {"notifications_enabled":True,"external_provider":False,"notices":[
        {"id":str(x[0]),"request_id":str(x[1]),"message_id":str(x[2]),
         "created_at":x[3].isoformat()} for x in rows]}

def ack(conn,subject,device,notice_id):
    active_device(conn,subject,device,lock=True)
    row=conn.execute("""UPDATE bnb_message_notice SET acknowledged_at=clock_timestamp()
        WHERE id=%s AND recipient_subject=%s AND device_id=%s
          AND acknowledged_at IS NULL RETURNING id""",
        (notice_id,subject,device)).fetchone()
    if row:return {"acknowledged":True,"replayed":False}
    known=conn.execute("""SELECT 1 FROM bnb_message_notice WHERE id=%s
         AND recipient_subject=%s AND device_id=%s AND acknowledged_at IS NOT NULL""",
         (notice_id,subject,device)).fetchone()
    if known:return {"acknowledged":True,"replayed":True}
    raise HTTPException(404,"NOTICE_NOT_FOUND")

def enqueue_message(conn,request_id,message_id,sender):
    # Called in the same transaction as body creation. No message bodies or
    # subject identifiers leave the database or enter the general event.
    participants=conn.execute("""SELECT guest_subject,host_subject FROM bnb_booking_request
       WHERE id=%s""",(request_id,)).fetchone()
    if not participants:raise HTTPException(404,"NOT_FOUND")
    for recipient in set(participants)-{sender}:
        conn.execute("""INSERT INTO bnb_message_notice(request_id,message_id,recipient_subject,device_id)
            SELECT %s,%s,d.subject,d.device_id FROM bnb_message_device d
            JOIN bnb_account a ON a.subject=d.subject AND a.state='active'
            WHERE d.subject=%s AND d.revoked_at IS NULL
                AND d.authority_expires_at>clock_timestamp()
                AND d.notifications_enabled
            ON CONFLICT(message_id,recipient_subject,device_id) DO NOTHING""",
            (request_id,message_id,recipient))
