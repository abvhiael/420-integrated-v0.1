"""One-path sports admission and restart-safe reconciliation orchestrator.

Any unverified dependency fails closed; this is not a replacement contract.
"""
from app import AdmissionRejected, SportsbookClient
from identity import PlayerBinding
from rpc import Web3SportsRPC
from quote_bridge import validate_quote

class FundedSportsSession:
    def __init__(self, client: SportsbookClient, identity: PlayerBinding):
        if not isinstance(client.rpc, Web3SportsRPC) or not isinstance(identity, PlayerBinding):
            raise AdmissionRejected("requires real RPC and approved identity binding")
        self.client, self.identity = client, identity

    def admit(self, wallet, offer, source_report, now, *, gas_limit):
        app, rpc = self.client, self.client.rpc
        player = wallet.address
        app.deployment.verify(rpc)
        market = rpc.read(app.deployment.markets, "get", offer["marketId"])
        # Web3 tuple response is decoded by ABI as a tuple; market config is
        # the first element of SportsMarketRegistry420.Record.
        config = market[0]
        asset = config[6] if isinstance(config, (tuple, list)) else config["asset"]
        self.identity.verify(rpc, player, asset, app.deployment.asset)
        planned = app.prepare(player, offer, source_report, now)
        evidence = app.verifier.verify(source_report, now=now)
        sources = rpc.canonical_source_config(app.deployment.markets, offer["marketId"])
        canonical_digest = validate_quote(rpc,app.deployment,offer["marketId"],evidence,sources)
        if canonical_digest.lower() != offer["quoteDigest"].lower():
            raise AdmissionRejected("client quote differs from authenticated EIP-712 terms")
        # Never send if player declined the precise locked terms.
        if not wallet.confirm_terms(planned["consent"]):
            raise AdmissionRejected("player declined terms")
        planned["asset"] = self.identity.canonical_asset
        return rpc.submit_player_funding(planned, wallet, gas_limit=gas_limit)

    def receipt(self, tx_hash, ticket_id, player):
        rpc = self.client.rpc
        canonical = rpc.reconcile_after_restart(tx_hash, ticket_id, self.client.deployment.vault, player)
        return self.client.verify_funding(canonical, ticket_id, player)

    def recovery(self, ticket_id):
        return self.client.recovery(ticket_id)
