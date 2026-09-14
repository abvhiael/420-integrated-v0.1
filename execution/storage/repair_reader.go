package storage

import (
	"context"
	"strings"
)

// RepairSnapshot is the canonical read-only input to the SR-5 planner.
// RepairPolicyHash is derived from the storage agreements backing every
// placement and must be identical across the sealed manifest.
type RepairSnapshot struct {
	Manifest         RepairManifest
	RepairPolicyHash string
}

type RepairCanonicalReader interface {
	RepairSnapshot(ctx context.Context, manifestID string) (RepairSnapshot, error)
}

type RepairPolicyResolver interface {
	ResolveRepairPolicy(ctx context.Context, policyHash string, manifest RepairManifest) (RepairPolicy, error)
}

type RepairEvaluation struct {
	Snapshot RepairSnapshot
	Policy   RepairPolicy
	Plan     RepairPlan
}

// EvaluateRepair is deliberately read-only. Canonical state is read first,
// policy semantics are resolved separately, and only then is repair intent
// derived. No provider selection or chain mutation occurs here.
func EvaluateRepair(ctx context.Context, reader RepairCanonicalReader, resolver RepairPolicyResolver, manifestID string) (RepairEvaluation, error) {
	if reader == nil || resolver == nil || strings.TrimSpace(manifestID) == "" {
		return RepairEvaluation{}, ErrInvalidRepairState
	}
	snapshot, err := reader.RepairSnapshot(ctx, manifestID)
	if err != nil {
		return RepairEvaluation{}, err
	}
	if !equalHex(snapshot.Manifest.ManifestID, manifestID) || strings.TrimSpace(snapshot.RepairPolicyHash) == "" {
		return RepairEvaluation{}, ErrInvalidRepairState
	}
	policy, err := resolver.ResolveRepairPolicy(ctx, snapshot.RepairPolicyHash, snapshot.Manifest)
	if err != nil {
		return RepairEvaluation{}, err
	}
	plan, err := PlanRepair(snapshot.Manifest, policy)
	if err != nil {
		return RepairEvaluation{}, err
	}
	return RepairEvaluation{Snapshot: snapshot, Policy: policy, Plan: plan}, nil
}

// StaticRepairPolicyResolver is suitable for genesis configuration and tests.
// Production policy distribution can replace it without changing repair logic.
type StaticRepairPolicyResolver map[string]RepairPolicy

func (r StaticRepairPolicyResolver) ResolveRepairPolicy(_ context.Context, policyHash string, manifest RepairManifest) (RepairPolicy, error) {
	for key, policy := range r {
		if equalHex(key, policyHash) {
			target := policy.TargetLiveShards
			if target == 0 {
				target = manifest.TotalShards
			}
			if target < manifest.DataShards || target > manifest.TotalShards {
				return RepairPolicy{}, ErrInvalidRepairState
			}
			return policy, nil
		}
	}
	return RepairPolicy{}, ErrInvalidRepairState
}

// RPCRepairReader derives repair state only from canonical storage contracts.
// A placement is live only when its agreement is currently effective. Every
// placement agreement must match the manifest envelope and share one policy
// hash; otherwise repair evaluation fails closed.
type RPCRepairReader struct {
	Backend   RPCBackend
	Contracts RPCStorageContracts
}

