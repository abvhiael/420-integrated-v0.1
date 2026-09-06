// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/media/PlaybackResolver420.sol";

contract MockPlaybackMediaManifest420 is IPlaybackMediaManifest420 {
    mapping(uint256 => MediaManifest420) private _manifests;

    function setManifest(RecordingId recordingId, MediaManifest420 calldata manifest) external {
        _manifests[RecordingId.unwrap(recordingId)] = manifest;
    }

    function current(RecordingId recordingId) external view returns (MediaManifest420 memory) {
        MediaManifest420 memory manifest = _manifests[RecordingId.unwrap(recordingId)];
        if (manifest.revision == 0) revert CreativeErrors420.NotFound();
        return manifest;
    }
}

contract MockPlaybackStorageSource420 is IPlaybackStorageSource420 {
    struct Resolution {
        uint64 sourceId;
        StorageSource420 source;
        bool exists;
    }

    mapping(uint256 => Resolution) private _resolutions;

    function setBestSource(RecordingId recordingId, uint64 sourceId, StorageSource420 calldata source_) external {
        _resolutions[RecordingId.unwrap(recordingId)] = Resolution(sourceId, source_, true);
    }

    function bestAvailableSource(RecordingId recordingId)
        external
        view
        returns (uint64 sourceId, StorageSource420 memory source_)
    {
        Resolution storage resolution = _resolutions[RecordingId.unwrap(recordingId)];
        if (!resolution.exists) revert CreativeErrors420.NotFound();
        return (resolution.sourceId, resolution.source);
    }
}

contract PlaybackResolver420Test {
    RecordingId private constant RECORDING = RecordingId.wrap(7);
    bytes32 private constant MASTER = keccak256("master");

    MockPlaybackMediaManifest420 private media;
    MockPlaybackStorageSource420 private storageSources;
    PlaybackResolver420 private resolver;

    function setUp() public {
        media = new MockPlaybackMediaManifest420();
        storageSources = new MockPlaybackStorageSource420();
        resolver = new PlaybackResolver420(address(media), address(storageSources));

        media.setManifest(
            RECORDING,
            IPlaybackMediaManifest420.MediaManifest420({
                manifestHash: keccak256("manifest"),
                masterContentHash: MASTER,
                technicalMetadataHash: keccak256("technical"),
                storageLocatorHash: keccak256("storage-locator"),
                provenanceHash: keccak256("provenance"),
                durationMs: 240000,
                revision: 3,
                updatedAt: 1
            })
        );
    }

    function testResolvesCanonicalRecordingToBestPlayableSource() public {
        storageSources.setBestSource(
            RECORDING,
            2,
            IPlaybackStorageSource420.StorageSource420({
                providerKey: keccak256("provider-b"),
                locatorHash: keccak256("locator-b"),
                contentHash: MASTER,
                integrityHash: keccak256("integrity-b"),
                addedAt: 1,
                updatedAt: 2,
                priority: 5,
                state: IPlaybackStorageSource420.SourceState.ACTIVE
            })
        );

        PlaybackResolver420.PlaybackResolution420 memory resolution = resolver.resolve(RECORDING);
        require(resolution.recordingId == 7, "recording identity");
        require(resolution.mediaRevision == 3, "media revision");
        require(resolution.sourceId == 2, "source id");
        require(resolution.masterContentHash == MASTER, "content identity");
        require(resolution.durationMs == 240000, "duration");
        require(resolution.sourceState == uint8(IPlaybackStorageSource420.SourceState.ACTIVE), "state");
    }

    function testAllowsDegradedFallbackSource() public {
        storageSources.setBestSource(
            RECORDING,
            4,
            IPlaybackStorageSource420.StorageSource420({
                providerKey: keccak256("fallback"),
                locatorHash: keccak256("fallback-locator"),
                contentHash: MASTER,
                integrityHash: keccak256("fallback-integrity"),
                addedAt: 1,
                updatedAt: 2,
                priority: 10,
                state: IPlaybackStorageSource420.SourceState.DEGRADED
            })
        );

        PlaybackResolver420.PlaybackResolution420 memory resolution = resolver.resolve(RECORDING);
        require(resolution.sourceId == 4, "fallback source");
        require(resolution.sourceState == uint8(IPlaybackStorageSource420.SourceState.DEGRADED), "degraded state");
    }

    function testRejectsSourceWhoseContentDoesNotMatchCanonicalMaster() public {
        storageSources.setBestSource(
            RECORDING,
            1,
            IPlaybackStorageSource420.StorageSource420({
                providerKey: keccak256("provider"),
                locatorHash: keccak256("locator"),
                contentHash: keccak256("wrong-master"),
                integrityHash: keccak256("integrity"),
                addedAt: 1,
                updatedAt: 2,
                priority: 1,
                state: IPlaybackStorageSource420.SourceState.ACTIVE
            })
        );

        try resolver.resolve(RECORDING) returns (PlaybackResolver420.PlaybackResolution420 memory) {
            revert("expected content mismatch revert");
        } catch (bytes memory reason) {
            require(_selector(reason) == CreativeErrors420.InvalidState.selector, "wrong revert");
        }
    }

    function testRejectsUnavailableSourceEvenIfRegistryReturnsIt() public {
        storageSources.setBestSource(
            RECORDING,
            1,
            IPlaybackStorageSource420.StorageSource420({
                providerKey: keccak256("provider"),
                locatorHash: keccak256("locator"),
                contentHash: MASTER,
                integrityHash: keccak256("integrity"),
                addedAt: 1,
                updatedAt: 2,
                priority: 1,
                state: IPlaybackStorageSource420.SourceState.UNAVAILABLE
            })
        );

        try resolver.resolve(RECORDING) returns (PlaybackResolver420.PlaybackResolution420 memory) {
            revert("expected unavailable revert");
        } catch (bytes memory reason) {
            require(_selector(reason) == CreativeErrors420.InvalidState.selector, "wrong revert");
        }
    }

    function testZeroRecordingIdFailsClosed() public {
        try resolver.resolve(RecordingId.wrap(0)) returns (PlaybackResolver420.PlaybackResolution420 memory) {
            revert("expected zero id revert");
        } catch (bytes memory reason) {
            require(_selector(reason) == CreativeErrors420.InvalidId.selector, "wrong revert");
        }
    }

    function _selector(bytes memory reason) private pure returns (bytes4 selector) {
        if (reason.length < 4) return bytes4(0);
        assembly {
            selector := mload(add(reason, 32))
        }
    }
}
