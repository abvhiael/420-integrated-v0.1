"""BNB-5.9 fail-closed operator CLI. No token arguments or env-secret fallbacks.

Usage: python operator_console.py --origin https://ops.example --ca-file /.../ca.pem
       --token-file /.../operator.jwt health
       [dead-letters | reconcile restart | replay EVENT_ID --reason '...']
Only internal operator endpoints, no financial or production-recovery execution.
"""
import argparse
import json
import ssl
import stat
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

class ConsoleError(RuntimeError):pass

def secure_file(name,*,secret=False):
    p=Path(name)
    if not p.is_absolute() or p.is_symlink():raise ConsoleError("CREDENTIAL_MOUNT_INVALID")
    try:
        s=p.stat()
        if not stat.S_ISREG(s.st_mode) or not 0<s.st_size<=65536 or s.st_mode & 0o022:
            raise ConsoleError("CREDENTIAL_MOUNT_INVALID")
        if secret and s.st_mode & 0o077:raise ConsoleError("CREDENTIAL_MOUNT_INVALID")
        return p.read_text().strip()
    except OSError:raise ConsoleError("CREDENTIAL_MOUNT_UNAVAILABLE") from None

def request(origin,ca_file,token_file,operation,event_id=None,reason=None):
    u=urlsplit(origin)
    if (u.scheme!="https" or not u.hostname or u.username or u.password or
        u.query or u.fragment or u.path not in ("","/")):
        raise ConsoleError("OPERATOR_ORIGIN_INVALID")
    routes={"health":("GET","/health"),"dead-letters":("GET","/dead-letters"),
            "reconcile":("GET","/reconciliation/restart"),
            "replay":("POST","/dead-letters/{event_id}/replay")}
    if operation not in routes:raise ConsoleError("OPERATION_INVALID")
    verb,path=routes[operation]
    if operation=="replay":
        try: event_id=str(UUID(str(event_id)))
        except(ValueError,TypeError):raise ConsoleError("EVENT_INVALID") from None
        if not isinstance(reason,str) or not 8<=len(reason)<=200:
            raise ConsoleError("REASON_INVALID")
        path=path.replace("{event_id}",event_id)
    token=secure_file(token_file,secret=True)
    if len(token)>8192 or not token:raise ConsoleError("TOKEN_INVALID")
    secure_file(ca_file)
    context=ssl.create_default_context(cafile=ca_file)
    data=json.dumps({"reason":reason}).encode() if verb=="POST" else None
    req=urllib.request.Request(origin.rstrip("/")+"/v1/bnb/internal/operations"+path,
        method=verb,data=data,headers={"Authorization":"Bearer "+token,
        "Accept":"application/json","Content-Type":"application/json"})
    class DenyRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=context),DenyRedirect())
    try:
        with opener.open(req,timeout=5) as response:
            if response.status not in (200,201):raise ConsoleError("OPERATOR_RESPONSE_INVALID")
            raw=response.read(16385)
            if len(raw)>16384 or not response.headers.get("Content-Type","").startswith("application/json"):
                raise ConsoleError("OPERATOR_RESPONSE_INVALID")
    except (OSError,urllib.error.URLError):
        raise ConsoleError("OPERATOR_NETWORK_UNAVAILABLE") from None
    try:return json.loads(raw)
    except (ValueError,UnicodeDecodeError):raise ConsoleError("OPERATOR_RESPONSE_INVALID") from None

def main(argv=None):
    parser=argparse.ArgumentParser(description="420BnB read-only and fenced operator console")
    parser.add_argument("--origin",required=True)
    parser.add_argument("--ca-file",required=True)
    parser.add_argument("--token-file",required=True)
    parser.add_argument("operation",choices=["health","dead-letters","reconcile","replay"])
    parser.add_argument("event_id",nargs="?")
    parser.add_argument("--reason")
    args=parser.parse_args(argv)
    try:
        result=request(args.origin,args.ca_file,args.token_file,args.operation,args.event_id,args.reason)
        print(json.dumps(result,sort_keys=True))
        return 0
    except ConsoleError as exc:
        print(str(exc),file=sys.stderr)
        return 1

if __name__=="__main__":sys.exit(main())
