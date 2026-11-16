// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./DobbscoinFinalityVerifier420.t.sol";

contract DobbscoinHistoricalHarness420 {
    function inclusion(bytes memory transaction,uint32 index,bytes32[] memory siblings,bytes32 root) external pure returns(bool){DobbscoinWire420.Transaction memory t=DobbscoinWire420.parse(transaction,false);return DobbscoinConsensus420.branch(t.id,index,siblings)==root;}
    function parse(bytes memory transaction) external pure returns(DobbscoinWire420.Transaction memory){return DobbscoinWire420.parse(transaction,false);}
}
contract DobbscoinHistorical420Test {
    DobbscoinVm420 constant vm=DobbscoinVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function deploy(DobbscoinFinalityVerifier420.Proof memory p) private returns(DobbscoinFinalityVerifier420 v){
        AuthenticatedCheckpoint420 cp=new AuthenticatedCheckpoint420(address(this),keccak256("DOBBSCOIN/MAINNET"),address(0x23),1914745,0xc6d2be979323fee26cac4dd88c0e180992d8c62a8901cf6a2faf621f347d2cb8,sha256(abi.encode("420/BOB/NATIVE-REPLAY-STATE/V1",p.state)));
        v=new DobbscoinFinalityVerifier420(address(this),address(cp),address(this),1);
    }

    function testQualifiedNativeCheckpointBundle() public {
        vm.warp(1800000000);string memory json=vm.readFile("contracts/test/fixtures/dobbscoin/native-checkpoint.json");
        bytes32 root=bytes32(vm.parseJsonBytes(json,".root"));
        DobbscoinFinalityVerifier420.Proof[] memory ps=abi.decode(vm.parseJsonBytes(json,".abiProofs"),(DobbscoinFinalityVerifier420.Proof[]));require(ps.length==28);
        AuthenticatedCheckpoint420 cp=new AuthenticatedCheckpoint420(address(this),keccak256("DOBBSCOIN/MAINNET"),address(0x23),1914745,0xc6d2be979323fee26cac4dd88c0e180992d8c62a8901cf6a2faf621f347d2cb8,root);
        DobbscoinFinalityVerifier420 v=new DobbscoinFinalityVerifier420(address(this),address(cp),address(this),1);
        for(uint256 i;i<ps.length;++i){require(ps[i].stateIndex==i&&ps[i].stateBranch.length>0);(uint64 height,bytes32 hash)=v.verifyFinalizedBlock(abi.encode(ps[i]));require(height==ps[i].state.height&&hash==ps[i].state.blockHash);}
    }
    function testGenuineHistoricalDifficultyAndEmergencyBlocks() public {
        vm.warp(1800000000);string memory json=vm.readFile("contracts/test/fixtures/dobbscoin/proofs.json");
        DobbscoinFinalityVerifier420.Proof[] memory ps=abi.decode(vm.parseJsonBytes(json,".settledProofs"),(DobbscoinFinalityVerifier420.Proof[]));require(ps.length==28);
        for(uint256 i;i<ps.length;++i){DobbscoinFinalityVerifier420 v=deploy(ps[i]);(uint64 h,bytes32 id)=v.verifyFinalizedBlock(abi.encode(ps[i]));require(h==ps[i].state.height&&id==ps[i].state.blockHash);}
    }
    function testGenuineHistoricalTransactionAndOutputNotABridgeDeposit() public {
        vm.warp(1800000000);string memory json=vm.readFile("contracts/test/fixtures/dobbscoin/proofs.json");
        DobbscoinFinalityVerifier420.Proof memory p=abi.decode(vm.parseJsonBytes(json,".historicalOutput"),(DobbscoinFinalityVerifier420.Proof));DobbscoinFinalityVerifier420 v=deploy(p);
        (uint64 h,)=v.verifyFinalizedBlock(abi.encode(p));require(h==68493);DobbscoinHistoricalHarness420 helper=new DobbscoinHistoricalHarness420();
        require(helper.inclusion(p.transaction,p.transactionIndex,p.transactionBranch,DobbscoinWire420.hashAt(p.header,36)));
        DobbscoinWire420.Transaction memory t=helper.parse(p.transaction);require(!t.coinbase&&t.outputs.length>0&&t.outputs[0].amount>0);
        // The authentic historical transaction has no destination-bound 420 memo.
        // It proves historical inclusion/output parsing, never a gateway deposit.
        p.recipient=address(0xB0B);p.route=keccak256("historical-not-authorized");vm.expectRevert();v.verifyFinalizedTransfer(abi.encode(p));
    }
}
