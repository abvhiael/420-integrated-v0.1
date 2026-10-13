"""R04.8 trusted routing to 420Notifications and 420Arbitration.
No local delivery of notifications or adjudication authority.
"""
from dataclasses import dataclass
from datetime import datetime,timezone
from .auth import Denied

@dataclass(frozen=True)
class RouteReceipt:
 issuer:str
 tenant_id:str
 case_ref:str
 event_ref:str
 service:str
 status:str
 issued_at:datetime

def route_reference(*,service,tenant_id,case_ref,event_ref,category,
                    router,approved_issuers,now=None):
 now=now or datetime.now(timezone.utc)
 if (service not in ("NOTIFICATIONS","ARBITRATION")
   or not isinstance(now,datetime) or now.tzinfo is None
   or not approved_issuers
   or any(not isinstance(s,str) or not 1<=len(s)<=128
          or not all(c.isalnum() or c in "-_:" for c in s)
          for s in (tenant_id,case_ref,event_ref))
   or category not in ({"ORDER_STATE","SAFETY_NOTICE","RETURN_NOTICE"}
                       if service=="NOTIFICATIONS" else
                       {"DELIVERY_DISPUTE","CUSTODY_DISPUTE","REFUND_DISPUTE"})):
  raise Denied("untrusted canonical route request")
 try:
  result=router.submit_reference(service=service,tenant_id=tenant_id,
      case_ref=case_ref,event_ref=event_ref,category=category,at=now)
  if (not isinstance(result,RouteReceipt) or result.issuer not in approved_issuers
    or result.tenant_id!=tenant_id or result.case_ref!=case_ref
    or result.event_ref!=event_ref or result.service!=service
    or result.status!="ACCEPTED" or not isinstance(result.issued_at,datetime)
    or result.issued_at.tzinfo is None or result.issued_at>now):
   raise Denied("unverified route receipt")
  return result
 except Denied:raise
 except Exception as exc:raise Denied("canonical notification/arbitration unavailable") from exc
