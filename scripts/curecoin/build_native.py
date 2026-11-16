#!/usr/bin/env python3
"""Build pinned native consensus with one ancestry-query cache, no validation bypass.
Ancestry cache is scoped to the checkpoint hash and immutable parent hashes.
Modifier selection hashes are scoped to a single computation and unchanged modifier.
It memoizes only successful results of the exact original ancestor walk.
"""
import argparse,subprocess,hashlib,json,tarfile,io
from pathlib import Path
from consensus import SOURCE,require
OLD='''            const CBlockIndex* pindex = pindexPrev;
            while (pindex->nHeight > pindexSync->nHeight)
                if (!(pindex = pindex->pprev))
                    return error("CheckSync: pprev null - block index structure failure");
            if (pindex->nHeight < pindexSync->nHeight || pindex->GetBlockHash() != hashSyncCheckpoint)
                return false; // only descendant of sync-checkpoint can pass check'''
NEW='''            // Replay integration: memoize this immutable ancestry predicate only.
            // cs_hashSyncCheckpoint is held; a changed anchor discards every entry.
            static uint256 cachedAnchor = 0;
            static std::set<uint256> knownDescendants;
            if (cachedAnchor != hashSyncCheckpoint) {
                knownDescendants.clear();
                cachedAnchor = hashSyncCheckpoint;
            }
            const CBlockIndex* pindex = pindexPrev;
            std::vector<uint256> traversed;
            while (pindex->nHeight > pindexSync->nHeight) {
                uint256 h = pindex->GetBlockHash();
                if (knownDescendants.count(h)) break;
                traversed.push_back(h);
                if (!(pindex = pindex->pprev))
                    return error("CheckSync: pprev null - block index structure failure");
            }
            if (!knownDescendants.count(pindex->GetBlockHash()) &&
                (pindex->nHeight < pindexSync->nHeight || pindex->GetBlockHash() != hashSyncCheckpoint))
                return false; // same predicate as the original complete walk
            knownDescendants.insert(traversed.begin(), traversed.end());'''
