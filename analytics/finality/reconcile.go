package finality

import (
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/420integrated/420-integrated/analytics/model"
)

var (
	ErrFinalizedRewrite = errors.New("finalized analytics snapshot cannot be rewritten")
	ErrSafeRegression   = errors.New("analytics safe height regression")
	ErrChainMismatch    = errors.New("analytics snapshot chain mismatch")
)

type Freshness struct {
	IndexedAt time.Time `json:"indexedAt"`
	AgeSeconds int64 `json:"ageSeconds"`
	Stale bool `json:"stale"`
}

type Action string

const (
	ActionAppend Action = "append"
	ActionReplace Action = "replace_nonfinalized"
	ActionNoop Action = "noop"
)

func IsFinalized(s model.Snapshot) bool {
	return s.Provenance.IndexedHeight > 0 && s.Provenance.SafeHeight >= s.Provenance.IndexedHeight
}

func AssessFreshness(indexedAt, now time.Time, staleAfter time.Duration) (Freshness, error) {
	indexedAt = indexedAt.UTC()
	now = now.UTC()
	if indexedAt.IsZero() || now.IsZero() || staleAfter <= 0 {
		return Freshness{}, errors.New("indexedAt, now and positive staleAfter are required")
	}
	if indexedAt.After(now) {
		return Freshness{}, errors.New("analytics indexed time is in the future")
	}
	age := now.Sub(indexedAt)
	return Freshness{IndexedAt: indexedAt, AgeSeconds: int64(age / time.Second), Stale: age > staleAfter}, nil
}

func Reconcile(existing []model.Snapshot, incoming model.Snapshot) ([]model.Snapshot, Action, error) {
	if err := model.ValidateSnapshot(incoming); err != nil {
		return nil, "", fmt.Errorf("incoming snapshot: %w", err)
	}
	out := append([]model.Snapshot(nil), existing...)
	for i := range out {
		if err := model.ValidateSnapshot(out[i]); err != nil {
			return nil, "", fmt.Errorf("existing snapshot %d: %w", i, err)
		}
		if out[i].Provenance.ChainID != incoming.Provenance.ChainID {
			continue
		}
		if !sameSlot(out[i], incoming) {
			continue
		}
		if out[i].ID == incoming.ID {
			return sorted(out), ActionNoop, nil
		}
		if IsFinalized(out[i]) {
			return nil, "", ErrFinalizedRewrite
		}
		if incoming.Provenance.SafeHeight < out[i].Provenance.SafeHeight {
			return nil, "", ErrSafeRegression
		}
		out[i] = incoming
		return sorted(out), ActionReplace, nil
	}
	for _, current := range out {
		if current.Provenance.ChainID != incoming.Provenance.ChainID {
			continue
		}
		if incoming.Provenance.SafeHeight < current.Provenance.SafeHeight && incoming.GeneratedAt.After(current.GeneratedAt) {
			return nil, "", ErrSafeRegression
		}
	}
	out = append(out, incoming)
	return sorted(out), ActionAppend, nil
}

func sameSlot(a, b model.Snapshot) bool {
	if !a.GeneratedAt.Equal(b.GeneratedAt) || len(a.Metrics) != len(b.Metrics) {
		return false
	}
	idsA := make([]string, len(a.Metrics))
	idsB := make([]string, len(b.Metrics))
	for i := range a.Metrics { idsA[i] = a.Metrics[i].ID }
	for i := range b.Metrics { idsB[i] = b.Metrics[i].ID }
	sort.Strings(idsA); sort.Strings(idsB)
	for i := range idsA { if idsA[i] != idsB[i] { return false } }
	return true
}

func sorted(in []model.Snapshot) []model.Snapshot {
	out := append([]model.Snapshot(nil), in...)
	sort.Slice(out, func(i, j int) bool {
		if out[i].GeneratedAt.Equal(out[j].GeneratedAt) { return out[i].ID < out[j].ID }
		return out[i].GeneratedAt.Before(out[j].GeneratedAt)
	})
	return out
}