func (r RPCRepairReader) RepairSnapshot(ctx context.Context, manifestID string) (RepairSnapshot, error) {
	if !validHexAddress(r.Contracts.Manifest) || !validHexAddress(r.Contracts.Agreement) {
		return RepairSnapshot{}, ErrInvalidRepairState
	}
	mid, err := bytes32Arg(manifestID)
	if err != nil {
		return RepairSnapshot{}, ErrInvalidRepairState
	}
	raw, err := r.Backend.EthCall(ctx, r.Contracts.Manifest, calldata("getManifest(bytes32)", mid), "latest")
	if err != nil {
		return RepairSnapshot{}, err
	}
	mw, err := abiWords(raw, 13)
	if err != nil {
		return RepairSnapshot{}, ErrInvalidRepairState
	}
	dataShards, dok := wordUint64(mw[8])
	totalShards, tok := wordUint64(mw[9])
	placedShards, pok := wordUint64(mw[10])
	if !dok || !tok || !pok || dataShards == 0 || totalShards < dataShards || totalShards > 1024 || placedShards != totalShards || !wordBool(mw[11]) || !wordBool(mw[12]) || zeroWord(mw[1]) || zeroWord(mw[3]) || zeroWord(mw[5]) {
		return RepairSnapshot{}, ErrInvalidRepairState
	}
	manifest := RepairManifest{
		ManifestID:   wordHex(mid),
		ObjectID:     wordHex(mw[1]),
		ManifestHash: wordHex(mw[3]),
		ErasureRoot:  wordHex(mw[5]),
		DataShards:   uint32(dataShards),
		TotalShards:  uint32(totalShards),
		Sealed:       true,
		Placements:   make([]RepairPlacement, 0, totalShards),
	}
	policyHash := ""
	for i := uint64(0); i < totalShards; i++ {
		raw, err = r.Backend.EthCall(ctx, r.Contracts.Manifest, calldata("placementAt(bytes32,uint32)", mid, uintWord(i)), "latest")
		if err != nil {
			return RepairSnapshot{}, err
		}
		pw, err := abiWords(raw, 8)
		if err != nil {
			return RepairSnapshot{}, ErrInvalidRepairState
		}
		size, sok := wordUint64(pw[5])
		index, iok := wordUint64(pw[6])
		if !sok || !iok || size == 0 || index != i || !wordBool(pw[7]) || !sameWord(pw[0], mid) || zeroWord(pw[1]) || zeroWord(pw[2]) || zeroWord(pw[3]) || zeroWord(pw[4]) {
			return RepairSnapshot{}, ErrInvalidRepairState
		}

		agreementID := pw[1]
		raw, err = r.Backend.EthCall(ctx, r.Contracts.Agreement, calldata("getAgreement(bytes32)", agreementID), "latest")
		if err != nil {
			return RepairSnapshot{}, err
		}
		aw, err := abiWords(raw, 18)
		if err != nil {
			return RepairSnapshot{}, ErrInvalidRepairState
		}
		ad, adok := wordUint64(aw[14])
		at, atok := wordUint64(aw[15])
		if !adok || !atok || !wordBool(aw[17]) || !sameWord(aw[2], mw[1]) || !sameWord(aw[4], mw[3]) || !sameWord(aw[8], pw[2]) || ad != dataShards || at != totalShards || zeroWord(aw[6]) {
			return RepairSnapshot{}, ErrInvalidRepairState
		}
		candidatePolicy := wordHex(aw[6])
		if policyHash == "" {
			policyHash = candidatePolicy
		} else if !equalHex(policyHash, candidatePolicy) {
			return RepairSnapshot{}, ErrInvalidRepairState
		}

		raw, err = r.Backend.EthCall(ctx, r.Contracts.Agreement, calldata("isEffective(bytes32)", agreementID), "latest")
		if err != nil {
			return RepairSnapshot{}, err
		}
		liveWords, err := abiWords(raw, 1)
		if err != nil {
			return RepairSnapshot{}, ErrInvalidRepairState
		}
		manifest.Placements = append(manifest.Placements, RepairPlacement{
			ShardIndex:   uint32(index),
			AgreementID:  wordHex(agreementID),
			CommitmentID: wordHex(pw[2]),
			NodeID:       wordHex(pw[3]),
			ShardRoot:    wordHex(pw[4]),
			SizeBytes:    size,
			Live:         wordBool(liveWords[0]),
		})
	}
	if policyHash == "" {
		return RepairSnapshot{}, ErrInvalidRepairState
	}
	return RepairSnapshot{Manifest: manifest, RepairPolicyHash: policyHash}, nil
}
