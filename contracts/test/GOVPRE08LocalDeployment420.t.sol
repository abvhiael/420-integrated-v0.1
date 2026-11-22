// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

// GOV-PRE-08 / Step 1: whole LOCAL deployment graph, not signed V4 or an actual testnet.
// All deployed components are the production contracts. Only identities and the
// canonical predeploy *materialization method* are local Foundry fixtures.
import "../src/apps/ProtocolRegistry.sol";
import "../src/governance/GovernanceTimelock.sol";
import "../src/governance/CivicConstitution420.sol";
import "../src/governance/CivicProposalRegistry420.sol";
import "../src/governance/CivicElectorateRegistry420.sol";
import "../src/governance/CivicVoting420.sol";
import "../src/governance/CivicGovernor420.sol";
import "../src/governance/FoundingWalletClaims420.sol";
import "../src/governance/FoundingCommitteeMembership420.sol";
import "../src/governance/FoundingRetirementVerifier420.sol";
import "../src/treasury/FoundingTreasuryAuthority420.sol";
import "../src/treasury/FoundingValidatorSponsorship420.sol";
import "../src/treasury/FoundingCommunityRetirementSweep420.sol";
import "../src/revenue/FoundingDeveloperCompensationSplitter420.sol";
import "../src/revenue/DevelopmentCompensationVault420.sol";
import "../src/treasury/TreasuryAuthorization420.sol";
import "../src/treasury/TreasuryPolicyRegistry420.sol";
import "../src/treasury/TreasuryBudgetRegistry420.sol";
import "../src/treasury/TreasuryDisbursementRegistry420.sol";
import "../src/treasury/TreasuryRouter420.sol";
import "../src/treasury/TreasuryReleaseExecutor420.sol";
import "../src/treasury/TreasuryIds420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/system/CommunityValidatorReserve.sol";
import "../src/system/ValidatorRegistry.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultRegistry420.sol";
import "../src/vault/VaultAccounting420.sol";
import "../src/vault/AssetVault420.sol";
import "../src/vault/VaultRouter420.sol";
import "../src/vault/VaultIds420.sol";

interface VmPre08Graph420 {
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
    function etch(address target, bytes calldata runtimeCode) external;
    function store(address target, bytes32 slot, bytes32 value) external;
}

