"""BNB-5.6 isolated network consumer delivery adapter (never production-enabled).

Only explicitly injected HTTPS endpoints and an independent proof provider can
operate this adapter. No endpoint discovery, token minting or default fallback.
"""
import json
import ssl
import urllib.request
import urllib.error
from urllib.parse import urlsplit
from uuid import UUID
import discovery_transport as transport
import discovery_feed
from fastapi import HTTPException

class TransportUnavailable(RuntimeError):
    pass

class NetworkDiscoveryDelivery:
    def __init__(self, connect, consumer, endpoint, proof_provider, *, ssl_context, timeout=3):
        if consumer not in transport.CONSUMERS or not isinstance(endpoint,str):
            raise ValueError("CONSUMER_INVALID")
        url=urlsplit(endpoint)
        if (url.scheme!="https" or not url.hostname or url.username or url.password
                or url.fragment or url.query or url.port is None or url.path!="/v1/discovery/accept"):
            raise ValueError("CONSUMER_ENDPOINT_INVALID")
        if not isinstance(ssl_context,ssl.SSLContext) or ssl_context.verify_mode!=ssl.CERT_REQUIRED or not ssl_context.check_hostname:
            raise ValueError("CONSUMER_TLS_REQUIRED")
        if not callable(proof_provider) or type(timeout) not in (int,float) or not 0.1<=timeout<=10:
            raise ValueError("CONSUMER_TRANSPORT_CONFIG_INVALID")
        self.connect,self.consumer,self.endpoint,self.proof_provider=connect,consumer,endpoint,proof_provider
        self.ssl_context,self.timeout=ssl_context,timeout

    def accept(self,event_id,encoded):
        try:
            event=json.loads(encoded)
            if str(UUID(event_id))!=event["id"] or event["type"]!="bnb.discovery.changed":
                raise ValueError()
            pid=str(UUID(event["payload"]["property_id"]))
            with self.connect() as conn:
                row=conn.execute("""SELECT cursor,property_id,revision,source_digest,payload
                  FROM bnb_discovery_change WHERE property_id=%s AND revision=%s""",
                  (pid,event["payload"]["revision"])).fetchone()
                if not row:raise ValueError()
                safe=discovery_feed._item(conn,row)
                high,epoch=discovery_feed._clock(conn)
                if safe["cursor"]>high:raise ValueError()
                body=transport.envelope(self.consumer,safe,epoch)
            proof=self.proof_provider(self.consumer,body)
            if not isinstance(proof,str) or not proof or len(proof)>8192:
                raise ValueError()
            data=transport.canonical(body).encode()
            request=urllib.request.Request(self.endpoint,data=data,method="POST",headers={
                "Content-Type":"application/json","X-Discovery-Proof":proof,
                "Accept":"application/json"})
            # Refuse redirect: must not leak signed assertions or discovery payloads.
            class NoRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self,*args,**kwargs):
                    return None
            opener=urllib.request.build_opener(
                urllib.request.HTTPSHandler(context=self.ssl_context),NoRedirect())
            with opener.open(request,timeout=self.timeout) as response:
                if response.status!=201 or response.headers.get("Content-Type","").split(";")[0].strip()!="application/json":
                    raise ValueError()
                raw=response.read(8193)
                if len(raw)>8192:raise ValueError()
            receipt=json.loads(raw)
            if (receipt.get("consumer")!=self.consumer or
                receipt.get("transport_digest")!=body["transport_digest"] or
                receipt.get("transactional_acceptance") is not True or
                receipt.get("external_acceptance") is not False):
                raise ValueError()
            # Repository-controlled fixture acknowledges post-commit; not an
            # independently signed real provider receipt.
            return transport._digest({"event_id":event_id,"consumer":self.consumer,
                                     "transport_digest":body["transport_digest"]})
        except (ValueError,KeyError,TypeError,HTTPException,urllib.error.URLError,
                OSError,TimeoutError,json.JSONDecodeError) as exc:
            raise TransportUnavailable("CONSUMER_DELIVERY_UNAVAILABLE") from None
