"""Independent Ethereum history oracle: canonical RLP, two tries, SSZ, and pinned artifacts.
Dependencies are frozen in requirements.lock. No RPC is required for verification.
"""
import hashlib
import json
from pathlib import Path
import sys
import rlp
from eth_hash.auto import keccak
from trie import HexaryTrie
from eth_abi import encode

ROOT=Path(__file__).resolve().parent

def require(ok,message):
    if not ok:raise ValueError(message)
def hb(value):return bytes.fromhex(value.removeprefix('0x'))
def num(value):return int(value,16) if isinstance(value,str) and value.startswith('0x') else int(value)
def sha(value):return hashlib.sha256(value).digest()
def merkle(leaves):
    leaves=list(leaves);n=1
    while n<len(leaves):n*=2
    leaves += [bytes(32)]*(n-len(leaves))
    while len(leaves)>1:leaves=[sha(leaves[i]+leaves[i+1]) for i in range(0,len(leaves),2)]
    return leaves[0]
def branch(leaves,index):
    leaves=list(leaves);n=1
    while n<len(leaves):n*=2
    leaves += [bytes(32)]*(n-len(leaves));out=[]
    while len(leaves)>1:
        out.append(leaves[index^1]);index//=2
        leaves=[sha(leaves[i]+leaves[i+1]) for i in range(0,len(leaves),2)]
    return out
def verify_branch(leaf,nodes,index,root):
    for node in nodes:
        leaf=sha(node+leaf) if index&1 else sha(leaf+node);index>>=1
    require(index==1 and leaf==root,'SSZ branch mismatch')
def u64(v):return num(v).to_bytes(8,'little')+bytes(24)
def beacon_root(h):return merkle([u64(h['slot']),u64(h['proposer_index']),hb(h['parent_root']),hb(h['state_root']),hb(h['body_root'])])
def committee_root(c):return sha(merkle([sha(hb(p)+bytes(16)) for p in c['pubkeys']])+sha(hb(c['aggregate_pubkey'])+bytes(16)))
def execution_leaves(e):
    extra=hb(e['extra_data']);require(len(extra)<=32,'extra data')
    out=[hb(e['parent_hash']),hb(e['fee_recipient'])+bytes(12),hb(e['state_root']),hb(e['receipts_root']),merkle([hb(e['logs_bloom'])[i:i+32] for i in range(0,256,32)]),hb(e['prev_randao']),u64(e['block_number']),u64(e['gas_limit']),u64(e['gas_used']),u64(e['timestamp']),sha(extra+bytes(32-len(extra))+len(extra).to_bytes(32,'little')),num(e['base_fee_per_gas']).to_bytes(32,'little'),hb(e['block_hash']),hb(e['transactions_root'])]
    if 'withdrawals_root'in e:out.append(hb(e['withdrawals_root']))
    if 'blob_gas_used'in e:out.extend([u64(e['blob_gas_used']),u64(e['excess_blob_gas'])])
    return out

