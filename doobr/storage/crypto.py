"""DOOBR R02.1 envelope encryption. Keys must come from an authorized external KMS."""
from __future__ import annotations
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

VERSION = b"DBR1"
def encrypt_field(*, key: bytes, tenant_id: str, order_id: str, purpose: str, plaintext: bytes) -> bytes:
    """Persist VERSION | fresh 96-bit nonce | ciphertext + 128-bit GCM tag."""
    if not isinstance(key, bytes) or len(key) != 32:
        raise ValueError("requires externally provisioned 256-bit key")
    if not tenant_id or not order_id or purpose not in {"address", "recipient", "location", "custody"}:
        raise ValueError("invalid encryption scope")
    if not plaintext:
        raise ValueError("empty sensitive payload not supported")
    nonce = os.urandom(12)
    aad = (tenant_id + "\x00" + order_id + "\x00" + purpose).encode()
    return VERSION + nonce + AESGCM(key).encrypt(nonce, plaintext, aad)

def decrypt_field(*, key: bytes, tenant_id: str, order_id: str, purpose: str, payload: bytes) -> bytes:
    if not isinstance(key, bytes) or len(key) != 32:
        raise ValueError("requires externally provisioned 256-bit key")
    if not isinstance(payload, bytes) or len(payload) < 33 or payload[:4] != VERSION:
        raise ValueError("invalid ciphertext envelope")
    if not tenant_id or not order_id or purpose not in {"address", "recipient", "location", "custody"}:
        raise ValueError("invalid decryption scope")
    nonce = payload[4:16]
    aad = (tenant_id + "\x00" + order_id + "\x00" + purpose).encode()
    return AESGCM(key).decrypt(nonce, payload[16:], aad)
