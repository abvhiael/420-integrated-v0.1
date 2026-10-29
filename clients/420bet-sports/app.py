"""Sportsbook application security boundary (local, non-broadcasting by default).

Adapters must be supplied by the deployment operator. No synthetic attestations,
privileged settlement calls, or implicit transaction signing.
"""
from dataclasses import dataclass
from hashlib import sha256
import json
from typing import Callable, Mapping

class AdmissionRejected(ValueError):
    pass

def canonical(payload: Mapping) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()

def nonzero_hex(value: str, n: int) -> bool:
    try:
        return isinstance(value, str) and len(value) == 2 + 2 * n and value.startswith("0x") and int(value[2:], 16) != 0
    except (TypeError, ValueError):
        return False

@dataclass(frozen=True)
class Deployment:
    chain_id: int
    vault: str
    admission: str
    odds: str
    markets: str
    certification: str
    oracle_gate: str
    oracle: str
    asset: str
    code_hashes: Mapping[str, str]

    def verify(self, rpc) -> None:
        """rpc provides chain_id(), code(address), read(address, function, *args).
        Code hashes are SHA-256 over actual runtime bytes; compare no placeholders.
        """
        if self.chain_id <= 0 or rpc.chain_id() != self.chain_id:
            raise AdmissionRejected("wrong chain")
        for name in ("vault", "admission", "odds", "markets", "certification", "oracle_gate", "oracle", "asset"):
            address = getattr(self, name)
            expected = self.code_hashes.get(name)
            if not nonzero_hex(address, 20) or not nonzero_hex(expected, 32):
                raise AdmissionRejected("unapproved deployment identity")
            code = rpc.code(address)
            if not code or "0x" + sha256(code).hexdigest() != expected.lower():
                raise AdmissionRejected("runtime hash mismatch")
        required = (
            ("vault", "admission", self.admission),
            ("vault", "markets", self.markets),
            ("vault", "odds", self.odds),
            ("vault", "certification", self.certification),
            ("admission", "odds", self.odds),
            ("oracle_gate", "vault", self.vault),
            ("oracle_gate", "markets", self.markets),
            ("oracle_gate", "certification", self.certification),
            ("oracle_gate", "oracle", self.oracle),
        )
        for contract, getter, expected in required:
            if rpc.read(getattr(self, contract), getter).lower() != expected.lower():
                raise AdmissionRejected("cross-module binding mismatch")
        if rpc.read(self.vault, "oracleOnlyFunding") is not True:
            raise AdmissionRejected("oracle-only funding fuse inactive")

@dataclass(frozen=True)
class VerifiedEvidence:
    source_digest: str
    evidence_digest: str
    market_id: str
    sequence: int
    observed_at: int
    expires_at: int
    provider: str

