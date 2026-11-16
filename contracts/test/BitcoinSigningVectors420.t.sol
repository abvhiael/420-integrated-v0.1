// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/bitcoin/BitcoinSigningTransaction420.sol";
interface BTCVectorVm420 {function readFile(string calldata) external view returns(string memory);function parseBytes(string calldata) external pure returns(bytes memory);function parseJsonBytes32(string calldata,string calldata) external pure returns(bytes32);}
contract BitcoinSigningVectors420Test {
 BTCVectorVm420 constant vm=BTCVectorVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
 function load(string memory name) internal view returns(bytes memory){return vm.parseBytes(vm.readFile(string.concat("contracts/test/fixtures/bitcoin/withdrawal-v1/",name,".hex")));}
 function value(string memory name) internal view returns(bytes32){return vm.parseJsonBytes32(vm.readFile("contracts/test/fixtures/bitcoin/withdrawal-v1/vectors.json"),string.concat(".",name));}
 function testIndependentLegacyAndSegwitTxidsAndSkeletons() public view {BitcoinSigningTransaction420.Parsed memory u=BitcoinSigningTransaction420.parse(load("unsigned"));BitcoinSigningTransaction420.Parsed memory l=BitcoinSigningTransaction420.parse(load("legacy"));BitcoinSigningTransaction420.Parsed memory w=BitcoinSigningTransaction420.parse(load("segwit"));require(u.txid==value("unsigned_txid")&&l.txid==value("legacy_txid")&&w.txid==value("segwit_txid"));require(u.skeletonHash==l.skeletonHash&&l.skeletonHash==w.skeletonHash&&w.skeletonHash==value("script_sig_and_witness_stripped_skeleton"));require(!u.signedData&&l.signedData&&w.signedData&&u.inputsHash==l.inputsHash&&l.inputsHash==w.inputsHash);require(BridgeCrypto420.sha256d(load("segwit"))==value("segwit_wtxid")&&w.txid!=value("segwit_wtxid"));}
 function parse(bytes calldata raw) external pure returns(bytes32){return BitcoinSigningTransaction420.parse(raw).txid;}
 function testMalformedSigningSerializationCannotReachWallet() public {bytes memory raw=load("unsigned");(bool ok,)=address(this).call(abi.encodeCall(this.parse,(bytes.concat(raw,hex"00"))));require(!ok);raw[4]=0;(ok,)=address(this).call(abi.encodeCall(this.parse,(raw)));require(!ok);}
}
