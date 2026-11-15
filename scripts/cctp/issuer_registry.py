"""Extract explicit chain/domain/deployment identities from Circle publications."""
import re
from cctp import require, address_word

EVM_MT='MessageTransmitterV2'
EVM_TM='TokenMessengerV2'

def table_rows(document):
    return [[cell.strip() for cell in line.strip().strip('|').split('|')] for line in document.splitlines() if line.startswith('|')]

def linked_value(cell):
    match=re.search(r'\[`([^`]+)`\]',cell)
    require(match is not None,'issuer address cell')
    return match.group(1)

def base58_decode(value):
    alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';number=0
    for character in value:number=number*58+alphabet.index(character)
    result=bytes(len(value)-len(value.lstrip('1')))+number.to_bytes((number.bit_length()+7)//8,'big')
    require(len(result)==32,'non-EVM identity width')
    return result

def contract_addresses(document,title):
    section=document.split('### '+title+'\n',1)[1].split('\n### ',1)[0]
    return {int(row[1]):linked_value(row[2]) for row in table_rows(section) if len(row)>=3 and row[1].isdigit()}

def build_registry(domains,addresses,tokens,solana):
    names={int(row[0]):row[1] for row in table_rows(domains.split('## Supported tokens',1)[0]) if len(row)>=2 and row[0].isdigit()}
    transmitters=contract_addresses(addresses,EVM_MT);messengers=contract_addresses(addresses,EVM_TM)
    # Only the project's canonical launch source domains plus genuine Solana
    # historical interoperability evidence. This does not activate a new route.
    registry={}
    token_rows={row[0]:linked_value(row[1]) for row in table_rows(tokens.split('## Testnet',1)[0]) if len(row)>=2 and row[0] in ['Ethereum','Arbitrum','Base','Solana']}
    for domain in [0,3,6]:
        name=names[domain];registry[str(domain)]={'name':name,'message_transmitter':address_word(transmitters[domain]).hex(),'token_messenger':address_word(messengers[domain]).hex(),'usdc':address_word(token_rows[name]).hex(),'address_model':'EVM'}
    programs={row[0].strip('`'):linked_value(row[2]) for row in table_rows(solana.split('### Devnet',1)[0]) if len(row)>=3 and row[1]=='5'}
    registry['5']={'name':names[5],'message_transmitter':base58_decode(programs[EVM_MT]).hex(),'token_messenger':base58_decode(programs['TokenMessengerMinterV2']).hex(),'usdc':base58_decode(token_rows['Solana']).hex(),'address_model':'Solana'}
    return registry

def eligibility(domains,tokens):
    names=[row[1].casefold().replace(' ','') for row in table_rows(domains) if len(row)>=2 and row[0].isdigit()]
    token_names=[row[0].casefold().replace(' ','') for row in table_rows(tokens)]
    aliases={'420chain','420integrated','420chainmainnet','420chaintestnet'}
    listed=bool(aliases.intersection(names));native=bool(aliases.intersection(token_names))
    return {'cctp_listed':listed,'native_usdc_listed':native,'assigned_domain':None if not listed else 'read issuer-assigned domain; never infer from EVM chain ID','status':'NOT_CURRENTLY_LISTED_NATIVE_USDC_OR_CCTP' if not listed and not native else 'REQUIRES_EXACT_ISSUER_DEPLOYMENT_RECONCILIATION','private_issuer_approval':'NOT_ESTABLISHED_BY_PUBLIC_PUBLICATIONS'}
