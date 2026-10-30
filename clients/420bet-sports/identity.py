"""Locally enforce canonical wallet, identity and asset admission binding.

Official designated deployments, approved credential type and trusted issuer
remain operator-controlled testnet/release inputs, never fabricated defaults.
"""
from dataclasses import dataclass
from app import AdmissionRejected, nonzero_hex

@dataclass(frozen=True)
class PlayerBinding:
    identity_contract: str
    profile_id: str
    credential_type: str
    canonical_asset: str
    approved_issuer: str

    def verify(self, rpc, player: str, market_asset: str, configured_asset: str):
        for value in (self.identity_contract, self.canonical_asset, self.approved_issuer, player):
            if not nonzero_hex(value, 20):
                raise AdmissionRejected("invalid canonical address")
        for value in (self.profile_id, self.credential_type):
            if not nonzero_hex(value, 32):
                raise AdmissionRejected("invalid credential binding")
        if market_asset.lower() != self.canonical_asset.lower() or configured_asset.lower() != self.canonical_asset.lower():
            raise AdmissionRejected("market uses noncanonical asset")
        if not rpc.code(self.identity_contract):
            raise AdmissionRejected("identity authority not deployed")
        # Identity420.hasValidCredential checks revocation, subject and expiration.
        if rpc.read(self.identity_contract, "hasValidCredential", self.profile_id, self.credential_type) is not True:
            raise AdmissionRejected("player identity credential revoked or absent")
        # Controller and issuer checks are delegated to an approved application
        # account service; no profile/controller getter exists in this minimal
        # binding, so a credential on its own is NOT a player wallet binding.
        if not rpc.verify_player_authority(player, self.profile_id, self.credential_type, self.approved_issuer):
            raise AdmissionRejected("player wallet/credential authority mismatch")
