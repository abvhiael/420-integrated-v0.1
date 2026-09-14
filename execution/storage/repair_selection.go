package storage

import (
	"context"
	"sort"
	"strings"
)

var repairStoreServiceID = wordHex(keccak256([]byte("420/RESOURCE/SERVICE/STORE/V1")))

type RepairProviderCandidate struct {
	OfferID       string
	NodeID        string
	ProviderID    string
	UnitPrice420  uint64
	AvailableBytes uint64
}

type RepairEligibilityReader interface {
	VerifyRepairCandidate(ctx context.Context, candidate RepairProviderCandidate, requiredBytes uint64) (RepairProviderCandidate, error)
}

type RepairPlacementSelection struct {
	ShardIndex uint32
	Candidate  RepairProviderCandidate
}

type RepairSelectionPlan struct {
	ManifestID string
	Selections []RepairPlacementSelection
}

// SelectRepairProviders deterministically assigns eligible STORE candidates to
// reconstruction targets. A candidate node/provider can be used only once in a
// single repair plan and cannot reuse any node/provider already backing a live
// manifest shard. Canonical eligibility is delegated to the reader.
func SelectRepairProviders(ctx context.Context, reconstruction RepairReconstructionPlan, manifest RepairManifest, reader RepairEligibilityReader, candidates []RepairProviderCandidate) (RepairSelectionPlan, error) {
	if reader == nil || !equalHex(reconstruction.ManifestID, manifest.ManifestID) || len(reconstruction.Targets) == 0 || len(candidates) == 0 {
		return RepairSelectionPlan{}, ErrInvalidRepairState
	}

	excludedNodes := map[string]struct{}{}
	excludedProviders := map[string]struct{}{}
	for _, placement := range manifest.Placements {
		if !placement.Live {
			continue
		}
		excludedNodes[strings.ToLower(placement.NodeID)] = struct{}{}
	}

	verified := make([]RepairProviderCandidate, 0, len(candidates))
	seenOffers := map[string]struct{}{}
	seenNodes := map[string]struct{}{}
	seenProviders := map[string]struct{}{}
	for _, candidate := range candidates {
		if strings.TrimSpace(candidate.OfferID) == "" || strings.TrimSpace(candidate.NodeID) == "" || strings.TrimSpace(candidate.ProviderID) == "" {
			return RepairSelectionPlan{}, ErrInvalidRepairState
		}
		okCandidate, err := reader.VerifyRepairCandidate(ctx, candidate, minimumTargetSize(reconstruction.Targets))
		if err != nil {
			continue
		}
		if _, blocked := excludedNodes[strings.ToLower(okCandidate.NodeID)]; blocked {
			continue
		}
		if _, blocked := excludedProviders[strings.ToLower(okCandidate.ProviderID)]; blocked {
			continue
		}
		okey := strings.ToLower(okCandidate.OfferID)
		nkey := strings.ToLower(okCandidate.NodeID)
		pkey := strings.ToLower(okCandidate.ProviderID)
		if _, exists := seenOffers[okey]; exists { continue }
		if _, exists := seenNodes[nkey]; exists { continue }
		if _, exists := seenProviders[pkey]; exists { continue }
		seenOffers[okey] = struct{}{}
		seenNodes[nkey] = struct{}{}
		seenProviders[pkey] = struct{}{}
		verified = append(verified, okCandidate)
	}
	if len(verified) < len(reconstruction.Targets) {
		return RepairSelectionPlan{}, ErrInvalidRepairState
	}

	sort.Slice(verified, func(i, j int) bool {
		if verified[i].UnitPrice420 != verified[j].UnitPrice420 { return verified[i].UnitPrice420 < verified[j].UnitPrice420 }
		if verified[i].AvailableBytes != verified[j].AvailableBytes { return verified[i].AvailableBytes > verified[j].AvailableBytes }
		return strings.ToLower(verified[i].NodeID) < strings.ToLower(verified[j].NodeID)
	})
	targets := append([]RepairShardRef(nil), reconstruction.Targets...)
	sort.Slice(targets, func(i, j int) bool { return targets[i].ShardIndex < targets[j].ShardIndex })

	out := RepairSelectionPlan{ManifestID: manifest.ManifestID, Selections: make([]RepairPlacementSelection, 0, len(targets))}
	for i, target := range targets {
		candidate := verified[i]
		if candidate.AvailableBytes < target.SizeBytes {
			return RepairSelectionPlan{}, ErrInvalidRepairState
		}
		out.Selections = append(out.Selections, RepairPlacementSelection{ShardIndex: target.ShardIndex, Candidate: candidate})
	}
	return out, nil
}

