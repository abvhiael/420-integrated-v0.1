package assistance

import (
	"context"
	"math"

	"github.com/420integrated/420-integrated/grow/security"
	"time"
)

// MinimalInput is an allowlisted data transfer object; it contains no tenant address,
// user name, media bytes, image metadata, public-location coordinates or credentials.
type MinimalInput struct {
	Kind       string
	Metric     string
	Unit       string
	Value      float64
	State      string
	ObservedAt time.Time
}

// WorkItem is server-resolved, never a client-authored LLM prompt.
type WorkItem struct {
	Input       Input
	Observation MinimalInput
}

// ProjectionStore must recheck source ownership and current consent in its read transaction.
type ProjectionStore interface {
	Resolve(context.Context, string, string, string, string) (WorkItem, error)
}

// AdvisoryProvider receives only this bounded server-projected data.
// It has no methods to control equipment, modify plant history, or publish private data.
type AdvisoryProvider interface {
	Analyze(context.Context, MinimalInput) (Recommendation, error)
}

// Generate is fail-closed until a trusted provider and consent-verifying projection
// store are explicitly configured. A recommendation is never an executable command.
func (s Service) Generate(ctx context.Context, scope Scope, facility, zone, jobID string, now time.Time, provider AdvisoryProvider) (Recommendation, error) {
	if s.Store == nil || s.Provider == nil || provider == nil || jobID == "" ||
		!allowed(scope, facility, zone, security.PlantWrite) {
		return Recommendation{}, ErrDenied
	}
	source, ok := s.Store.(ProjectionStore)
	if !ok {
		return Recommendation{}, ErrDenied
	}
	item, err := source.Resolve(ctx, scope.TenantID, facility, zone, jobID)
	if err != nil {
		return Recommendation{}, err
	}
	if item.Input.TenantID != scope.TenantID || item.Input.FacilityID != facility ||
		item.Input.ZoneID != zone || item.Input.JobID != jobID ||
		item.Input.Purpose != "CULTIVATION_ADVICE" ||
		item.Input.Prompt != "" || item.Input.ConsentID == "" {
		return Recommendation{}, ErrDenied
	}
	data := item.Observation
	if (data.Kind != "PLANT" && data.Kind != "OBSERVATION") ||
		(data.Kind == "OBSERVATION" && (data.Metric == "" || data.Unit == "" ||
			math.IsNaN(data.Value) || math.IsInf(data.Value, 0))) ||
		data.ObservedAt.IsZero() || data.ObservedAt.After(now.Add(5*time.Minute)) ||
		data.ObservedAt.Before(now.AddDate(-2, 0, 0)) {
		return Recommendation{}, ErrInvalid
	}
	output, err := provider.Analyze(ctx, data)
	if err != nil {
		return Recommendation{}, err
	}
	if output.TenantID != scope.TenantID || output.FacilityID != facility ||
		output.ZoneID != zone || output.JobID != jobID {
		return Recommendation{}, ErrDenied
	}
	if err := s.Record(ctx, scope, output, now); err != nil {
		return Recommendation{}, err
	}
	return output, nil
}
