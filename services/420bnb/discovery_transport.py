"""BNB-5.6 strict internal discovery transport contract; no external sender enabled.

This module establishes a versioned, privacy-limited transport envelope and
independently signed consumer acknowledgment verifier. It does not provision
issuer keys, activate Search/Travel deployments, or grant publication authority.
"""
import hashlib
import json
from uuid import UUID

from fastapi import HTTPException
from authority import verify_authority

VERSION = "bnb-discovery-transport/v1"
RECEIPT_VERSION = "bnb-discovery-receipt/v1"
CONSUMERS = frozenset(("search", "travel"))
MAX_BYTES = 4096
PUBLIC_FIELDS = frozenset(("property_id", "visible", "property_version",
    "title", "public_region", "capacity", "map_marker", "place_id",
    "jurisdiction_id", "nonbinding", "booking_enabled"))


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _digest(value):
    return hashlib.sha256(canonical(value).encode("ascii")).hexdigest()


def envelope(consumer, item, epoch):
    """Construct allowlisted, nonbinding wire data from an already-safe journal item."""
    if consumer not in CONSUMERS:
        raise HTTPException(403, "CONSUMER_UNAUTHORIZED")
    if not isinstance(item, dict) or not isinstance(item.get("payload"), dict):
        raise HTTPException(422, "TRANSPORT_ITEM_INVALID")
    payload = item["payload"]
    if (not set(payload).issubset(PUBLIC_FIELDS)
            or payload.get("visible") not in (True, False)
            or payload.get("booking_enabled", False) is not False
            or payload.get("nonbinding", True) is not True):
        raise HTTPException(403, "TRANSPORT_PRIVATE_OR_BINDING")
    try:
        pid = str(UUID(item["property_id"]))
        if str(UUID(payload["property_id"])) != pid:
            raise ValueError()
        epoch = str(UUID(epoch))
    except (ValueError, TypeError, KeyError, AttributeError):
        raise HTTPException(422, "TRANSPORT_ID_INVALID") from None
    cursor, revision = item.get("cursor"), item.get("revision")
    if any(type(x) is not int or x < 1 or x > 2**63-1 for x in (cursor, revision)):
        raise HTTPException(422, "TRANSPORT_VERSION_INVALID")
    if payload.get("visible") is False and set(payload) - {"property_id", "visible", "property_version"}:
        raise HTTPException(403, "TRANSPORT_TOMBSTONE_PRIVATE")
    payload_digest = _digest(payload)
    if item.get("payload_digest") != payload_digest:
        raise HTTPException(409, "TRANSPORT_DIGEST_MISMATCH")
    body = {"version": VERSION, "consumer": consumer, "epoch": epoch,
            "cursor": cursor, "property_id": pid, "revision": revision,
            "payload": payload, "payload_digest": payload_digest,
            "nonbinding": True, "booking_enabled": False}
    if len(canonical(body).encode("ascii")) > MAX_BYTES:
        raise HTTPException(413, "TRANSPORT_TOO_LARGE")
    body["transport_digest"] = _digest(body)
    return body


def verify_receipt(proof, consumer, body):
    """Only a separately configured RS256 consumer issuer can prove acceptance.

    This is a verification primitive, not proof that consumer writes are durable.
    The consumer must commit its idempotent update before signing a receipt.
    """
    if consumer not in CONSUMERS or not isinstance(body, dict):
        raise HTTPException(403, "CONSUMER_UNAUTHORIZED")
    if body.get("version") != VERSION or body.get("consumer") != consumer:
        raise HTTPException(409, "TRANSPORT_SCOPE_MISMATCH")
    if not isinstance(proof, str) or not proof:
        raise HTTPException(401, "CONSUMER_RECEIPT_REQUIRED")
    claims = verify_authority(proof, "BNB_DISCOVERY_RECEIPT_" + consumer.upper(),
                              "discovery-acceptance", subject=consumer)
    for key, value in (("receipt_version", RECEIPT_VERSION),
                       ("consumer", consumer),
                       ("epoch", body.get("epoch")),
                       ("cursor", body.get("cursor")),
                       ("property_id", body.get("property_id")),
                       ("revision", body.get("revision")),
                       ("transport_digest", body.get("transport_digest"))):
        if claims.get(key) != value:
            raise HTTPException(403, "CONSUMER_RECEIPT_SCOPE_MISMATCH")
    if claims.get("durable_acceptance") is not True or claims.get("consumer_revoked") is not False:
        raise HTTPException(403, "CONSUMER_RECEIPT_NOT_ACCEPTED")
    return _digest({"consumer": consumer, "jti": claims["jti"],
                    "transport_digest": body["transport_digest"]})


def accept_repository_consumer(conn, consumer, body, *, authorize=None):
    """Commit-scoped Search/Travel consumer admission for isolated repository runs.

    The caller owns the PostgreSQL transaction. No signed receipt is emitted until
    that transaction commits; a caller cannot treat this return value as external
    provider acceptance or a network acknowledgment.
    """
    import discovery_sync
    if getattr(conn, "autocommit", True):
        raise HTTPException(503, "CONSUMER_TRANSACTION_REQUIRED")
    if consumer not in CONSUMERS or not isinstance(body, dict):
        raise HTTPException(403, "CONSUMER_UNAUTHORIZED")
    if not callable(authorize) or authorize(consumer, "discovery-accept") is not True:
        raise HTTPException(403, "CONSUMER_AUTHORITY_REQUIRED")
    if body.get("version") != VERSION or body.get("consumer") != consumer:
        raise HTTPException(403, "TRANSPORT_SCOPE_MISMATCH")
    item = {"cursor": body.get("cursor"), "property_id": body.get("property_id"),
            "revision": body.get("revision"), "payload": body.get("payload"),
            "payload_digest": body.get("payload_digest")}
    expected = envelope(consumer, item, body.get("epoch"))
    if expected != body:
        raise HTTPException(409, "TRANSPORT_DIGEST_MISMATCH")
    clock = conn.execute("SELECT value,epoch FROM bnb_discovery_clock WHERE singleton").fetchone()
    if not clock or str(clock[1]) != body["epoch"] or clock[0] < body["cursor"]:
        raise HTTPException(409, "CONSUMER_EPOCH_OR_CURSOR_STALE")
    journal = conn.execute("""SELECT property_id,revision,payload FROM bnb_discovery_change
                               WHERE cursor=%s""", (body["cursor"],)).fetchone()
    if not journal or str(journal[0]) != body["property_id"] or journal[1] != body["revision"]:
        raise HTTPException(409, "CONSUMER_SOURCE_MISMATCH")
    # Fetch a fresh privacy/authority-checked item. A historical visible payload
    # that has since been revoked must not be accepted as visible.
    import discovery_feed
    current = discovery_feed._item(conn, (
        body["cursor"], journal[0], journal[1],
        _digest(journal[2]), journal[2]))
    if current["payload"] != body["payload"]:
        raise HTTPException(409, "CONSUMER_AUTHORITY_STALE")
    # This canonical consumer writer locks the property and rejects any stale
    # revision or mismatching source projection, including stale resurrection.
    result = discovery_sync.consume(conn, body["property_id"], consumer,
                                    body["revision"], body["payload"])
    return {"consumer": consumer, "property_id": body["property_id"],
            "revision": result["revision"], "visible": result["visible"],
            "transport_digest": body["transport_digest"],
            "transactional_acceptance": True,
            "external_acceptance": False}
