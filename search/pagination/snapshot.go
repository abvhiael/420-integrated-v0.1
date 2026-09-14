package pagination

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/420integrated/420-integrated/search/query"
	"github.com/420integrated/420-integrated/search/ranking"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

const CursorSchema = "420-search-cursor-v1"

const (
	MinPageSize = 1
	MaxPageSize = 100
)

type Snapshot struct {
	IndexedHeight   uint64 `json:"indexedHeight"`
	FinalizedHeight uint64 `json:"finalizedHeight"`
}

type cursorPayload struct {
	Schema          string  `json:"schema"`
	PlanDigest      string  `json:"planDigest"`
	Ranker          string  `json:"ranker"`
	IndexedHeight   uint64  `json:"indexedHeight"`
	FinalizedHeight uint64  `json:"finalizedHeight"`
	LastScore       float64 `json:"lastScore"`
	LastID          string  `json:"lastId"`
}

type Page struct {
	Items      []searchresult.Result `json:"items"`
	Snapshot   Snapshot              `json:"snapshot"`
	NextCursor *string               `json:"nextCursor"`
}

// Paginate slices an already-ranked result set at a stable indexer snapshot.
// The cursor is query-, ranker-, and snapshot-bound and resumes strictly after
// the last emitted (score,id) tuple. Page numbers are intentionally unsupported.
func Paginate(plan query.Plan, ranked []searchresult.Result, snapshot Snapshot, limit int, cursor string) (Page, error) {
	if plan.Schema != query.SchemaVersion {
		return Page{}, errors.New("unsupported query schema")
	}
	if snapshot.IndexedHeight == 0 {
		return Page{}, errors.New("indexed snapshot height required")
	}
	if snapshot.FinalizedHeight > snapshot.IndexedHeight {
		return Page{}, errors.New("finalized height cannot exceed indexed height")
	}
	if limit < MinPageSize || limit > MaxPageSize {
		return Page{}, fmt.Errorf("page size must be between %d and %d", MinPageSize, MaxPageSize)
	}

	planDigest, err := digestPlan(plan)
	if err != nil {
		return Page{}, err
	}
	if err := validateRanked(ranked); err != nil {
		return Page{}, err
	}

	start := 0
	if strings.TrimSpace(cursor) != "" {
		payload, err := decodeCursor(cursor)
		if err != nil {
			return Page{}, err
		}
		if payload.Schema != CursorSchema || payload.PlanDigest != planDigest || payload.Ranker != ranking.RankerVersion {
			return Page{}, errors.New("cursor does not match search plan or ranker")
		}
		if payload.IndexedHeight != snapshot.IndexedHeight || payload.FinalizedHeight != snapshot.FinalizedHeight {
			return Page{}, errors.New("cursor does not match search snapshot")
		}
		start = positionAfter(ranked, payload.LastScore, payload.LastID)
		if start < 0 {
			return Page{}, errors.New("cursor position is not present in ranked snapshot")
		}
	}

	if start >= len(ranked) {
		return Page{Items: []searchresult.Result{}, Snapshot: snapshot}, nil
	}
	end := start + limit
	if end > len(ranked) {
		end = len(ranked)
	}
	items := cloneResults(ranked[start:end])
	page := Page{Items: items, Snapshot: snapshot}
	if end < len(ranked) {
		last := ranked[end-1]
		encoded, err := encodeCursor(cursorPayload{
			Schema: CursorSchema, PlanDigest: planDigest, Ranker: ranking.RankerVersion,
			IndexedHeight: snapshot.IndexedHeight, FinalizedHeight: snapshot.FinalizedHeight,
			LastScore: last.Ranking.Score, LastID: last.ID,
		})
		if err != nil {
			return Page{}, err
		}
		page.NextCursor = &encoded
	}
	return page, nil
}

func digestPlan(plan query.Plan) (string, error) {
	canonical := struct {
		Schema       string   `json:"schema"`
		Normalized   string   `json:"normalized"`
		Kind         string   `json:"kind"`
		ExactValue   string   `json:"exactValue"`
		Protocol     string   `json:"protocol"`
		ObjectKey    string   `json:"objectKey"`
		TargetDomain string   `json:"targetDomain"`
		Domains      []string `json:"domains"`
	}{
		Schema: plan.Schema, Normalized: plan.Normalized, Kind: string(plan.Kind),
		ExactValue: plan.ExactValue, Protocol: plan.Protocol, ObjectKey: plan.ObjectKey,
		TargetDomain: string(plan.TargetDomain),
	}
	for _, domain := range plan.Domains {
		canonical.Domains = append(canonical.Domains, string(domain))
	}
	sort.Strings(canonical.Domains)
	encoded, err := json.Marshal(canonical)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:]), nil
}

func validateRanked(results []searchresult.Result) error {
	for i, result := range results {
		if err := result.Validate(); err != nil {
			return err
		}
		if result.Ranking.Ranker != ranking.RankerVersion {
			return errors.New("result is not ranked by current ranker")
		}
		if i == 0 {
			continue
		}
		prev := results[i-1]
		if prev.Ranking.Score < result.Ranking.Score || (prev.Ranking.Score == result.Ranking.Score && prev.ID > result.ID) {
			return errors.New("ranked results are not in deterministic order")
		}
	}
	return nil
}

func positionAfter(results []searchresult.Result, score float64, id string) int {
	for i, result := range results {
		if result.Ranking.Score == score && result.ID == id {
			return i + 1
		}
	}
	return -1
}

func encodeCursor(payload cursorPayload) (string, error) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(encoded), nil
}

func decodeCursor(cursor string) (cursorPayload, error) {
	encoded, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(cursor))
	if err != nil {
		return cursorPayload{}, errors.New("invalid search cursor")
	}
	var payload cursorPayload
	if err := json.Unmarshal(encoded, &payload); err != nil {
		return cursorPayload{}, errors.New("invalid search cursor")
	}
	if payload.LastID == "" {
		return cursorPayload{}, errors.New("invalid search cursor position")
	}
	return payload, nil
}

func cloneResults(in []searchresult.Result) []searchresult.Result {
	out := make([]searchresult.Result, len(in))
	for i := range in {
		out[i] = in[i]
		out[i].Presentation.Tags = append([]string(nil), in[i].Presentation.Tags...)
		out[i].Ranking.Signals = append([]string(nil), in[i].Ranking.Signals...)
	}
	return out
}
