#!/usr/bin/env python3
"""Generate scoped Foundry acceptance/rejection tests from actual gnark Groth16 outputs."""
import json
import pathlib
import re
import sys
if len(sys.argv)!=7:
    raise SystemExit("usage: script.py verifier.sol fixture.json test.t.sol test-contract scope-index root-index")
source,fixture,destination,contract_name=map(str,sys.argv[1:5])
scope=int(sys.argv[5]);root=int(sys.argv[6])
contents=pathlib.Path(source).read_text()
names=re.findall(r"^\s*contract\s+([A-Za-z_][A-Za-z0-9_]*)\b",contents,re.MULTILINE)
if len(names)!=1:raise SystemExit(f"expected one generated verifier, got {names}")
data=json.loads(pathlib.Path(fixture).read_text())
raw=data["proof"]
if not isinstance(raw,str) or not raw.startswith("0x") or len(raw)!=514:raise SystemExit("bad BN254 proof")
proof=[int(raw[2+i*64:2+(i+1)*64],16) for i in range(8)]
public=[int(x) for x in data["public"]]
n=len(public)
if not 0<=scope<n or not 0<=root<n or scope==root:raise SystemExit("wrong indices")
field=21888242871839275222246405745257275088548364400416034343698204186575808495617
if any(x<0 or x>=field for x in public):raise SystemExit("noncanonical public field")
proof_words=",".join(f"uint256({x})" for x in proof)
public_words=",".join(f"uint256({x})" for x in public)
filename=pathlib.Path(source).name
out=f"""// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/generated/{filename}";
contract {contract_name} {{
    function _check(address verifier,uint256[8] memory p,uint256[{n}] memory x)
      private view returns(bool) {{
      (bool ok,bytes memory result)=verifier.staticcall(
        abi.encodeWithSelector(bytes4(keccak256("verifyProof(uint256[8],uint256[{n}])")),p,x));
      if(!ok)return false;
      if(result.length==0)return true;
      if(result.length==32)return abi.decode(result,(bool));
      return false;
    }}
    function testGeneratedVerifierAcceptsRealProofAndRejectsTampering() public {{
      {names[0]} verifier=new {names[0]}();
      uint256[8] memory p=[{proof_words}];
      uint256[{n}] memory x=[{public_words}];
      require(_check(address(verifier),p,x),"valid actual proof rejected");
      x[{scope}]++;require(!_check(address(verifier),p,x),"cross-hand replay verified");
      x[{scope}]--;
      x[{root}]++;require(!_check(address(verifier),p,x),"changed root verified");
      x[{root}]--;
      p[0]++;require(!_check(address(verifier),p,x),"corrupted proof verified");
    }}
}}
"""
dest=pathlib.Path(destination)
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(out)
print(f"Generated {dest} from actual VK and proof")
