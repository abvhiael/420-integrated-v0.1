"""Bounded public Pirate evidence validation. Never accepts RPC finality flags.

Difficulty context, native execution, notary season/quorum, destination-chain
anchor finality and shielded ownership require separately authenticated native
state. These helpers do not replace those dependencies.
"""
import hashlib
import struct


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def sha256d(raw):
    return hashlib.sha256(hashlib.sha256(raw).digest()).digest()


def equihash(header):
    require(len(header) == 1487 and header[140:143] == b'\xfd\x40\x05', 'header encoding')
    bits=int.from_bytes(header[104:108],'little');size=bits>>24;word=bits&0x7fffff
    require(word>0 and not bits&0x800000 and size<=34 and not(word>0xff and size>33) and not(word>0xffff and size>32),'compact target')
    target=word>>(8*(3-size)) if size<=3 else word<<(8*(size-3))
    require(0<target<=int('0f'*32,16) and int.from_bytes(sha256d(header),'little')<=target,'proof of work')
    return equihash_solution(header)

def equihash_solution(header):
    require(len(header)==1487 and header[140:143]==b"\xfd\x40\x05", "header encoding")
    value = int.from_bytes(header[143:], 'big')
    indices = [(value >> (21 * (511-i))) & 0x1fffff for i in range(512)]
    require(len(set(indices)) == 512, 'duplicate Equihash index')
    state = hashlib.blake2b(digest_size=50, person=b'ZcashPoW'+struct.pack('<II', 200, 9))
    state.update(header[:140])
    rows = []
    for index in indices:
        h = state.copy()
        h.update(struct.pack('<I', index//2))
        rows.append((int.from_bytes(h.digest()[(index % 2)*25:(index % 2+1)*25], 'big'), index))
    width = 200
    for _ in range(9):
        next_rows = []
        for (left, li), (right, ri) in zip(rows[::2], rows[1::2]):
            require(li < ri and left >> (width-20) == right >> (width-20), 'Equihash collision/order')
            next_rows.append((left ^ right, li))
        rows = next_rows
        width -= 20
    require(rows[0][0] == 0, 'Equihash residual')
    return sha256d(header)[::-1].hex()


def transaction_inclusion(raw, index, branch, header):
    # V4 uses SHA256d. Ironwood V6 uses the pinned native transaction-ID
    # implementation and MUST NOT enter this legacy function.
    require(len(raw) >= 8 and raw[:8] == bytes.fromhex('0400008085202f89'), 'not Sapling V4')
    require(type(index) is int and 0 <= index < 2**32 and len(branch) <= 32, 'Merkle index')
    digest = sha256d(raw)
    for sibling in branch:
        require(len(sibling) == 32 and sibling != digest, 'ambiguous Merkle sibling')
        digest = sha256d(sibling+digest if index & 1 else digest+sibling)
        index >>= 1
    require(index == 0 and digest == header[36:68], 'transaction Merkle root')
    return sha256d(raw).hex()
