// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/oracle/OracleProviderRegistry420.sol";
import "../src/oracle/OracleFeedRegistry420.sol";
import "../src/oracle/OracleRiskPolicy420.sol";
import "../src/oracle/OracleRouter420.sol";

contract Oracle420DeploymentBindingTest {
    bytes32 internal constant ORACLE_SERVICE = keccak256("420/service/oracle/v1");

    function testCanonicalDeploymentGraphPublishesRouterThroughProtocolRegistry() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        OracleProviderRegistry420 providers = new OracleProviderRegistry420(address(this));
        OracleFeedRegistry420 feeds = new OracleFeedRegistry420(address(this), address(providers));
        OracleRiskPolicy420 risk = new OracleRiskPolicy420(address(this));
        OracleRouter420 router = new OracleRouter420(address(this), address(providers), address(feeds), address(risk));

        registry.publishRegisteredService(
            ORACLE_SERVICE,
            address(router),
            keccak256("420oracle-v1-metadata"),
            1,
            true,
            ProtocolRegistry.ComponentType.INFRASTRUCTURE,
            keccak256("420oracle-v1-manifest"),
            keccak256(abi.encode(address(providers), address(feeds), address(risk))),
            keccak256("IOracle420.readNumeric.readResult.v1")
        );

        (address implementation, bytes32 codeHash,, uint32 version, bool active) = registry.getService(ORACLE_SERVICE);
        require(implementation == address(router), "wrong router");
        require(codeHash == address(router).codehash, "wrong code hash");
        require(version == 1, "wrong version");
        require(active, "inactive service");
    }
}
