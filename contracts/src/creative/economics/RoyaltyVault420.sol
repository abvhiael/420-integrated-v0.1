// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";
import "../shared/CreativeEvents420.sol";

interface IVaultRights420 { function currentShare(bytes32 assetKey, uint256 profileId) external view returns (uint16); }
interface IVaultProfiles420 { function isAuthorized(CreatorId creatorId, address account) external view returns (bool); }

contract RoyaltyVault420 is CreativeEvents420 {
    uint256 public constant ACC_SCALE = 1e27;
    address public immutable governanceTimelock;
    address public immutable rightsRegistry;
    IVaultProfiles420 public immutable creatorProfiles;
    address public royaltyRouter;
    address public treasuryRecipient;

    struct PoolState { uint256 accRoyaltyPerBp; uint256 scaledDust; uint256 totalReceived; }
    struct HolderAccounting { uint256 rewardDebt; uint256 claimable; }

    mapping(bytes32 => PoolState) private _pools;
    mapping(bytes32 => mapping(uint256 => HolderAccounting)) private _holders;
    uint256 public treasuryClaimable;

    constructor(address governanceTimelock_, address rightsRegistry_, address creatorProfiles_, address treasuryRecipient_) {
        if (governanceTimelock_ == address(0) || rightsRegistry_ == address(0) || creatorProfiles_ == address(0) || treasuryRecipient_ == address(0)) revert CreativeErrors420.ZeroAddress();
        governanceTimelock = governanceTimelock_; rightsRegistry = rightsRegistry_; creatorProfiles = IVaultProfiles420(creatorProfiles_); treasuryRecipient = treasuryRecipient_;
    }

    function setRoyaltyRouter(address router_) external {
        if (msg.sender != governanceTimelock) revert CreativeErrors420.Unauthorized();
        if (router_ == address(0)) revert CreativeErrors420.ZeroAddress();
        royaltyRouter = router_;
    }

    function depositPool(bytes32 assetKey) external payable {
        if (msg.sender != royaltyRouter) revert CreativeErrors420.OnlyRoyaltyRouter();
        PoolState storage pool = _pools[assetKey];
        uint256 scaled = msg.value * ACC_SCALE + pool.scaledDust;
        pool.accRoyaltyPerBp += scaled / CreativeConstants420.BPS_DENOMINATOR;
        pool.scaledDust = scaled % CreativeConstants420.BPS_DENOMINATOR;
        pool.totalReceived += msg.value;
        emit RoyaltyPoolDeposited(assetKey, msg.value);
    }

    function depositTreasury() external payable {
        if (msg.sender != royaltyRouter) revert CreativeErrors420.OnlyRoyaltyRouter();
        treasuryClaimable += msg.value;
        emit TreasuryRoyaltyAccrued(msg.value);
    }

    function checkpointHolder(bytes32 assetKey, uint256 profileId, uint16 oldBps) external {
        if (msg.sender != rightsRegistry) revert CreativeErrors420.OnlyRightsRegistry();
        _checkpoint(assetKey, profileId, oldBps);
    }

    function syncHolder(bytes32 assetKey, uint256 profileId, uint16 newBps) external {
        if (msg.sender != rightsRegistry) revert CreativeErrors420.OnlyRightsRegistry();
        _holders[assetKey][profileId].rewardDebt = (uint256(newBps) * _pools[assetKey].accRoyaltyPerBp) / ACC_SCALE;
    }

    function claim(bytes32 assetKey, CreatorId profileId, address payable recipient) external returns (uint256 amount) {
        if (recipient == address(0)) revert CreativeErrors420.ZeroAddress();
        if (!creatorProfiles.isAuthorized(profileId, msg.sender)) revert CreativeErrors420.Unauthorized();
        uint256 id = CreatorId.unwrap(profileId);
        uint16 share = IVaultRights420(rightsRegistry).currentShare(assetKey, id);
        _checkpoint(assetKey, id, share);
        HolderAccounting storage holder = _holders[assetKey][id];
        amount = holder.claimable;
        holder.claimable = 0;
        if (amount != 0) {
            (bool ok,) = recipient.call{value: amount}("");
            if (!ok) revert CreativeErrors420.TransferFailed();
        }
        emit RoyaltyClaimed(assetKey, id, recipient, amount);
    }

    function claimTreasury() external returns (uint256 amount) {
        if (msg.sender != treasuryRecipient) revert CreativeErrors420.Unauthorized();
        amount = treasuryClaimable; treasuryClaimable = 0;
        (bool ok,) = payable(treasuryRecipient).call{value: amount}("");
        if (!ok) revert CreativeErrors420.TransferFailed();
        emit TreasuryRoyaltyClaimed(treasuryRecipient, amount);
    }

    function pending(bytes32 assetKey, uint256 profileId) external view returns (uint256) {
        HolderAccounting storage holder = _holders[assetKey][profileId];
        uint16 share = IVaultRights420(rightsRegistry).currentShare(assetKey, profileId);
        uint256 accumulated = (uint256(share) * _pools[assetKey].accRoyaltyPerBp) / ACC_SCALE;
        return holder.claimable + (accumulated > holder.rewardDebt ? accumulated - holder.rewardDebt : 0);
    }

    function pool(bytes32 assetKey) external view returns (PoolState memory) { return _pools[assetKey]; }

    function _checkpoint(bytes32 assetKey, uint256 profileId, uint16 bps) internal {
        HolderAccounting storage holder = _holders[assetKey][profileId];
        uint256 accumulated = (uint256(bps) * _pools[assetKey].accRoyaltyPerBp) / ACC_SCALE;
        if (accumulated > holder.rewardDebt) holder.claimable += accumulated - holder.rewardDebt;
        holder.rewardDebt = accumulated;
    }
}
