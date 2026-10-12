"""R04.4: read-only verification of retailer prepaid order and canonical 420Pay receipt.
This adapter cannot charge, transfer, refund, mint tokens or hold client funds.
"""
from dataclasses import dataclass
from datetime import datetime,timezone
from .auth import Denied
from .retailer import AuthorizedRetailOrder

@dataclass(frozen=True)
class PayReceipt:
 issuer:str
 seller_ref:str
 retailer_order_ref:str
 payment_ref:str
 amount_minor:int
 currency:str
 status:str
 reversed:bool
 verified_at:datetime

def verify_prepaid_settlement(*,retail_order,pay_authority,approved_issuers,now=None):
 now=now or datetime.now(timezone.utc)
 if (not isinstance(retail_order,AuthorizedRetailOrder) or not isinstance(now,datetime)
     or now.tzinfo is None or not approved_issuers):
  raise Denied("invalid pay verification context")
 try:
  receipt=pay_authority.verify_receipt(
   seller_ref=retail_order.seller_ref,
   retailer_order_ref=retail_order.retailer_order_ref,
   payment_ref=retail_order.payment_ref,at=now)
  if (not isinstance(receipt,PayReceipt) or receipt.issuer not in approved_issuers
      or receipt.seller_ref!=retail_order.seller_ref
      or receipt.retailer_order_ref!=retail_order.retailer_order_ref
      or receipt.payment_ref!=retail_order.payment_ref
      or type(receipt.amount_minor) is not int
      or receipt.amount_minor<=0 or receipt.amount_minor!=retail_order.amount_minor
      or receipt.currency!=retail_order.currency
      or receipt.status!="SETTLED" or receipt.reversed is not False
      or not isinstance(receipt.verified_at,datetime)
      or receipt.verified_at.tzinfo is None or receipt.verified_at>now):
   raise Denied("canonical prepaid settlement not independently verified")
  return receipt
 except Denied:raise
 except Exception as exc:raise Denied("canonical pay authority unavailable") from exc
