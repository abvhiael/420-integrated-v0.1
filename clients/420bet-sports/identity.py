"""Canonical Identity420 credential and wrapped-asset admission gate."""
from dataclasses import dataclass
from hashlib import sha256
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
    identity_runtime_sha256: str
    minimum_issuer_trust: int = 2

    def verify(self, rpc, player: str, market_asset: str, configured_asset: str):
        for value in (self.identity_contract, self.canonical_asset, self.approved_issuer, player):
            if not nonzero_hex(value, 20):
                raise AdmissionRejected("invalid canonical address")
        for value in (self.profile_id, self.credential_id, self.credential_type, self.issuer_id):
            if not nonzero_hex(value, 32):
                raise AdmissionRejected("invalid credential binding")
        if market_asset.lower() != self.canonical_asset.lower() or configured_asset.lower() != self.canonical_asset.lower():
            raise AdmissionRejected("market uses noncanonical asset")
        code = rpc.code(self.identity_contract)
        if (not code or not nonzero_hex(self.identity_runtime_sha256, 32)
            or '0x' + sha256(code).hexdigest() != self.identity_runtime_sha256.lower()):
            raise AdmissionRejected("identity deployment hash mismatch")
        if rpc.read(self.canonical_asset, 'symbol') != 'W420' or rpc.read(self.canonical_asset, 'decimals') != 18:
            raise AdmissionRejected("canonical wrapped $420 denomination mismatch")
        profile = rpc.read(self.identity_contract, "profiles", self.profile_id)
        if profile[0].lower() != player.lower() or not profile[6]:
            raise AdmissionRejected("identity profile inactive or not wallet-controlled")
        issuer = rpc.read(self.identity_contract, "issuers", self.issuer_id)
        if issuer[0].lower() != self.approved_issuer.lower() or not issuer[3] or issuer[2] < self.minimum_issuer_trust:
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
