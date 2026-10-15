"""BNB-5.10 signed observation cursor, fault and replay qualification."""
import pytest
from uuid import uuid4
from test_bnb55_discovery_feed import database
from test_bnb32_infrastructure import database as tls_database
import pay_observation_worker as worker

def observation(n,kind="finality"):
    return {"sequence":n,"kind":kind,"payload":{"reservation_id":str(uuid4())},
            "proof":"synthetic-test-proof-does-not-grant-authority",
            "provider_id":"canonical-420Pay-fixture"}

def test_durable_cursor_recovery_and_rejection(database):
    connect,_,_=database
    stream="bnb510-"+uuid4().hex
    items=[observation(1),observation(2)]
    attempted=[]
    def fetch(after,limit):
        return [x for x in items if x["sequence"]>after][:limit]
    def deliver(path,payload,proof):
        attempted.append((path,payload,proof))
        return {"accepted":True}
    outcome=worker.once(connect,stream,fetch,deliver)
    assert outcome["cursor"]==2 and outcome["consumed"]==2
    with connect() as c:assert worker.checkpoint(c,stream)==2
    assert worker.once(connect,stream,fetch,deliver)["consumed"]==0
    assert len(attempted)==2
    with pytest.raises(worker.ReconciliationBlocked,match="PAGE_BOUNDS"):
        worker.once(connect,stream,fetch,deliver,limit=33)

def test_rejected_observation_does_not_advance(database):
    connect,_,_=database
    stream="bnb510-"+uuid4().hex
    original=observation(1)
    with pytest.raises(worker.ReconciliationBlocked,match="PROVIDER_ACCEPTANCE_REQUIRED"):
        worker.once(connect,stream,lambda *_:[original],lambda *_:{"accepted":False})
    with connect() as c:assert worker.checkpoint(c,stream)==0
    with pytest.raises(worker.ReconciliationBlocked,match="OBSERVATION_SEQUENCE_GAP"):
        worker.once(connect,stream,lambda *_:[observation(2)],
                    lambda *_:{"accepted":True})
    with connect() as c:assert worker.checkpoint(c,stream)==0

@pytest.mark.parametrize("value,reason",[
    ({"sequence":1,"kind":"wallet-sign","payload":{},"proof":"x"*30,
      "provider_id":"fixture"},"OBSERVATION_DOMAIN_INVALID"),
    ({"sequence":1,"kind":"finality","payload":{},"proof":"",
      "provider_id":"fixture"},"CANONICAL_PROOF_REQUIRED"),
])
def test_cannot_create_new_payment_authority(value,reason):
    with pytest.raises(worker.ReconciliationBlocked,match=reason):
        worker._observation(value,1)

def test_synthetic_source_gap_and_dedupe_is_fail_closed(database):
    connect,_,_=database
    stream="bnb510-"+uuid4().hex
    item=observation(1)
    with pytest.raises(worker.ReconciliationBlocked,match="OBSERVATION_SEQUENCE_GAP"):
        worker.once(connect,stream,lambda *_:[item,item],
                    lambda *_:{"accepted":True})
    with connect() as c:assert worker.checkpoint(c,stream)==0
