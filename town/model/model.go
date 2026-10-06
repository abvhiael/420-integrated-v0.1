package model

import (
	"strings"
	"time"
)

const (
	Namespace420Town = "420Town"
	SchemaVersion    = "v1"
)

type ObjectID string

func (id ObjectID) Valid() bool {
	value := string(id)
	return value != "" && len(value) <= 256 && strings.TrimSpace(value) == value
}

type ObjectKind string

const (
	KindCommunity        ObjectKind = "Community"
	KindMembership       ObjectKind = "Membership"
	KindRoleBinding      ObjectKind = "RoleBinding"
	KindPermissionGrant  ObjectKind = "PermissionGrant"
	KindSubscription     ObjectKind = "Subscription"
	KindEntitlement      ObjectKind = "Entitlement"
	KindTreasuryRef      ObjectKind = "TreasuryRef"
	KindPost             ObjectKind = "Post"
	KindThread           ObjectKind = "Thread"
	KindComment          ObjectKind = "Comment"
	KindVote             ObjectKind = "Vote"
	KindModerationAction ObjectKind = "ModerationAction"
)

type MembershipState string
const (
	MembershipNone    MembershipState = "NONE"
	MembershipActive  MembershipState = "ACTIVE"
	MembershipLeft    MembershipState = "LEFT"
	MembershipRemoved MembershipState = "REMOVED"
)

type SubscriptionState string
const (
	SubscriptionNone      SubscriptionState = "NONE"
	SubscriptionActive    SubscriptionState = "ACTIVE"
	SubscriptionCancelled SubscriptionState = "CANCELLED"
	SubscriptionExpired   SubscriptionState = "EXPIRED"
)

type EntitlementState string
const (
	EntitlementNone    EntitlementState = "NONE"
	EntitlementActive  EntitlementState = "ACTIVE"
	EntitlementRevoked EntitlementState = "REVOKED"
	EntitlementExpired EntitlementState = "EXPIRED"
)

type RoleID string
const (
	RoleMember    RoleID = "MEMBER"
	RoleModerator RoleID = "MODERATOR"
	RoleAdmin     RoleID = "ADMIN"
)

type PermissionID string
const (
	PermissionManageMembers       PermissionID = "MANAGE_MEMBERS"
	PermissionManageRoles         PermissionID = "MANAGE_ROLES"
	PermissionManageSubscriptions PermissionID = "MANAGE_SUBSCRIPTIONS"
	PermissionManageEntitlements  PermissionID = "MANAGE_ENTITLEMENTS"
	PermissionManageTreasury      PermissionID = "MANAGE_TREASURY"
)

type ModerationActionName string

const (
	ModerationReport            ModerationActionName = "REPORT"
	ModerationHide              ModerationActionName = "HIDE"
	ModerationBlock             ModerationActionName = "BLOCK"
	ModerationMute              ModerationActionName = "MUTE"
	ModerationSuspend           ModerationActionName = "SUSPEND"
	ModerationAppeal            ModerationActionName = "APPEAL"
	ModerationModeratorDecision ModerationActionName = "MODERATOR_DECISION"
	ModerationRestore           ModerationActionName = "RESTORE"
	ModerationLock              ModerationActionName = "LOCK"
)

type Visibility string

const (
	VisibilityPublic             Visibility = "PUBLIC"
	VisibilityUnlisted           Visibility = "UNLISTED"
	VisibilityFollowers          Visibility = "FOLLOWERS"
	VisibilityCommunityOnly      Visibility = "COMMUNITY_ONLY"
	VisibilityPurchasersBackers  Visibility = "PURCHASERS_OR_BACKERS"
	VisibilityPrivate            Visibility = "PRIVATE"
	VisibilityOrganizationMember Visibility = "ORGANIZATION_MEMBERS"
	VisibilityModerators         Visibility = "MODERATORS"
	VisibilityAdmins             Visibility = "ADMINS"
)

type Envelope struct {
	ID         ObjectID   `json:"id"`
	Kind       ObjectKind `json:"kind"`
	Namespace  string     `json:"namespace"`
	Version    string     `json:"version"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	Visibility Visibility `json:"visibility"`
	Source     string     `json:"source"`
}

type Community struct {
	Envelope
	OwnerIdentityID ObjectID `json:"owner_identity_id"`
	Title           string   `json:"title"`
}

type Membership struct {
	Envelope
	CommunityID ObjectID        `json:"community_id"`
	IdentityID  ObjectID        `json:"identity_id"`
	State       MembershipState `json:"state"`
}

type RoleBinding struct {
	Envelope
	CommunityID ObjectID `json:"community_id"`
	IdentityID  ObjectID `json:"identity_id"`
	RoleID      RoleID   `json:"role_id"`
}

type PermissionGrant struct {
	Envelope
	CommunityID ObjectID     `json:"community_id"`
	SubjectID   ObjectID     `json:"subject_id"`
	Permission  PermissionID `json:"permission"`
}

type Subscription struct {
	Envelope
	CommunityID ObjectID          `json:"community_id"`
	Subscriber  ObjectID          `json:"subscriber_id"`
	State       SubscriptionState `json:"state"`
}

type Entitlement struct {
	Envelope
	CommunityID ObjectID         `json:"community_id"`
	Beneficiary ObjectID         `json:"beneficiary_id"`
	Type        string           `json:"entitlement_type"`
	State       EntitlementState `json:"state"`
}

type TreasuryRef struct {
	Envelope
	CommunityID ObjectID `json:"community_id"`
	AuthorityID ObjectID `json:"authority_id"`
}

type Post struct {
	Envelope
	CommunityID ObjectID `json:"community_id"`
	AuthorID    ObjectID `json:"author_id"`
	ContentRef  string   `json:"content_ref"`
}

type Thread struct {
	Envelope
	CommunityID ObjectID `json:"community_id"`
	RootPostID  ObjectID `json:"root_post_id"`
}

type Comment struct {
	Envelope
	CommunityID ObjectID `json:"community_id"`
	ParentID    ObjectID `json:"parent_id"`
	AuthorID    ObjectID `json:"author_id"`
	ContentRef  string   `json:"content_ref"`
}

type Vote struct {
	Envelope
	CommunityID ObjectID `json:"community_id"`
	TargetID    ObjectID `json:"target_id"`
	VoterID     ObjectID `json:"voter_id"`
	Value       int8     `json:"value"`
}

type ModerationAction struct {
	Envelope
	CommunityID ObjectID `json:"community_id"`
	TargetID    ObjectID `json:"target_id"`
	ModeratorID ObjectID `json:"moderator_id"`
	Action      ModerationActionName `json:"action"`
	Reason      string   `json:"reason,omitempty"`
}
