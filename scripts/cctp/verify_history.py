#!/usr/bin/env python3
"""Authenticate genuine CCTP V2 messages using Circle's pinned public keys,
published identities, exact Iris responses, and observed destination logs.
This is issuer-attestation qualification, not an Ethereum consensus light client.
"""
import json
from pathlib import Path
from eth_abi import decode
from eth_hash.auto import keccak
from cctp import parse_message,verify_attestation,require,raw_hex
from issuer_registry import build_registry,eligibility

ROOT=Path(__file__).resolve().parents[2]
FIX=ROOT/'contracts/test/fixtures/cctp'
def registry():
    return build_registry(*( (FIX/name).read_text() for name in ['issuer-supported-domains.md','issuer-contract-addresses.md','issuer-usdc-addresses.md','issuer-solana-programs.md']))

def verify(name,keys,deployments):
    data=json.loads((FIX/(name+'.json')).read_text());raw=bytes.fromhex((FIX/(name+'.message.hex')).read_text());attestation=bytes.fromhex((FIX/(name+'.attestation.hex')).read_text());m=parse_message(raw)
    issuer=data['issuer_response'];rows=[r for r in issuer['messages'] if raw_hex(r['message'])==raw and raw_hex(r['attestation'])==attestation]
    require(len(rows)==1,'exact Circle response binding');row=rows[0];require(row['cctpVersion']==2 and row['status']=='complete','Circle version/status')
    signers=verify_attestation(raw,attestation,keys,2)
    source=deployments[str(m.source)];destination=deployments[str(m.destination)]
    require(m.sender.hex()==source['token_messenger'] and m.burn_token.hex()==source['usdc'],'published source messenger/token')
    require(m.recipient.hex()==destination['token_messenger'],'published destination messenger')
    decoded=row['decodedMessage'];body=decoded['decodedMessageBody']
    require(int(decoded['sourceDomain'])==m.source and int(decoded['destinationDomain'])==m.destination and raw_hex(decoded['nonce'])==m.nonce and raw_hex(decoded['messageBody'])==raw[148:],'Circle decoded header')
    require(int(body['amount'])==m.amount and int(body['feeExecuted'])==m.fee and int(body['maxFee'])==m.max_fee and int(body['expirationBlock'])==m.expiration and body['mintRecipient'].lower()==m.mint_recipient,'Circle decoded amount/recipient')
    receipt_observed=False
    if 'destination_transaction' in data:
        tx=data['destination_transaction'];require(tx['status']=='ok' and tx['to']['hash'].lower()=='0x'+destination['message_transmitter'][-40:],'canonical successful destination transmitter')
        require(row['destinationMintTxHash'].lower()==tx['hash'].lower(),'Circle destination transaction binding')
        call_message,call_attestation=decode(['bytes','bytes'],raw_hex(tx['raw_input'])[4:]);require(call_message==raw and call_attestation==attestation,'actual receiveMessage calldata')
        matched=[];minted=[]
        for log in data['destination_logs']['items']:
            topics=log['topics'];address=log['address']['hash'].lower();topic0=topics[0] if topics else None
            if address=='0x'+destination['message_transmitter'][-40:] and topic0=='0x'+keccak(b'MessageReceived(address,uint32,bytes32,bytes32,uint32,bytes)').hex():
                domain,sender,body_bytes=decode(['uint32','bytes32','bytes'],raw_hex(log['data']));require(domain==m.source and sender==m.sender and body_bytes==raw[148:] and raw_hex(topics[2])==m.nonce and int(topics[3],16)==m.executed_finality,'native message receipt');matched.append(log)
            if address=='0x'+destination['usdc'][-40:] and topic0=='0x'+keccak(b'Transfer(address,address,uint256)').hex() and int(topics[1],16)==0 and '0x'+topics[2][-40:].lower()==m.mint_recipient:
                minted.append(int(log['data'],16))
        require(len(matched)==1 and m.delivered in minted,'actual native USDC mint logs');receipt_observed=True
    return {'name':name,'source_domain':m.source,'destination_domain':m.destination,'source_transaction':issuer['sourceTxHash'],'destination_transaction':row['destinationMintTxHash'],'executed_finality':m.executed_finality,'amount':m.amount,'fee':m.fee,'delivered':m.delivered,'nonce':'0x'+m.nonce.hex(),'message_hash':'0x'+keccak(raw).hex(),'authorized_signers':signers,'observed_destination_receipt':receipt_observed}

def main():
    keys=json.loads((FIX/'issuer-public-keys.json').read_text());deployments=registry();results=[verify(name,keys,deployments) for name in json.loads((FIX/'historical-index.json').read_text())]
    print(json.dumps({'genuine_authenticated_messages':len(results),'results':results,'issuer_420chain_public_status':eligibility((FIX/'issuer-supported-domains.md').read_text(),(FIX/'issuer-usdc-addresses.md').read_text()),'420chain_end_to_end_qualified':False},indent=2))
if __name__=='__main__':main()
