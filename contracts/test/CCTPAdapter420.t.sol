// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./helpers/CCTPNativeHarness420.sol";

contract CCTPAdapter420Test is CCTPNativeHarness420 {
    function setUp() public {setupNative(0,address(0));}
    function assertDelivery(string memory name) internal {
        CCTPV2Message420.Message memory m=message(name);uint256 before=token.balanceOf(m.mintRecipient);
        IBridgeAdapter420.VerifiedTransfer memory v=inbound(name);
        require(v.routeId==route(m.sourceDomain)&&v.assetId==ASSET&&v.recipient==m.mintRecipient&&v.amount==m.amount-m.fee,"transfer binding");
        require(token.balanceOf(m.mintRecipient)==before+v.amount&&adapter.consumedNonces(m.nonce)&&CCTPNativeMT420(MT).usedNonces(m.nonce)==1,"native mint");
        require(v.sourceTxId==keccak256(file(string.concat(name,".message.hex"))),"signed message digest");
    }
    function testGenuineBaseStandard() public {assertDelivery("base-standard");}
    function testGenuineArbitrumFastNetFees() public {assertDelivery("arbitrum-fast");}
    function testGenuineArbitrumFinalizedWithOpaqueHook() public {assertDelivery("arbitrum-standard-hook");}
    function testGenuineSolanaMessageSenderNotTruncated() public {
        CCTPV2Message420.Message memory m=message("solana-standard");IBridgeAdapter420.VerifiedTransfer memory v=inbound("solana-standard");
        require(v.sender==address(uint160(uint256(keccak256(abi.encode("420/CCTP/V2/NON-EVM-SENDER",m.sourceDomain,m.messageSender))))),"non-EVM sender");
    }
    function testDefaultUnconfiguredIntegrationInactive() public {
        USDCCCTPAdapter a=new USDCCCTPAdapter(address(this),router,address(token),ASSET);
        (bool ok,bytes memory r)=router.call(abi.encodeCall(CCTPRouterCaller420.inbound,(a,proof("base-standard"))));require(!ok&&bytes4(r)==USDCCCTPAdapter.Inactive.selector,"inactive default");
    }
    function testDisabledIssuerFailsClosed() public {adapter.setIssuerEnabled(false);reject(proof("base-standard"),USDCCCTPAdapter.Inactive.selector);}
    function testOnlyRouterInbound() public {(bool ok,bytes memory r)=address(adapter).call(abi.encodeCall(adapter.verifyInbound,(proof("base-standard"))));require(!ok&&bytes4(r)==USDCCCTPAdapter.OnlyRouter.selector,"router");}
    function testGovernanceAuthorization() public {vm.prank(address(0xBAD));(bool ok,)=address(adapter).call(abi.encodeCall(adapter.setIssuerEnabled,(false)));require(!ok,"governance");}
    function testReplayRejectsSameAttestation() public {inbound("base-standard");reject(proof("base-standard"),USDCCCTPAdapter.Replay.selector);}
    function testReplaySurvivesReconfiguration() public {inbound("base-standard");adapter.configureIssuer(MT,TM,0,keccak256("CONTROLLED ROTATION"));adapter.setIssuerEnabled(true);reject(proof("base-standard"),USDCCCTPAdapter.Replay.selector);}
    function testReplaySurvivesReattestedMessageDigestChange() public {
        inbound("base-standard");bytes memory raw=file("base-standard.message.hex");setWord(raw,344,block.number+1000,32);
        reject(abi.encode(raw,file("base-standard.attestation.hex")),USDCCCTPAdapter.Replay.selector);
    }
    function testWrongVersionRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,0,0,4);reject(abi.encode(raw,file("base-standard.attestation.hex")),CCTPV2Message420.InvalidMessage.selector);}
    function testWrongBodyVersionRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,148,0,4);reject(abi.encode(raw,file("base-standard.attestation.hex")),CCTPV2Message420.InvalidMessage.selector);}
    function testWrongDestinationRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,8,77,4);reject(abi.encode(raw,file("base-standard.attestation.hex")),USDCCCTPAdapter.InvalidProof.selector);}
    function testWrongSourceRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,4,77,4);reject(abi.encode(raw,file("base-standard.attestation.hex")),USDCCCTPAdapter.InvalidConfiguration.selector);}
    function testWrongMessengerRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,44,123,32);reject(abi.encode(raw,file("base-standard.attestation.hex")),USDCCCTPAdapter.InvalidProof.selector);}
    function testWrongLocalMessengerRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,76,123,32);reject(abi.encode(raw,file("base-standard.attestation.hex")),USDCCCTPAdapter.InvalidProof.selector);}
    function testWrongDestinationCallerRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,108,uint256(uint160(router)),32);reject(abi.encode(raw,file("base-standard.attestation.hex")),USDCCCTPAdapter.InvalidProof.selector);}
    function testWrongBurnTokenRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,152,123,32);reject(abi.encode(raw,file("base-standard.attestation.hex")),USDCCCTPAdapter.InvalidProof.selector);}
    function testDirtyRecipientHighBitsRejected() public {bytes memory raw=file("base-standard.message.hex");raw[184]=0x01;reject(abi.encode(raw,file("base-standard.attestation.hex")),CCTPV2Message420.InvalidMessage.selector);}
    function testZeroAmountRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,216,0,32);reject(abi.encode(raw,file("base-standard.attestation.hex")),CCTPV2Message420.InvalidMessage.selector);}
    function testZeroNonceRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,12,0,32);reject(abi.encode(raw,file("base-standard.attestation.hex")),CCTPV2Message420.InvalidMessage.selector);}
    function testFeeAboveMaximumRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,312,message("base-standard").maxFee+1,32);reject(abi.encode(raw,file("base-standard.attestation.hex")),CCTPV2Message420.InvalidMessage.selector);}
    function testExpiredMessageRejected() public {bytes memory raw=file("base-standard.message.hex");vm.roll(50);setWord(raw,344,50,32);reject(abi.encode(raw,file("base-standard.attestation.hex")),USDCCCTPAdapter.InvalidProof.selector);}
    function testFastMessageRejectedByFinalizedPolicy() public {
        CCTPV2Message420.Message memory m=message("arbitrum-fast");adapter.setPeer(3,USDCCCTPAdapter.Peer(route(3),m.sender,bytes32(uint256(uint160(MT))),m.burnToken,2000,true,true,true));reject(proof("arbitrum-fast"),USDCCCTPAdapter.InvalidProof.selector);
    }
    function testInconsistentExecutedFinalityRejected() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,144,1000,4);reject(abi.encode(raw,file("base-standard.attestation.hex")),CCTPV2Message420.InvalidMessage.selector);}
    function testChangedSignedAmountRejectedByActualIssuer() public {bytes memory raw=file("base-standard.message.hex");setWord(raw,216,message("base-standard").amount+1,32);reject(abi.encode(raw,file("base-standard.attestation.hex")),bytes4(keccak256("Error(string)")));require(!adapter.consumedNonces(message("base-standard").nonce),"nonce rollback");}
    function testMissingSignatureRejectedByActualIssuer() public {bytes memory sig=file("base-standard.attestation.hex");bytes memory shortSig=new bytes(65);for(uint256 i;i<65;++i)shortSig[i]=sig[i];reject(abi.encode(file("base-standard.message.hex"),shortSig),bytes4(keccak256("Error(string)")));}
    function testDuplicateSignerRejectedByActualIssuer() public {bytes memory sig=file("base-standard.attestation.hex");for(uint256 i;i<65;++i)sig[65+i]=sig[i];reject(abi.encode(file("base-standard.message.hex"),sig),bytes4(keccak256("Error(string)")));}
    function testUnsortedSignersRejectedByActualIssuer() public {bytes memory sig=file("base-standard.attestation.hex");for(uint256 i;i<65;++i)(sig[i],sig[65+i])=(sig[65+i],sig[i]);reject(abi.encode(file("base-standard.message.hex"),sig),bytes4(keccak256("Error(string)")));}
    function testMalformedRecoveryIdRejectedByActualIssuer() public {bytes memory sig=file("base-standard.attestation.hex");sig[64]=0x00;reject(abi.encode(file("base-standard.message.hex"),sig),bytes4(keccak256("Error(string)")));}
    function testHighSMalleableSignatureRejectedByActualIssuer() public {
        bytes memory sig=file("base-standard.attestation.hex");uint256 low=BridgeWire420.readBE(sig,32,32);uint256 high=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141-low;setWord(sig,32,high,32);sig[64]=sig[64]==0x1b?bytes1(0x1c):bytes1(0x1b);
        reject(abi.encode(file("base-standard.message.hex"),sig),bytes4(keccak256("Error(string)")));
    }
    function testExtraSignatureRejectedByActualIssuer() public {bytes memory sig=file("base-standard.attestation.hex");bytes memory third=new bytes(65);for(uint256 i;i<65;++i)third[i]=sig[i];reject(abi.encode(file("base-standard.message.hex"),bytes.concat(sig,third)),bytes4(keccak256("Error(string)")));}
    function testUnauthorizedWellFormedSignersRejectedByActualIssuer() public {
        bytes memory raw=file("base-standard.message.hex");uint256 one=420;uint256 two=421;if(vm.addr(one)>vm.addr(two))(one,two)=(two,one);
        (uint8 v,bytes32 r,bytes32 s)=vm.sign(one,keccak256(raw));bytes memory sig=abi.encodePacked(r,s,v);(v,r,s)=vm.sign(two,keccak256(raw));sig=bytes.concat(sig,abi.encodePacked(r,s,v));
        (bool ok,bytes memory reason)=router.call(abi.encodeCall(CCTPRouterCaller420.inbound,(adapter,abi.encode(raw,sig))));require(!ok&&keccak256(reason)==keccak256(abi.encodeWithSignature("Error(string)","Invalid signature: not attester")),"issuer authorization");
    }
    function testRevokedIssuerAttesterRejected() public {CCTPNativeMT420(MT).setSignatureThreshold(1);CCTPNativeMT420(MT).disableAttester(0x725b06F73ff761eF5390e39315e2BfbF60d33F96);reject(proof("base-standard"),bytes4(keccak256("Error(string)")));}
    function testPausedActualTransmitterRejected() public {CCTPNativeMT420(MT).pause();reject(proof("base-standard"),bytes4(keccak256("Error(string)")));}
    function testNativeImplementationChangeRequiresRequalification() public {vm.etch(ICircleCCTPProxy420(MT).implementation(),hex"00");reject(proof("base-standard"),USDCCCTPAdapter.InvalidConfiguration.selector);}
    function testNativePeerSubstitutionRejected() public {CCTPNativeTM420(TM).removeRemoteTokenMessenger(6);CCTPNativeTM420(TM).addRemoteTokenMessenger(6,bytes32(uint256(99)));reject(proof("base-standard"),USDCCCTPAdapter.InvalidConfiguration.selector);}
    function testNativeTokenPairSubstitutionRejected() public {bytes32 burnToken=message("base-standard").burnToken;minter.unlinkTokenPair(address(token),6,burnToken);minter.linkTokenPair(address(0xBAD),6,burnToken);reject(proof("base-standard"),USDCCCTPAdapter.InvalidConfiguration.selector);}
    function testClaimedMintWithoutDeliveryRejectedAndRolledBack() public {token.setMintMode(2);reject(proof("base-standard"),USDCCCTPAdapter.TokenMovement.selector);bytes32 n=message("base-standard").nonce;require(!adapter.consumedNonces(n)&&CCTPNativeMT420(MT).usedNonces(n)==0,"rollback");}
    function testActualMintFailureRollsBackNonce() public {token.setMintMode(1);reject(proof("base-standard"),bytes4(keccak256("Error(string)")));require(!adapter.consumedNonces(message("base-standard").nonce),"failed mint consumed");}
    function testLaterRouterFailureRollsBackNativeDelivery() public {CCTPV2Message420.Message memory m=message("base-standard");(bool ok,)=router.call(abi.encodeCall(CCTPRouterCaller420.inboundAndFail,(adapter,proof("base-standard"))));require(!ok&&!adapter.consumedNonces(m.nonce)&&CCTPNativeMT420(MT).usedNonces(m.nonce)==0&&token.balanceOf(m.mintRecipient)==0,"atomic router rollback");}
    function testReentrantRouterCallRejected() public {token.setReentry(router,abi.encodeCall(CCTPRouterCaller420.inbound,(adapter,proof("base-standard"))));inbound("base-standard");require(token.reentryError()==USDCCCTPAdapter.Reentrancy.selector,"reentrancy");}
    function testTrailingEnvelopeRejected() public {reject(bytes.concat(proof("base-standard"),hex"00"),USDCCCTPAdapter.InvalidProof.selector);}
    function testOutboundActualNativeBurnAndMessageSent() public {
        token.fund(address(this),100e6);token.approve(address(adapter),100e6);bytes memory extra=abi.encode(bytes32(0),uint256(0),uint32(2000),bytes(""));
        vm.recordLogs();bytes32 id=CCTPRouterCaller420(router).outbound(adapter,route(6),ASSET,address(this),abi.encode(bytes32(uint256(uint160(address(0xB0B))))),100e6,extra);
        require(id!=0&&token.balanceOf(address(this))==0&&token.balanceOf(address(adapter))==0&&token.balanceOf(address(minter))==0&&token.allowance(address(adapter),TM)==0,"native burn");
        CCTPVm420.Log[] memory logs=vm.getRecordedLogs();bool found;
        for(uint256 i;i<logs.length;++i)if(logs[i].emitter==MT&&logs[i].topics[0]==keccak256("MessageSent(bytes)")){bytes memory raw=abi.decode(logs[i].data,(bytes));require(BridgeWire420.readBE(raw,12,32)==0&&BridgeWire420.readBE(raw,216,32)==100e6&&BridgeWire420.readBE(raw,248,32)==uint160(address(adapter)),"native outbound message");found=true;}
        require(found,"native event missing");
    }
    function testOutboundBurnFailureRestoresUserFunds() public {token.fund(address(this),100e6);token.approve(address(adapter),100e6);minter.setMaxBurnAmountPerMessage(address(token),1);(bool ok,)=router.call(abi.encodeCall(CCTPRouterCaller420.outbound,(adapter,route(6),ASSET,address(this),abi.encode(bytes32(uint256(1))),100e6,abi.encode(bytes32(0),uint256(0),uint32(2000),bytes("")))));require(!ok&&token.balanceOf(address(this))==100e6&&token.allowance(address(adapter),TM)==0&&adapter.outboundNonce()==0,"burn rollback");}
    function testOutboundDirtyEVMRecipientRejectedBeforeBurn() public {
        token.fund(address(this),100e6);token.approve(address(adapter),100e6);bytes32 dirty=bytes32((uint256(1)<<200)|1);
        (bool ok,bytes memory reason)=router.call(abi.encodeCall(CCTPRouterCaller420.outbound,(adapter,route(6),ASSET,address(this),abi.encode(dirty),100e6,abi.encode(bytes32(0),uint256(0),uint32(2000),bytes("")))));
        require(!ok&&bytes4(reason)==CCTPV2Message420.InvalidMessage.selector&&token.balanceOf(address(this))==100e6,"recipient truncation");
    }
    function testOutboundDirtyEVMCallerRejected() public {
        (bool ok,bytes memory reason)=router.call(abi.encodeCall(CCTPRouterCaller420.outbound,(adapter,route(6),ASSET,address(this),abi.encode(bytes32(uint256(1))),100e6,abi.encode(bytes32(uint256(1)<<200),uint256(0),uint32(2000),bytes("")))));
        require(!ok&&bytes4(reason)==CCTPV2Message420.InvalidMessage.selector,"caller truncation");
    }
    function testDirtyEVMSourceSenderRejected() public {bytes memory raw=file("base-standard.message.hex");raw[248]=0x01;reject(abi.encode(raw,file("base-standard.attestation.hex")),CCTPV2Message420.InvalidMessage.selector);}
    function testOutboundWrongAssetRejected() public {(bool ok,)=router.call(abi.encodeCall(CCTPRouterCaller420.outbound,(adapter,route(6),bytes32(uint256(55)),address(this),abi.encode(bytes32(uint256(1))),100e6,abi.encode(bytes32(0),uint256(0),uint32(2000),bytes("")))));require(!ok,"asset substitution");}
    function decode(bytes calldata raw) external pure returns(CCTPV2Message420.Message memory){return CCTPV2Message420.decode(raw);}
    function testFuzzTruncatedWireRejected(uint16 length) public {uint256 size=uint256(length)%376;(bool ok,bytes memory r)=address(this).call(abi.encodeCall(this.decode,(new bytes(size))));require(!ok&&bytes4(r)==CCTPV2Message420.InvalidMessage.selector,"truncated format");}
}
contract CCTPSourceEthereumHistory420Test is CCTPNativeHarness420 {
    function setUp() public {setupNative(6,address(0));}
    function testGenuineEthereumToBase() public {CCTPV2Message420.Message memory m=message("ethereum-fast-to-base");IBridgeAdapter420.VerifiedTransfer memory v=inbound("ethereum-fast-to-base");require(v.amount==m.amount-m.fee&&v.recipient==m.mintRecipient&&token.balanceOf(m.mintRecipient)==v.amount,"native source zero");}
}
