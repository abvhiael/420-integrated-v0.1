#!/usr/bin/env python3
"""Generate real Groth16 adapter-level Foundry acceptance from gnark fixtures.

Proof bytes and public words are taken from the pinned generated VK/proof
artifact; mocks are forbidden in this integration qualification owner.
"""
import json
import pathlib
import re
import sys

if len(sys.argv) != 5:
    raise SystemExit("usage: script.py delivery|recipient verifier.sol fixture.json output.t.sol")
kind, source, fixture, dest = sys.argv[1:]
if kind not in {"delivery", "recipient"}:
    raise SystemExit("unrecognized verifier family")
src = pathlib.Path(source)
names = re.findall(r"^\s*contract\s+([A-Za-z_][A-Za-z0-9_]*)\b", src.read_text(), re.MULTILINE)
if len(names) != 1:
    raise SystemExit("expected one generated Solidity verifier contract")
data = json.loads(pathlib.Path(fixture).read_text())
proof = data["proof"]
if not proof.startswith("0x") or len(proof) != 514:
    raise SystemExit("invalid gnark Solidity proof bytes")
p = [int(proof[2+i*64:2+(i+1)*64], 16) for i in range(8)]
x = [int(word) for word in data["public"]]
fr = 21888242871839275222246405745257275088696311157297823662689037894645226208583
n = 18 if kind == "delivery" else 3
if len(x) != n or any(v < 0 or v >= fr for v in x):
    raise SystemExit("wrong public input schema or noncanonical field element")
words = lambda vals: ",".join(f"uint256({v})" for v in vals)
common = f"""// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/generated/{src.name}";
import "../src/bet/PokerVerifierVersions420.sol";
import "../src/bet/PokerGnarkEncryptedShareDeliveryAdapter420.sol";
import "../src/bet/PokerGnarkRecipientKeyPoPAdapter420.sol";
contract PokerActualPrivateDeliveryAdapterProofTest {{
 function testRealProofThroughPinnedAdapter() public {{
  {names[0]} verifier = new {names[0]}();
  PokerVerifierVersions420 registry=new PokerVerifierVersions420(address(this));
  bytes32 version=keccak256("actual delivery fixture version");
  bytes32 vk=keccak256("actual fixture VK artifact");
  bytes32 circuit=keccak256("actual fixture circuit identity");
  bytes32 schema=keccak256("actual fixture public input order");
  registry.register(version,address(verifier),vk,circuit,schema);
  uint256[8] memory p=[{words(p)}];
  uint256[{n}] memory input=[{words(x)}];
  bytes memory packed=abi.encode(p,input);
"""
if kind == "delivery":
    body = f"""
  uint256[12] memory points;
  for(uint256 i=0;i<12;i++)points[i]=input[i+6];
  bytes32 providerKeyHash=keccak256(abi.encode(points[4],points[5]));
  PokerGnarkEncryptedShareDeliveryAdapter420 adapter=
    new PokerGnarkEncryptedShareDeliveryAdapter420(
      address(verifier),address(registry),version,circuit,vk,schema,providerKeyHash);
  bytes32 handId=bytes32(input[0]);bytes32 root=bytes32(input[1]);
  require(adapter.verifyDelivery(handId,root,uint8(input[2]),uint8(input[3]),
    uint8(input[4]),input[5],points,packed),"genuine generated proof rejected");
  require(!adapter.verifyDelivery(handId,root,uint8(input[2]),uint8(input[3]),
    uint8(input[4]),input[5]+1,points,packed),"cross-context proof replay");
  require(!adapter.verifyDelivery(handId,bytes32(uint256(root)+1),uint8(input[2]),
    uint8(input[3]),uint8(input[4]),input[5],points,packed),"wrong deck root accepted");
  points[8]++;
  require(!adapter.verifyDelivery(handId,root,uint8(input[2]),uint8(input[3]),
    uint8(input[4]),input[5],points,packed),"tampered envelope accepted");
  points[8]--;
  p[0]++;
  require(!adapter.verifyDelivery(handId,root,uint8(input[2]),uint8(input[3]),
    uint8(input[4]),input[5],points,abi.encode(p,input)),"corrupt proof accepted");
"""
else:
    body = """
  PokerGnarkRecipientKeyPoPAdapter420 adapter=
    new PokerGnarkRecipientKeyPoPAdapter420(
      address(verifier),address(registry),version,vk,circuit,schema);
  require(adapter.verifyKeyPossession(input[0],input[1],input[2],packed),
    "real key possession proof rejected");
  require(!adapter.verifyKeyPossession(input[0]+1,input[1],input[2],packed),
    "cross-domain possession proof replay");
  require(!adapter.verifyKeyPossession(input[0],input[1]+1,input[2],packed),
    "wrong recipient public key accepted");
  p[0]++;
  require(!adapter.verifyKeyPossession(input[0],input[1],input[2],abi.encode(p,input)),
    "corrupt proof accepted");
"""
destp=pathlib.Path(dest)
destp.parent.mkdir(parents=True,exist_ok=True)
destp.write_text(common + body + " }\n}\n")
print(f"generated actual proof adapter test: {destp}")
