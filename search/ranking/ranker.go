package ranking

import (
	"errors"
	"sort"
	"strings"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/query"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

const RankerVersion = "420-search-ranker-v1"

type signal struct {
	name   string
	weight float64
}

// Rank validates, filters and deterministically orders already-qualified search
// results. Ranking is presentation metadata only: canonical identity,
// provenance, presentation URLs and sponsorship state are never rewritten.
func Rank(plan query.Plan, candidates []searchresult.Result) ([]searchresult.Result, error) {
	if plan.Schema != query.SchemaVersion {
		return nil, errors.New("unsupported query schema")
	}

	eligible := make([]searchresult.Result, 0, len(candidates))
	for _, candidate := range candidates {
		if err := candidate.Validate(); err != nil {
			return nil, err
		}
		if !domainAllowed(candidate.Domain, plan.Domains) {
			continue
		}

		ranked := cloneResult(candidate)
		signals := score(plan, ranked)
		total := 0.0
		ranked.Ranking.Signals = make([]string, 0, len(signals))
		for _, s := range signals {
			total += s.weight
			ranked.Ranking.Signals = append(ranked.Ranking.Signals, s.name)
		}
		ranked.Ranking.Score = total
		ranked.Ranking.Ranker = RankerVersion
		ranked.Ranking.Canonical = false
		eligible = append(eligible, ranked)
	}

	sort.SliceStable(eligible, func(i, j int) bool {
		if eligible[i].Ranking.Score != eligible[j].Ranking.Score {
			return eligible[i].Ranking.Score > eligible[j].Ranking.Score
		}
		return eligible[i].ID < eligible[j].ID
	})
	return eligible, nil
}

func domainAllowed(domain architecture.ResultDomain, filters []architecture.ResultDomain) bool {
	if len(filters) == 0 {
		return true
	}
	for _, filter := range filters {
		if filter == domain {
			return true
		}
	}
	return false
}

func score(plan query.Plan, candidate searchresult.Result) []signal {
	var signals []signal
	normalized := strings.ToLower(strings.TrimSpace(plan.Normalized))
	exact := strings.ToLower(strings.TrimSpace(plan.ExactValue))
	sourceKey := strings.ToLower(strings.TrimSpace(candidate.SourceKey))
	title := strings.ToLower(strings.TrimSpace(candidate.Presentation.Title))
	subtitle := strings.ToLower(strings.TrimSpace(candidate.Presentation.Subtitle))
	snippet := strings.ToLower(strings.TrimSpace(candidate.Presentation.Snippet))

	if plan.TargetDomain != "" && candidate.Domain == plan.TargetDomain {
		signals = append(signals, signal{"target_domain", 120})
	}
	if exact != "" && sourceKey == exact {
		signals = append(signals, signal{"exact_source_key", 1000})
	}
	if normalized != "" && title == normalized {
		signals = append(signals, signal{"exact_title", 500})
	} else if normalized != "" && strings.HasPrefix(title, normalized) {
		signals = append(signals, signal{"title_prefix", 220})
	} else if normalized != "" && strings.Contains(title, normalized) {
		signals = append(signals, signal{"title_contains", 160})
	}
	if normalized != "" && strings.Contains(subtitle, normalized) {
		signals = append(signals, signal{"subtitle_contains", 80})
	}
	if normalized != "" && strings.Contains(snippet, normalized) {
		signals = append(signals, signal{"snippet_contains", 40})
	}
	if normalized != "" && sourceKey == normalized {
		signals = append(signals, signal{"query_source_key", 300})
	}
	for _, tag := range candidate.Presentation.Tags {
		if normalized != "" && strings.ToLower(strings.TrimSpace(tag)) == normalized {
			signals = append(signals, signal{"exact_tag", 100})
			break
		}
	}

	// Canonical-chain finality can be used as a trust-oriented ordering signal,
	// but it never changes canonical truth or hides head results.
	switch candidate.Provenance.Finality {
	case searchresult.FinalityFinalized:
		signals = append(signals, signal{"finalized", 30})
	case searchresult.FinalitySafe:
		signals = append(signals, signal{"safe", 20})
	case searchresult.FinalityHead:
		signals = append(signals, signal{"head", 10})
	}

	sort.Slice(signals, func(i, j int) bool {
		if signals[i].weight != signals[j].weight {
			return signals[i].weight > signals[j].weight
		}
		return signals[i].name < signals[j].name
	})
	return signals
}

func cloneResult(in searchresult.Result) searchresult.Result {
	out := in
	out.Presentation.Tags = append([]string(nil), in.Presentation.Tags...)
	out.Ranking.Signals = append([]string(nil), in.Ranking.Signals...)
	return out
}