func minimumTargetSize(targets []RepairShardRef) uint64 {
	var max uint64
	for _, target := range targets { if target.SizeBytes > max { max = target.SizeBytes } }
	return max
}

// RPCRepairEligibilityReader validates a discovered candidate against canonical
// offer/node/capacity state. Candidate discovery remains pluggable because the
// current registries do not expose global enumeration.
type RPCRepairEligibilityReader struct {
	Backend RPCBackend
	Offers string
	Nodes string
	Capacity string
}

func (r RPCRepairEligibilityReader) VerifyRepairCandidate(ctx context.Context, candidate RepairProviderCandidate, requiredBytes uint64) (RepairProviderCandidate, error) {
	if !validHexAddress(r.Offers) || !validHexAddress(r.Nodes) || !validHexAddress(r.Capacity) || requiredBytes == 0 {
		return RepairProviderCandidate{}, ErrInvalidRepairState
	}
	offerID, err := bytes32Arg(candidate.OfferID); if err != nil { return RepairProviderCandidate{}, ErrInvalidRepairState }
	raw, err := r.Backend.EthCall(ctx, r.Offers, calldata("getOffer(bytes32)", offerID), "latest"); if err != nil { return RepairProviderCandidate{}, err }
	ow, err := abiWords(raw, 8); if err != nil { return RepairProviderCandidate{}, ErrInvalidRepairState }
	price, pok := wordUint64(ow[2]); maxUnits, mok := wordUint64(ow[3])
	if !pok || !mok || maxUnits == 0 || !wordBool(ow[6]) || !wordBool(ow[7]) || !equalHex(wordHex(ow[1]), repairStoreServiceID) { return RepairProviderCandidate{}, ErrInvalidRepairState }
	raw, err = r.Backend.EthCall(ctx, r.Offers, calldata("isEffective(bytes32)", offerID), "latest"); if err != nil { return RepairProviderCandidate{}, err }
	bools, err := abiWords(raw,1); if err != nil || !wordBool(bools[0]) { return RepairProviderCandidate{}, ErrInvalidRepairState }

	nodeID := ow[0]
	raw, err = r.Backend.EthCall(ctx, r.Nodes, calldata("getNode(bytes32)", nodeID), "latest"); if err != nil { return RepairProviderCandidate{}, err }
	nw, err := abiWords(raw,8); if err != nil { return RepairProviderCandidate{}, ErrInvalidRepairState }
	state, sok := wordUint64(nw[6])
	if !sok || state != 2 || !wordBool(nw[7]) || !sameWord(nw[1], ow[1]) || zeroWord(nw[0]) { return RepairProviderCandidate{}, ErrInvalidRepairState }

	raw, err = r.Backend.EthCall(ctx, r.Capacity, calldata("availableBytes(bytes32)", nodeID), "latest"); if err != nil { return RepairProviderCandidate{}, err }
	cw, err := abiWords(raw,1); if err != nil { return RepairProviderCandidate{}, ErrInvalidRepairState }
	available, aok := wordUint64(cw[0]); if !aok || available < requiredBytes { return RepairProviderCandidate{}, ErrInvalidRepairState }

	return RepairProviderCandidate{OfferID:wordHex(offerID), NodeID:wordHex(nodeID), ProviderID:wordHex(nw[0]), UnitPrice420:price, AvailableBytes:available}, nil
}
