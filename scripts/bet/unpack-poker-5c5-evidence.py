"""Extract only manifest-listed, checksum-verified genuine hand evidence."""
import hashlib,json,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]/'clients/420bet-poker/zkshuffle/fixtures/tournament-5c5'
def unpack():
    m=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    with zipfile.ZipFile(ROOT/'evidence.zip') as z:
        assert len(z.namelist())==len(set(z.namelist())) and set(z.namelist())==set(m['files']),'archive inventory mismatch'
        for name,expected in m['files'].items():
            target=(ROOT/name).resolve();assert target.is_relative_to(ROOT.resolve()) and len(Path(name).parts)==3,'unsafe evidence path'
            data=z.read(name);assert hashlib.sha256(data).hexdigest()==expected,'proof/context checksum mismatch: '+name
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    print(f"Verified and extracted {len(m['files'])} genuine evidence files")
if __name__=='__main__':unpack()
