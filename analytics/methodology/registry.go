package methodology

import (
	"errors"
	"sort"
	"strings"

	"github.com/420integrated/420-integrated/analytics/model"
)

// Entry binds one analytics metric identity to its versioned, human-readable
// methodology. Entries are immutable at runtime; a methodology change requires
// a new version and code change so historical snapshots remain interpretable.
type Entry struct {
	MetricID    string
	Methodology model.Methodology
}

var registry = map[string]model.Methodology{
	"network.indexed_height": {
		ID: "indexed-height", Version: "v1", Description: "420Indexer indexed head at the qualified analytics snapshot",
	},
	"network.safe_height": {
		ID: "safe-height", Version: "v1", Description: "420Indexer safe head at the qualified analytics snapshot",
	},
	"network.finality_depth": {
		ID: "finality-depth", Version: "v1", Description: "difference between indexed head and safe head at the qualified analytics snapshot",
	},
	"network.projection_lag": {
		ID: "projection-lag", Version: "v1", Description: "420Indexer-reported projection lag when available; zero when omitted by the source contract",
	},
	"validator.registered_count": {
		ID: "registered-validator-count", Version: "v1", Description: "count of unique validator projections exposed through qualified 420Indexer",
	},
	"validator.active_count": {
		ID: "active-validator-count", Version: "v1", Description: "count of indexed validators whose lifecycle is active at the qualified snapshot",
	},
	"validator.native_collateral": {
		ID: "native-validator-collateral", Version: "v1", Description: "sum of indexed validator-owned collateral at the qualified snapshot",
	},
	"validator.community_collateral": {
		ID: "community-validator-collateral", Version: "v1", Description: "sum of indexed community reserve collateral assigned to validators at the qualified snapshot",
	},
	"validator.accrued_rewards": {
		ID: "validator-accrued-rewards", Version: "v1", Description: "sum of indexed accrued validator rewards at the qualified snapshot",
	},
	"protocol.event_count": {
		ID: "protocol-event-count", Version: "v1", Description: "count of unique typed protocol events exposed through qualified 420Indexer at or before the analytics snapshot",
	},
	"protocol.object_count": {
		ID: "protocol-object-count", Version: "v1", Description: "count of unique latest protocol-object projections exposed through qualified 420Indexer",
	},
	"protocol.active_object_count": {
		ID: "protocol-active-object-count", Version: "v1", Description: "count of latest protocol objects whose lifecycle state is active or enabled",
	},
	"protocol.distinct_count": {
		ID: "distinct-protocol-count", Version: "v1", Description: "count of distinct protocol identifiers represented by indexed event and object projections",
	},
	"economic.treasury_budget_ceiling": {
		ID: "treasury-budget-ceiling", Version: "v1", Description: "sum of indexed governed Treasury budget spending ceilings at the qualified snapshot",
	},
	"economic.treasury_committed": {
		ID: "treasury-committed", Version: "v1", Description: "sum of indexed amounts reserved against governed Treasury budgets at the qualified snapshot",
	},
	"economic.treasury_executed": {
		ID: "treasury-executed", Version: "v1", Description: "sum of indexed successfully executed governed Treasury budget amounts at the qualified snapshot",
	},
	"economic.treasury_scheduled_disbursement_volume": {
		ID: "treasury-scheduled-disbursement-volume", Version: "v1", Description: "sum of indexed Treasury disbursements currently in scheduled state at the qualified snapshot",
	},
	"economic.treasury_executed_disbursement_volume": {
		ID: "treasury-executed-disbursement-volume", Version: "v1", Description: "sum of indexed Treasury disbursements in executed state with canonical Treasury execution recorded",
	},
}

func Resolve(metricID string) (model.Methodology, error) {
	metricID = strings.TrimSpace(metricID)
	if metricID == "" {
		return model.Methodology{}, errors.New("metric id required for methodology resolution")
	}
	method, ok := registry[metricID]
	if !ok {
		return model.Methodology{}, errors.New("analytics methodology is not registered")
	}
	return method, nil
}

func Entries() []Entry {
	ids := make([]string, 0, len(registry))
	for id := range registry {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	entries := make([]Entry, 0, len(ids))
	for _, id := range ids {
		entries = append(entries, Entry{MetricID: id, Methodology: registry[id]})
	}
	return entries
}

func Validate(metricID string, method model.Methodology) error {
	registered, err := Resolve(metricID)
	if err != nil {
		return err
	}
	if method != registered {
		return errors.New("metric methodology does not match registered version")
	}
	return nil
}