def main():
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--secp',type=Path);p.add_argument('--secp-source',type=Path);a=p.parse_args()
 require(subprocess.check_output(['git','rev-parse','HEAD'],cwd=a.source,text=True).strip()==SOURCE,'source pin')
 require(not subprocess.check_output(['git','status','--porcelain','--','src'],cwd=a.source,text=True).strip(),'dirty source')
 a.out.mkdir(parents=True,exist_ok=True);native=a.out/'source';native.mkdir(exist_ok=True)
 archive=subprocess.check_output(['git','archive','HEAD'],cwd=a.source)
 with tarfile.open(fileobj=io.BytesIO(archive)) as tf:tf.extractall(native,filter='data')
 f=native/'src/checkpoints.cpp';s=f.read_text();require(s.count(OLD)==1,'upstream ancestry query changed');f.write_text(s.replace(OLD,NEW))
 k=native/'src/kernel.cpp';kernel=k.read_text();updated=kernel.replace('const CBlockIndex** pindexSelected)\n{','const CBlockIndex** pindexSelected, std::map<uint256, uint256>& selectionHashes)\n{')
 oldHash='        CDataStream ss(SER_GETHASH, 0);\n        ss << hashProof << nStakeModifierPrev;\n        uint256 hashSelection = Hash(ss.begin(), ss.end());'
 newHash='        uint256 hashSelection;\n        std::map<uint256, uint256>::const_iterator cached = selectionHashes.find(hashProof);\n        if (cached != selectionHashes.end()) hashSelection = cached->second;\n        else {\n            CDataStream ss(SER_GETHASH, 0);\n            ss << hashProof << nStakeModifierPrev;\n            hashSelection = Hash(ss.begin(), ss.end());\n            selectionHashes[hashProof] = hashSelection;\n        }'
 require(updated.count(oldHash)==1,'upstream selection hashing changed');updated=updated.replace(oldHash,newHash).replace('uint64 nStakeModifierNew = 0;','uint64 nStakeModifierNew = 0;\n    std::map<uint256, uint256> selectionHashes;').replace('nStakeModifier, &pindex))','nStakeModifier, &pindex, selectionHashes))');k.write_text(updated)
 import difflib
 patch=''.join(difflib.unified_diff(s.splitlines(True),f.read_text().splitlines(True),fromfile='a/src/checkpoints.cpp',tofile='b/src/checkpoints.cpp'))
 patch+=''.join(difflib.unified_diff(kernel.splitlines(True),updated.splitlines(True),fromfile='a/src/kernel.cpp',tofile='b/src/kernel.cpp'))
 if a.secp:
  require(a.secp_source is not None,'secp source pin required')
  secp_source_sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=a.secp_source,text=True).strip()
  require(secp_source_sha=='1a53f4961f337b4d166c25fce72ef0dc88806618','secp source pin')
  require(not subprocess.check_output(['git','status','--porcelain','--','src','include'],cwd=a.secp_source,text=True).strip(),'dirty secp source')
  key=native/'src/key.cpp';old_key=key.read_text();fast='    // Same secp256k1 ECDSA equation, high-s normalized; preserve OpenSSL fallback\n    // for any encoding or verification result the fast library does not accept.\n    static const secp256k1_context* verifyContext = secp256k1_context_create(SECP256K1_CONTEXT_VERIFY);\n    CPubKey encoded = GetPubKey();\n    secp256k1_pubkey publicKey;\n    secp256k1_ecdsa_signature signature, normalized;\n    if (!vchSig.empty() && secp256k1_ec_pubkey_parse(verifyContext, &publicKey, &encoded.vchPubKey[0], encoded.vchPubKey.size()) &&\n        secp256k1_ecdsa_signature_parse_der(verifyContext, &signature, &vchSig[0], vchSig.size())) {\n        secp256k1_ecdsa_signature_normalize(verifyContext, &normalized, &signature);\n        if (secp256k1_ecdsa_verify(verifyContext, &normalized, (unsigned char*)&hash, &publicKey)) return true;\n    }\n'
  new_key='#include <secp256k1.h>\n'+old_key.replace('    // -1 = error, 0 = bad sig, 1 = good',fast+'    // -1 = error, 0 = bad sig, 1 = good');key.write_text(new_key)
  patch+=''.join(difflib.unified_diff(old_key.splitlines(True),new_key.splitlines(True),fromfile='a/src/key.cpp',tofile='b/src/key.cpp'))
  cmake=native/'CMakeLists.txt';old_cmake=cmake.read_text();new_cmake=old_cmake+'\ntarget_include_directories(curecoind PRIVATE "'+str(a.secp.resolve()/'include')+'")\ntarget_link_libraries(curecoind PRIVATE "'+str(a.secp.resolve()/'lib/libsecp256k1.a')+'")\n';cmake.write_text(new_cmake)
  patch+=''.join(difflib.unified_diff(old_cmake.splitlines(True),new_cmake.splitlines(True),fromfile='a/CMakeLists.txt',tofile='b/CMakeLists.txt'))
 (a.out/'ancestry-cache.patch').write_text(patch)
 deps=a.deps.resolve();lib=deps/'usr/lib/x86_64-linux-gnu'
 for x in lib.glob('libboost_*.so.1.74.0'):
  link=lib/x.name.replace('.so.1.74.0','.so')
  if not link.exists():link.symlink_to(x.name)
 subprocess.run(['cmake','-S',str(native),'-B',str(a.out/'build'),'-DCMAKE_BUILD_TYPE=Release','-DBUILD_GUI=OFF','-DUSE_UPNP=OFF','-DBOOST_ROOT='+str(deps/'usr'),'-DBoost_NO_SYSTEM_PATHS=ON','-DBoost_NO_BOOST_CMAKE=ON','-DBOOST_LIBRARYDIR='+str(lib),'-DBDB_INCLUDE_PATH='+str(deps/'usr/include'),'-DBDB_LIBRARY='+str(lib/'libdb_cxx-5.3.so')],check=True)
 subprocess.run(['cmake','--build',str(a.out/'build'),'--parallel','6'],check=True)
 binary=next((a.out/'build').rglob('curecoind'));(a.out/'build-manifest.json').write_text(json.dumps({'source':SOURCE,'patch_sha256':hashlib.sha256((a.out/'ancestry-cache.patch').read_bytes()).hexdigest(),'daemon_sha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'secp_source':secp_source_sha if a.secp else None,'secp_static_library_sha256':hashlib.sha256((a.secp/'lib/libsecp256k1.a').read_bytes()).hexdigest() if a.secp else None},indent=2)+'\n')
 print('Built native replay binary:',binary)
if __name__=='__main__':main()
