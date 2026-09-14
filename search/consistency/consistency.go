package consistency

import (
	"errors"
	"fmt"
	"strings"

	"github.com/420integrated/420-integrated/search/pagination"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

type Freshness string

const (
	FreshnessCurrent Freshness = "current"
	FreshnessLagging Freshness = "lagging"
	FreshnessStale   Freshness = "stale"
)

type SnapshotState struct {
	Search    pagination.Snapshot `json:"search"`
	Upstream  pagination.Snapshot `json:"upstream"`
	MaxLag    uint64              `json:"maxLag"`
}

type Assessment struct {
	Freshness Freshness `json:"freshness"`
	Lag       uint64    `json:"lag"`
}

type ReconcileReport struct {
	ReorgedIDs []string `json:"reorgedIds"`
	UpdatedIDs []string `json:"updatedIds"`
}

func AssessSnapshot(state SnapshotState) (Assessment, error) {
	if err := validateSnapshot(state.Search); err != nil {
		return Assessment{}, fmt.Errorf("invalid search snapshot: %w", err)
	}
	if err := validateSnapshot(state.Upstream); err != nil {
		return Assessment{}, fmt.Errorf("invalid upstream snapshot: %w", err)
	}
	if state.Search.IndexedHeight > state.Upstream.IndexedHeight {
		return Assessment{}, errors.New("search snapshot cannot be ahead of upstream")
	}
	if state.Search.FinalizedHeight > state.Upstream.FinalizedHeight {
		return Assessment{}, errors.New("search finalized height cannot be ahead of upstream")
	}
	lag := state.Upstream.IndexedHeight - state.Search.IndexedHeight
	assessment := Assessment{Freshness: FreshnessCurrent, Lag: lag}
	if lag == 0 {
		return assessment, nil
	}
	assessment.Freshness = FreshnessLagging
	if lag > state.MaxLag {
		assessment.Freshness = FreshnessStale
	}
	return assessment, nil
}

func ValidateResultAtSnapshot(result searchresult.Result, snapshot pagination.Snapshot) error {
	if err := result.Validate(); err != nil {
		return err
	}
	if err := validateSnapshot(snapshot); err != nil {
		return err
	}
	p := result.Provenance
	if p.IndexedHeight != nil && *p.IndexedHeight > snapshot.IndexedHeight {
		return errors.New("result provenance indexed height exceeds search snapshot")
	}
	if p.FinalizedHeight != nil && *p.FinalizedHeight > snapshot.FinalizedHeight {
		return errors.New("result provenance finalized height exceeds search snapshot")
	}
	if p.BlockNumber == nil {
		if p.Finality == searchresult.FinalityFinalized {
			return errors.New("finalized result requires block provenance")
		}
		return nil
	}
	block := *p.BlockNumber
	if block > snapshot.IndexedHeight {
		return errors.New("result block exceeds search snapshot")
	}
	if p.Finality == searchresult.FinalityFinalized && block > snapshot.FinalizedHeight {
		return errors.New("result claims finalized above finalized snapshot")
	}
	if block <= snapshot.FinalizedHeight && p.Finality == searchresult.FinalityHead {
		return errors.New("finalized-range result cannot remain head-only")
	}
	return nil
}

// Reconcile compares two projections of the same logical Search snapshot lineage.
// Finalized records are immutable: they may neither disappear nor change their
// canonical chain provenance. Non-finalized records may disappear or change as
// the Indexer follows a canonical reorg; those changes are reported explicitly.
func Reconcile(previous, current []searchresult.Result, previousSnapshot, currentSnapshot pagination.Snapshot) (ReconcileReport, error) {
	if err := validateSnapshot(previousSnapshot); err != nil {
		return ReconcileReport{}, err
	}
	if err := validateSnapshot(currentSnapshot); err != nil {
		return ReconcileReport{}, err
	}
	if currentSnapshot.IndexedHeight < previousSnapshot.IndexedHeight {
		return ReconcileReport{}, errors.New("search snapshot indexed height regressed")
	}
	if currentSnapshot.FinalizedHeight < previousSnapshot.FinalizedHeight {
		return ReconcileReport{}, errors.New("search snapshot finalized height regressed")
	}

	prevByID, err := indexResults(previous, previousSnapshot)
	if err != nil {
		return ReconcileReport{}, err
	}
	currByID, err := indexResults(current, currentSnapshot)
	if err != nil {
		return ReconcileReport{}, err
	}

	report := ReconcileReport{}
	for id, before := range prevByID {
		after, exists := currByID[id]
		finalizedBefore := finalizedAt(before, previousSnapshot.FinalizedHeight)
		if !exists {
			if finalizedBefore {
				return ReconcileReport{}, fmt.Errorf("finalized result disappeared: %s", id)
			}
			report.ReorgedIDs = append(report.ReorgedIDs, id)
			continue
		}
		if canonicalProvenanceChanged(before, after) {
			if finalizedBefore {
				return ReconcileReport{}, fmt.Errorf("finalized result provenance changed: %s", id)
			}
			report.ReorgedIDs = append(report.ReorgedIDs, id)
			continue
		}
		if presentationChanged(before, after) {
			report.UpdatedIDs = append(report.UpdatedIDs, id)
		}
	}
	return report, nil
}

func validateSnapshot(snapshot pagination.Snapshot) error {
	if snapshot.IndexedHeight == 0 {
		return errors.New("indexed snapshot height required")
	}
	if snapshot.FinalizedHeight > snapshot.IndexedHeight {
		return errors.New("finalized height cannot exceed indexed height")
	}
	return nil
}

func indexResults(results []searchresult.Result, snapshot pagination.Snapshot) (map[string]searchresult.Result, error) {
	indexed := make(map[string]searchresult.Result, len(results))
	for _, result := range results {
		if err := ValidateResultAtSnapshot(result, snapshot); err != nil {
			return nil, fmt.Errorf("result %s invalid at snapshot: %w", result.ID, err)
		}
		if _, exists := indexed[result.ID]; exists {
			return nil, fmt.Errorf("duplicate search result id: %s", result.ID)
		}
		indexed[result.ID] = result
	}
	return indexed, nil
}

func finalizedAt(result searchresult.Result, finalizedHeight uint64) bool {
	if result.Provenance.Finality == searchresult.FinalityFinalized {
		return true
	}
	return result.Provenance.BlockNumber != nil && *result.Provenance.BlockNumber <= finalizedHeight
}

func canonicalProvenanceChanged(a, b searchresult.Result) bool {
	if a.Provenance.Source != b.Provenance.Source || a.Provenance.ChainID != b.Provenance.ChainID {
		return true
	}
	if uintPtrValue(a.Provenance.BlockNumber) != uintPtrValue(b.Provenance.BlockNumber) {
		return true
	}
	if !strings.EqualFold(strings.TrimSpace(a.Provenance.BlockHash), strings.TrimSpace(b.Provenance.BlockHash)) {
		return true
	}
	if !strings.EqualFold(strings.TrimSpace(a.Provenance.TransactionHash), strings.TrimSpace(b.Provenance.TransactionHash)) {
		return true
	}
	return uintPtrValue(a.Provenance.LogIndex) != uintPtrValue(b.Provenance.LogIndex)
}

func presentationChanged(a, b searchresult.Result) bool {
	return a.Presentation.Title != b.Presentation.Title ||
		a.Presentation.Subtitle != b.Presentation.Subtitle ||
		a.Presentation.Snippet != b.Presentation.Snippet ||
		a.Presentation.Category != b.Presentation.Category ||
		a.Presentation.CanonicalURL != b.Presentation.CanonicalURL
}

func uintPtrValue(v *uint64) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%d", *v)
}
