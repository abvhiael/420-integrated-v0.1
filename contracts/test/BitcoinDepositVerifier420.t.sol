// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/BitcoinFinalityVerifier420.sol";

contract BitcoinDepositVerifier420Test {
    function testGenesisAndConsensusArithmetic() public {
        BitcoinHeaderChain420 c=new BitcoinHeaderChain420();
        require(c.bestTip()==c.GENESIS());
        require(c.expectedBits(c.GENESIS())==0x1d00ffff);
        require(c.medianTimePast(c.GENESIS())==1231006505);
        require(c.blockWork(c.POW_LIMIT())==4295032833);
        require(c.encodeTarget(c.decodeTarget(0x1d00ffff))==0x1d00ffff);
        require(c.confirmations(c.GENESIS(),new bytes32[](0))==1);
        bytes memory genesis=hex"0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c";
        require(c.submit(genesis)==c.GENESIS());
        genesis[4]=0x01;
        (bool ok,)=address(c).call(abi.encodeCall(c.submit,(genesis)));
        require(!ok);
    }
    function testDepositWireAndDomain() public {
        BitcoinHeaderChain420 c=new BitcoinHeaderChain420();
        bytes memory script=hex"00141111111111111111111111111111111111111111";
        BitcoinFinalityVerifier420 v=new BitcoinFinalityVerifier420(c,script,keccak256("btc-route"),1,address(this));
        bytes memory commitment=v.commitmentScript(0,address(0xB0B),1000);
        bytes memory tx_=abi.encodePacked(hex"0100000001",bytes32(uint256(1)),hex"0000000000ffffffff02e80300000000000016",script,hex"000000000000000022",commitment,hex"00000000");
        BitcoinTransaction420.Parsed memory parsed=BitcoinTransaction420.parse(tx_,0,1);
        require(parsed.payment.value==1000 && parsed.payment.scriptHash==keccak256(script));
        require(parsed.commitment.value==0 && parsed.commitment.scriptHash==keccak256(commitment));
        require(!parsed.coinbase);
        require(keccak256(v.commitmentScript(0,address(0xBAD),1000))!=parsed.commitment.scriptHash);
        require(keccak256(v.commitmentScript(1,address(0xB0B),1000))!=parsed.commitment.scriptHash);
        require(keccak256(v.commitmentScript(0,address(0xB0B),1001))!=parsed.commitment.scriptHash);
        bytes32[] memory siblings=new bytes32[](0);
        require(v.verifyInclusion(parsed.txid,parsed.txid,0,siblings));
        require(!v.verifyInclusion(parsed.txid,parsed.txid,1,siblings));
        BitcoinFinalityVerifier420.Proof memory proof=BitcoinFinalityVerifier420.Proof(c.GENESIS(),tx_,0,1,address(0xB0B),0,siblings,siblings);
        (bool ok,)=address(v).staticcall(abi.encodeCall(v.verifyFinalizedTransfer,(abi.encode(proof))));
        require(!ok);
        (ok,)=address(this).call(abi.encodeCall(this.parse,(abi.encodePacked(tx_,hex"00"))));
        require(!ok);
    }
    function parse(bytes calldata raw) external pure returns(BitcoinTransaction420.Parsed memory){
        return BitcoinTransaction420.parse(raw,0,1);
    }
}
