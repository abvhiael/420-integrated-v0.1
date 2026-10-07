package reeferreview

import "time"

const ServiceID = "420/service/reefer-review/v1"

type Visibility string
const (
 VisibilityPublic Visibility = "PUBLIC"
 VisibilityUnlisted Visibility = "UNLISTED"
 VisibilityFollowers Visibility = "FOLLOWERS"
 VisibilityCommunityOnly Visibility = "COMMUNITY_ONLY"
 VisibilityPrivate Visibility = "PRIVATE"
 VisibilityOrganizationMembers Visibility = "ORGANIZATION_MEMBERS"
 VisibilityModerators Visibility = "MODERATORS"
 VisibilityAdmins Visibility = "ADMINS"
)

type Status string
const (
 StatusDraft Status = "DRAFT"
 StatusPublished Status = "PUBLISHED"
 StatusHidden Status = "HIDDEN"
 StatusTombstoned Status = "TOMBSTONED"
)

type Publication struct {
 ID string `json:"id"`
 Namespace string `json:"namespace"`
 Version string `json:"version"`
 Author string `json:"author"`
 Title string `json:"title"`
 Summary string `json:"summary,omitempty"`
 BodyRef string `json:"body_ref"`
 BodyDigest string `json:"body_digest"`
 RightsClaim string `json:"rights_claim,omitempty"`
 Visibility Visibility `json:"visibility"`
 Status Status `json:"status"`
 Source string `json:"source"`
 CreatedAt time.Time `json:"created_at"`
 UpdatedAt time.Time `json:"updated_at"`
 PublishedAt *time.Time `json:"published_at,omitempty"`
}

type CreateDraftRequest struct {
 IdempotencyKey string `json:"idempotency_key"`
 Title string `json:"title"`
 Summary string `json:"summary,omitempty"`
 Body string `json:"body"`
 Visibility Visibility `json:"visibility"`
}

type ModerateRequest struct {
 Action string `json:"action"`
 Reason string `json:"reason,omitempty"`
}
