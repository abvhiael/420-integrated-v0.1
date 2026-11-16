// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./MalformedProofRecipientFuzzHardening420.t.sol";
/// @notice Ethereum's zero address is rejected; a Solana public key remains a full 32-byte value.
contract BridgeRecipientEncodingRegression420Test is MalformedProofRecipientFuzzHardening420Test {
 function testEthereumZeroRecipientIsRejectedByExistingAdapter() public {this.testFuzzEthereumRecipientLength(new bytes(20));}
}