def bootstrap(file):
    d=json.loads((ROOT/file).read_text())['data'];h=d['header'];c=committee_root(d['current_sync_committee']);root=beacon_root(h['beacon']);slot=num(h['beacon']['slot'])
    verify_branch(c,[hb(n) for n in d['current_sync_committee_branch']],86 if slot//32>=364032 else 54,hb(h['beacon']['state_root']))
    leaves=execution_leaves(h['execution']);verify_branch(merkle(leaves),[hb(n) for n in h['execution_branch']],25,hb(h['beacon']['body_root']))
    nodes=branch(leaves,12)+[hb(n) for n in h['execution_branch']]
    verify_branch(hb(h['execution']['block_hash']),nodes,812 if len(leaves)>16 else 412,hb(h['beacon']['body_root']))
    return d,root,c,nodes

def tx_bytes(t):
    typ=num(t.get('type','0x0'));to=hb(t['to']) if t.get('to') else b''
    data=hb(t.get('input',t.get('data','0x')))
    access=[[hb(a['address']),[hb(s) for s in a['storageKeys']]] for a in t.get('accessList',[])]
    n=lambda k:num(t[k]);sig=[num(t.get('yParity',t.get('v','0x0'))),n('r'),n('s')]
    if typ==0:fields=[n('nonce'),n('gasPrice'),n('gas'),to,n('value'),data,n('v'),n('r'),n('s')]
    elif typ==1:fields=[n('chainId'),n('nonce'),n('gasPrice'),n('gas'),to,n('value'),data,access]+sig
    elif typ in (2,3,4):
        fields=[n('chainId'),n('nonce'),n('maxPriorityFeePerGas'),n('maxFeePerGas'),n('gas'),to,n('value'),data,access]
        if typ==3:fields += [n('maxFeePerBlobGas'),[hb(h) for h in t['blobVersionedHashes']]]
        if typ==4:fields += [[[num(a['chainId']),hb(a['address']),num(a['nonce']),num(a['yParity']),num(a['r']),num(a['s'])] for a in t['authorizationList']]]
        fields += sig
    else:raise ValueError('unsupported transaction envelope')
    raw=(bytes([typ]) if typ else b'')+rlp.encode(fields)
    require(keccak(raw)==hb(t['hash']),'transaction identity mismatch')
    return raw

def receipt_bytes(r):
    typ=num(r.get('type','0x0'))
    logs=[[hb(l['address']),[hb(t) for t in l['topics']],hb(l['data'])] for l in r['logs']]
    body=rlp.encode([num(r['status']),num(r['cumulativeGasUsed']),hb(r['logsBloom']),logs])
    return (bytes([typ]) if typ else b'')+body

def header_bytes(b):
    fields=[hb(b[k]) for k in ['parentHash','sha3Uncles','miner','stateRoot','transactionsRoot','receiptsRoot','logsBloom']]
    fields += [num(b[k]) for k in ['difficulty','number','gasLimit','gasUsed','timestamp']]
    fields += [hb(b[k]) for k in ['extraData','mixHash','nonce']]
    for k,integer in [('baseFeePerGas',True),('withdrawalsRoot',False),('blobGasUsed',True),('excessBlobGas',True),('parentBeaconBlockRoot',False),('requestsHash',False)]:
        if k in b:fields.append(num(b[k]) if integer else hb(b[k]))
    out=rlp.encode(fields);require(keccak(out)==hb(b['hash']),'execution header hash mismatch');return out

def trie_proof(trie,key):
    nodes=[rlp.encode(n) for n in trie.get_proof(key)]
    return [n for i,n in enumerate(nodes) if i==0 or len(n)>=32]

def build():
    d,initial_root,initial_committee,_=bootstrap('bootstrap.json')
    f,final_root,final_committee,execution_branch=bootstrap('finalized-bootstrap.json')
    values=(ROOT/'consensus-public-values.bin').read_bytes();words=[values[i:i+32] for i in range(0,len(values),32)]
    require(words[5]==initial_root and words[8]==initial_committee,'initial consensus journal binding')
    require(words[2]==final_root and words[7]==final_committee,'final consensus journal binding')
    require(int.from_bytes(words[4],'big')==num(f['header']['beacon']['slot']),'finalized slot binding')
    b=json.loads((ROOT/'execution-block.json').read_text());receipts=json.loads((ROOT/'execution-receipts.json').read_text())
    require(hb(b['hash'])==hb(f['header']['execution']['block_hash']),'execution SSZ/hash binding')
    require(hb(b['stateRoot'])==words[1],'consensus state root binding')
    require(len(b['transactions'])==len(receipts),'receipt count mismatch')
    txs=[tx_bytes(t) for t in b['transactions']];rs=[receipt_bytes(r) for r in receipts]
    txtrie=HexaryTrie(db={});rtrie=HexaryTrie(db={})
    for i,(t,r) in enumerate(zip(txs,rs)):
        key=rlp.encode(i);txtrie[key]=t;rtrie[key]=r
        require(receipts[i]['transactionHash'].lower()==b['transactions'][i]['hash'].lower() and num(receipts[i]['transactionIndex'])==i,'receipt transaction index mismatch')
    require(txtrie.root_hash==hb(b['transactionsRoot']),'transaction trie root')
    require(rtrie.root_hash==hb(b['receiptsRoot']),'receipt trie root')
    header=header_bytes(b)
    selected=[]
    native=next(i for i,t in enumerate(b['transactions']) if num(t['value'])>0 and t['input']=='0x' and num(receipts[i]['status'])==1)
    selected.append(('native',native,None))
    configs=ROOT.parents[2]/'config/bridge'
    for symbol in ['aave','audio','eurc','link','qcad','uni','usdt']:
        config=json.loads(next(configs.glob(symbol+'-ethereum-*.json')).read_text());token=config['asset']['ethereum_token'].lower()
        match=next(((i,j) for i,r in enumerate(receipts) for j,l in enumerate(r['logs']) if l['address'].lower()==token and len(l['topics'])==3 and l['topics'][0].lower()=='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'),None)
        if match:selected.append((symbol,*match))
    vectors=[]
    for name,index,log_index in selected:
        tproof=trie_proof(txtrie,rlp.encode(index));rproof=trie_proof(rtrie,rlp.encode(index))
        require(HexaryTrie.get_from_proof(txtrie.root_hash,rlp.encode(index),tuple(rlp.decode(n) for n in tproof))==txs[index],'independent transaction proof')
        require(HexaryTrie.get_from_proof(rtrie.root_hash,rlp.encode(index),tuple(rlp.decode(n) for n in rproof))==rs[index],'independent receipt proof')
        v={'name':name,'transaction_index':index,'transaction_hash':b['transactions'][index]['hash'],'transaction':'0x'+txs[index].hex(),'receipt':'0x'+rs[index].hex(),'transaction_proof':['0x'+n.hex() for n in tproof],'receipt_proof':['0x'+n.hex() for n in rproof],'log_index':log_index}
        if log_index is not None:
            log=receipts[index]['logs'][log_index];v['token']=log['address'];v['sender']='0x'+log['topics'][1][-40:];v['recipient']='0x'+log['topics'][2][-40:];v['amount']=int(log['data'],16)
        else:
            t=b['transactions'][index];v['sender']=t['from'];v['recipient']=t['to'];v['amount']=num(t['value'])
        vectors.append(v)
    oracle={'initial_root':'0x'+initial_root.hex(),'initial_committee_root':'0x'+initial_committee.hex(),'final_root':'0x'+final_root.hex(),'final_committee_root':'0x'+final_committee.hex(),'execution_header':'0x'+header.hex(),'execution_hash_branch':['0x'+n.hex() for n in execution_branch],'block_number':num(b['number']),'block_hash':b['hash'],'transaction_count':len(txs),'receipts_root':b['receiptsRoot'],'transactions_root':b['transactionsRoot'],'vectors':vectors}
    return oracle

def write_abi(oracle,write=False):
    def emit(name,data):
        path=ROOT/name
        if write:path.write_bytes(data)
        else:require(path.read_bytes()==data,"derived ABI fixture drift: "+name)
    beacon_type='(uint64,uint64,bytes32,bytes32,bytes32)'
    def bh(h):return (num(h['slot']),num(h['proposer_index']),hb(h['parent_root']),hb(h['state_root']),hb(h['body_root']))
    for prefix,initial,final in [('', 'bootstrap.json','finalized-bootstrap.json'),('rotation-','rotation-bootstrap.json','rotation-finalized-bootstrap.json')]:
        d,root,committee,_=bootstrap(initial)
        initial_args=encode(['bytes32',beacon_type,'bytes32','bytes32[]'],[root,bh(d['header']['beacon']),committee,[hb(n) for n in d['current_sync_committee_branch']]])
        emit(prefix+'bootstrap.bin',initial_args)
        f,final_root,final_committee,_=bootstrap(final)
        journal=(ROOT/(prefix+'consensus-public-values.bin' if not prefix else 'rotation-public-values.bin')).read_bytes()
        words=[journal[i:i+32] for i in range(0,len(journal),32)]
        require(words[5]==root and words[8]==committee and words[2]==final_root and words[7]==final_committee,'rotation journal binding')
    f,_,_,_=bootstrap('finalized-bootstrap.json')
    emit('finalized-execution.bin',encode([beacon_type,'bytes','bytes32[]'],[bh(f['header']['beacon']),hb(oracle['execution_header']),[hb(n) for n in oracle['execution_hash_branch']]]))
    proof_type='(bytes,uint64,bytes,bytes[],bytes,bytes[],uint32)'
    for v in oracle['vectors']:
        args=(hb(oracle['execution_header']),v['transaction_index'],hb(v['transaction']),[hb(x) for x in v['transaction_proof']],hb(v['receipt']),[hb(x) for x in v['receipt_proof']],v['log_index'] or 0)
        emit('history-'+v['name']+'.bin',encode([proof_type],[args]))
    for symbol in ['aave','audio','eurc','link','qcad','uni','usdt']:
        file=ROOT/('account-'+symbol+'.json')
        require(file.exists(),'missing canonical token account proof: '+symbol)
        a=json.loads(file.read_text());b=json.loads((ROOT/'execution-block.json').read_text());key=keccak(hb(a['address']));nodes=[hb(n) for n in a['accountProof']]
        canonical=json.loads(next((ROOT.parents[2]/'config/bridge').glob(symbol+'-ethereum-*.json')).read_text())['asset']['ethereum_token']
        require(a['address'].lower()==canonical.lower(),'canonical token-address substitution')
        account=HexaryTrie.get_from_proof(hb(b['stateRoot']),key,tuple(rlp.decode(n) for n in nodes))
        require(account==rlp.encode([num(a['nonce']),num(a['balance']),hb(a['storageHash']),hb(a['codeHash'])]),'account metadata authentication')
        code=(ROOT/('code-'+symbol+'.bin')).read_bytes();require(code and keccak(code)==hb(a['codeHash']),'canonical token contract code hash')
        emit('account-'+symbol+'.bin',encode(['address','bytes32','bytes','bytes[]','bytes32'],[a['address'],hb(b['stateRoot']),account,nodes,hb(a['codeHash'])]))

def main():
    result=build();path=ROOT/'expected.json'
    parent=json.loads((ROOT/'execution-parent.json').read_text());child=json.loads((ROOT/'execution-block.json').read_text())
    require(parent['hash']==child['parentHash'] and num(parent['number'])+1==num(child['number']),'historical parent binding')
    raw=header_bytes(parent);target=ROOT/'parent-header.bin'
    if '--write' in sys.argv:target.write_bytes(raw)
    require(target.read_bytes()==raw,'historical parent header drift')
    if '--write' in sys.argv:
        path.write_text(json.dumps(result,indent=2)+'\n')
    write_abi(result,write='--write' in sys.argv)
    require(json.loads(path.read_text())==result,'independent historical oracle drift')
    print(f"PASS: genuine SP1 consensus journal + two committee/SSZ bootstrap proofs, finalized execution hash, {result['transaction_count']} transaction identities and receipts, both MPT roots, seven authenticated token accounts/code hashes, native ETH and historical token vectors {[v['name'] for v in result['vectors']]}")
if __name__=='__main__':main()
