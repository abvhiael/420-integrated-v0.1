// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasySeasonData420.sol";
/// @notice Authorized receipt for durable private draft preferences and waiver queues.
contract FantasySeasonReceipt420{
    bytes32 public constant VALIDATE=keccak256("BET_FANTASY_VALIDATE_SEASON_PRIVATE.V1");
    FantasySeasonData420 public immutable data;
    error Invalid();
    constructor(address data_){data=FantasySeasonData420(data_);}
    function verify(bytes32 id,bytes32 digest,uint64 expiry,uint64 deadline,bytes calldata signature) external view{
        if(expiry<block.timestamp||expiry>deadline||signature.length!=65)revert Invalid();
        bytes32 r;bytes32 s;uint8 v;assembly{r:=calldataload(signature.offset) s:=calldataload(add(signature.offset,32)) v:=byte(0,calldataload(add(signature.offset,64)))}
        if((v!=27&&v!=28)||uint256(s)>0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0)revert Invalid();
        address signer=ecrecover(digest,v,r,s);BetAuthorization420 auth=data.authorization();
        if(signer==address(0)||signer!=data.configOf(id).validator||!auth.isAuthorized(signer,VALIDATE,auth.scopeForContest(id),0))revert Invalid();
    }
}
