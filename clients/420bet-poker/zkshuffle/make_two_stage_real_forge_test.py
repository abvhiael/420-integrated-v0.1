#!/usr/bin/env python3
"""Exact-setup two-stage real Groth16 + gnark MiMC ciphertext-availability Foundry test."""
import json
import pathlib
import re
import sys

if len(sys.argv) != 6:
    raise SystemExit("usage: generator.py initial-verifier.sol initial-fixture.json shuffle-verifier.sol shuffle-fixture-dir out.t.sol")
initial_verifier, initial_fixture, shuffle_verifier, fixture_dir, dest = map(pathlib.Path, sys.argv[1:])
initial = json.loads(initial_fixture.read_text())
a = json.loads((fixture_dir/"EXPERIMENTAL-Reencrypt52SolidityFixture.json").read_text())
b = json.loads((fixture_dir/"EXPERIMENTAL-Reencrypt52StageBSolidityFixture.json").read_text())
data = json.loads((fixture_dir/"EXPERIMENTAL-Reencrypt52AvailabilityFixture.json").read_text())
FR = 21888242871839275222246405745257275088548364400416034343698204186575808495617

def checked(values, expected, title):
    numbers = [int(x) for x in values]
    if len(numbers) != expected or any(v < 0 or v >= FR for v in numbers):
        raise ValueError("invalid "+title)
    return numbers

ip = checked(initial["public"], 5, "initial public")
ap = checked(a["public"], 6, "stage A public")
bp = checked(b["public"], 6, "stage B public")
if not (ip[0] == ap[0] == int(data["stageARootIn"])
        and ap[2] == bp[0] == int(data["stageARootOut"])
        and bp[2] == int(data["stageBRootOut"])
        and ip[2] == ap[3] == bp[3] == 420
        and ip[3:] == ap[4:] == bp[4:]
        and ap[1] == int(data["stageAStatement"])
        and bp[1] == int(data["stageBStatement"])):
    raise SystemExit("fixture input/root/context continuity mismatch")
if data["stageBInput"] != data["stageAOutput"]:
    raise SystemExit("provider B input must equal the exact published output of provider A")
rounds = checked(data["roundConstants"], 110, "native gnark MiMC constants")
inp = checked(data["stageAInput"], 208, "initial ciphertext list")
out_a = checked(data["stageAOutput"], 208, "provider A ciphertext list")
out_b = checked(data["stageBOutput"], 208, "provider B ciphertext list")

# Put fixture bytes in the already permitted Foundry artifacts/contracts path;
# no fs_permissions changes, ffi, or heavy generated test bytecode.
binary_dir = pathlib.Path("..")/"artifacts"/"contracts"/"poker-ws2"
binary_dir.mkdir(parents=True,exist_ok=True)
def write_words(path, values):
    path.write_bytes(b"".join(x.to_bytes(32,"big") for x in values))
write_words(binary_dir/"initial.bin", inp)
write_words(binary_dir/"stage-a.bin", out_a)
write_words(binary_dir/"stage-b.bin", out_b)
write_words(binary_dir/"rounds.bin", [32, len(rounds), *rounds])

def rename(source, new_name):
    src=source.read_text()
    names=re.findall(r"^\s*contract\s+([A-Za-z_][A-Za-z0-9_]*)\b",src,re.M)
    if len(names)!=1:
        raise SystemExit("expected one generated Solidity verifier: "+str(source))
    return re.sub(r"\bcontract\s+"+re.escape(names[0])+r"\b","contract "+new_name,src,count=1)
out_dir=pathlib.Path("src/bet/generated")
out_dir.mkdir(parents=True,exist_ok=True)
(out_dir/"QualifiedInitial52WS2.sol").write_text(rename(initial_verifier,"QualifiedInitial52WS2"))
(out_dir/"QualifiedShuffle52WS2.sol").write_text(rename(shuffle_verifier,"QualifiedShuffle52WS2"))

def parse_proof(value):
    raw=value["proof"]
    if len(raw)!=514 or not raw.startswith("0x"):raise SystemExit("malformed Solidity proof")
    return [int(raw[2+64*i:2+64*(i+1)],16) for i in range(8)]
