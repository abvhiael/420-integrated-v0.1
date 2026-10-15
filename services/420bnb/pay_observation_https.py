"""BNB-5.10 independently provisioned verified TLS Pay observation adapters.

No local proof minting. The canonical source provides original 420Pay signed
observation and BnB ingests that exact proof using existing strict endpoints.
No redirects, provider-side signing, broadcast or custody.
"""
import json
import ssl
import urllib.request
import urllib.error
from urllib.parse import urlsplit
from . import pay_observation_worker as worker

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

class SignedObservationHTTPS:
    def __init__(self,source_url,bnb_url,*,ca_file,source_token=None):
        for url in (source_url,bnb_url):
            parts=urlsplit(url)
            if (parts.scheme!="https" or not parts.hostname or parts.username or
                parts.password or parts.query or parts.fragment):
                raise worker.ReconciliationBlocked("HTTPS_DESTINATION_REQUIRED")
        if not isinstance(ca_file,str) or not ca_file:
            raise worker.ReconciliationBlocked("TLS_AUTHORITY_REQUIRED")
        self.source=source_url.rstrip("/")
        self.bnb=bnb_url.rstrip("/")
        self.token=source_token
        self.client=urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile=ca_file)),
            NoRedirect())
    def _json(self,url,*,body=None,headers=None):
        request=urllib.request.Request(url,data=body,
            headers=headers or {"Accept":"application/json"},
            method="POST" if body is not None else "GET")
        try:
            with self.client.open(request,timeout=10) as response:
                if response.status not in (200,202):
                    raise worker.ReconciliationBlocked("HTTPS_STATUS_INVALID")
                if not response.headers.get("Content-Type","").startswith("application/json"):
                    raise worker.ReconciliationBlocked("HTTPS_MEDIA_TYPE_INVALID")
                raw=response.read(262145)
                if len(raw)>262144:raise worker.ReconciliationBlocked("HTTPS_BODY_TOO_LARGE")
                return response.status,json.loads(raw)
        except (urllib.error.URLError,ValueError,UnicodeError):
            raise worker.ReconciliationBlocked("HTTPS_TRANSPORT_REJECTED") from None
    def fetch(self,after,limit):
        if type(after) is not int or after<0 or type(limit) is not int or not 1<=limit<=worker.MAX_PAGE:
            raise worker.ReconciliationBlocked("PAGE_BOUNDS")
        from urllib.parse import urlencode
        headers={"Accept":"application/json"}
        if self.token:
            headers["Authorization"]="Bearer "+self.token
        _,response=self._json(self.source+"?"+urlencode({"after":after,"limit":limit}),headers=headers)
        if not isinstance(response,dict) or not isinstance(response.get("observations"),list):
            raise worker.ReconciliationBlocked("SOURCE_PAGE_INVALID")
        return response["observations"]
    def deliver(self,path,payload,proof):
        if path not in worker.KINDS.values():
            raise worker.ReconciliationBlocked("CANONICAL_INGRESS_REQUIRED")
        if not isinstance(proof,str) or not proof:
            raise worker.ReconciliationBlocked("PAY_PROOF_REQUIRED")
        status,_=self._json(self.bnb+path,body=json.dumps(payload,separators=(",",":"),
            allow_nan=False).encode(),headers={"Content-Type":"application/json",
            "Accept":"application/json","X-Pay-Authority-Proof":proof})
        return {"accepted":status==202}
