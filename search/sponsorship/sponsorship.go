package sponsorship

import (
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/query"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

const EngineVersion = "420-search-sponsorship-v1"

type Campaign struct {
	ID            string
	TargetResultID string
	Label         string
	Priority      uint32
	StartsAt      time.Time
	EndsAt        time.Time
	Domains       []architecture.ResultDomain
	QueryTerms    []string
	Active        bool
}

type Placement struct {
	Result   searchresult.Result `json:"result"`
	Campaign string              `json:"campaign"`
	Priority uint32              `json:"priority"`
	Engine   string              `json:"engine"`
}

type Set struct {
	Sponsored []Placement          `json:"sponsored"`
	Organic   []searchresult.Result `json:"organic"`
}

// Apply builds a separate sponsored lane over already-ranked results. It never
// mutates organic ordering or ranking metadata and never changes canonical
// identity, provenance, presentation, source keys or result IDs.
func Apply(plan query.Plan, ranked []searchresult.Result, campaigns []Campaign, now time.Time, maxSponsored int) (Set, error) {
	if plan.Schema != query.SchemaVersion {
		return Set{}, errors.New("unsupported query schema")
	}
	if now.IsZero() {
		return Set{}, errors.New("evaluation time required")
	}
	if maxSponsored < 0 {
		return Set{}, errors.New("max sponsored cannot be negative")
	}

	organic := make([]searchresult.Result, len(ranked))
	byID := make(map[string]searchresult.Result, len(ranked))
	for i, candidate := range ranked {
		if err := candidate.Validate(); err != nil {
			return Set{}, err
		}
		organic[i] = cloneResult(candidate)
		byID[candidate.ID] = candidate
	}

	eligible := make([]Placement, 0)
	seenTarget := make(map[string]struct{})
	for _, campaign := range campaigns {
		if !campaignEligible(plan, campaign, now) {
			continue
		}
		candidate, ok := byID[campaign.TargetResultID]
		if !ok {
			continue
		}
		if !domainAllowed(candidate.Domain, campaign.Domains) {
			continue
		}
		if _, duplicate := seenTarget[candidate.ID]; duplicate {
			continue
		}
		label := strings.TrimSpace(campaign.Label)
		if label == "" {
			return Set{}, errors.New("sponsored campaign label required")
		}
		campaignID := strings.TrimSpace(campaign.ID)
		if campaignID == "" {
			return Set{}, errors.New("sponsored campaign id required")
		}

		sponsored := cloneResult(candidate)
		sponsored.Sponsorship = searchresult.Sponsorship{
			Sponsored: true,
			Label: label,
			Campaign: campaignID,
			Canonical: false,
		}
		if err := sponsored.Validate(); err != nil {
			return Set{}, err
		}
		eligible = append(eligible, Placement{
			Result: sponsored,
			Campaign: campaignID,
			Priority: campaign.Priority,
			Engine: EngineVersion,
		})
		seenTarget[candidate.ID] = struct{}{}
	}

	sort.Slice(eligible, func(i, j int) bool {
		if eligible[i].Priority != eligible[j].Priority {
			return eligible[i].Priority > eligible[j].Priority
		}
		if eligible[i].Campaign != eligible[j].Campaign {
			return eligible[i].Campaign < eligible[j].Campaign
		}
		return eligible[i].Result.ID < eligible[j].Result.ID
	})
	if maxSponsored > 0 && len(eligible) > maxSponsored {
		eligible = eligible[:maxSponsored]
	}
	if maxSponsored == 0 {
		eligible = nil
	}
	return Set{Sponsored: eligible, Organic: organic}, nil
}

func campaignEligible(plan query.Plan, campaign Campaign, now time.Time) bool {
	if !campaign.Active {
		return false
	}
	if !campaign.StartsAt.IsZero() && now.Before(campaign.StartsAt) {
		return false
	}
	if !campaign.EndsAt.IsZero() && !now.Before(campaign.EndsAt) {
		return false
	}
	if len(campaign.QueryTerms) == 0 {
		return true
	}
	needle := strings.ToLower(strings.TrimSpace(plan.Normalized))
	for _, term := range campaign.QueryTerms {
		if needle == strings.ToLower(strings.TrimSpace(term)) {
			return true
		}
	}
	return false
}

func domainAllowed(domain architecture.ResultDomain, allowed []architecture.ResultDomain) bool {
	if len(allowed) == 0 {
		return true
	}
	for _, item := range allowed {
		if item == domain {
			return true
		}
	}
	return false
}

func cloneResult(in searchresult.Result) searchresult.Result {
	out := in
	out.Presentation.Tags = append([]string(nil), in.Presentation.Tags...)
	out.Ranking.Signals = append([]string(nil), in.Ranking.Signals...)
	return out
}
