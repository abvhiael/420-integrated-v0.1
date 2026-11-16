"""Offline artifact integrity, pinned ELF key and source-closure provenance checks."""
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[3]
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    manifest=json.loads((ROOT/'SHA256SUMS.json').read_text())
    for name,expected in manifest.items():
        path=ROOT/name
        if not path.is_file() or digest(path)!=expected:raise ValueError('fixture checksum mismatch: '+name)
    sources=json.loads((ROOT/'sources.json').read_text())
    assert digest(ROOT/'consensus-program/helios.elf')==sources['program_elf_sha256']
    client=(REPO/'contracts/src/bridge/verifiers/EthereumConsensusLightClient420.sol').read_text()
    key=sources['derived_program_vkey'];assert 'PROGRAM_VKEY='+key in client
    assert key in (ROOT/'qualification/program-vkey.log').read_text()
    guest=(ROOT/'consensus-program/program/src/main.rs').read_text()
    assert 'store.next_sync_committee = None;' in guest and 'verify_finality_update(' in guest
    closure=json.loads((ROOT/'qualification/source-sha256.json').read_text())
    for name,expected in closure.items():
        if digest(REPO/name)!=expected:raise ValueError('qualified source changed: '+name)
    print(f'PASS: {len(manifest)} fixture artifacts and {len(closure)} qualified Solidity sources; pinned guest ELF / derived verification key / immutable verifier binding')
if __name__=='__main__':main()
