"""Independent EIP-712 quote reconstruction and source-policy binding.

Ed25519 authenticates a licensed observation; ECDSA/EIP-712 authenticates the
authorized sportsbook odds signer. The two distinct signatures bind through
the exact sourceDigest/evidenceDigest/market/sequence/time fields.
"""
from eth_abi import encode
from eth_utils import keccak
from app import AdmissionRejected

def word(value):
    if isinstance(value, (bytes,bytearray)) and len(value)==32:
        return bytes(value)
    if isinstance(value,str) and len(value)==66 and value.startswith("0x"):
        try:return bytes.fromhex(value[2:])
        except ValueError:pass
    raise AdmissionRejected("expected bytes32")

def domain(chain_id,odds_address):
    t=keccak(text="EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    return keccak(encode(["bytes32","bytes32","bytes32","uint256","address"],
        [t,keccak(text="420Bet Sports Odds"),keccak(text="1"),chain_id,odds_address]))

def signed_quote_digest(chain_id,odds_address,market_id,terms_hash,quote):
    th=keccak(text="Odds(bytes32 marketId,bytes32 termsHash,uint64 quoteEpoch,uint64 sequence,uint64 observedAt,uint64 validUntil,bytes32 sourceDigest,bytes32 evidenceDigest,uint32[] prices)")
    prices=quote["prices"]
    if not isinstance(prices,(tuple,list)) or not prices or any(not isinstance(p,int) or isinstance(p,bool) or p<1_010_000 or p>1_000_000_000 for p in prices):
        raise AdmissionRejected("unapproved odds scale")
    packed_prices=b"".join(encode(["uint256"],[p]) for p in prices)
    sh=keccak(encode(
        ["bytes32","bytes32","bytes32","uint64","uint64","uint64","uint64","bytes32","bytes32","bytes32"],
        [th,word(market_id),word(terms_hash),quote["quoteEpoch"],quote["sequence"],
         quote["observedAt"],quote["validUntil"],word(quote["sourceDigest"]),
         word(quote["evidenceDigest"]),keccak(packed_prices)]))
    return "0x"+keccak(b"\x19\x01"+domain(chain_id,odds_address)+sh).hex()

def source_config_digest(provider,feed,source_policy):
    # Solidity abi.encode of three bytes32 equals concatenation.
    return "0x"+keccak(word(provider)+word(feed)+word(source_policy)).hex()

def validate_quote(rpc, deployment, market_id, verified_evidence, source_config):
    """Verify both signature domains bind to one on-chain accepted quote."""
    if len(source_config)!=3:
        raise AdmissionRejected("missing approved source configuration")
    expected=source_config_digest(*source_config)
    if expected.lower()!=verified_evidence.source_digest.lower():
        raise AdmissionRejected("source rights/config mismatch")
    market=rpc.read(deployment.markets,"get",market_id)
    terms=market[1]
    quote,usable=rpc.read(deployment.odds,"current",market_id)
    if not usable or quote["sourceDigest"].lower()!=expected.lower():
        raise AdmissionRejected("unusable signed odds")
    if quote["evidenceDigest"].lower()!=verified_evidence.evidence_digest.lower():
        raise AdmissionRejected("independent evidence mismatch")
    reconstructed=signed_quote_digest(deployment.chain_id,deployment.odds,market_id,terms,quote)
    if reconstructed.lower()!=quote["digest"].lower():
        raise AdmissionRejected("on-chain quote not bound to EIP-712 fields")
    actual=rpc.read(deployment.odds,"digest",(
        word(market_id),word(terms),quote["quoteEpoch"],quote["sequence"],
        quote["observedAt"],quote["validUntil"],word(expected),
        word(verified_evidence.evidence_digest),quote["prices"]))
    actual="0x"+bytes(actual).hex() if isinstance(actual,(bytes,bytearray)) else actual
    if actual.lower()!=reconstructed.lower():
        raise AdmissionRejected("quote contract/domain mismatch")
    return reconstructed
