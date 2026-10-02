// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/swap/PermissionlessDEXFactory.sol";
import "./helpers/GenesisMocks420.sol";

contract PermissionlessImplementationStub420 {}

contract PermissionlessPoolMock420 {
    address public immutable token0;
    address public immutable token1;

    constructor(address token0_, address token1_) {
        token0 = token0_;
        token1 = token1_;
    }
}

contract PermissionlessNoPairIntrospection420 {}

contract PermissionlessRegistrar420 {
    function register(
        PermissionlessDEXFactory factory,
        bytes32 poolId,
        address token0,
        address token1,
        address pool,
        bytes32 implementationHash
    ) external {
        factory.registerExistingPool(poolId, token0, token1, pool, implementationHash);
    }
}

contract SwapPermissionlessDEXFactory420Test {
    bytes32 internal constant POOL_ID = keccak256("permissionless/420/USDC/1");
    bytes32 internal constant POOL_ID_2 = keccak256("permissionless/420/USDC/2");
    address internal constant TOKEN0 = address(0x420);
    address internal constant TOKEN1 = address(0x4201);

    function _setup()
        internal
        returns (
            GenesisMockEnvironment420 env,
            PermissionlessDEXFactory factory,
            PermissionlessImplementationStub420 implementation,
            PermissionlessPoolMock420 pool
        )
    {
        env = new GenesisMockEnvironment420();
        implementation = new PermissionlessImplementationStub420();
        factory = new PermissionlessDEXFactory(
            address(this),
            address(env.registry()),
            keccak256("permissionless-swap-factory"),
            address(implementation)
        );
        env.registerResident(address(factory), factory.componentId());
        pool = new PermissionlessPoolMock420(TOKEN0, TOKEN1);
    }

    function testRegistrationOnlyLifecycleRecordsExactProvenance() public {
        (, PermissionlessDEXFactory factory, PermissionlessImplementationStub420 implementation, PermissionlessPoolMock420 pool) =
            _setup();

        require(factory.REGISTRATION_ONLY(), "mode");
        require(factory.poolImplementation() == address(implementation), "implementation");
        require(factory.poolImplementationCodeHash() == address(implementation).codehash, "implementation hash");

        factory.registerExistingPool(POOL_ID, TOKEN0, TOKEN1, address(pool), address(pool).codehash);

        (address creator, address token0, address token1, address recordedPool, bytes32 recordedHash) =
            factory.pools(POOL_ID);
        require(creator == address(this), "creator");
        require(token0 == TOKEN0 && token1 == TOKEN1, "pair");
        require(recordedPool == address(pool), "pool");
        require(recordedHash == address(pool).codehash, "codehash");
        require(factory.poolIdByAddress(address(pool)) == POOL_ID, "reverse lookup");
    }

    function testPairIntrospectionRejectsSpoofedPair() public {
        (, PermissionlessDEXFactory factory,, PermissionlessPoolMock420 pool) = _setup();

        (bool ok,) = address(factory).call(
            abi.encodeWithSelector(
                factory.registerExistingPool.selector,
                POOL_ID,
                TOKEN1,
                TOKEN0,
                address(pool),
                address(pool).codehash
            )
        );
        require(!ok, "spoofed pair accepted");
        require(factory.poolIdByAddress(address(pool)) == bytes32(0), "failed registration mutated state");
    }

    function testCodeHashCommitmentRejectsSpoofedHash() public {
        (, PermissionlessDEXFactory factory,, PermissionlessPoolMock420 pool) = _setup();

        (bool ok,) = address(factory).call(
            abi.encodeWithSelector(
                factory.registerExistingPool.selector,
                POOL_ID,
                TOKEN0,
                TOKEN1,
                address(pool),
                keccak256("wrong-codehash")
            )
        );
        require(!ok, "spoofed codehash accepted");
    }

    function testNonIntrospectablePoolRejected() public {
        (, PermissionlessDEXFactory factory,,) = _setup();
        PermissionlessNoPairIntrospection420 pool = new PermissionlessNoPairIntrospection420();

        (bool ok,) = address(factory).call(
            abi.encodeWithSelector(
                factory.registerExistingPool.selector,
                POOL_ID,
                TOKEN0,
                TOKEN1,
                address(pool),
                address(pool).codehash
            )
        );
        require(!ok, "non-introspectable pool accepted");
    }

    function testDuplicatePoolIdAndPoolAddressRejected() public {
        (, PermissionlessDEXFactory factory,, PermissionlessPoolMock420 pool) = _setup();
        PermissionlessPoolMock420 otherPool = new PermissionlessPoolMock420(TOKEN0, TOKEN1);

        factory.registerExistingPool(POOL_ID, TOKEN0, TOKEN1, address(pool), address(pool).codehash);

        (bool duplicateIdOk,) = address(factory).call(
            abi.encodeWithSelector(
                factory.registerExistingPool.selector,
                POOL_ID,
                TOKEN0,
                TOKEN1,
                address(otherPool),
                address(otherPool).codehash
            )
        );
        require(!duplicateIdOk, "duplicate pool id accepted");

        (bool duplicateAddressOk,) = address(factory).call(
            abi.encodeWithSelector(
                factory.registerExistingPool.selector,
                POOL_ID_2,
                TOKEN0,
                TOKEN1,
                address(pool),
                address(pool).codehash
            )
        );
        require(!duplicateAddressOk, "duplicate pool address accepted");
    }

    function testDistinctPoolsForSamePairRemainPermissionless() public {
        (, PermissionlessDEXFactory factory,, PermissionlessPoolMock420 pool) = _setup();
        PermissionlessPoolMock420 secondPool = new PermissionlessPoolMock420(TOKEN0, TOKEN1);

        factory.registerExistingPool(POOL_ID, TOKEN0, TOKEN1, address(pool), address(pool).codehash);
        factory.registerExistingPool(POOL_ID_2, TOKEN0, TOKEN1, address(secondPool), address(secondPool).codehash);

        require(factory.poolIdByAddress(address(pool)) == POOL_ID, "first");
        require(factory.poolIdByAddress(address(secondPool)) == POOL_ID_2, "second");
    }

    function testRegistrationFailsClosedOnPauseSafetyAndComponentLifecycle() public {
        (GenesisMockEnvironment420 env, PermissionlessDEXFactory factory,, PermissionlessPoolMock420 pool) = _setup();

        env.pause().setPaused(true);
        (bool pausedOk,) = address(factory).call(
            abi.encodeWithSelector(
                factory.registerExistingPool.selector,
                POOL_ID,
                TOKEN0,
                TOKEN1,
                address(pool),
                address(pool).codehash
            )
        );
        require(!pausedOk, "paused registration accepted");

        env.pause().setPaused(false);
        env.safety().setAllowed(false);
        (bool unsafeOk,) = address(factory).call(
            abi.encodeWithSelector(
                factory.registerExistingPool.selector,
                POOL_ID,
                TOKEN0,
                TOKEN1,
                address(pool),
                address(pool).codehash
            )
        );
        require(!unsafeOk, "unsafe registration accepted");

        env.safety().setAllowed(true);
        env.registry().setLifecycle(factory.componentId(), Types420.Lifecycle.SUSPENDED);
        (bool lifecycleOk,) = address(factory).call(
            abi.encodeWithSelector(
                factory.registerExistingPool.selector,
                POOL_ID,
                TOKEN0,
                TOKEN1,
                address(pool),
                address(pool).codehash
            )
        );
        require(!lifecycleOk, "inactive component accepted registration");
    }

    function testPermissionlessCallerMayRegisterWithoutGovernanceGrant() public {
        (, PermissionlessDEXFactory factory,, PermissionlessPoolMock420 pool) = _setup();
        PermissionlessRegistrar420 registrar = new PermissionlessRegistrar420();

        registrar.register(factory, POOL_ID, TOKEN0, TOKEN1, address(pool), address(pool).codehash);

        (address creator,,,,) = factory.pools(POOL_ID);
        require(creator == address(registrar), "permissionless creator provenance");
    }

    function testInvalidIdentifiersTokensAndCodeBearingPoolFailClosed() public {
        (, PermissionlessDEXFactory factory,, PermissionlessPoolMock420 pool) = _setup();

        (bool zeroIdOk,) = address(factory).call(
            abi.encodeWithSelector(
                factory.registerExistingPool.selector,
                bytes32(0),
                TOKEN0,
                TOKEN1,
                address(pool),
                address(pool).codehash
            )
        );
        require(!zeroIdOk, "zero id accepted");

        (bool sameTokenOk,) = address(factory).call(
            abi.encodeWithSelector(
                factory.registerExistingPool.selector,
                POOL_ID,
                TOKEN0,
                TOKEN0,
                address(pool),
                address(pool).codehash
            )
        );
        require(!sameTokenOk, "same-token pair accepted");

        (bool noCodeOk,) = address(factory).call(
            abi.encodeWithSelector(
                factory.registerExistingPool.selector,
                POOL_ID,
                TOKEN0,
                TOKEN1,
                address(0xBEEF),
                bytes32(uint256(1))
            )
        );
        require(!noCodeOk, "no-code pool accepted");
    }
}
