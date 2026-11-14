// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/BitcoinTransaction420.sol";
import "../src/bridge/verifiers/BitcoinHeaderPow420.sol";
import "../src/bridge/verifiers/BitcoinMerkleBranch420.sol";
interface HistoricalSegwitVm420 {function readFileBinary(string calldata) external view returns(bytes memory);}
contract BitcoinHistoricalSegwit420Test {
    function testGenuineHistoricalSegwitTxidOutputsAndMerkleBranch() public view {
        HistoricalSegwitVm420 vm=HistoricalSegwitVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
        bytes memory raw=vm.readFileBinary("contracts/test/fixtures/bitcoin/segwit-transaction.bin");
        BitcoinTransaction420.Parsed memory p=BitcoinTransaction420.parse(raw,0,1);
        require(p.txid==0x1c5cfd5ceb65588602c01cdc6a7cb72b1f6fc045683e106587e4ebd22579908f && p.strippedSize==192 && !p.coinbase);
        require(BridgeCrypto420.sha256d(raw)==0xed5d7da30051f1c83d2e01248a5d34b47d8178238d5a84abeb3b7ef921d81761 && BridgeCrypto420.sha256d(raw)!=p.txid);
        require(p.payment.value==311000 && p.commitment.value==0);
        require(p.payment.scriptHash==keccak256(hex"a91422c17a06117b40516f9826804800003562e834c987"));
        require(p.commitment.scriptHash==keccak256(hex"6a4b424950313431205c6f2f2048656c6c6f20536567576974203a2d29206b656570206974207374726f6e6721204c4c415020426974636f696e20747769747465722e636f6d2f6b6873396e65"));
        bytes memory block_=vm.readFileBinary("contracts/test/fixtures/bitcoin/block481824.bin");
        bytes memory header=new bytes(80);for(uint256 i;i<80;++i)header[i]=block_[i];
        require(BitcoinHeaderPow420.verify(header)==0x93987f1602194afce36375f21451f22e743bcbd918801c000000000000000000);
        bytes32 root=bytes32(BridgeWire420.readBE(header,36,32));
        bytes32[] memory siblings=new bytes32[](11);
        siblings[0]=0xdb28a976d7ee0e36c9ecacd89d9ff25c670ec2f31714fb26f790a11fab537ae0;
        siblings[1]=0x0567897b1548eb2ff23356a9d7c5b7b015643bda7eb83692f97aa0c3ec3c2221;
        siblings[2]=0x5dc263e2c9e78c364a295e787d5b6b15dda8d56eb9dcc942233ad87690d42fd6;
        siblings[3]=0x29e41f2883eed8738b31467025f0b55de336cb16f00e54629a64602ee8fb51ce;
        siblings[4]=0x41cde61d96d0fb1c5c89cd65a3a475fad12a5534e3421114146ed944330a31af;
        siblings[5]=0x2d90247af00972fdf2675bde5b378b8465f78ea760612849ae4b41242eb21228;
        siblings[6]=0xcc82d2561ba9b0e04c8d77357651e1eb294838761f97a139771c6c35694fdad0;
        siblings[7]=0xbfa9ef8aa5a017ca024203cae6fb36ba3da0f2f1dcec144d372dde345988fa0c;
        siblings[8]=0xf52d418e214e38036185096041f8c173348581d0189056864f28cf5dc9f33266;
        siblings[9]=0x360836d748dfd650efc593e5d0556680ff42c05cb36220ba7f39ca3a0fb8c8b3;
        siblings[10]=0x54858c6d4d6290ac5c1c67772a455e2d266027be0b9b7cf44b8104fd96225366;
        // Count is independently reconstructed from the full raw block, not a bridge proof claim.
        require(BitcoinMerkleBranch420.verify(p.txid,root,12,1866,siblings));
    }
}
