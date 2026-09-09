// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ProgressiveGamingTypes } from "../../../../src/gaming/access/ProgressiveGamingTypes.sol";
import { HighCountryAccessPolicy } from "../../../../src/highcountry/access/HighCountryAccessPolicy.sol";

contract HighCountryAccessPolicyTest {
    HighCountryAccessPolicy private policy = new HighCountryAccessPolicy();

    function testGuestCanPlayCoreWithoutWallet() public view {
        require(policy.canUse(ProgressiveGamingTypes.AccessState.GUEST, ProgressiveGamingTypes.Capability.CORE_GAMEPLAY));
        require(policy.canUse(ProgressiveGamingTypes.AccessState.GUEST, ProgressiveGamingTypes.Capability.LOCAL_SAVE));
        require(!policy.canUse(ProgressiveGamingTypes.AccessState.GUEST, ProgressiveGamingTypes.Capability.CLOUD_SAVE));
        require(!policy.walletRequiredForCoreGameplay());
        require(!policy.walletMayGrantStatAdvantage());
    }

    function testRegisteredAddsCloudAndRecoveryWithoutWallet() public view {
        require(policy.canUse(ProgressiveGamingTypes.AccessState.REGISTERED, ProgressiveGamingTypes.Capability.CLOUD_SAVE));
        require(policy.canUse(ProgressiveGamingTypes.AccessState.REGISTERED, ProgressiveGamingTypes.Capability.CROSS_DEVICE_RECOVERY));
        require(policy.canUse(ProgressiveGamingTypes.AccessState.REGISTERED, ProgressiveGamingTypes.Capability.STANDARD_LEADERBOARD));
        require(!policy.canUse(ProgressiveGamingTypes.AccessState.REGISTERED, ProgressiveGamingTypes.Capability.VERIFIED_OWNERSHIP));
    }

    function testWalletConnectedAddsBreadthNotPower() public view {
        require(policy.canUse(ProgressiveGamingTypes.AccessState.WALLET_CONNECTED, ProgressiveGamingTypes.Capability.WALLET_EXCLUSIVE_CONTENT));
        require(policy.canUse(ProgressiveGamingTypes.AccessState.WALLET_CONNECTED, ProgressiveGamingTypes.Capability.ECOSYSTEM_REWARDS));
        require(policy.canUse(ProgressiveGamingTypes.AccessState.WALLET_CONNECTED, ProgressiveGamingTypes.Capability.VERIFIED_OWNERSHIP));
        require(policy.canUse(ProgressiveGamingTypes.AccessState.WALLET_CONNECTED, ProgressiveGamingTypes.Capability.CROSS_GAME_INTEROPERABILITY));
        require(!policy.canUse(ProgressiveGamingTypes.AccessState.WALLET_CONNECTED, ProgressiveGamingTypes.Capability.MARKETPLACE));
        require(!policy.walletMayGrantStatAdvantage());
    }

    function testFullParticipantGetsHighValueEcosystemCapabilities() public view {
        require(policy.canUse(ProgressiveGamingTypes.AccessState.ECOSYSTEM_PARTICIPANT, ProgressiveGamingTypes.Capability.MARKETPLACE));
        require(policy.canUse(ProgressiveGamingTypes.AccessState.ECOSYSTEM_PARTICIPANT, ProgressiveGamingTypes.Capability.GENETICS_LICENSING));
        require(policy.canUse(ProgressiveGamingTypes.AccessState.ECOSYSTEM_PARTICIPANT, ProgressiveGamingTypes.Capability.MAJOR_TOURNAMENTS));
        require(policy.canUse(ProgressiveGamingTypes.AccessState.ECOSYSTEM_PARTICIPANT, ProgressiveGamingTypes.Capability.TRANSFERABLE_ASSETS));
    }

    function testAuthorityBoundarySeparatesOrdinaryAndCanonicalState() public view {
        require(policy.authorityFor(HighCountryAccessPolicy.StateObject.ROUTINE_EQUIPMENT_LEVEL) == ProgressiveGamingTypes.StateAuthority.LOCAL_GAME_STATE);
        require(policy.authorityFor(HighCountryAccessPolicy.StateObject.COMMON_INVENTORY) == ProgressiveGamingTypes.StateAuthority.LOCAL_GAME_STATE);
        require(policy.authorityFor(HighCountryAccessPolicy.StateObject.REGISTERED_CLOUD_PROGRESS) == ProgressiveGamingTypes.StateAuthority.REGISTERED_GAME_STATE);
        require(policy.authorityFor(HighCountryAccessPolicy.StateObject.REGISTERED_CULTIVAR) == ProgressiveGamingTypes.StateAuthority.CANONICAL_ECOSYSTEM_STATE);
        require(policy.authorityFor(HighCountryAccessPolicy.StateObject.CHAMPIONSHIP_RESULT) == ProgressiveGamingTypes.StateAuthority.CANONICAL_ECOSYSTEM_STATE);
        require(policy.authorityFor(HighCountryAccessPolicy.StateObject.LICENSING_RIGHT) == ProgressiveGamingTypes.StateAuthority.CANONICAL_ECOSYSTEM_STATE);
    }
}