def literal(values):
    return ",".join("uint256("+str(x)+")" for x in values)
src=r'''// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/generated/QualifiedInitial52WS2.sol";
import "../../src/bet/generated/QualifiedShuffle52WS2.sol";
import "../../src/bet/PokerGnarkElGamalAdapters420.sol";
import "../../src/bet/PokerPrivateShuffleGate420.sol";
import "../../src/bet/PokerShuffleCiphertextAvailability420.sol";
import "../../src/bet/PokerShuffleProviderIndependence420.sol";
import "../../src/bet/PokerInitialEncryptedDeck420.sol";

interface VmTwoStageWS2 {
    function etch(address,bytes calldata) external;
    function chainId(uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
    function readFileBinary(string calldata) external returns(bytes memory);
}
contract WS2PermissiveAuthorization {
    function scopeForTable(bytes32 table) external pure returns(bytes32) {return table;}
    function isAuthorized(address,bytes32,bytes32,uint256) external pure returns(bool){return true;}
}
contract WS2CanonicalDeal {
    WS2PermissiveAuthorization private auth;
    address public constant providerA=address(0xAA54);
    address public constant providerB=address(0xBB54);
    bytes32 public transcript=keccak256("test-transcript");
    uint64 public epoch=7;
    constructor(){auth=new WS2PermissiveAuthorization();}
    function authorization() external view returns(BetAuthorization420){return BetAuthorization420(address(auth));}
    function ACTION_PROVIDER_COMMIT() external pure returns(bytes32){return keccak256("BET_POKER_DEAL_COMMIT");}
    function setTranscript(bytes32 digest) external {transcript=digest;}
    function getHand(bytes32) external view returns(PokerConfidentialDeal420.Hand memory h){
        h.tableId=keccak256("test-table");
        h.configHash=keccak256("test-config");
        h.rulesetId=keccak256("test-rules");
        h.versionId=keccak256("test-version");
        h.seatSnapshotHash=keccak256("test-snapshot");
        h.transcriptCommitment=transcript;
        h.epoch=epoch; h.nonce=2;
        h.state=PokerConfidentialDeal420.State.COMMITTED;
    }
}
contract PokerTwoStageActualGroth16WS2Test {
    VmTwoStageWS2 constant vm=VmTwoStageWS2(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant HAND=bytes32(uint256(420));
    address constant PROVIDER_A=address(0xAA54);
    address constant PROVIDER_B=address(0xBB54);
    uint256 constant FR=21888242871839275222246405745257275088548364400416034343698204186575808495617;

    function _initialProof() private pure returns(uint256[8] memory p,uint256[5] memory x){
        p=[__INITIAL_PROOF__];x=[__INITIAL_PUBLIC__];
    }
    function _stageAProof() private pure returns(uint256[8] memory p,uint256[6] memory x){
        p=[__A_PROOF__];x=[__A_PUBLIC__];
    }
    function _stageBProof() private pure returns(uint256[8] memory p,uint256[6] memory x){
        p=[__B_PROOF__];x=[__B_PUBLIC__];
    }
    function _coords(string memory filename) private returns(uint256[208] memory data){
        bytes memory raw=vm.readFileBinary(string.concat("../artifacts/contracts/poker-ws2/",filename));
        require(raw.length==208*32,"ciphertext availability fixture length");
        return abi.decode(raw,(uint256[208]));
    }
    function _constants() private returns(uint256[] memory constants){
        bytes memory raw=vm.readFileBinary("../artifacts/contracts/poker-ws2/rounds.bin");
        return abi.decode(raw,(uint256[]));
    }
    function _setup() private returns(
        PokerInitialEncryptedDeck420 initialDeck,
        PokerPrivateShuffleGate420 gate,
        PokerShuffleCiphertextAvailability420 availability,
        PokerShuffleProviderIndependence420 independence,
        WS2CanonicalDeal deals
    ){
        vm.chainId(31337);
        deals=new WS2CanonicalDeal();
        PokerVerifierVersions420 registry=new PokerVerifierVersions420(address(this));
        ( ,uint256[5] memory ix)=_initialProof();
        (,uint256[6] memory ax)=_stageAProof();
        bytes32 key=keccak256(abi.encode(ix[3],ix[4]));
        require(key==keccak256(abi.encode(ax[4],ax[5])),"wrong threshold key family");
        QualifiedInitial52WS2 initialVerifier=new QualifiedInitial52WS2();
        QualifiedShuffle52WS2 shuffleVerifier=new QualifiedShuffle52WS2();

        bytes32 initVersion=keccak256("initial-52-v2");
        bytes32 initCircuit=keccak256("gnark-initial-52-context");
        bytes32 initVK=keccak256("test-only-vk");
        bytes32 initSchema=keccak256("root,statement,hand,pkx,pky");
        registry.register(initVersion,address(initialVerifier),initVK,initCircuit,initSchema);
        PokerGnarkInitial52Adapter420 originalInitial=new PokerGnarkInitial52Adapter420(
            address(initialVerifier),address(registry),initVersion,initCircuit,initVK,initSchema,key);
        vm.etch(address(0x1002),address(originalInitial).code);
        bytes32 deckVersion=keccak256("initial-52-contract-v2");
        bytes32 deckCircuit=keccak256("initial-52-contract-circuit");
        bytes32 deckVK=keccak256("initial-52-contract-key");
        bytes32 deckSchema=keccak256("initial-52-contract-schema");
        registry.register(deckVersion,address(0x1002),deckVK,deckCircuit,deckSchema);
        PokerInitialEncryptedDeck420 originalDeck=new PokerInitialEncryptedDeck420(
            address(deals),address(registry),address(0x1002),
            deckVersion,deckCircuit,deckVK,deckSchema,key);
        vm.etch(address(0x1001),address(originalDeck).code);
        initialDeck=PokerInitialEncryptedDeck420(address(0x1001));

        bytes32 shuffleVersion=keccak256("shuffle-52-v2");
        bytes32 shuffleCircuit=keccak256("shuffle-52-pinned-circuit");
        bytes32 shuffleVK=keccak256("shuffle-52-test-vk");
        bytes32 shuffleSchema=keccak256("root,statement,outputroot,hand,pkx,pky");
        registry.register(shuffleVersion,address(shuffleVerifier),
            shuffleVK,shuffleCircuit,shuffleSchema);
        PokerGnarkShuffle52Adapter420 adapter=new PokerGnarkShuffle52Adapter420(
            address(shuffleVerifier),address(registry),shuffleVersion,
            shuffleCircuit,shuffleVK,shuffleSchema,key);
        uint256[] memory constants=_constants();
        availability=new PokerShuffleCiphertextAvailability420(
            constants,keccak256(abi.encode(constants)));
        independence=new PokerShuffleProviderIndependence420(address(this));
        vm.prank(PROVIDER_A);
        independence.claim(keccak256("independent controller A"),
            keccak256("audited operator A dossier"),uint64(block.timestamp+30 days));
        vm.prank(PROVIDER_B);
        independence.claim(keccak256("independent controller B"),
            keccak256("audited operator B dossier"),uint64(block.timestamp+30 days));
        independence.attest(PROVIDER_A,keccak256("independent controller A"),
            keccak256("audited operator A dossier"),uint64(block.timestamp+30 days));
        independence.attest(PROVIDER_B,keccak256("independent controller B"),
            keccak256("audited operator B dossier"),uint64(block.timestamp+30 days));
        independence.recordAudit(PROVIDER_A,keccak256("independent reviewer report A"),keccak256("audited operator A dossier"),keccak256("external report reference A"));
        independence.recordAudit(PROVIDER_B,keccak256("independent reviewer report B"),keccak256("audited operator B dossier"),keccak256("external report reference B"));
        PokerPrivateShuffleGate420 originalGate=new PokerPrivateShuffleGate420(
            address(deals),address(initialDeck),address(adapter),
            address(independence),address(availability),
            keccak256("shuffle-52-contract-circuit"),key);
        vm.etch(address(0x1003),address(originalGate).code);
        gate=PokerPrivateShuffleGate420(address(0x1003));
    }
    function _publishAll(PokerShuffleCiphertextAvailability420 availability) private {
        (,uint256[5] memory ix)=_initialProof();
        (,uint256[6] memory ax)=_stageAProof();
        (,uint256[6] memory bx)=_stageBProof();
        uint256[208] memory initial=_coords("initial.bin");
        uint256[208] memory shuffledA=_coords("stage-a.bin");
        uint256[208] memory shuffledB=_coords("stage-b.bin");
        uint256 beforeGas=gasleft();
        require(availability.publish(420,initial)==bytes32(ix[0]),"initial MiMC mismatch");
        require(beforeGas-gasleft()<=30_000_000,"initial ciphertext publication exceeds single-block gas budget");
        beforeGas=gasleft();
        require(availability.publish(420,shuffledA)==bytes32(ax[2]),"stage A MiMC mismatch");
        require(beforeGas-gasleft()<=30_000_000,"stage A ciphertext publication exceeds single-block gas budget");
        beforeGas=gasleft();
        require(availability.publish(420,shuffledB)==bytes32(bx[2]),"stage B MiMC mismatch");
        require(beforeGas-gasleft()<=30_000_000,"stage B ciphertext publication exceeds single-block gas budget");
    }
    function testRealTwoStageProofAndAuthenticatedCiphertextAvailability() public {
        (PokerInitialEncryptedDeck420 initialDeck,
         PokerPrivateShuffleGate420 gate,
         PokerShuffleCiphertextAvailability420 availability,,)=_setup();
        _publishAll(availability);
        (uint256[8] memory ip,uint256[5] memory ix)=_initialProof();
        require(uint256(initialDeck.statement(HAND,bytes32(ix[0])))%FR==ix[1],
            "initial exact context does not match");
        initialDeck.submit(HAND,bytes32(ix[0]),abi.encode(ip,ix));
        (uint256[8] memory ap,uint256[6] memory ax)=_stageAProof();
        (uint256[8] memory bp,uint256[6] memory bx)=_stageBProof();
        require(uint256(gate.statement(HAND,1,bytes32(ax[0]),bytes32(ax[2])))%FR==ax[1],
            "stage A exact context mismatch");
        require(uint256(gate.statement(HAND,2,bytes32(bx[0]),bytes32(bx[2])))%FR==bx[1],
            "stage B exact context mismatch");
        vm.prank(PROVIDER_A);
        gate.proveStage(HAND,1,bytes32(ax[0]),bytes32(ax[2]),abi.encode(ap,ax));
        require(!gate.isProofComplete(HAND),"premature shuffle completion");
        vm.prank(PROVIDER_B);
        gate.proveStage(HAND,2,bytes32(bx[0]),bytes32(bx[2]),abi.encode(bp,bx));
        require(gate.isProofComplete(HAND),"two genuine 52-card proofs not accepted");
        require(gate.recordOf(HAND).finalDeckRoot==bytes32(bx[2]),"wrong terminal root");
        vm.expectRevert(PokerPrivateShuffleGate420.WrongStage.selector);
        vm.prank(PROVIDER_A);
        gate.proveStage(HAND,1,bytes32(ax[0]),bytes32(ax[2]),abi.encode(ap,ax));
    }
    function testMissingCiphertextPublicationAndMalformedCoordinatesRejected() public {
        (PokerInitialEncryptedDeck420 initialDeck,
         PokerPrivateShuffleGate420 gate,
         PokerShuffleCiphertextAvailability420 availability,,)=_setup();
        (uint256[8] memory ip,uint256[5] memory ix)=_initialProof();
        initialDeck.submit(HAND,bytes32(ix[0]),abi.encode(ip,ix));
        (uint256[8] memory ap,uint256[6] memory ax)=_stageAProof();
        vm.expectRevert(PokerPrivateShuffleGate420.InvalidProof.selector);
        vm.prank(PROVIDER_A);
        gate.proveStage(HAND,1,bytes32(ax[0]),bytes32(ax[2]),abi.encode(ap,ax));
        uint256[208] memory invalid=_coords("initial.bin");
        invalid[0]=FR;
        vm.expectRevert(PokerShuffleCiphertextAvailability420.InvalidCiphertext.selector);
        availability.publish(420,invalid);
        invalid=_coords("initial.bin");
        invalid[0]+=1;
        bytes32 altered=availability.publish(420,invalid);
        require(altered!=bytes32(ix[0]),"modified ciphertext accepted original MiMC root");
    }
    function testProviderControlConflictAndProofSubstitutionRejected() public {
        (PokerInitialEncryptedDeck420 initialDeck,
         PokerPrivateShuffleGate420 gate,
         PokerShuffleCiphertextAvailability420 availability,
         PokerShuffleProviderIndependence420 independence,
         WS2CanonicalDeal deals)=_setup();
        _publishAll(availability);
        (uint256[8] memory ip,uint256[5] memory ix)=_initialProof();
        initialDeck.submit(HAND,bytes32(ix[0]),abi.encode(ip,ix));
        (uint256[8] memory ap,uint256[6] memory ax)=_stageAProof();
        (uint256[8] memory bp,uint256[6] memory bx)=_stageBProof();
        vm.prank(PROVIDER_B); independence.claim(keccak256("independent controller A"),keccak256("conflict evidence"),uint64(block.timestamp+30 days));
        independence.attest(PROVIDER_B,keccak256("independent controller A"),
            keccak256("conflict evidence"),uint64(block.timestamp+30 days));
        vm.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);
        vm.prank(PROVIDER_A);
        gate.proveStage(HAND,1,bytes32(ax[0]),bytes32(ax[2]),abi.encode(ap,ax));
        vm.prank(PROVIDER_B); independence.claim(keccak256("independent controller B"),keccak256("independent dossier"),uint64(block.timestamp+30 days));
        independence.attest(PROVIDER_B,keccak256("independent controller B"),
            keccak256("independent dossier"),uint64(block.timestamp+30 days));
        vm.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);
        vm.prank(PROVIDER_B);
        gate.proveStage(HAND,1,bytes32(ax[0]),bytes32(ax[2]),abi.encode(ap,ax));
        deals.setTranscript(keccak256("conflicting transcript"));
        vm.expectRevert(PokerPrivateShuffleGate420.InvalidProof.selector);
        vm.prank(PROVIDER_A);
        gate.proveStage(HAND,1,bytes32(ax[0]),bytes32(ax[2]),abi.encode(ap,ax));
        deals.setTranscript(keccak256("test-transcript"));
        vm.expectRevert(PokerPrivateShuffleGate420.InvalidProof.selector);
        vm.prank(PROVIDER_A);
        gate.proveStage(HAND,1,bytes32(ax[0]),bytes32(ax[2]),abi.encode(bp,bx));
        vm.prank(PROVIDER_A);
        gate.proveStage(HAND,1,bytes32(ax[0]),bytes32(ax[2]),abi.encode(ap,ax));
        vm.expectRevert(PokerPrivateShuffleGate420.InvalidProof.selector);
        vm.prank(PROVIDER_B);
        gate.proveStage(HAND,2,bytes32(bx[0]),bytes32(bx[2]),abi.encode(ap,ax));
        bp[0]+=1;
        vm.expectRevert(PokerPrivateShuffleGate420.InvalidProof.selector);
        vm.prank(PROVIDER_B);
        gate.proveStage(HAND,2,bytes32(bx[0]),bytes32(bx[2]),abi.encode(bp,bx));
    }
}
'''
replacements={
"__INITIAL_PROOF__":literal(parse_proof(initial)),
"__INITIAL_PUBLIC__":literal(ip),
"__A_PROOF__":literal(parse_proof(a)),
"__A_PUBLIC__":literal(ap),
"__B_PROOF__":literal(parse_proof(b)),
"__B_PUBLIC__":literal(bp),
}
for key,value in replacements.items():src=src.replace(key,value)
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(src)
print("Generated actual on-chain full-context initial + A/B shuffle proof and published ciphertext acceptance",dest)
