package mail

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const DiscordProvider = "discord"

var ErrDiscordInvalidResult = errors.New("mail: invalid discord link result")

type DiscordAccount struct {
	UserID       string    `json:"user_id"`
	Username     string    `json:"username"`
	GlobalName   string    `json:"global_name,omitempty"`
	Scopes       []string  `json:"scopes"`
	Verified     bool      `json:"verified"`
	NonCustodial bool      `json:"non_custodial"`
	LinkedAt     time.Time `json:"linked_at"`
}

type DiscordLinkAuthority interface {
	LinkDiscord(context.Context, string, string) (DiscordAccount, error)
	UnlinkDiscord(context.Context, string, string) error
}

type DiscordConnectorAdapter struct {
	Authority DiscordLinkAuthority
}

func NewDiscordConnectorAdapter(authority DiscordLinkAuthority) *DiscordConnectorAdapter {
	return &DiscordConnectorAdapter{Authority: authority}
}

func NewDiscordConnectorService(authority DiscordLinkAuthority) (*ConnectorService, error) {
	registry, err := NewConnectorRegistry(NewDiscordConnectorAdapter(authority))
	if err != nil {
		return nil, err
	}
	return NewConnectorService(registry), nil
}

func (a *DiscordConnectorAdapter) Descriptor() ConnectorDescriptor {
	capabilities := []ConnectorCapability{ConnectorCapabilityLink}
	if _, ok := a.Authority.(DiscordSyncAuthority); ok {
		capabilities = append(capabilities, ConnectorCapabilityPull)
	}
	return ConnectorDescriptor{
		Provider:     DiscordProvider,
		DisplayName:  "Discord",
		Capabilities: capabilities,
	}
}

func (a *DiscordConnectorAdapter) Link(ctx context.Context, actor string, req ConnectorLinkRequest) (ConnectorConnection, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return ConnectorConnection{}, ErrUnauthorized
	}
	if normalizeProvider(req.Provider) != DiscordProvider {
		return ConnectorConnection{}, ErrInvalidInput
	}
	authorizationRef := strings.TrimSpace(req.AuthorizationRef)
	if authorizationRef == "" || len([]byte(authorizationRef)) > MaxConnectorOpaqueBytes {
		return ConnectorConnection{}, ErrInvalidInput
	}
	if a == nil || a.Authority == nil {
		return ConnectorConnection{}, errors.New("mail: discord link authority unavailable")
	}

	account, err := a.Authority.LinkDiscord(ctx, actor, authorizationRef)
	if err != nil {
		return ConnectorConnection{}, fmt.Errorf("mail: discord link authority: %w", err)
	}
	account = normalizeDiscordAccount(account)
	if err := validateDiscordAccount(account); err != nil {
		return ConnectorConnection{}, err
	}

	display := account.GlobalName
	if display == "" {
		display = account.Username
	}
	return ConnectorConnection{
		ID:           "discord:" + account.UserID,
		Provider:     DiscordProvider,
		Identity:     actor,
		ExternalID:   account.UserID,
		DisplayName:  display,
		LinkedAt:     account.LinkedAt,
		UpdatedAt:    account.LinkedAt,
		Active:       true,
		NonCustodial: true,
	}, nil
}

func (a *DiscordConnectorAdapter) Unlink(ctx context.Context, actor, connectionID string) error {
	actor = strings.TrimSpace(actor)
	connectionID = strings.TrimSpace(connectionID)
	if actor == "" {
		return ErrUnauthorized
	}
	userID, ok := discordUserIDFromConnectionID(connectionID)
	if !ok {
		return ErrInvalidInput
	}
	if a == nil || a.Authority == nil {
		return errors.New("mail: discord link authority unavailable")
	}
	if err := a.Authority.UnlinkDiscord(ctx, actor, userID); err != nil {
		return fmt.Errorf("mail: discord unlink authority: %w", err)
	}
	return nil
}

