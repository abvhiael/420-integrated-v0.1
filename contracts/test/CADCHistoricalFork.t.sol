// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/adapters/CADCLayerZeroAdapter.sol";

interface CADCHistoryVm420 {
    function createSelectFork(string calldata, uint256) external returns (uint256);
    function envString(string calldata) external returns (string memory);
}

/// @dev Test-only issuer activation record. No production approval is implied by a fork.
contract CADCHistoryActivation420 {
    function requireActive() external view {require(active,"inactive historical test activation");}
    bool public active = true;
    address public constant cadc = 0x49A6F6aeAB68eA001bEaa4815186eb22FBDcCF2A;
    address public constant issuerOFT = 0xe0F9483dE044B8E0C069a8561bdb580778854143;
    address public constant layerZeroEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;
    bytes32 public securityConfigHash;
    bytes32 public peerConfigHash;

    function setActive(bool a) external {
        active = a;
    }

    function pin(bytes32 s, bytes32 p) external {
        securityConfigHash = s;
        peerConfigHash = p;
    }
}

/// @notice Explicit network qualification against genuine pre-commit mainnet state.
contract CADCHistoricalFork420Test {
    CADCHistoryVm420 constant vm = CADCHistoryVm420(address(uint160(uint256(keccak256("hevm cheat code")))));

    function qualify(
        uint256 blockNumber,
        uint32 srcEid,
        bytes32 remote,
        address recipient,
        uint64 shared,
        bytes32 expectedGuid
    ) internal {
        vm.createSelectFork(vm.envString("CADC_ARCHIVE_RPC"), blockNumber);
        CADCHistoryActivation420 i = new CADCHistoryActivation420();
        i.setActive(false);
        CADCLayerZeroAdapter adapter =
            new CADCLayerZeroAdapter(address(this), address(this), address(i), keccak256("CADC"));
        address lib = 0xc02Ab410f0734EFa3F14628780e6e695156024C2;
        CADCUln420 memory config = ICADCUln420(lib).getUlnConfig(i.issuerOFT(), srcEid);
        adapter.setPeer(
            srcEid,
            CADCLayerZeroAdapter.Peer(
                keccak256("CONTROLLED/HISTORICAL/ROUTE"),
                remote,
                lib,
                address(0),
                keccak256(abi.encode(config)),
                0,
                true,
                false
            )
        );
        i.pin(adapter.securityConfigHash(), adapter.peerConfigHash());
        i.setActive(true);
        uint256 beforeBalance = ICADCToken420(i.cadc()).balanceOf(recipient);
        IBridgeAdapter420.VerifiedTransfer memory v = adapter.verifyInbound(
            abi.encode(srcEid, uint64(1), abi.encodePacked(bytes32(uint256(uint160(recipient))), shared))
        );
        require(
            v.sourceMessageId == expectedGuid && v.amount == shared && v.recipient == recipient, "historical packet"
        );
        require(
            ICADCToken420(i.cadc()).balanceOf(recipient) == beforeBalance + shared, "genuine issuer native execution"
        );
        (bool ok,) = address(adapter)
            .call(
                abi.encodeCall(
                    adapter.verifyInbound,
                    (abi.encode(srcEid, uint64(1), abi.encodePacked(bytes32(uint256(uint160(recipient))), shared)))
                )
            );
        require(!ok, "historical replay");
    }

    function testGenuineBaseDvnStateAndIssuerExecution() public {
        qualify(
            26400201,
            30184,
            bytes32(uint256(uint160(address(0x91222d95170227badb6d4e856fC03324EB6a4Ab8)))),
            address(0xDac92EE635a47762bE01d886118731FFb10A4eE6),
            1000000,
            0x75cdaa63f2b1e7b7e97b3776b0feafb4738d8a240ee242383920cd3f85268660
        );
    }

    function testGenuinePolygonDvnStateAndIssuerExecution() public {
        qualify(
            26399892,
            30109,
            bytes32(uint256(uint160(address(0xf004f8c27851F4f7123B974bF4d106A1aa5C0ef5)))),
            address(0xF8d2aeaD1060a5da45e35d0f83c68bF89D9A9461),
            100000,
            0x25ccbf6c79e62492b5220015e789dfcd8f872c8a4f06d23a9520442fdc0527ce
        );
    }
}
