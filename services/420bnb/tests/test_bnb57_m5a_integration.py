"""BNB-5.7 M5-A: source-to-refresh-to-fanout and retraction integration.

Runs with real verified-TLS PostgreSQL, migration ledger and retained app tests.
The separate BNB-5.6 HTTPS suite owns network/TLS/signed receipt coverage.
"""
import pytest
from fastapi import HTTPException
from test_bnb55_discovery_feed import database, property_row
from test_bnb32_infrastructure import database as tls_database
from api import occupancy_in_window
import consumer_delivery
import discovery_feed
import discovery_sync
import projection_refresh


def test_m5a_source_mutation_refresh_journal_and_two_consumer_checkpoints(database):
    connect,_,_=database
    def authority(actor,action,target):
        return actor=="m5a-fixture" and action=="configure" and target in ("search","travel")
    with connect() as c:
        for consumer in ("search","travel"):
            consumer_delivery.configure(c,consumer,["bnb.discovery.changed"],
                active=True,expected_revision=0,actor="m5a-fixture",authorize=authority)
        pid=property_row(c)
        # The source mutation, refresh request and resulting discovery publication
        # are deliberately in separate durable transactions.
    with connect() as c:
        assert projection_refresh.once(c,occupancy=occupancy_in_window,property_id=pid)
    with connect() as c:
        initial=discovery_feed.page(c,"search")
        assert len(initial["items"])==1
        assert initial["items"][0]["revision"]==1
        assert initial["items"][0]["payload"]["visible"] is False
        before=c.execute("SELECT requested_revision,completed_revision FROM bnb_projection_work WHERE property_id=%s",(pid,)).fetchone()
        assert before[0]==before[1]
        for consumer in ("search","travel"):
            assert discovery_feed.page(c,consumer)["items"][0]["property_id"]==str(pid)
    # A source update invalidates the projection transactionally; before a
    # refresh the next revision cannot appear in the externally consumable feed.
    with connect() as c:
        c.execute("UPDATE bnb_property SET version=version+1 WHERE id=%s",(pid,))
    with connect() as c:
        assert len(discovery_feed.page(c,"search")["items"])==1
        assert projection_refresh.once(c,occupancy=occupancy_in_window,property_id=pid)
    with connect() as c:
        events=discovery_feed.page(c,"search")["items"]
        assert [x["revision"] for x in events]==[1,2]
        assert events[1]["payload"]["visible"] is False
        assert events[1]["cursor"]>events[0]["cursor"]
        for consumer in ("search","travel"):
            with pytest.raises(HTTPException,match="SOURCE_REVISION_STALE"):
                discovery_sync.consume(c,pid,consumer,1,events[0]["payload"])
            discovery_sync.consume(c,pid,consumer,2,events[1]["payload"])
        # Neither checkpoint can be mistaken for the other.
        rows=c.execute("SELECT consumer,revision FROM bnb_discovery_consumer ORDER BY consumer").fetchall()
        assert rows==[("search",2),("travel",2)]
    with connect() as c:
        for consumer in ("search","travel"):
            with pytest.raises(HTTPException,match="CONSUMER_REPLAY"):
                discovery_sync.consume(c,pid,consumer,2,events[1]["payload"])


def test_m5a_uncommitted_source_mutation_cannot_leak_journal(database):
    connect,_,_=database
    with connect() as c:
        pid=property_row(c)
        assert projection_refresh.once(c,occupancy=occupancy_in_window,property_id=pid)
    with connect() as writer:
        writer.execute("UPDATE bnb_property SET version=version+1 WHERE id=%s",(pid,))
        writer.rollback()
    with connect() as reader:
        assert len(discovery_feed.page(reader,"travel")["items"])==1
        assert reader.execute("SELECT version FROM bnb_property WHERE id=%s",(pid,)).fetchone()==(1,)
        assert reader.execute("SELECT requested_revision=completed_revision FROM bnb_projection_work WHERE property_id=%s",(pid,)).fetchone()==(True,)
