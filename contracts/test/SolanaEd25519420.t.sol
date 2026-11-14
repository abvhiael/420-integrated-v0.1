// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/solana/SolanaEd25519420.sol";
contract SolanaEd25519420Test {
 function testRfc8032EmptyMessageAndMutation() public {SolanaEd25519420 v=new SolanaEd25519420();bytes32 pk=0xd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a;bytes memory sig=hex"e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b";require(v.verify(pk,hex"",sig),"RFC8032 rejected");sig[1]^=0x01;require(!v.verify(pk,hex"",sig));}
 function testNonCanonicalScalarAndIdentityKeyFailClosed() public {SolanaEd25519420 v=new SolanaEd25519420();bytes memory s=new bytes(64);s[0]=0x01;s[32]=0x01;require(!v.verify(bytes32(uint256(1)<<248),hex"",s));for(uint256 i=32;i<64;++i)s[i]=0xff;require(!v.verify(0xd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a,hex"",s));}
}
