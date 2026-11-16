#!/usr/bin/env python3
"""Offline qualification of retained native CADC protocol observations; never RPC admission."""
from pathlib import Path
import hashlib,json
from eth_abi import decode,encode
from eth_hash.auto import keccak
ROOT=Path(__file__).resolve().parents[1]
FIX=ROOT/'contracts/test/fixtures/cadc'

def b(x):return bytes.fromhex(x.removeprefix('0x'))
def check(condition,message):
    if not condition:raise ValueError(message)
def event(receipt,signature,address):
    topic='0x'+keccak(signature.encode()).hex()
    return [x for x in receipt['logs'] if x['address'].lower()==address.lower() and x['topics'][0].lower()==topic]
def main():
    manifest=json.loads((FIX/'history/SHA256SUMS.json').read_text())
    for name,digest in manifest.items():check(hashlib.sha256((FIX/'history'/name).read_bytes()).hexdigest()==digest,'fixture checksum: '+name)
    vendor=json.loads((FIX/'upstream-manifest.json').read_text())
    for name,digest in vendor['sources'].items():check(hashlib.sha256((FIX/'upstream'/name).read_bytes()).hexdigest()==digest,'upstream checksum: '+name)
    results=[]
    for name in ['base-eth','polygon-eth']:
        h=json.loads((FIX/'history'/f'{name}-scan.json').read_text())['data'][0]
        r=json.loads((FIX/'history'/f'{name}-archive-rpc.json').read_text())
        responses=r['responses'];p=h['pathway'];c=h['config']['inboundConfig'];receiver=p['receiver']['address'];remote=p['sender']['address'];eid=p['srcEid'];dst=p['dstEid'];nonce=p['nonce']
        check(r['historical_block']==hex(h['destination']['tx']['blockNumber']-1),'historical state boundary')
        for key,value in responses.items():check('error' not in value and value.get('result') is not None,'missing RPC observation: '+name+'/'+key)
        result=lambda key:responses[key]['result']
        message=b(h['source']['tx']['payload']);check(len(message)==40 and int.from_bytes(message[:32],'big')>>160==0,'simple canonical recipient')
        recipient='0x'+message[12:32].hex();shared=int.from_bytes(message[32:],'big');check(shared>0,'positive amount')
        header=b'\x01'+nonce.to_bytes(8,'big')+eid.to_bytes(4,'big')+bytes(12)+b(remote)+dst.to_bytes(4,'big')+bytes(12)+b(receiver)
        guid=keccak(header[1:]);check('0x'+guid.hex()==h['guid'],'GUID')
        payload=keccak(guid+message)
        cfg=decode(['(uint64,uint8,uint8,uint8,address[],address[])'],b(result('receive-config')))[0]
        expected=(c['confirmations'],c['requiredDVNCount'],c['optionalDVNCount'],c['optionalDVNThreshold'],tuple(c['requiredDVNs']),tuple(c['optionalDVNs']))
        check(cfg==expected,'historical effective ULN config')
        check(cfg[0]>0 and cfg[1]>=2 and cfg[2]==3 and cfg[3]==1,'locked policy and issuer stack')
        check(len(set(cfg[4]+cfg[5]))==5,'independent configured provider identities')
        lib=decode(['address','bool'],b(result('receive-library')))[0];check(lib.lower()==h['config']['receiveLibrary'].lower(),'effective library identity')
        check(result('peer').lower()=='0x'+(bytes(12)+b(remote)).hex(),'native peer identity')
        endpoint=decode(['address'],b(result('oft-endpoint')))[0];token=decode(['address'],b(result('token')))[0]
        check(token=='0x49a6f6aeab68ea001beaa4815186eb22fbdccf2a','issuer upgraded token binding')
        rate=decode(['uint256'],b(result('rate')))[0];check(rate==1,'six-decimal issuer units');amount=shared*rate
        for key in [k for k in responses if k.startswith('code-')]:check(len(b(result(key)))>0,'contract identity code: '+key)
        receipt=result('destination-receipt');check(receipt['status']=='0x1' and receipt['transactionHash']==h['destination']['tx']['txHash'] and receipt['blockHash']==h['destination']['tx']['blockHash'],'successful destination receipt')
        mint=event(receipt,'Transfer(address,address,uint256)',token)
        check(any(b(x['topics'][1])==bytes(32) and b(x['topics'][2])==message[:32] and int(x['data'],16)==amount for x in mint),'exact native CADC mint')
        received=event(receipt,'OFTReceived(bytes32,uint32,address,uint256)',receiver)
        check(any(b(x['topics'][1])==guid and b(x['topics'][2])==message[:32] and decode(['uint32','uint256'],b(x['data']))==(eid,amount) for x in received),'issuer OFT receipt')
        delivered=event(receipt,'PacketDelivered((uint32,bytes32,uint64),address)',endpoint)
        check(any(decode(['(uint32,bytes32,uint64)','address'],b(x['data']))==((eid,bytes(12)+b(remote),nonce),receiver) for x in delivered),'endpoint delivery')
        sealer=result('sealer-transaction');check(sealer['to'].lower()==lib and b(sealer['input'])[:4]==keccak(b'commitVerification(bytes,bytes32)')[:4],'native ULN commitment call')
        check(decode(['bytes','bytes32'],b(sealer['input'])[4:])==(header,payload),'ULN commitment binds exact packet')
        committed=event(result('sealer-receipt'),'PacketVerified((uint32,bytes32,uint64),address,bytes32)',endpoint)
        check(any(decode(['(uint32,bytes32,uint64)','address','bytes32'],b(x['data']))==((eid,bytes(12)+b(remote),nonce),receiver,payload) for x in committed),'authenticated native commitment event')
        verified=[]
        for dvn in cfg[4]+cfg[5]:
            dvnReceipt=result('dvn-receipt-'+dvn);check(dvnReceipt['status']=='0x1','successful DVN transaction')
            logs=event(dvnReceipt,'PayloadVerified(address,bytes,uint256,bytes32)',lib)
            check(any((lambda v:v[0]==dvn and v[1]==header and v[2]>=cfg[0] and v[3]==payload)(decode(['address','bytes','uint256','bytes32'],b(x['data']))) for x in logs),'DVN identity/header/confirmations/payload')
            verified.append(dvn)
        results.append({'fixture':name,'guid':h['guid'],'source_eid':eid,'destination_eid':dst,'amount_local_units':amount,'authenticated_native_dvn_events':len(verified),'required_dvns':cfg[1],'optional_threshold':cfg[3],'receipt':receipt['transactionHash'],'qualification':'MATCHED_HISTORICAL_PROTOCOL_AND_RPC_OBSERVATIONS_NOT_A_420_FINALITY_PROOF'})
    print(json.dumps({'pass':True,'historical_messages':len(results),'upstream_sources':len(vendor['sources']),'results':results},indent=2))
if __name__=='__main__':main()
