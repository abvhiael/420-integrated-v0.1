package assistance

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

var (
	ErrDenied   = errors.New("AI assistance unavailable")
	ErrInvalid  = errors.New("invalid AI assistance request")
	ErrConflict = errors.New("AI assistance state conflict")
)

type Scope struct {
	TenantID  string
	Principal security.Principal
	Grant     security.Grant
}

type Input struct {
	TenantID    string
	FacilityID  string
	ZoneID      string
	JobID       string
	Purpose     string
	SourceKind  string
	SourceID    string
	ConsentID   string
	Prompt      string
	RequestedAt time.Time
}

type Recommendation struct {
	TenantID    string
	FacilityID  string
	ZoneID      string
	JobID       string
	ID          string
	Provider    string
	Model       string
	Text        string
	Explanation string
	Limitations string
	Confidence  string
	CreatedAt   time.Time
}

type Review struct {
	TenantID         string
	FacilityID       string
	ZoneID           string
	RecommendationID string
	ID               string
	Actor            string
	Decision         string
	Reason           string
	ReviewedAt       time.Time
}

type Store interface {
	Enqueue(context.Context, Input, string) error
	SaveRecommendation(context.Context, Recommendation) error
	Review(context.Context, Review) error
	Read(context.Context, string, string, string, string) (Recommendation, error)
}

type ProviderVerifier interface {
	Verify(context.Context, Recommendation) error
}

type ConsentStore interface {
	SetConsent(context.Context, Scope, string, string, string, bool) error
}

type Service struct {
	Store    Store
	Provider ProviderVerifier
}

func New(store Store) Service {
	return Service{Store: store}
}

func NewWithProvider(store Store, provider ProviderVerifier) Service {
	return Service{Store: store, Provider: provider}
}

func (s Service) Consent(ctx context.Context, scope Scope, consentID, facility, zone string, granted bool) error {
	if s.Store == nil || consentID == "" || !allowed(scope, facility, zone, security.PlantWrite) {
		return ErrDenied
	}
	store, ok := s.Store.(ConsentStore)
	if !ok {
		return ErrDenied
	}
	return store.SetConsent(ctx, scope, consentID, facility, zone, granted)
}

func allowed(scope Scope, facility, zone string, action security.Action) bool {
	return scope.TenantID != "" && facility != "" && zone != "" &&
		scope.Principal.Authenticated && scope.Principal.SubjectID != "" &&
		scope.Principal.SubjectID == scope.Grant.SubjectID &&
		scope.TenantID == scope.Grant.TenantID &&
		security.Authorize(scope.Principal, scope.Grant, security.Resource{
			TenantID: scope.TenantID, FacilityID: facility, ZoneID: zone,
		}, action)
}

// Submit accepts only a server-selected, minimal reference to tenant-private data.
// The caller must obtain consent in the same tenant-scoped transaction as enqueue.
func (s Service) Submit(ctx context.Context, scope Scope, input Input, now time.Time) error {
	if s.Store == nil || input.TenantID != scope.TenantID ||
		!allowed(scope, input.FacilityID, input.ZoneID, security.PlantWrite) {
		return ErrDenied
	}
	if input.JobID == "" || input.ConsentID == "" || input.SourceID == "" ||
		input.Purpose != "CULTIVATION_ADVICE" ||
		(input.SourceKind != "OBSERVATION" && input.SourceKind != "PLANT") ||
		input.Prompt != "" || input.RequestedAt.IsZero() ||
		input.RequestedAt.After(now.Add(5*time.Minute)) ||
		input.RequestedAt.Before(now.Add(-24*time.Hour)) {
		return ErrInvalid
	}
	return s.Store.Enqueue(ctx, input, scope.Principal.SubjectID)
}

// Record is only for results from an already authenticated, allowlisted provider adapter.
// It does not authorize action, publish information or change controlled equipment.
func (s Service) Record(ctx context.Context, scope Scope, output Recommendation, now time.Time) error {
	if s.Store == nil || s.Provider == nil || output.TenantID != scope.TenantID ||
		!allowed(scope, output.FacilityID, output.ZoneID, security.PlantWrite) {
		return ErrDenied
	}
	if output.ID == "" || output.JobID == "" || output.Provider == "" ||
		output.Model == "" || strings.TrimSpace(output.Text) == "" ||
		strings.TrimSpace(output.Explanation) == "" ||
		strings.TrimSpace(output.Limitations) == "" ||
		len(output.Text) > 3000 || len(output.Explanation) > 3000 ||
		len(output.Limitations) > 1500 || output.CreatedAt.IsZero() ||
		output.CreatedAt.After(now.Add(5*time.Minute)) ||
		(output.Confidence != "LOW" && output.Confidence != "MEDIUM" && output.Confidence != "HIGH") {
		return ErrInvalid
	}
	if err := s.Provider.Verify(ctx, output); err != nil {
		return ErrDenied
	}
	return s.Store.SaveRecommendation(ctx, output)
}

func (s Service) Decide(ctx context.Context, scope Scope, review Review, now time.Time) error {
	if s.Store == nil || review.TenantID != scope.TenantID ||
		!allowed(scope, review.FacilityID, review.ZoneID, security.PlantWrite) {
		return ErrDenied
	}
	if review.ID == "" || review.RecommendationID == "" ||
		review.Actor != scope.Principal.SubjectID ||
		(review.Decision != "ACCEPTED_FOR_REVIEW" && review.Decision != "REJECTED") ||
		strings.TrimSpace(review.Reason) == "" || len(review.Reason) > 1000 ||
		review.ReviewedAt.IsZero() || review.ReviewedAt.After(now.Add(5*time.Minute)) {
		return ErrInvalid
	}
	return s.Store.Review(ctx, review)
}

func (s Service) Read(ctx context.Context, scope Scope, facility, zone, id string) (Recommendation, error) {
	if s.Store == nil || id == "" || !allowed(scope, facility, zone, security.View) {
		return Recommendation{}, ErrDenied
	}
	record, err := s.Store.Read(ctx, scope.TenantID, facility, zone, id)
	if err != nil {
		return Recommendation{}, err
	}
	if record.TenantID != scope.TenantID || record.FacilityID != facility ||
		record.ZoneID != zone || record.ID != id {
		return Recommendation{}, ErrDenied
	}
	return record, nil
}
