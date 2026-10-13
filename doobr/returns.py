"""R02.10 fail-closed failure/return transitions, deadline and replay controls."""
from datetime import datetime,timedelta,timezone
from hashlib import sha256
from uuid import UUID
from .auth import Denied,Permission,authorize
from .order_commands import command_digest
EDGES={
 "FAIL_DELIVERY":("HANDOFF_PENDING","DELIVERY_FAILED","COURIER","FAILED"),
 "REQUIRE_RETURN":("DELIVERY_FAILED","RETURN_REQUIRED","OPERATOR","RETURN_REQUIRED"),
 "RETURN":("RETURN_REQUIRED","RETURNED","COURIER","RETURNED"),
 "RECONCILE":("RETURNED","RECONCILED","OPERATOR","RECONCILED")}
REASONS=frozenset(("NO_SHOW","RECIPIENT_REJECTED","ID_FAILED","TIMEOUT","UNSAFE_HANDOFF","OTHER_VERIFIED"))
def uuid(v):
 try:return str(UUID(v))
 except (TypeError,ValueError,AttributeError) as e:raise Denied("invalid return identifier") from e
def transition_return(*,connect,issuer,store,token,tenant_id,order_id,command_id,event_id,
 action,expected_revision,reason,policy_ref,deadline_at,proof_ref,authority,encrypt,at=None,retention_seconds=86400):
 at=at or datetime.now(timezone.utc)
 if (at.tzinfo is None or deadline_at.tzinfo is None or action not in EDGES
     or type(expected_revision) is not int or expected_revision<1
     or reason not in REASONS or not isinstance(policy_ref,str) or not 1<=len(policy_ref)<=256
     or not isinstance(proof_ref,str) or not 1<=len(proof_ref)<=256
     or type(retention_seconds) is not int or not 60<=retention_seconds<=2592000):
  raise Denied("invalid return instruction")
 if action=="FAIL_DELIVERY" and deadline_at<=at:raise Denied("unusable return deadline")
 tenant_id,order_id,command_id,event_id=map(uuid,(tenant_id,order_id,command_id,event_id))
 source,target,role,case_state=EDGES[action]
 actor=uuid(authorize(issuer=issuer,store=store,signed_token=token,tenant_id=tenant_id,
    permission=Permission(role,"TRANSITION_ORDER","order:"+order_id),now=at).actor_id)
 fingerprint=sha256("|".join((reason,policy_ref,str(deadline_at),proof_ref,event_id)).encode()).hexdigest()
 digest=command_digest(tenant_id,order_id,actor,action,expected_revision,fingerprint)
 try:
  with connect() as db:
   with db.transaction():
    with db.cursor() as c:
     c.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
     c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
     c.execute("""SELECT state,revision FROM doobr_private.delivery_orders
         WHERE tenant_id=%s AND order_id=%s FOR UPDATE""",(tenant_id,order_id))
     current=c.fetchone()
     if not current:raise Denied("order unavailable")
     c.execute("""SELECT order_id,actor_id,action,target_state,request_digest,expected_revision,applied_revision
        FROM doobr_private.order_commands WHERE tenant_id=%s AND command_id=%s""",(tenant_id,command_id))
     prior=c.fetchone()
     if prior:
      if (str(prior[0])!=order_id or str(prior[1])!=actor or prior[2]!=action
       or bytes(prior[4])!=digest or prior[5]!=expected_revision):
       raise Denied("return command replay substitution")
      return {"state":prior[3],"revision":prior[6],"replay":True}
     if current!=(source,expected_revision):raise Denied("illegal return lifecycle")
     c.execute("""SELECT courier_id FROM doobr_private.dispatch_assignments
         WHERE tenant_id=%s AND order_id=%s AND state='ACTIVE'""",(tenant_id,order_id))
     assigned=c.fetchone()
     if not assigned or (role=="COURIER" and str(assigned[0])!=actor):
      raise Denied("courier assignment missing")
     c.execute("""SELECT reason,carrier_policy_ref,deadline_at,state FROM doobr_private.return_cases
         WHERE tenant_id=%s AND order_id=%s FOR UPDATE""",(tenant_id,order_id))
     case=c.fetchone()
     if action=="FAIL_DELIVERY":
      if case:raise Denied("duplicate return case")
     else:
      if not case or (case[0],case[1],case[2])!=(reason,policy_ref,deadline_at):
       raise Denied("return policy or case mismatch")
      if at>deadline_at and action!="RECONCILE":
       raise Denied("overdue return requires approved escalation")
      if case[3]!=({"REQUIRE_RETURN":"FAILED","RETURN":"RETURN_REQUIRED","RECONCILE":"RETURNED"}[action]):
       raise Denied("return case state conflict")
     if authority.approve(tenant_id=tenant_id,order_id=order_id,actor_id=actor,
        action=action,reason=reason,policy_ref=policy_ref,deadline_at=deadline_at,
        proof_ref=proof_ref,at=at) is not True:
      raise Denied("independent return approval denied")
     ciphertext,key=encrypt(tenant_id=tenant_id,order_id=order_id,action=action,
                            reason=reason,proof_ref=proof_ref,event_id=event_id)
     if not isinstance(ciphertext,bytes) or len(ciphertext)<=28 or not isinstance(key,str) or not key:
      raise Denied("encrypted return proof unavailable")
     if action=="FAIL_DELIVERY":
      c.execute("""INSERT INTO doobr_private.return_cases(tenant_id,order_id,case_id,
          reason,carrier_policy_ref,deadline_at,opened_at,state)
          VALUES(%s,%s,%s,%s,%s,%s,%s,'FAILED')""",
          (tenant_id,order_id,event_id,reason,policy_ref,deadline_at,at))
     else:
      c.execute("""UPDATE doobr_private.return_cases SET state=%s,closed_at=%s
          WHERE tenant_id=%s AND order_id=%s""",
          (case_state,at if action=="RECONCILE" else None,tenant_id,order_id))
     c.execute("""UPDATE doobr_private.delivery_orders SET state=%s,
          revision=revision+1,updated_at=now()
          WHERE tenant_id=%s AND order_id=%s AND state=%s AND revision=%s
          RETURNING revision""",(target,tenant_id,order_id,source,expected_revision))
     updated=c.fetchone()
     if not updated:raise Denied("return transition race")
     c.execute("""INSERT INTO doobr_private.order_commands(tenant_id,command_id,order_id,
         actor_id,action,target_state,request_digest,expected_revision,applied_revision)
         VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
         (tenant_id,command_id,order_id,actor,action,target,digest,expected_revision,updated[0]))
     c.execute("""INSERT INTO doobr_private.return_events(tenant_id,event_id,order_id,
         command_id,actor_id,action,proof_ciphertext,key_version,recorded_at,retention_until)
         VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
         (tenant_id,event_id,order_id,command_id,actor,action,ciphertext,key,at,
          at+timedelta(seconds=retention_seconds)))
     return {"state":target,"revision":updated[0],"replay":False}
 except Denied:raise
 except Exception as exc:raise Denied("return transaction unavailable") from exc
