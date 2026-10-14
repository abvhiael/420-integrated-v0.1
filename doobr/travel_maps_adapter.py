"""Read-only service boundary used by 420Travel/Maps; not a transaction gateway."""
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlsplit,parse_qs
from .auth import Denied
from .presence_service import read_travel_maps_region

def make_handler(*, audience_token, load_region, policy_authority, tenant_id):
    """Token provisioned by private service operator. No browser-side credentials."""
    if not audience_token or not tenant_id:
        raise ValueError("service-to-service authorization required")
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            parsed=urlsplit(self.path)
            args=parse_qs(parsed.query,strict_parsing=True)
            if (parsed.path!="/v1/travel-maps/regions" or set(args)!={"region_id"}
                or len(args["region_id"])!=1):
                return self._error(404)
            if self.headers.get("Authorization")!="Bearer "+audience_token:
                return self._error(403)
            try:
                result=read_travel_maps_region(load_region=load_region,
                    tenant_id=tenant_id,region_id=args["region_id"][0],
                    policy_authority=policy_authority)
                payload=json.dumps(result,sort_keys=True).encode()
                self.send_response(200)
                self.send_header("Content-Type","application/json")
                self.send_header("Cache-Control","private, no-store")
                self.send_header("Content-Length",str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            except (Denied,ValueError,KeyError):
                self._error(503)
        def do_POST(self):self._error(405)
        def do_PUT(self):self._error(405)
        def do_DELETE(self):self._error(405)
        def _error(self,status):
            self.send_response(status)
            self.send_header("Cache-Control","no-store")
            self.send_header("Content-Length","0")
            self.end_headers()
        def log_message(self,fmt,*args):pass # Avoid logging bearer tokens/query PII.
    return Handler
