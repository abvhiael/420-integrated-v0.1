"""R04.9 read-only 420Pay accounting and canonical Dev Compensation Vault boundary.
No transfers, refunds, custody, local fee creation or live checkout.
"""
from dataclasses import dataclass
from datetime import datetime,timezone
from .auth import Denied
from .retailer import AuthorizedRetailOrder
from .pay_receipt_adapter import verify_prepaid_settlement

@dataclass(frozen=True)
class SettlementAccounting:
 issuer:str
 payment_ref:str
 currency:str
 gross_minor:int
 retailer_minor:int
 delivery_minor:int
 dev_vault_minor:int
 platform_minor:int
 vault_ref:str
 cancelled:bool
 refunded_minor:int
 callback_id:str
 recorded_at:datetime

def verify_payment_accounting(*,retail_order,pay_authority,accounting_authority,
      approved_pay_issuers,approved_accounting_issuers,canonical_vault_ref,
      callbacks,now=None):
 now=now or datetime.now(timezone.utc)
 if (not isinstance(retail_order,AuthorizedRetailOrder) or
     not isinstance(now,datetime) or now.tzinfo is None or
     not isinstance(canonical_vault_ref,str) or not canonical_vault_ref or
     not approved_accounting_issuers):
  raise Denied("invalid conservation context")
 # 420Pay is independently verified before any event is recorded.
 receipt=verify_prepaid_settlement(retail_order=retail_order,pay_authority=pay_authority,
     approved_issuers=approved_pay_issuers,now=now)
 try:
  record=accounting_authority.verify_accounting(
     payment_ref=receipt.payment_ref,at=now)
  if not isinstance(record,SettlementAccounting):raise Denied("invalid canonical accounting")
  amounts=(record.gross_minor,record.retailer_minor,record.delivery_minor,
           record.dev_vault_minor,record.platform_minor,record.refunded_minor)
  if (record.issuer not in approved_accounting_issuers or
      record.payment_ref!=receipt.payment_ref or record.currency!=receipt.currency or
      record.gross_minor!=receipt.amount_minor or
      any(type(n) is not int or n<0 for n in amounts) or
      record.gross_minor!=sum(amounts[1:5])+record.refunded_minor or
      record.refunded_minor>record.gross_minor or
      record.vault_ref!=canonical_vault_ref or
      record.cancelled is not False and record.cancelled is not True or
      (record.cancelled and record.refunded_minor!=record.gross_minor) or
      not record.callback_id or len(record.callback_id)>128 or
      not isinstance(record.recorded_at,datetime) or
      record.recorded_at.tzinfo is None or record.recorded_at>now):
   raise Denied("non-conserving or untrusted canonical accounting")
  if accounting_authority.verify_vault_route(payment_ref=record.payment_ref,
       vault_ref=canonical_vault_ref,amount_minor=record.dev_vault_minor,at=now) is not True:
   raise Denied("canonical vault route missing")
  if accounting_authority.verify_refund(payment_ref=record.payment_ref,
       amount_minor=record.refunded_minor,cancelled=record.cancelled,at=now) is not True:
   raise Denied("canonical refund or cancellation unverified")
  # Atomic, durable unique receipt on (tenant,payment_ref,callback_id) required.
  # A false duplicate must NOT trigger another downstream economic side effect.
  fresh=callbacks.record_once(tenant_id=retail_order.tenant_id,
      payment_ref=record.payment_ref,callback_id=record.callback_id,at=now)
  if fresh is not True:raise Denied("duplicate callback or accounting ledger unavailable")
  return record
 except Denied:raise
 except Exception as exc:raise Denied("canonical accounting unavailable") from exc