func (a *DiscordConnectorAdapter) Pull(ctx context.Context, actor string, req ConnectorPullRequest) (ConnectorPullResult, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return ConnectorPullResult{}, ErrUnauthorized
	}
	if normalizeProvider(req.Provider) != DiscordProvider {
		return ConnectorPullResult{}, ErrInvalidInput
	}
	userID, ok := discordUserIDFromConnectionID(strings.TrimSpace(req.ConnectionID))
	if !ok {
		return ConnectorPullResult{}, ErrInvalidInput
	}
	syncAuthority, ok := a.Authority.(DiscordSyncAuthority)
	if !ok {
		return ConnectorPullResult{}, ErrConnectorUnsupported
	}
	cursor := strings.TrimSpace(req.Cursor)
	if len([]byte(cursor)) > MaxDiscordSyncCursorBytes {
		return ConnectorPullResult{}, ErrInvalidInput
	}
	page, err := syncAuthority.PullDiscord(ctx, actor, userID, cursor)
	if err != nil {
		return ConnectorPullResult{}, fmt.Errorf("mail: discord sync authority: %w", err)
	}
	page.NextCursor = strings.TrimSpace(page.NextCursor)
	if len([]byte(page.NextCursor)) > MaxDiscordSyncCursorBytes {
		return ConnectorPullResult{}, ErrDiscordInvalidResult
	}
	items := make([]ConnectorItem, 0, len(page.Messages))
	for _, message := range page.Messages {
		if err := validateDiscordInboundMessage(message); err != nil {
			return ConnectorPullResult{}, err
		}
		raw, err := json.Marshal(message)
		if err != nil {
			return ConnectorPullResult{}, fmt.Errorf("mail: encode discord sync message: %w", err)
		}
		items = append(items, ConnectorItem{
			ExternalID: message.MessageID,
			OccurredAt: message.CreatedAt.UTC(),
			Kind:       DiscordSyncItemKind,
			Payload:    string(raw),
		})
	}
	return ConnectorPullResult{
		Provider: DiscordProvider, ConnectionID: req.ConnectionID, Items: items, NextCursor: page.NextCursor,
	}, nil
}

func (a *DiscordConnectorAdapter) Push(context.Context, string, ConnectorPushRequest) (ConnectorPushResult, error) {
	return ConnectorPushResult{}, ErrConnectorUnsupported
}

func (a *DiscordConnectorAdapter) VerifyWebhook(context.Context, ConnectorWebhookRequest) (ConnectorWebhookResult, error) {
	return ConnectorWebhookResult{}, ErrConnectorUnsupported
}

func normalizeDiscordAccount(account DiscordAccount) DiscordAccount {
	account.UserID = strings.TrimSpace(account.UserID)
	account.Username = strings.TrimSpace(account.Username)
	account.GlobalName = strings.TrimSpace(account.GlobalName)
	scopes := make([]string, 0, len(account.Scopes))
	for _, scope := range account.Scopes {
		scope = strings.ToLower(strings.TrimSpace(scope))
		if scope != "" {
			scopes = append(scopes, scope)
		}
	}
	account.Scopes = scopes
	return account
}

func validateDiscordAccount(account DiscordAccount) error {
	if !validDiscordSnowflake(account.UserID) || account.Username == "" || len([]byte(account.Username)) > 128 || len([]byte(account.GlobalName)) > 128 ||
		!account.Verified || !account.NonCustodial || account.LinkedAt.IsZero() || !discordHasScope(account.Scopes, "identify") {
		return ErrDiscordInvalidResult
	}
	seen := map[string]bool{}
	for _, scope := range account.Scopes {
		if seen[scope] {
			return ErrDiscordInvalidResult
		}
		seen[scope] = true
	}
	return nil
}

func validDiscordSnowflake(value string) bool {
	value = strings.TrimSpace(value)
	if len(value) < 17 || len(value) > 20 {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func discordUserIDFromConnectionID(connectionID string) (string, bool) {
	const prefix = "discord:"
	if !strings.HasPrefix(connectionID, prefix) {
		return "", false
	}
	userID := strings.TrimPrefix(connectionID, prefix)
	return userID, validDiscordSnowflake(userID)
}

func discordHasScope(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}