contract GOVPRE08LocalDeployment420Test {
    VmPre08Graph420 internal constant vm =
        VmPre08Graph420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant TIME = 0x0000000000000000000000000000000000000429;
    address internal constant REGISTRY = 0x0000000000000000000000000000000000000434;
    address internal constant VALIDATORS = 0x0000000000000000000000000000000000000423;
    address internal constant COMMUNITY_RESERVE = 0x0000000000000000000000000000000000000425;
    address internal constant BOOTSTRAP_GOVERNOR = 0x0000000000000000000000000000000000000437;
    address internal constant ADMIN = address(0xA01);
    address internal constant ANDREW = address(0xA02);
    address internal constant JANET = address(0xA03);

    bytes32 internal constant OPS = keccak256("GOV-PRE-08/LOCAL-ONLY/OPERATIONS/VAULT");
    bytes32 internal constant CONT = keccak256("GOV-PRE-08/LOCAL-ONLY/CONTINGENCY/VAULT");
    bytes32 internal constant COMMUNITY = keccak256("GOV-PRE-08/LOCAL-ONLY/COMMUNITY/VAULT");
    bytes32 internal constant AUTH_POLICY = keccak256("GOV-PRE-08/LOCAL-ONLY/AUTH-POLICY");
    bytes32 internal constant ASSET_POLICY = keccak256("GOV-PRE-08/LOCAL-ONLY/ASSET-POLICY");
    bytes32 internal constant RELEASE_POLICY = keccak256("GOV-PRE-08/LOCAL-ONLY/RELEASE-POLICY");
    bytes32 internal constant ACCOUNTING_POLICY = keccak256("GOV-PRE-08/LOCAL-ONLY/ACCOUNTING-POLICY");
    bytes32 internal constant METADATA = keccak256("GOV-PRE-08/LOCAL-ONLY/METADATA");
    bytes32 internal constant MANIFEST = keccak256("GOV-PRE-08/LOCAL-ONLY/UNSIGNED-V4-REHEARSAL");
    bytes32 internal constant INTERFACE_HASH = keccak256("GOV-PRE-08/LOCAL-ONLY/INTERFACE");

    ProtocolRegistry internal registry;
    GovernanceTimelock internal timelock;
    CivicGovernor420 internal civic;
    FoundingWalletClaims420 internal claims;
    FoundingCommitteeMembership420 internal committee;
    FoundingRetirementVerifier420 internal retirement;
    FoundingTreasuryAuthority420 internal founding;
    FoundingValidatorSponsorship420 internal sponsor;
    FoundingCommunityRetirementSweep420 internal sweep;
    FoundingDeveloperCompensationSplitter420 internal splitter;
    DevelopmentCompensationVault420 internal compensation;
    TreasuryAuthorization420 internal auth;
    TreasuryPolicyRegistry420 internal policy;
    TreasuryBudgetRegistry420 internal budgets;
    TreasuryDisbursementRegistry420 internal disbursements;
    TreasuryRouter420 internal treasuryRouter;
    TreasuryReleaseExecutor420 internal executor;
    CapabilityRegistry420 internal capabilities;
    VaultAuthorization420 internal vaultAuth;
    VaultPolicyRegistry420 internal vaultPolicy;
    VaultRegistry420 internal vaultRegistry;
    VaultAccounting420 internal vaultAccounting;
    VaultRouter420 internal vaultRouter;
    AssetVault420 internal opsVault;
    AssetVault420 internal contingencyVault;
    AssetVault420 internal communityVault;

    // All 14 required production component contracts, deployed by genuine constructors.
    address[14] internal components;
    string[14] internal names;
    bytes32 public graphDigest;
    event log_bytes32(bytes32);

    function setUp() public virtual {
        vm.warp(1_900_000_000);
        _materializeExistingFrozenAnchors();
        _deployCivicAndValidators();
        _deployTreasuryAndVaultDependencies();
        _deployFoundingAndCompensation();
        _wireOneTimeAuthority();
        _publishLocalRegistry();
        graphDigest = _graphHash();
    }

    function _materializeExistingFrozenAnchors() internal {
        // Actual constructors, then only local Foundry etch for existing frozen predeploys.
        // No new fixed address is introduced. The Timelock constructor's scheduler
        // is explicitly reconstructed; etching code alone would omit persistent state.
        GovernanceTimelock builtTimelock = new GovernanceTimelock(BOOTSTRAP_GOVERNOR);
        vm.etch(TIME, address(builtTimelock).code);
        vm.store(TIME, bytes32(uint256(0)), bytes32(uint256(uint160(BOOTSTRAP_GOVERNOR))));
        timelock = GovernanceTimelock(payable(TIME));
        require(timelock.bootstrapGovernor() == BOOTSTRAP_GOVERNOR, "timelock immutable");
        require(timelock.scheduler() == BOOTSTRAP_GOVERNOR, "timelock initialized storage");
        require(!timelock.civicAuthorityActivated(), "fabricated civic activation");

        ProtocolRegistry builtRegistry = new ProtocolRegistry(TIME);
        vm.etch(REGISTRY, address(builtRegistry).code);
        registry = ProtocolRegistry(REGISTRY);
        require(registry.governanceTimelock() == TIME && registry.protocolVersion() == 4, "registry anchor");

        CommunityValidatorReserve builtReserve = new CommunityValidatorReserve(TIME);
        vm.etch(COMMUNITY_RESERVE, address(builtReserve).code);
        require(CommunityValidatorReserve(payable(COMMUNITY_RESERVE)).governanceTimelock() == TIME,
                "reserve authority");
    }

    function _deployCivicAndValidators() internal {
        CivicConstitution420 constitution = new CivicConstitution420(TIME);
        CivicProposalRegistry420 proposals = new CivicProposalRegistry420(TIME);
        CivicElectorateRegistry420 electors = new CivicElectorateRegistry420(TIME);
        CivicVoting420 voting = new CivicVoting420(address(proposals), address(electors));
        civic = new CivicGovernor420(address(constitution), address(proposals), address(electors), address(voting));
        require(address(civic.timelock()) == TIME, "Civic timelock mismatch");

        // Actual canonical ValidatorRegistry runtime is tested at its frozen system address.
        ValidatorRegistry builtValidators = new ValidatorRegistry(TIME, REGISTRY, MANIFEST);
        vm.etch(VALIDATORS, address(builtValidators).code);
        require(ValidatorRegistry(payable(VALIDATORS)).stakeProtocolRegistry() == REGISTRY,
                "validator registry dependency");
    }

    function _deployTreasuryAndVaultDependencies() internal {
        capabilities = new CapabilityRegistry420();
        capabilities.registerProtocolComponent(TreasuryIds420.COMPONENT_TREASURY, address(this));
        capabilities.registerProtocolComponent(VaultIds420.COMPONENT_VAULT, address(this));
        auth = new TreasuryAuthorization420(address(capabilities));
        policy = new TreasuryPolicyRegistry420(TIME);
        budgets = new TreasuryBudgetRegistry420(TIME, address(policy));
        disbursements = new TreasuryDisbursementRegistry420(
            TIME, address(auth), address(policy), address(budgets)
        );
        treasuryRouter = new TreasuryRouter420(address(budgets), address(disbursements));

        vaultAuth = new VaultAuthorization420(address(capabilities));
        vaultPolicy = new VaultPolicyRegistry420(TIME);
        vaultRegistry = new VaultRegistry420(address(vaultAuth), address(vaultPolicy));
        vaultAccounting = new VaultAccounting420(address(vaultRegistry));
        vaultRouter = new VaultRouter420(address(vaultRegistry), address(vaultAccounting), address(vaultAuth));

        _setVaultPolicy(AUTH_POLICY, VaultIds420.POLICY_AUTHORIZATION);
        _setVaultPolicy(ASSET_POLICY, VaultIds420.POLICY_ASSET);
        _setVaultPolicy(RELEASE_POLICY, VaultIds420.POLICY_RELEASE);
        _setVaultPolicy(ACCOUNTING_POLICY, VaultIds420.POLICY_ACCOUNTING);
        opsVault = _registerVault(OPS, VaultIds420.VAULT_TREASURY);
        contingencyVault = _registerVault(CONT, VaultIds420.VAULT_TREASURY);
        communityVault = _registerVault(COMMUNITY, VaultIds420.VAULT_COMMUNITY);
    }

    function _setVaultPolicy(bytes32 id, bytes32 kind) internal {
        vm.prank(TIME);
        vaultPolicy.setPolicy(id, kind, id, METADATA, true);
    }

    function _registerVault(bytes32 id, bytes32 kind) internal returns (AssetVault420 deployed) {
        deployed = new AssetVault420(
            id, address(vaultRegistry), address(vaultAuth), address(vaultAccounting), address(this)
        );
        vaultRegistry.registerVault(
            id, address(deployed), kind, AUTH_POLICY, ASSET_POLICY,
            RELEASE_POLICY, ACCOUNTING_POLICY, bytes32(0), METADATA, MANIFEST
        );
        require(vaultRegistry.getVault(id).vaultAddress == address(deployed), "vault registry binding");
    }

    function _deployFoundingAndCompensation() internal {
        claims = new FoundingWalletClaims420(ADMIN, ANDREW, JANET, MANIFEST);
        committee = new FoundingCommitteeMembership420(ADMIN, ANDREW, JANET, TIME);
        retirement = new FoundingRetirementVerifier420(VALIDATORS, address(committee), address(civic), TIME);
        founding = new FoundingTreasuryAuthority420(
            ADMIN, ANDREW, JANET, address(claims), TIME, address(retirement),
            address(budgets), address(disbursements), address(policy),
            address(vaultRegistry), OPS, CONT
        );
        sponsor = new FoundingValidatorSponsorship420(
            ADMIN, address(claims), address(founding), COMMUNITY_RESERVE, VALIDATORS
        );
        sweep = new FoundingCommunityRetirementSweep420(address(founding), COMMUNITY);
        splitter = new FoundingDeveloperCompensationSplitter420(ADMIN, ANDREW, JANET);
        compensation = new DevelopmentCompensationVault420(address(capabilities), address(splitter));
        executor = new TreasuryReleaseExecutor420(REGISTRY, address(founding));

        components = [
            address(claims), address(committee), address(retirement), address(founding),
            address(sponsor), address(sweep), address(splitter), address(compensation),
            address(auth), address(policy), address(budgets), address(disbursements),
            address(treasuryRouter), address(executor)
        ];
        names = [
            "FoundingWalletClaims420", "FoundingCommitteeMembership420", "FoundingRetirementVerifier420",
            "FoundingTreasuryAuthority420", "FoundingValidatorSponsorship420",
            "FoundingCommunityRetirementSweep420", "FoundingDeveloperCompensationSplitter420",
            "DevelopmentCompensationVault420", "TreasuryAuthorization420",
            "TreasuryPolicyRegistry420", "TreasuryBudgetRegistry420",
            "TreasuryDisbursementRegistry420", "TreasuryRouter420", "TreasuryReleaseExecutor420"
        ];
    }

    function _wireOneTimeAuthority() internal {
        // The real contracts enforce candidate pointer checks and one-shot restrictions.
        // Foundry's TIME prank represents a locally authorized Timelock operation,
        // NOT an on-chain approval or user wallet credential.
        policy.bindFoundingAuthority(address(founding));
        budgets.bindFoundingAuthority(address(founding));
        disbursements.bindFoundingAuthority(address(founding));
        vm.prank(TIME);
        budgets.setController(address(disbursements));
        founding.bindReleaseExecutor(address(executor), address(executor).codehash);
        splitter.bindCompensationVault(address(compensation));
        vm.prank(TIME);
        committee.bindRetirementAuthority(address(founding));

        vm.prank(TIME);
        CommunityValidatorReserve(payable(COMMUNITY_RESERVE)).bindGenesisFoundingSponsorAuthority(address(sponsor));
        vm.prank(TIME);
        CommunityValidatorReserve(payable(COMMUNITY_RESERVE)).bindValidatorRegistry(VALIDATORS);
        vm.prank(TIME);
        ValidatorRegistry(payable(VALIDATORS)).bindCommunityValidatorReserve(COMMUNITY_RESERVE);

        // Unclaimed accounts have no founding authority. Fixture claims only locally.
        vm.prank(ADMIN);
        (bool premature,) = address(founding).call(abi.encodeCall(founding.initializeBudgets, ()));
        require(!premature, "unclaimed founder initialized budgets");
        vm.prank(ADMIN); claims.claimFounderWallet();
        vm.prank(ANDREW); claims.claimFounderWallet();
        vm.prank(JANET); claims.claimFounderWallet();
        vm.prank(ADMIN); founding.initializeNativePolicy();
        vm.prank(ADMIN); founding.initializeBudgets();
    }

    function _publishLocalRegistry() internal {
        // Namespaced exclusively for local test receipts. NO new production service
        // IDs, no amendment to the frozen Genesis namespace, and no live publication.
        for (uint256 i; i < components.length; ++i) {
            address implementation = components[i];
            require(implementation.code.length != 0, "missing deployed component");
            bytes32 id = _localComponentId(names[i]);
            vm.prank(TIME);
            registry.registerComponent(
                id, implementation, Types420.Version(1, 0, 0), Types420.Lifecycle.ACTIVE
            );
            require(registry.resolve(id) == implementation, "Registry resolution drift");
            require(registry.runtimeCodeHash(id) == implementation.codehash, "Registry codehash drift");
            require(registry.currentComponentRevision(id) == 1, "Registry revision drift");
        }
        _publishService(ServiceIds420.TREASURY, address(treasuryRouter));
        _publishService(ServiceIds420.VAULT, address(vaultRouter));
        _publishService(ServiceIds420.DEVELOPMENT_COMPENSATION, address(compensation));
    }

    function _publishService(bytes32 id, address implementation) internal {
        vm.prank(TIME);
        registry.publishRegisteredService(
            id, implementation, METADATA, 1, true,
            ProtocolRegistry.ComponentType.SERVICE, MANIFEST, _graphHash(), INTERFACE_HASH
        );
        (address actual, uint32 version) = registry.resolveActive(id);
        require(actual == implementation && version == 1, "canonical service pointer drift");
        require(registry.getService(id).codeHash == implementation.codehash, "service runtime drift");
    }

    function _localComponentId(string memory name) internal pure returns (bytes32) {
        return keccak256(abi.encode("GOV-PRE-08/LOCAL-ONLY/COMPONENT", name));
    }

    function _graphHash() internal view returns (bytes32 hash) {
        bytes32 rolling = keccak256(abi.encode(block.chainid, MANIFEST, TIME, REGISTRY, VALIDATORS, COMMUNITY_RESERVE));
        for (uint256 i; i < components.length; ++i) {
            rolling = keccak256(abi.encode(rolling, names[i], components[i], components[i].codehash));
        }
        hash = keccak256(abi.encode(
            rolling, address(civic), address(vaultRegistry), address(opsVault),
            address(contingencyVault), address(communityVault), address(capabilities)
        ));
    }

    function testAllFourteenRealConstructorsAndRegistryReproducible() public {
        emit log_bytes32(graphDigest);
        require(components.length == 14 && graphDigest == _graphHash(), "source graph drift");
        for (uint256 i; i < components.length; ++i) {
            address deployed = components[i];
            require(deployed != address(0) && deployed.code.length != 0, "unmaterialized component");
            bytes32 id = _localComponentId(names[i]);
            Types420.ContractRef memory ref = registry.component(id);
            require(ref.implementation == deployed && ref.runtimeCodeHash == deployed.codehash,
                    "registered runtime differs");
            require(ref.lifecycle == Types420.Lifecycle.ACTIVE, "inactive local component");
        }
        require(registry.governanceTimelock() == TIME, "Registry Timelock drift");
        require(address(retirement.civicGovernor()) == address(civic), "verifier Civic binding");
        require(address(retirement.validators()) == VALIDATORS, "verifier validator binding");
        require(address(retirement.committee()) == address(committee), "verifier committee binding");
        require(!retirement.retirementReady(), "retirement authorized without witnesses");
    }

    function testFounderTreasuryAndCommunityCustodyBoundaries() public view {
        require(founding.foundingAdministrator() == ADMIN &&
                founding.founderAndrew() == ANDREW &&
                founding.founderJanet() == JANET, "founder identity drift");
        require(address(founding.founderWalletClaims()) == address(claims), "claim dependency");
        require(address(founding.retirementVerifier()) == address(retirement), "retirement dependency");
        require(address(founding.policyRegistry()) == address(policy), "policy dependency");
        require(address(founding.disbursementRegistry()) == address(disbursements), "disbursement dependency");
        require(address(founding.budgetRegistry()) == address(budgets), "budget dependency");
        require(address(founding.vaultRegistry()) == address(vaultRegistry), "vault registry dependency");
        require(founding.operationsVaultId() == OPS && founding.contingencyVaultId() == CONT, "vault IDs");
        require(address(founding.foundingReleaseExecutor()) == address(executor), "executor handshake");
        require(policy.foundingAuthority() == address(founding), "policy handshake");
        require(budgets.foundingAuthority() == address(founding), "budget handshake");
        require(disbursements.foundingAuthority() == address(founding), "disbursement handshake");
        require(budgets.controller() == address(disbursements), "controller drift");
        require(committee.retirementAuthority() == address(founding), "committee retirement binding");
        require(address(sweep.registry()) == address(vaultRegistry), "sweep vault graph");
        require(sweep.communityId() == COMMUNITY, "community ID");
        require(sweep.operationsId() == OPS && sweep.contingencyId() == CONT, "sweep source IDs");
        require(!founding.retired() && !sweep.custodyHandoffComplete(), "early retirement/handoff");
        require(budgets.budget(founding.operationsBudgetId()).ceiling == 4_200_000 ether, "operations allocation");
        require(budgets.budget(founding.contingencyBudgetId()).ceiling == 840_000 ether, "contingency allocation");
    }

    function testValidatorSponsorshipAndCompensationAreBoundAndNotAuthorizedToSpend() public view {
        require(sponsor.foundingAdministrator() == ADMIN, "sponsor founder");
        require(address(sponsor.founderWalletClaims()) == address(claims), "sponsor claim boundary");
        require(address(sponsor.foundingRetirement()) == address(founding), "sponsor retirement boundary");
        require(address(sponsor.communityReserve()) == COMMUNITY_RESERVE, "sponsor reserve");
        require(address(sponsor.validatorRegistry()) == VALIDATORS, "sponsor validators");
        require(CommunityValidatorReserve(payable(COMMUNITY_RESERVE)).genesisFoundingSponsorAuthority()
                == address(sponsor), "missing sponsor binding");
        require(ValidatorRegistry(payable(VALIDATORS)).communityValidatorReserve() == COMMUNITY_RESERVE,
                "missing reserve/validator binding");
        require(splitter.compensationVault() == address(compensation), "splitter/vault handshake");
        require(compensation.beneficiary() == address(splitter), "compensation beneficiary");
        require(address(compensation.capabilityRegistry()) == address(capabilities), "compensation capabilities");
        require(splitter.ADMIN_BPS() == 5000 && splitter.ANDREW_BPS() == 2500 &&
                splitter.JANET_BPS() == 2500, "50/25/25 split");
        require(!auth.isDisbursementAuthorized(
            address(executor), bytes32(uint256(1)), TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT, 1
        ), "ungranted Treasury release");
        require(!vaultAuth.isRouteAuthorized(
            address(sweep), OPS, VaultIds420.ACTION_WITHDRAW, address(0),
            address(communityVault), 1
        ), "ungranted community sweep");
    }

    function testCannotRebindOrPublishWithoutAuthority() public {
        (bool ok,) = address(policy).call(abi.encodeCall(policy.bindFoundingAuthority, (address(founding))));
        require(!ok, "policy authority was rebound");
        (ok,) = address(budgets).call(abi.encodeCall(budgets.bindFoundingAuthority, (address(founding))));
        require(!ok, "budget authority was rebound");
        (ok,) = address(committee).call(
            abi.encodeCall(committee.bindRetirementAuthority, (address(founding)))
        );
        require(!ok, "committee retirement authority was rebound");
        (ok,) = address(splitter).call(abi.encodeCall(splitter.bindCompensationVault, (address(compensation))));
        require(!ok, "splitter vault was rebound");
        (ok,) = address(registry).call(abi.encodeCall(
            registry.registerComponent,
            (keccak256("untrusted"), address(founding),
             Types420.Version(1, 0, 0), Types420.Lifecycle.ACTIVE)
        ));
        require(!ok, "non-timelock component published");
        (ok,) = address(registry).call(abi.encodeCall(
            registry.publishService,
            (ServiceIds420.TREASURY, address(this), bytes32(uint256(1)), METADATA, 2, true)
        ));
        require(!ok, "non-timelock canonical service overwritten");
        (ok,) = address(sweep).call(abi.encodeCall(sweep.sweep, (false, 1 ether)));
        require(!ok, "unretired sweep permitted");
        require(!retirement.retirementReady(), "retirement incorrectly ready");
    }
}
