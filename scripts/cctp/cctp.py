"""CCTP V2 preflight and ABI encoding. Circle's native contracts are authoritative.

Issuer keys/deployments must come from authenticated Circle publication/native
state. An arbitrary caller's JSON, Iris status, or recovered signer is not an
authority. This module holds no private keys and never signs or mints tokens.
"""
from dataclasses import dataclass
from eth_abi import encode
from eth_hash.auto import keccak
from eth_keys import keys

N=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141

def require(ok, reason):
    if not ok:raise ValueError(reason)

def raw_hex(value):
    require(isinstance(value,str),'hex string required')
    return bytes.fromhex(value.removeprefix('0x'))

def evm_address(word):
    require(len(word)==32 and word[:12]==bytes(12) and any(word[12:]),'noncanonical EVM recipient')
    return '0x'+word[12:].hex()

def address_word(address):
    raw=raw_hex(address);require(len(raw)==20 and any(raw),'EVM address required')
    return bytes(12)+raw

def uint(value,bits):
    require(type(value) is int and 0<=value<2**bits,'integer width')
    return value

@dataclass(frozen=True)
class Message:
    source:int
    destination:int
    nonce:bytes
    sender:bytes
    recipient:bytes
    destination_caller:bytes
    minimum_finality:int
    executed_finality:int
    burn_token:bytes
    mint_recipient:str
    amount:int
    message_sender:bytes
    max_fee:int
    fee:int
    expiration:int
    hook:bytes
    @property
    def delivered(self):return self.amount-self.fee
    @property
    def minimum_normalized(self):return 1000 if self.minimum_finality<=1000 else 2000

def parse_message(raw):
    require(isinstance(raw,bytes) and len(raw)>=376,'truncated CCTP V2 message')
    def number(at,width):return int.from_bytes(raw[at:at+width],'big')
    require(number(0,4)==1 and number(148,4)==1,'unsupported header/body version')
    m=Message(number(4,4),number(8,4),raw[12:44],raw[44:76],raw[76:108],raw[108:140],number(140,4),number(144,4),raw[152:184],evm_address(raw[184:216]),number(216,32),raw[248:280],number(280,32),number(312,32),number(344,32),raw[376:])
    require(m.source!=m.destination and any(m.nonce) and any(m.sender) and any(m.recipient) and any(m.burn_token) and any(m.message_sender),'invalid message identity')
    require(m.amount>0 and m.max_fee<m.amount and m.fee<m.amount and m.fee<=m.max_fee,'invalid amount/fee')
    require(m.executed_finality>=m.minimum_normalized,'inconsistent finality')
    return m

def issuer_addresses(public_key_response,version=2):
    require(version==2,'only CCTP V2 is supported')
    addresses=set()
    for row in public_key_response['publicKeys']:
        if row['cctpVersion']!=version:continue
        public=raw_hex(row['publicKey']);require(len(public)==65 and public[0]==4,'public key encoding')
        addresses.add(keys.PublicKey(public[1:]).to_canonical_address())
    require(bool(addresses),'no authorized CCTP V2 keys')
    return addresses

def verify_attestation(raw,attestation,public_key_response,threshold):
    allowed=issuer_addresses(public_key_response)
    require(type(threshold) is int and 1<=threshold<=len(allowed),'issuer threshold')
    require(len(attestation)==65*threshold,'attestation length')
    previous=bytes(20);recovered=[]
    for offset in range(0,len(attestation),65):
        sig=attestation[offset:offset+65];r=int.from_bytes(sig[:32],'big');s=int.from_bytes(sig[32:64],'big');v=sig[64]
        require(v in (27,28) and 0<r<N and 0<s<=N//2,'noncanonical issuer signature')
        signer=keys.Signature(sig[:64]+bytes([v-27])).recover_public_key_from_msg_hash(keccak(raw)).to_canonical_address()
        require(signer>previous and signer in allowed,'unauthorized/duplicate/unsorted issuer')
        recovered.append('0x'+signer.hex());previous=signer
    return recovered

def validate_route(m,*,local_domain,local_messenger,source_domain,source_messenger,source_token,adapter,minimum_finality,block_number,source_address_model="EVM",consumed_nonces=frozenset()):
    uint(local_domain,32);uint(source_domain,32);uint(block_number,256)
    require(minimum_finality in (1000,2000),'route finality')
    require(source_address_model in ('EVM','Solana'),'source address model')
    if source_address_model=='EVM':evm_address(m.message_sender)
    require(m.source==source_domain and m.destination==local_domain,'domain binding')
    require(m.sender==raw_hex(source_messenger) and m.burn_token==raw_hex(source_token),'source messenger/token')
    require(m.recipient==address_word(local_messenger),'destination messenger')
    require(m.destination_caller in (bytes(32),address_word(adapter)),'destination caller')
    require(m.executed_finality>=minimum_finality,'route finality not met')
    require(m.expiration==0 or m.expiration>block_number,'expired; obtain issuer re-attestation')
    require(m.nonce not in consumed_nonces,'attestation nonce replay')
    return m.delivered

def inbound_proof(raw,attestation):return encode(['bytes','bytes'],[raw,attestation])

def outbound_extra(destination_caller,max_fee,min_finality,hook=b''):
    require(len(destination_caller)==32 and isinstance(hook,bytes),'caller/hook encoding')
    uint(max_fee,256);uint(min_finality,32)
    return encode(['bytes32','uint256','uint32','bytes'],[destination_caller,max_fee,min_finality,hook])

def nonce_id(nonce):
    require(len(nonce)==32 and any(nonce),'nonce')
    return keccak(encode(['string','bytes32'],['420/CCTP/V2/NONCE',nonce]))


def outbound_destination(recipient,destination_caller,*,address_model):
    require(address_model in ('EVM','Solana') and isinstance(recipient,bytes) and len(recipient)==32 and any(recipient) and isinstance(destination_caller,bytes) and len(destination_caller)==32,'destination encoding')
    if address_model=='EVM':
        evm_address(recipient)
        if any(destination_caller):evm_address(destination_caller)
    return recipient,destination_caller
