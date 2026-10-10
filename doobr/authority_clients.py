"""R02.3 authenticated independent service clients; no locally issued authority.

Deployers must independently approve each provider, pin a TLS endpoint and install
separate scoped credentials. Transport authentication is not regulatory approval.
"""
import json
import ssl
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from .auth import Denied
from .retailer import PrepaidProof

class PinnedAuthorityTransport:
    def __init__(self, *, endpoint, credential, issuer, timeout=3.0, opener=None):
        url=urlparse(endpoint)
        if (url.scheme!="https" or not url.hostname or url.username or url.password
            or url.query or url.fragment or not endpoint.endswith("/verify")
            or not credential or not issuer or timeout<=0 or timeout>10):
            raise ValueError("approved HTTPS endpoint, issuer and scoped credential required")
        self.endpoint=endpoint
        self.credential=credential
        self.issuer=issuer
        self.timeout=timeout
        self.opener=opener

    def request(self, body):
        payload=json.dumps(body,sort_keys=True,separators=(",",":")).encode("utf-8")
        request=Request(self.endpoint,data=payload,headers={
            "Content-Type":"application/json","Authorization":"Bearer "+self.credential,
            "Accept":"application/json"},method="POST")
        try:
            if self.opener is None:
                response=urlopen(request,timeout=self.timeout,context=ssl.create_default_context())
            else:
                response=self.opener(request,timeout=self.timeout)
            with response as stream:
                if stream.status!=200:
                    raise Denied("authority refused")
                raw=stream.read(16385)
            if len(raw)>16384:
                raise Denied("authority response oversized")
            answer=json.loads(raw)
            if not isinstance(answer,dict) or answer.get("issuer")!=self.issuer:
                raise Denied("unexpected authority issuer")
            return answer
        except Denied:
            raise
        except Exception as exc:
            raise Denied("trusted authority unavailable") from exc

def _date(value):
    try:
        result=datetime.fromisoformat(value.replace("Z","+00:00"))
        if result.tzinfo is None:
            raise ValueError("timezone required")
        return result
    except (ValueError,AttributeError,TypeError) as exc:
        raise Denied("authority timestamp invalid") from exc

class RetailerLicenceService:
    def __init__(self, transport):self.transport=transport
    def verify_current(self,claim,at):
        r=self.transport.request({
            "operation":"verify-retailer-licence-v1","tenant_id":claim.tenant_id,
            "retailer_id":claim.retailer_id,"legal_entity_ref":claim.legal_entity_ref,
            "licence_id":claim.licence_id,"municipality_ref":claim.municipality_ref,
            "retail_site_ref":claim.retail_site_ref,"evidence_digest":claim.evidence_digest,
            "as_of":at.isoformat()})
        return (r.get("operation")=="verify-retailer-licence-v1"
                and r.get("approved") is True
                and r.get("licence_id")==claim.licence_id
                and r.get("legal_entity_ref")==claim.legal_entity_ref
                and r.get("municipality_ref")==claim.municipality_ref
                and r.get("retail_site_ref")==claim.retail_site_ref
                and r.get("evidence_digest")==claim.evidence_digest
                and r.get("revoked") is False and _date(r.get("expires_at"))>at
                and _date(r.get("verified_at"))<=at)

class CanonicalPrepaidService:
    def __init__(self,transport):self.transport=transport
    def verify_prepaid(self,*,seller_ref,order_ref,at):
        r=self.transport.request({"operation":"verify-prepaid-v1",
            "seller_ref":seller_ref,"retailer_order_ref":order_ref,"as_of":at.isoformat()})
        if r.get("operation")!="verify-prepaid-v1":
            raise Denied("payment authority operation mismatch")
        amount=r.get("amount_minor")
        if type(amount) is not int or amount<=0:
            raise Denied("payment amount invalid")
        return PrepaidProof(r.get("seller_ref"),r.get("retailer_order_ref"),
            r.get("canonical_payment_ref"),amount,r.get("currency"),
            r.get("settled") is True,r.get("reversed") is True,
            _date(r.get("verified_at")))
