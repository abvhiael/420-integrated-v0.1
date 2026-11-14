// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/vendor/sp1/v6.1.0/SP1VerifierGroth16.sol";
interface EthereumProofVm420 {function readFileBinary(string calldata) external view returns(bytes memory);}
contract EthereumSP1HistoricalProof420Test {
    EthereumProofVm420 constant vm=EthereumProofVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant VKEY=0x009677367b726fbff9493b3cb72e5d6d218cf4e453f92b7ca1bfce64fe005f1b;
    function testRealHistoricalMainnetConsensusProofAndTampering() public {
        SP1Verifier v=new SP1Verifier();
        bytes memory proof=vm.readFileBinary("contracts/test/fixtures/ethereum/consensus-proof.bin");
        bytes memory values=vm.readFileBinary("contracts/test/fixtures/ethereum/consensus-public-values.bin");
        (bool valid,)=address(v).staticcall{gas:2_000_000}(abi.encodeWithSelector(ISP1Verifier.verifyProof.selector,VKEY,values,proof));require(valid,"genuine proof exceeded verification gas bound or failed");
        (bool ok,)=address(v).staticcall{gas:2_000_000}(abi.encodeWithSelector(ISP1Verifier.verifyProof.selector,bytes32(uint256(VKEY)^1),values,proof));require(!ok,"wrong program accepted");
        values[63]^=0x01;
        (ok,)=address(v).staticcall{gas:2_000_000}(abi.encodeWithSelector(ISP1Verifier.verifyProof.selector,VKEY,values,proof));require(!ok,"forged public outputs accepted");
        values[63]^=0x01;proof[proof.length-1]^=0x01;
        (ok,)=address(v).staticcall{gas:2_000_000}(abi.encodeWithSelector(ISP1Verifier.verifyProof.selector,VKEY,values,proof));require(!ok,"forged proof accepted");
    }
}
