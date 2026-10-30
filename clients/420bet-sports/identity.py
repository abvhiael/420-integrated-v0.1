"""Canonical Identity420 credential and wrapped-asset admission gate."""
from dataclasses import dataclass
from app import AdmissionRejected, nonzero_hex

@dataclass(frozen=True)
class PlayerBinding:
    identity_contract: str
    profile_id: str
    credential_id: str
    credential_type: str
    issuer_id: str
    canonical_asset: str
    approved_issuer: str

    def verify(self, rpc, player: str, market_asset: str, configured_asset: str):
        for value in (self.identity_contract, self.canonical_asset, self.approved_issuer, player):
            if not nonzero_hex(value, 20):
                raise AdmissionRejected("invalid canonical address")
        for value in (self.profile_id, self.credential_id, self.credential_type, self.issuer_id):
            if not nonzero_hex(value, 32):
                raise AdmissionRejected("invalid credential binding")
        if market_asset.lower() != self.canonical_asset.lower() or configured_asset.lower() != self.canonical_asset.lower():
            raise AdmissionRejected("market uses noncanonical asset")
        if not rpc.code(self.identity_contract):
            raise AdmissionRejected("identity authority not deployed")
        profile = rpc.read(self.identity_contract, "profiles", self.profile_id)
        if profile[0].lower() != player.lower() or not profile[6]:
            raise AdmissionRejected("identity profile inactive or not wallet-controlled")
        issuer = rpc.read(self.identity_contract, "issuers", self.issuer_id)
        if issuer[0].lower() != self.approved_issuer.lower() or not issuer[3]:
            raise AdmissionRejected("issuer control revoked or changed")
        credential = rpc.read(self.identity_contract, "credentials", self.credential_id)
        if (credential[0] != bytes.fromhex(self.issuer_id[2:])
            or credential[1] != bytes.fromhex(self.profile_id[2:])
            or credential[2] != bytes.fromhex(self.credential_type[2:])):
            raise AdmissionRejected("credential issuer/profile/type mismatch")
        if rpc.read(self.identity_contract, "credentialValid", self.credential_id) is not True:
            raise AdmissionRejected("credential revoked, expired or rejected")
        if rpc.read(self.identity_contract, "hasValidCredential", self.profile_id, self.credential_type) is not True:
            raise AdmissionRejected("required subject credential unavailable")
