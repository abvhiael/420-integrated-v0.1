// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/swap/GenesisDEXFactory.sol";
import "./helpers/GenesisMocks420.sol";

contract GenesisDEXFactoryPoolStub420 {}

contract GenesisDEXFactoryCaller420 {
    function register(GenesisDEXFactory factory, bytes32 poolId, address pool) external {
        factory.registerPool(poolId, pool);
    }

    function setImplementation(GenesisDEXFactory factory, address implementation) external {
        factory.setPoolImplementation(implementation);
    }
}

contract SwapGenesisDEXFactory420Test {
    bytes32 internal constant POOL_ID = keccak256("420/USDC");

    function _setup()
        internal
        returns (
            GenesisMockEnvironment420 env,
            GenesisDEXFactory factory,
            GenesisDEXFactoryPoolStub420 implementation,
            GenesisDEXFactoryPoolStub420 pool
        )
    {
        env = new GenesisMockEnvironment420();
        implementation = new GenesisDEXFactoryPoolStub420();
        factory = new GenesisDEXFactory(
            address(this),
            address(env.registry()),
            keccak256("swap-genesis-factory"),
            address(implementation)
        );
        env.registerResident(address(factory), factory.componentId());
        pool = new GenesisDEXFactoryPoolStub420();
    }

    function testRegistrationOnlyModeIsExplicitAndRegistersExistingPool() public {
        (, GenesisDEXFactory factory, GenesisDEXFactoryPoolStub420 implementation, GenesisDEXFactoryPoolStub420 pool) =
            _setup();

        require(factory.REGISTRATION_ONLY(), "mode");
        require(factory.poolImplementation() == address(implementation), "implementation");

        uint256 codeSizeBefore = address(pool).code.length;
        factory.registerPool(POOL_ID, address(pool));

        require(factory.pools(POOL_ID) == address(pool), "pool");
        require(address(pool).code.length == codeSizeBefore && codeSizeBefore != 0, "existing pool changed");
    }

    function testRegistrationRejectsInvalidAndDuplicatePoolRecords() public {
        (, GenesisDEXFactory factory,, GenesisDEXFactoryPoolStub420 pool) = _setup();

        (bool zeroIdOk,) = address(factory).call(
            abi.encodeWithSelector(factory.registerPool.selector, bytes32(0), address(pool))
        );
        require(!zeroIdOk, "zero id accepted");

        (bool noCodeOk,) = address(factory).call(
            abi.encodeWithSelector(factory.registerPool.selector, POOL_ID, address(0xBEEF))
        );
        require(!noCodeOk, "no-code pool accepted");

        factory.registerPool(POOL_ID, address(pool));
        (bool duplicateOk,) = address(factory).call(
            abi.encodeWithSelector(factory.registerPool.selector, POOL_ID, address(pool))
        );
        require(!duplicateOk, "duplicate accepted");
    }

    function testRegistrationFailsClosedOnPauseAndSystemSafety() public {
        (GenesisMockEnvironment420 env, GenesisDEXFactory factory,, GenesisDEXFactoryPoolStub420 pool) = _setup();

        env.pause().setPaused(true);
        (bool pausedOk,) = address(factory).call(
            abi.encodeWithSelector(factory.registerPool.selector, POOL_ID, address(pool))
        );
        require(!pausedOk, "paused registration accepted");

        env.pause().setPaused(false);
        env.safety().setAllowed(false);
        (bool unsafeOk,) = address(factory).call(
            abi.encodeWithSelector(factory.registerPool.selector, POOL_ID, address(pool))
        );
        require(!unsafeOk, "unsafe registration accepted");
    }

    function testGovernanceControlsRegistrationAndImplementationReference() public {
        (GenesisMockEnvironment420 env, GenesisDEXFactory factory,, GenesisDEXFactoryPoolStub420 pool) = _setup();
        GenesisDEXFactoryPoolStub420 nextImplementation = new GenesisDEXFactoryPoolStub420();

        env.governance().set(false, true);
        (bool deniedRegister,) = address(factory).call(
            abi.encodeWithSelector(factory.registerPool.selector, POOL_ID, address(pool))
        );
        require(!deniedRegister, "unauthorized registration accepted");

        (bool deniedImplementation,) = address(factory).call(
            abi.encodeWithSelector(factory.setPoolImplementation.selector, address(nextImplementation))
        );
        require(!deniedImplementation, "unauthorized implementation accepted");

        env.governance().set(true, true);
        factory.setPoolImplementation(address(nextImplementation));
        require(factory.poolImplementation() == address(nextImplementation), "implementation update");

        (bool noCodeImplementation,) = address(factory).call(
            abi.encodeWithSelector(factory.setPoolImplementation.selector, address(0xBEEF))
        );
        require(!noCodeImplementation, "no-code implementation accepted");
    }

    function testOnlyGovernanceTimelockCallerMayMutateFactory() public {
        (, GenesisDEXFactory factory,, GenesisDEXFactoryPoolStub420 pool) = _setup();
        GenesisDEXFactoryCaller420 caller = new GenesisDEXFactoryCaller420();

        (bool registerOk,) = address(caller).call(
            abi.encodeWithSelector(caller.register.selector, factory, POOL_ID, address(pool))
        );
        require(!registerOk, "non-timelock registration accepted");

        (bool implementationOk,) = address(caller).call(
            abi.encodeWithSelector(caller.setImplementation.selector, factory, address(pool))
        );
        require(!implementationOk, "non-timelock implementation accepted");
    }
}
