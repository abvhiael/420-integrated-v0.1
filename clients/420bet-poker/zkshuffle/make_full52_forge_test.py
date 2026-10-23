#!/usr/bin/env python3
"""Generate a Foundry integration test from the REAL gnark full-52 proof fixture.

Inputs must originate from the same exact-SHA proving run as the generated
Groth16 Solidity verifying key. Never substitute a mocked return-true verifier.
"""
import json
import pathlib
import re
import sys

if len(sys.argv) != 4:
    raise SystemExit("usage: make_full52_forge_test.py verifier.sol fixture.json destination.t.sol")
source = pathlib.Path(sys.argv[1])
fixture = pathlib.Path(sys.argv[2])
destination = pathlib.Path(sys.argv[3])
contents = source.read_text()
names = re.findall(r"^\s*contract\s+([A-Za-z_][A-Za-z0-9_]*)\b", contents, re.MULTILINE)
if len(names) != 1:
    raise SystemExit(f"expected one generated Groth16 contract, found {names}")
data = json.loads(fixture.read_text())
raw = data["proof"]
if not raw.startswith("0x") or len(raw) != 514:
    raise SystemExit("invalid canonical 256-byte BN254 Solidity proof")
words = [int(raw[2 + i * 64:2 + (i + 1) * 64], 16) for i in range(8)]
public = [int(s) for s in data["public"]]
if len(public) != 6 or public[3] == 0 or public[1] == 0:
    raise SystemExit("six bound circuit public inputs required")
if any(v < 0 or v >= 21888242871839275222246405745257275088548364400416034343698204186575808495617 for v in public):
    raise SystemExit("public input outside BN254 scalar field")
proof_literals = ",".join(f"uint256({v})" for v in words)
input_literals = ",".join(f"uint256({v})" for v in public)
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(f"""// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/generated/ExperimentalReencrypt52Verifier.sol";
contract PokerGeneratedProofAcceptanceTest {{
    function _call(address verifier,uint256[8] memory p,uint256[6] memory x)
      private view returns(bool ok) {{
        (bool success,bytes memory result)=verifier.staticcall(
          abi.encodeWithSelector(bytes4(keccak256("verifyProof(uint256[8],uint256[6])")),p,x));
        if(!success)return false;
        if(result.length==0)return true;
        if(result.length==32)return abi.decode(result,(bool));
        return false;
    }}
    function testReal52CardGroth16SolidityAcceptsProofAndRejectsTampering() public {{
        {names[0]} verifier=new {names[0]}();
        uint256[8] memory proof=[{proof_literals}];
        uint256[6] memory input=[{input_literals}];
        require(_call(address(verifier),proof,input),"real valid 52-card proof rejected");
        input[3]+=1;
        require(!_call(address(verifier),proof,input),"cross-hand replay verified");
        input[3]-=1;
        input[2]+=1;
        require(!_call(address(verifier),proof,input),"modified final encrypted deck verified");
        input[2]-=1;
        input[1]+=1;
        require(!_call(address(verifier),proof,input),"cross-context replay verified");
        input[1]-=1;
        proof[0]+=1;
        require(!_call(address(verifier),proof,input),"tampered Groth16 proof verified");
    }}
}}
""")
print(f"Generated {destination} using {source.name} and {fixture.name}")
