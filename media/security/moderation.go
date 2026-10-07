package security

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"
)

var (
	ErrInvalidModeration = errors.New("420media security: invalid moderation request")
	ErrModerationDenied  = errors.New("420media security: moderation capability denied")
	ErrModerationExists  = errors.New("420media security: moderation record exists")
	ErrModerationMissing = errors.New("420media security: moderation record missing")
)

type ModerationAction string

const (
	ActionReport            ModerationAction = "REPORT"
	ActionHide              ModerationAction = "HIDE"
	ActionBlock             ModerationAction = "BLOCK"
	ActionMute              ModerationAction = "MUTE"
	ActionSuspend           ModerationAction = "SUSPEND"
	ActionAppeal            ModerationAction = "APPEAL"
	ActionModeratorDecision ModerationAction = "MODERATOR_DECISION"
	ActionRestore           ModerationAction = "RESTORE"
	ActionLock              ModerationAction = "LOCK"
)

type Report struct {
	ID          string    `json:"id"`
	ReporterRef string    `json:"reporter_ref"`
	TargetKind  string    `json:"target_kind"`
	TargetID    string    `json:"target_id"`
	Reason      string    `json:"reason"`
	EvidenceRef string    `json:"evidence_ref,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type Decision struct {
	ID           string           `json:"id"`
	ReportID     string           `json:"report_id"`
	ModeratorRef string           `json:"moderator_ref"`
	Action       ModerationAction `json:"action"`
	Reason       string           `json:"reason"`
	CreatedAt    time.Time        `json:"created_at"`
}

type Appeal struct {
	ID           string    `json:"id"`
	DecisionID   string    `json:"decision_id"`
	AppellantRef string    `json:"appellant_ref"`
	Reason       string    `json:"reason"`
	CreatedAt    time.Time `json:"created_at"`
}

type ModeratorAuthorizer interface {
	CanModerate(context.Context, string) (bool, error)
}

type ModerationService struct {
	mu        sync.RWMutex
	Auth      ModeratorAuthorizer
	Limiter   *RateLimiter
	Now       func() time.Time
	reports   map[string]Report
	decisions map[string]Decision
	appeals   map[string]Appeal
}

func NewModerationService(auth ModeratorAuthorizer, limiter *RateLimiter) (*ModerationService, error) {
	if auth == nil || limiter == nil {
		return nil, ErrInvalidModeration
	}
	return &ModerationService{
		Auth: auth, Limiter: limiter, Now: time.Now,
		reports: make(map[string]Report), decisions: make(map[string]Decision), appeals: make(map[string]Appeal),
	}, nil
}

func (s *ModerationService) Report(_ context.Context, report Report) (Report, error) {
	report.ID = strings.TrimSpace(report.ID)
	report.ReporterRef = strings.TrimSpace(report.ReporterRef)
	report.TargetKind = strings.TrimSpace(report.TargetKind)
	report.TargetID = strings.TrimSpace(report.TargetID)
	report.Reason = strings.TrimSpace(report.Reason)
	if report.ID == "" || report.ReporterRef == "" || report.TargetKind == "" || report.TargetID == "" || report.Reason == "" {
		return Report{}, ErrInvalidModeration
	}
	if ok, _, _ := s.Limiter.Allow("report:" + report.ReporterRef); !ok {
		return Report{}, ErrRateLimited
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.reports[report.ID]; exists {
		return Report{}, ErrModerationExists
	}
	report.CreatedAt = s.now()
	s.reports[report.ID] = report
	return report, nil
}

func (s *ModerationService) Decide(ctx context.Context, decision Decision) (Decision, error) {
	decision.ID = strings.TrimSpace(decision.ID)
	decision.ReportID = strings.TrimSpace(decision.ReportID)
	decision.ModeratorRef = strings.TrimSpace(decision.ModeratorRef)
	decision.Reason = strings.TrimSpace(decision.Reason)
	if decision.ID == "" || decision.ReportID == "" || decision.ModeratorRef == "" ||
		decision.Reason == "" || !moderatorAction(decision.Action) {
		return Decision{}, ErrInvalidModeration
	}
	allowed, err := s.Auth.CanModerate(ctx, decision.ModeratorRef)
	if err != nil || !allowed {
		return Decision{}, ErrModerationDenied
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.reports[decision.ReportID]; !ok {
		return Decision{}, ErrModerationMissing
	}
	if _, exists := s.decisions[decision.ID]; exists {
		return Decision{}, ErrModerationExists
	}
	decision.CreatedAt = s.now()
	s.decisions[decision.ID] = decision
	return decision, nil
}

func (s *ModerationService) Appeal(_ context.Context, appeal Appeal) (Appeal, error) {
	appeal.ID = strings.TrimSpace(appeal.ID)
	appeal.DecisionID = strings.TrimSpace(appeal.DecisionID)
	appeal.AppellantRef = strings.TrimSpace(appeal.AppellantRef)
	appeal.Reason = strings.TrimSpace(appeal.Reason)
	if appeal.ID == "" || appeal.DecisionID == "" || appeal.AppellantRef == "" || appeal.Reason == "" {
		return Appeal{}, ErrInvalidModeration
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.decisions[appeal.DecisionID]; !ok {
		return Appeal{}, ErrModerationMissing
	}
	if _, exists := s.appeals[appeal.ID]; exists {
		return Appeal{}, ErrModerationExists
	}
	appeal.CreatedAt = s.now()
	s.appeals[appeal.ID] = appeal
	return appeal, nil
}

func (s *ModerationService) AuditTrail() ([]Report, []Decision, []Appeal) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	reports := make([]Report, 0, len(s.reports))
	for _, item := range s.reports {
		reports = append(reports, item)
	}
	decisions := make([]Decision, 0, len(s.decisions))
	for _, item := range s.decisions {
		decisions = append(decisions, item)
	}
	appeals := make([]Appeal, 0, len(s.appeals))
	for _, item := range s.appeals {
		appeals = append(appeals, item)
	}
	return reports, decisions, appeals
}

func moderatorAction(action ModerationAction) bool {
	switch action {
	case ActionHide, ActionSuspend, ActionModeratorDecision, ActionRestore, ActionLock:
		return true
	default:
		return false
	}
}

func (s *ModerationService) now() time.Time {
	if s.Now != nil {
		return s.Now().UTC()
	}
	return time.Now().UTC()
}
