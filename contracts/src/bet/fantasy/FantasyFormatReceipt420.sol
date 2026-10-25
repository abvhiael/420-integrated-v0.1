// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasySlateBook420.sol";
/// @notice Variable-payload receipt verification, separate from daily's fixed seven-player ABI.
contract FantasyFormatReceipt420 {
    FantasySlateBook420 public immutable slates;
    constructor(address slates_){slates=FantasySlateBook420(slates_);}
    error InvalidReceipt();
    function verify(bytes32 slate,bytes32 digest,bytes32 commitment,uint64 expiry,uint256 envelopeLength,bytes calldata sig) external view{
        FantasySlateBook420.Slate memory s=slates.slateOf(slate);
        if(commitment==0||expiry<block.timestamp||expiry>s.lockAt||sig.length!=65||envelopeLength<64||envelopeLength>16384)revert InvalidReceipt();
        bytes32 r;bytes32 ss;uint8 v;
        assembly{r:=calldataload(sig.offset) ss:=calldataload(add(sig.offset,32)) v:=byte(0,calldataload(add(sig.offset,64)))}
        if((v!=27&&v!=28)||uint256(ss)>0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0)revert InvalidReceipt();
        address signer=ecrecover(digest,v,r,ss);BetAuthorization420 auth=slates.authorization();
        if(signer==address(0)||signer!=s.validator||!auth.isAuthorized(signer,slates.VALIDATE_LINEUP(),auth.scopeForContest(slate),0))revert InvalidReceipt();
    }
}
