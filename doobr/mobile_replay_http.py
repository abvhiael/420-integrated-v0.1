"""R03.9 private WSGI HTTP ingress. Mount only behind authenticated private TLS.

trusted_transport verifies TLS-bound origin, CSRF and device proof from connection
metadata. The caller's JSON cannot set trust flags or tenant identity.
"""
import json
from datetime import datetime,timezone
from .auth import Denied
from .mobile_replay_api import ReplayRequest,handle_replay
MAX_BODY=8192

def create_app(*,trusted_transport,identity,ledger,clock=lambda:datetime.now(timezone.utc)):
 def app(environ,start_response):
  try:
   length=environ.get("CONTENT_LENGTH","")
   if (environ.get("REQUEST_METHOD")!="POST"
       or environ.get("PATH_INFO")!="/private/v1/mobile/replay"
       or environ.get("CONTENT_TYPE","").split(";")[0].strip()!="application/json"
       or not length.isdigit() or not 0<int(length)<=MAX_BODY):
    raise Denied("invalid private replay request")
   # The verifier must validate platform ingress metadata/headers; it must not
   # accept JSON claims as authentication or authorization.
   claims=trusted_transport.authenticate(environ=environ)
   if not isinstance(claims,dict) or set(claims)!={"tenant_id","device_id","bearer_token","origin_ok","device_ok","csrf_ok"}:
    raise Denied("invalid trusted transport claims")
   raw=environ["wsgi.input"].read(int(length))
   data=json.loads(raw)
   if not isinstance(data,dict) or set(data)!={"commands"} or not isinstance(data["commands"],list):
    raise Denied("invalid replay payload")
   commands=[]
   for item in data["commands"]:
    if not isinstance(item,dict) or set(item)!={"command_id","kind","opaque_ref","created_at"}:
     raise Denied("unexpected replay command")
    try:created_at=datetime.fromisoformat(item["created_at"])
    except (ValueError,TypeError):raise Denied("invalid replay timestamp")
    commands.append(dict(item,created_at=created_at))
   request=ReplayRequest(method="POST",path="/private/v1/mobile/replay",
    bearer_token=claims["bearer_token"],tenant_id=claims["tenant_id"],
    device_id=claims["device_id"],commands=commands,
    trusted_origin=claims["origin_ok"],trusted_device=claims["device_ok"],
    trusted_csrf=claims["csrf_ok"])
   result=handle_replay(request=request,identity=identity,ledger=ledger,at=clock())
   payload=json.dumps(result,separators=(",",":")).encode()
   start_response("200 OK",[("Content-Type","application/json"),("Cache-Control","no-store"),
     ("Content-Length",str(len(payload))),("X-Content-Type-Options","nosniff")])
   return [payload]
  except (Denied,ValueError,TypeError,KeyError,UnicodeDecodeError,json.JSONDecodeError):
   payload=b'{"error":"replay denied"}'
   start_response("403 Forbidden",[("Content-Type","application/json"),("Cache-Control","no-store"),
    ("Content-Length",str(len(payload))),("X-Content-Type-Options","nosniff")])
   return [payload]
  except Exception:
   payload=b'{"error":"replay unavailable"}'
   start_response("503 Service Unavailable",[("Content-Type","application/json"),("Cache-Control","no-store"),
    ("Content-Length",str(len(payload)))])
   return [payload]
 return app
