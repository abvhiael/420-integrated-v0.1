package reeferreview

import "time"

const ServiceID = "420/service/reefer-review/v1"

type Visibility string

const (
	VisibilityPublic              Visibility = "PUBLIC"
	VisibilityUnlisted            Visibility = "UNLISTED"
	VisibilityFollowers           Visibility = "FOLLOWERS"
	VisibilityCommunityOnly       Visibility = "COMMUNITY_ONLY"
	VisibilityPrivate             Visibility = "PRIVATE"
	VisibilityOrganizationMembers Visibility = "ORGANIZATION_MEMBERS"
	VisibilityModerators          Visibility = "MODERATORS"
	VisibilityAdmins              Visibility = "ADMINS"
)

type Status string

const (
	StatusDraft      Status = "DRAFT"
	StatusPublished  Status = "PUBLISHED"
	StatusHidden     Status = "HIDDEN"
	StatusTombstoned Status = "TOMBSTONED"
)

type Publication struct {
	ID                string            `json:"id"`
	Namespace         string            `json:"namespace"`
	Version           string            `json:"version"`
	Author            string            `json:"author"`
	Title             string            `json:"title"`
	Summary           string            `json:"summary,omitempty"`
	BodyRef           string            `json:"body_ref"`
	BodyDigest        string            `json:"body_digest"`
	RightsClaim       string            `json:"rights_claim,omitempty"`
	RightsProvenance  *RightsProvenance `json:"rights_provenance,omitempty"`
	Visibility        Visibility        `json:"visibility"`
	Status            Status            `json:"status"`
	Source            string            `json:"source"`
	CurrentRevisionID string            `json:"current_revision_id"`
	Revision          int               `json:"revision"`
	CreatedAt         time.Time         `json:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at"`
	PublishedAt       *time.Time        `json:"published_at,omitempty"`
}

type PublicationRevision struct {
	ID               string            `json:"id"`
	PublicationID    string            `json:"publication_id"`
	Number           int               `json:"number"`
	Editor           string            `json:"editor"`
	Title            string            `json:"title"`
	Summary          string            `json:"summary,omitempty"`
	BodyRef          string            `json:"body_ref"`
	BodyDigest       string            `json:"body_digest"`
	RightsClaim      string            `json:"rights_claim,omitempty"`
	RightsProvenance *RightsProvenance `json:"rights_provenance,omitempty"`
	Visibility       Visibility        `json:"visibility"`
	CreatedAt        time.Time         `json:"created_at"`
}

type ModerationEvent struct {
	ID            string    `json:"id"`
	PublicationID string    `json:"publication_id"`
	Actor         string    `json:"actor"`
	Action        string    `json:"action"`
	Reason        string    `json:"reason,omitempty"`
	FromStatus    Status    `json:"from_status"`
	ToStatus      Status    `json:"to_status"`
	CreatedAt     time.Time `json:"created_at"`
}

type CreateDraftRequest struct {
	IdempotencyKey string     `json:"idempotency_key"`
	Title          string     `json:"title"`
	Summary        string     `json:"summary,omitempty"`
	Body           string     `json:"body"`
	Visibility     Visibility `json:"visibility"`
}

type UpdatePublicationRequest struct {
	Title      string     `json:"title"`
	Summary    string     `json:"summary,omitempty"`
	Body       string     `json:"body"`
	Visibility Visibility `json:"visibility"`
}

type ModerateRequest struct {
	Action string `json:"action"`
	Reason string `json:"reason,omitempty"`
}

type TombstoneRequest struct {
	Reason string `json:"reason,omitempty"`
}
