"""Production-equivalent, chain-verified sportsbook RPC and wallet executor.

Requires web3.py and a deployment-approved contract ABI/artifact set.
No keys in repository; signer comes from an external wallet boundary.
"""
from dataclasses import dataclass
from typing import Mapping

from app import AdmissionRejected

@dataclass(frozen=True)
class FinalityPolicy:
    confirmations: int
    def __post_init__(self):
        if not 1 <= self.confirmations <= 4096:
            raise AdmissionRejected("invalid finality policy")

class Web3SportsRPC:
    def __init__(self, web3, abi_by_address: Mapping[str, list], finality: FinalityPolicy):
        self.web3, self.abi_by_address, self.finality = web3, abi_by_address, finality
    def chain_id(self):
        return int(self.web3.eth.chain_id)
    def code(self, address):
        return bytes(self.web3.eth.get_code(address))
    def contract(self, address):
        abi = self.abi_by_address.get(address.lower())
        if not abi:
            raise AdmissionRejected("missing approved ABI")
        return self.web3.eth.contract(address=address, abi=abi)
    def read(self, address, name, *args):
        try:
            result = getattr(self.contract(address).functions, name)(*args).call()
            def hx(v):
                return "0x" + bytes(v).hex() if isinstance(v, (bytes, bytearray)) else v
            if name == "current" and isinstance(result, (tuple, list)) and len(result) == 2:
                fields = ("digest", "priorDigest", "sourceDigest", "evidenceDigest", "signer",
                          "sequence", "observedAt", "validUntil", "quoteEpoch", "prices")
                if len(result[0]) != len(fields):
                    raise AdmissionRejected("unexpected odds ABI")
                return dict(zip(fields, (hx(v) for v in result[0]))), result[1]
            if name == "get" and isinstance(result, (tuple, list)) and len(result) == 12:
                fields = ("player", "marketId", "selection", "oddsDigest", "termsHash", "nonce",
                          "stake", "gross", "profit", "quoteEpoch", "quoteSequence", "state")
                return dict(zip(fields, (hx(v) for v in result)))
            if name == "settlementReceipt" and isinstance(result, (tuple, list)) and len(result) == 5:
                fields = ("outcome", "payout", "evidence", "finalizedAt", "executor")
                return dict(zip(fields, (hx(v) for v in result)))
            return result
        except Exception as exc:
            raise AdmissionRejected("RPC read failed") from exc
    def canonical_source_config(self, markets_address, market_id):
        market = self.read(markets_address, "get", market_id)
        event_id = market[0][0]
        events = self.read(markets_address, "eventsRegistry")
        competitions = self.read(markets_address, "competitions")
        competition_id = self.read(events, "competitionOf", event_id)
        record = self.read(competitions, "get", competition_id)
        if record[4] != 2:
            raise AdmissionRejected("competition source authority not approved")
        config = record[0]
        if config[4] <= 0:
            raise AdmissionRejected("source freshness policy absent")
        return (config[2], config[3], config[1])

    def finalized_receipt(self, tx_hash: str):
        try:
            receipt = self.web3.eth.get_transaction_receipt(tx_hash)
            block = self.web3.eth.get_block(receipt["blockNumber"])
            head = self.web3.eth.block_number
            if head - receipt["blockNumber"] + 1 < self.finality.confirmations:
                raise AdmissionRejected("insufficient confirmations")
            if block["hash"] != receipt["blockHash"]:
                raise AdmissionRejected("orphaned receipt")
            transaction = self.web3.eth.get_transaction(tx_hash)
            if transaction["blockHash"] != block["hash"]:
                raise AdmissionRejected("transaction not on canonical block")
            if int(receipt["status"]) != 1:
                raise AdmissionRejected("reverted funding transaction")
            return receipt, transaction, block
        except AdmissionRejected:
            raise
        except Exception as exc:
            raise AdmissionRejected("unable to prove canonical receipt") from exc
    def submit_player_funding(self, transaction: Mapping, wallet, *, gas_limit: int):
        """Actual wallet signer must own the player key; no relayed vault admission."""
        if transaction.get("method") != "fund":
            raise AdmissionRejected("fund is the only permitted admission")
        sender = transaction["from"]
        if wallet.address.lower() != sender.lower():
            raise AdmissionRejected("wallet does not own payer identity")
        if gas_limit <= 0:
            raise AdmissionRejected("invalid gas limit")
        try:
            offer = transaction["arguments"][0]
            asset = transaction.get("asset")
            if not asset:
                raise AdmissionRejected("missing approved asset")
            stake = offer["stake"]
            allowance = self.read(asset, "allowance", sender, transaction["to"])
            balance = self.read(asset, "balanceOf", sender)
            if allowance < stake or balance < stake:
                raise AdmissionRejected("insufficient approved canonical stake balance")
            function = self.contract(transaction["to"]).functions.fund(*transaction["arguments"])
            nonce = self.web3.eth.get_transaction_count(sender, "pending")
            chain_id = self.chain_id()
            params = {"from":sender, "nonce":nonce, "chainId":chain_id, "gas":gas_limit}
            fee = self.web3.eth.gas_price
            params["gasPrice"] = int(fee)
            built = function.build_transaction(params)
            if built["to"].lower() != transaction["to"].lower() or built["from"].lower() != sender.lower():
                raise AdmissionRejected("unexpected transaction destination or sender")
            # Account.sign_transaction accepts signed fields, not the RPC-only from key.
            signing_payload = dict(built)
            signing_payload.pop('from', None)
            signed = wallet.sign_transaction(signing_payload)
            raw = getattr(signed, "raw_transaction", None)
            if raw is None:
                raw = signed.rawTransaction
            returned_hash = self.web3.eth.send_raw_transaction(raw)
            return self.web3.to_hex(returned_hash)
        except AdmissionRejected:
            raise
        except Exception as exc:
            raise AdmissionRejected("wallet funding submission failed") from exc
    def reconcile_funding(self, tx_hash, ticket_id, vault, player):
        receipt, tx, block = self.finalized_receipt(tx_hash)
        if tx["to"] is None or tx["to"].lower() != vault.lower() or tx["from"].lower() != player.lower():
            raise AdmissionRejected("funding sender/destination mismatch")
        event_parser = self.contract(vault).events.TicketFunded()
        events = event_parser.process_receipt(receipt)
        matched = [event for event in events if event["address"].lower() == vault.lower()
                   and event["args"]["id"].hex().lower().removeprefix("0x") == ticket_id.lower().removeprefix("0x")]
        if len(matched) != 1:
            raise AdmissionRejected("missing or duplicate funded event")
        return {"success":True,"finalized":True,"orphaned":False,"to":vault,
                "ticketFunded":{"id":ticket_id}, "blockNumber":receipt["blockNumber"],
                "blockHash":self.web3.to_hex(block["hash"]), "transactionHash":tx_hash}
    def reconcile_after_restart(self, tx_hash, ticket_id, vault, player):
        """A fresh canonical read, never cached history, is the authority on restart."""
        return self.reconcile_funding(tx_hash,ticket_id,vault,player)