class SportsbookClient:
    """Read-only projections; player alone calls vault.fund from own wallet.

    verifier is an external trust service that MUST perform licensed source
    authentication, signed provenance, rights/expiry, original report retention,
    and authorized provider-policy checks. Never treat a hash alone as provenance.
    """
    def __init__(self, deployment: Deployment, rpc, verifier: Callable):
        self.deployment, self.rpc, self.verifier = deployment, rpc, verifier

    def prepare(self, player: str, offer: Mapping, source_report: Mapping, now: int):
        self.deployment.verify(self.rpc)
        if not nonzero_hex(player, 20) or now < 0:
            raise AdmissionRejected("invalid player/time")
        if not callable(self.verifier):
            raise AdmissionRejected("no independent source verifier")
        ev = self.verifier(source_report)
        if not isinstance(ev, VerifiedEvidence) or not all((
            nonzero_hex(ev.source_digest, 32), nonzero_hex(ev.evidence_digest, 32),
            nonzero_hex(ev.market_id, 32), ev.provider,
            ev.sequence > 0, 0 < ev.observed_at <= now < ev.expires_at)):
            raise AdmissionRejected("unverified or stale source evidence")
        market = offer.get("marketId")
        if market != ev.market_id:
            raise AdmissionRejected("wrong market source")
        quote, usable = self.rpc.read(self.deployment.odds, "current", market)
        if not usable or quote["sourceDigest"] != ev.source_digest or quote["evidenceDigest"] != ev.evidence_digest:
            raise AdmissionRejected("odds evidence mismatch")
        if quote["sequence"] != ev.sequence or quote["observedAt"] != ev.observed_at or quote["validUntil"] != ev.expires_at:
            raise AdmissionRejected("replayed or substituted quote")
        if not nonzero_hex(offer.get("nonce"), 32) or not nonzero_hex(offer.get("quoteDigest"), 32):
            raise AdmissionRejected("invalid offer")
        if offer["quoteDigest"] != quote["digest"] or offer.get("expiry", 0) < now:
            raise AdmissionRejected("expired or changed offer")
        gross, liability, admissible = self.rpc.read(self.deployment.admission, "preview", offer, player)
        if not admissible or gross < offer["stake"] or liability != gross - offer["stake"]:
            raise AdmissionRejected("rejected funding preview")
        if self.rpc.read(self.deployment.vault, "marketOracleGate", market).lower() != self.deployment.oracle_gate.lower():
            raise AdmissionRejected("oracle gate not bound")
        asset_cap = self.rpc.read(self.deployment.vault, "assetProfitCap", self.deployment.asset)
        exposure = self.rpc.read(self.deployment.vault, "assetProfitExposure", self.deployment.asset)
        if asset_cap == 0 or exposure + liability > asset_cap:
            raise AdmissionRejected("asset risk freeze")
        # This is ONLY an unsigned transaction description. No approvals or
        # token transfers are simulated, and no acceptance is asserted.
        return {"to": self.deployment.vault, "method": "fund",
                "arguments": [dict(offer)], "from": player,
                "consent": {"gross": gross, "stake": offer["stake"],
                            "oddsDigest": quote["digest"], "sourceDigest": ev.source_digest}}

    def verify_funding(self, receipt: Mapping, ticket_id: str, player: str):
        """Canonical receipt and state must agree; never trust client-generated IDs."""
        if not receipt.get("finalized") or not receipt.get("success") or receipt.get("orphaned"):
            raise AdmissionRejected("noncanonical funding receipt")
        if receipt.get("to", "").lower() != self.deployment.vault.lower():
            raise AdmissionRejected("wrong funding recipient")
        ticket = self.rpc.read(self.deployment.vault, "get", ticket_id)
        if ticket["player"].lower() != player.lower() or ticket["state"] != 1:
            raise AdmissionRejected("ticket not funded for player")
        if not receipt.get("ticketFunded") or receipt["ticketFunded"].get("id") != ticket_id:
            raise AdmissionRejected("missing canonical funding event")
        return ticket

    def recovery(self, ticket_id: str):
        """Read-only recovery; authoritative settlement must be via Oracle gate.
        Refund is the existing permissionless timeout/disruption path.
        """
        self.deployment.verify(self.rpc)
        ticket = self.rpc.read(self.deployment.vault, "get", ticket_id)
        receipt = self.rpc.read(self.deployment.vault, "settlementReceipt", ticket_id)
        if ticket["state"] == 1:
            return {"state": "FUNDED", "settlement": None,
                    "normalSettlementOnly": {"to": self.deployment.oracle_gate, "method": "settle"},
                    "refundOnly": {"to": self.deployment.vault, "method": "refund"}}
        if receipt["outcome"] != ticket["state"] or not receipt["finalizedAt"]:
            raise AdmissionRejected("terminal receipt mismatch")
        if ticket["state"] in (2, 3, 5, 6, 7) and receipt["executor"].lower() != self.deployment.oracle_gate.lower():
            raise AdmissionRejected("non-oracle settlement detected")
        return {"state": "TERMINAL", "settlement": receipt, "normalSettlementOnly": None}
