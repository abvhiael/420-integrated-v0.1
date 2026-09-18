package model

import (
	"errors"
	"strings"
	"time"
)

type ModerationAction string
type ModerationReason string
type ModerationState string

const (
	ModerationReport   ModerationAction = "REPORT"
	ModerationHide     ModerationAction = "HIDE"
	ModerationAppeal   ModerationAction = "APPEAL"
	ModerationDecision ModerationAction = "MODERATOR_DECISION"
	ModerationRestore  ModerationAction = "RESTORE"
	ModerationLock     ModerationAction = "LOCK"

	ReasonSpam               ModerationReason = "SPAM"
	ReasonConflictOfInterest ModerationReason = "CONFLICT_OF_INTEREST"
	ReasonHarassment         ModerationReason = "HARASSMENT"
	ReasonFraud              ModerationReason = "FRAUD"
	ReasonDuplicate          ModerationReason = "DUPLICATE"
	ReasonIrrelevant         ModerationReason = "IRRELEVANT"
	ReasonPersonalInfo       ModerationReason = "PERSONAL_INFORMATION"
	ReasonRightsViolation    ModerationReason = "RIGHTS_VIOLATION"

	ModerationOpen       ModerationState = "OPEN"
	ModerationHidden     ModerationState = "HIDDEN"
	ModerationVisible    ModerationState = "VISIBLE"
	ModerationLocked     ModerationState = "LOCKED"
	ModerationAppealed   ModerationState = "APPEALED"
	ModerationResolved   ModerationState = "RESOLVED"
)

type ModerationRecord struct {
	ID            string
	ReviewID      string
	Action        ModerationAction
	Reason        ModerationReason
	Actor         SubjectRef
	BodyRef       string
	PreviousState ReviewStatus
	ResultState   ReviewStatus
	State         ModerationState
	ParentID      string
	Version       uint32
	CreatedAt     time.Time
}

func (m ModerationRecord) Validate() error {
	if strings.TrimSpace(m.ID) == "" || strings.TrimSpace(m.ReviewID) == "" {
		return errors.New("moderation id and review id are required")
	}
	if err := m.Actor.Validate(); err != nil {
		return err
	}
	switch m.Action {
	case ModerationReport, ModerationHide, ModerationAppeal, ModerationDecision, ModerationRestore, ModerationLock:
	default:
		return errors.New("moderation action is invalid")
	}
	switch m.Reason {
	case ReasonSpam, ReasonConflictOfInterest, ReasonHarassment, ReasonFraud, ReasonDuplicate, ReasonIrrelevant, ReasonPersonalInfo, ReasonRightsViolation:
	default:
		return errors.New("moderation reason is invalid")
	}
	switch m.State {
	case ModerationOpen, ModerationHidden, ModerationVisible, ModerationLocked, ModerationAppealed, ModerationResolved:
	default:
		return errors.New("moderation state is invalid")
	}
	if m.Version == 0 || m.CreatedAt.IsZero() {
		return errors.New("moderation version and timestamp are required")
	}
	return nil
}
