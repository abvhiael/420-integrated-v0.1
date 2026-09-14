package api

import (
	"errors"

	explorerservice "github.com/420integrated/420-integrated/explorer/service"
)

// OperationalIssue is presentation metadata for Explorer availability failures.
// It gives UI clients stable machine codes and safe recovery guidance without
// exposing implementation details or encouraging use of stale/wrong-chain data.
type OperationalIssue struct {
	Code      string `json:"code"`
	Severity  string `json:"severity"`
	Message   string `json:"message"`
	Action    string `json:"action"`
	Retryable bool   `json:"retryable"`
}

type statusFailureResponse struct {
	Status explorerservice.NetworkStatus `json:"status"`
	Issue  OperationalIssue              `json:"issue"`
}

func operationalIssue(err error) OperationalIssue {
	switch {
	case errors.Is(err, explorerservice.ErrWrongChain):
		return OperationalIssue{
			Code: "WRONG_CHAIN", Severity: "critical",
			Message: "420Explorer is connected to an Indexer reporting the wrong chain.",
			Action: "Do not trust indexed data. Check Explorer/Indexer chain configuration before retrying.",
			Retryable: false,
		}
	case errors.Is(err, explorerservice.ErrIndexerInconsistent):
		return OperationalIssue{
			Code: "INCONSISTENT_FINALITY", Severity: "critical",
			Message: "420Indexer reported an impossible head/safe/finalized relationship.",
			Action: "Do not present chain data until the Indexer has recovered a consistent snapshot.",
			Retryable: true,
		}
	case errors.Is(err, explorerservice.ErrIndexerDegraded):
		return OperationalIssue{
			Code: "INDEXER_DEGRADED", Severity: "warning",
			Message: "420Indexer is reporting a degraded operating state.",
			Action: "Show Explorer in degraded mode and retry after Indexer health returns to READY/HEALTHY/OK.",
			Retryable: true,
		}
	case errors.Is(err, explorerservice.ErrIndexerStale):
		return OperationalIssue{
			Code: "INDEXER_STALE", Severity: "warning",
			Message: "420Indexer has not ingested fresh chain data within the configured freshness window.",
			Action: "Show stale-data warning and avoid representing the displayed head as current until ingestion resumes.",
			Retryable: true,
		}
	default:
		return OperationalIssue{
			Code: "UPSTREAM_UNAVAILABLE", Severity: "error",
			Message: "420Explorer could not obtain a qualified Indexer response.",
			Action: "Retry later. Do not substitute direct RPC or unqualified data.",
			Retryable: true,
		}
	}
}
