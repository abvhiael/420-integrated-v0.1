package discovery

import "context"

// OperatorIndex is populated from MediaOperatorRegistry420 lifecycle/capability events.
// It is only a discovery accelerator; implementations must not treat indexed state as
// authoritative for selection eligibility.
type OperatorIndex interface {
	OperatorIDs(ctx context.Context, capabilityID [32]byte) ([][32]byte, error)
}

// RegistryReader revalidates an indexed operator against canonical chain state.
type RegistryReader interface {
	CanonicalProvider(ctx context.Context, operatorID, capabilityID [32]byte) (Provider, error)
}

// ProfileResolver resolves operator-published service metadata referenced by the
// canonical metadataHash. Raw endpoints, credentials and media secrets remain off-chain.
type ProfileResolver interface {
	ResolveProfile(ctx context.Context, operatorID, metadataHash [32]byte, revision uint32) (ServiceProfile, error)
}

type ServiceProfile struct {
	PricePerUnit   uint64
	LatencyMS      uint32
	Geography      string
	AvailableSlots uint32
	ReliabilityBPS uint32
}

// IndexedSource combines cheap event-index discovery with mandatory canonical state
// revalidation before a provider enters the selector candidate set.
type IndexedSource struct {
	Index    OperatorIndex
	Registry RegistryReader
	Profiles ProfileResolver
}

func (s IndexedSource) Candidates(ctx context.Context, capabilityID [32]byte) ([]Provider, error) {
	if s.Index == nil || s.Registry == nil || s.Profiles == nil || capabilityID == ([32]byte{}) {
		return nil, ErrInvalidRequest
	}
	ids, err := s.Index.OperatorIDs(ctx, capabilityID)
	if err != nil {
		return nil, err
	}
	out := make([]Provider, 0, len(ids))
	seen := make(map[[32]byte]struct{}, len(ids))
	for _, operatorID := range ids {
		if operatorID == ([32]byte{}) {
			continue
		}
		if _, ok := seen[operatorID]; ok {
			continue
		}
		seen[operatorID] = struct{}{}

		provider, err := s.Registry.CanonicalProvider(ctx, operatorID, capabilityID)
		if err != nil {
			// Canonical RPC/read failures invalidate the whole discovery pass. Returning
			// partially revalidated candidates could silently prefer stale state.
			return nil, err
		}
		if !provider.Active || !provider.Supports(capabilityID) || provider.OperatorID != operatorID {
			continue
		}
		profile, err := s.Profiles.ResolveProfile(ctx, operatorID, provider.MetadataHash, provider.Revision)
		if err != nil {
			// A malformed or unavailable operator profile excludes that operator but
			// does not make unrelated canonical operators undiscoverable.
			continue
		}
		if profile.ReliabilityBPS > 10_000 {
			continue
		}
		provider.PricePerUnit = profile.PricePerUnit
		provider.LatencyMS = profile.LatencyMS
		provider.Geography = profile.Geography
		provider.AvailableSlots = profile.AvailableSlots
		provider.ReliabilityBPS = profile.ReliabilityBPS
		out = append(out, provider)
	}
	return out, nil
}
