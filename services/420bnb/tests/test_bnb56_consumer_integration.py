"""BNB-5.6 transactional Search/Travel acceptance and recovery regressions."""
from uuid import uuid4
import pytest
from fastapi import HTTPException
from test_bnb55_discovery_feed import database, property_row
import discovery_sync
import discovery_feed
import discovery_transport as transport


def _source(conn, consumer):
    page = discovery_feed.page(conn, consumer)
    assert page["items"]
    return transport.envelope(consumer, page["items"][-1], page["epoch"])


def _allowed(consumer, action):
    return consumer in ("search", "travel") and action == "discovery-accept"


def test_two_consumers_persist_independent_transactional_receipts(database):
    connect, _, _ = database
    with connect() as conn:
        pid = property_row(conn)
        discovery_sync.synchronize(conn, pid)
    with connect() as conn:
        search = _source(conn, "search")
        travel = _source(conn, "travel")
        assert transport.accept_repository_consumer(conn, "search", search, authorize=_allowed)["transactional_acceptance"]
    with connect() as conn:
        assert conn.execute("SELECT count(*) FROM bnb_discovery_consumer WHERE consumer='search'").fetchone()[0] == 1
        assert conn.execute("SELECT count(*) FROM bnb_discovery_consumer WHERE consumer='travel'").fetchone()[0] == 0
        assert transport.accept_repository_consumer(conn, "travel", travel, authorize=_allowed)["transactional_acceptance"]
    with connect() as conn:
        assert conn.execute("SELECT count(*) FROM bnb_discovery_consumer").fetchone()[0] == 2


def test_crash_before_commit_does_not_create_acceptance(database):
    connect, _, _ = database
    with connect() as conn:
        pid = property_row(conn)
        discovery_sync.synchronize(conn, pid)
    with connect() as conn:
        body = _source(conn, "search")
        transport.accept_repository_consumer(conn, "search", body, authorize=_allowed)
        conn.rollback()
    with connect() as conn:
        assert conn.execute("SELECT count(*) FROM bnb_discovery_consumer").fetchone()[0] == 0
        assert transport.accept_repository_consumer(conn, "search", body, authorize=_allowed)["revision"] == 1


def test_replayed_wrong_consumer_and_forged_receipts_fail(database):
    connect, _, _ = database
    with connect() as conn:
        pid = property_row(conn)
        discovery_sync.synchronize(conn, pid)
    with connect() as conn:
        body = _source(conn, "search")
        for attempted, permission in (("travel", _allowed), ("search", lambda *_: False)):
            with pytest.raises(HTTPException):
                transport.accept_repository_consumer(conn, attempted, body, authorize=permission)
        # HTTPException alone does not abort a PostgreSQL transaction.
        transport.accept_repository_consumer(conn, "search", body, authorize=_allowed)
    with connect() as conn:
        with pytest.raises(HTTPException, match="CONSUMER_REPLAY"):
            transport.accept_repository_consumer(conn, "search", body, authorize=_allowed)
        forged = dict(body, transport_digest="0" * 64)
        with pytest.raises(HTTPException, match="TRANSPORT_DIGEST_MISMATCH"):
            transport.accept_repository_consumer(conn, "search", forged, authorize=_allowed)


def test_retraction_then_recovery_does_not_resurrect_old_revision(database):
    connect, _, _ = database
    with connect() as conn:
        pid = property_row(conn)
        discovery_sync.synchronize(conn, pid)
    with connect() as conn:
        first = _source(conn, "search")
        transport.accept_repository_consumer(conn, "search", first, authorize=_allowed)
    with connect() as conn:
        conn.execute("UPDATE bnb_property SET version=version+1 WHERE id=%s", (pid,))
        discovery_sync.synchronize(conn, pid)
    with connect() as conn:
        page = discovery_feed.page(conn, "search", after=first["cursor"])
        assert page["items"][-1]["payload"]["visible"] is False
        new = transport.envelope("search", page["items"][-1], page["epoch"])
        with pytest.raises(HTTPException):
            transport.accept_repository_consumer(conn, "search", first, authorize=_allowed)
        transport.accept_repository_consumer(conn, "search", new, authorize=_allowed)
    with connect() as restarted:
        saved = restarted.execute("SELECT revision,payload FROM bnb_discovery_consumer WHERE consumer='search'").fetchone()
        assert saved[0] == 2 and saved[1]["visible"] is False
        with pytest.raises(HTTPException):
            transport.accept_repository_consumer(restarted, "search", first, authorize=_allowed)
