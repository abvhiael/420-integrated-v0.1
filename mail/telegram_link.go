package mail

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const TelegramProvider = "telegram"

var ErrTelegramInvalidResult = errors.New("mail: invalid telegram link result")

type TelegramAccount struct {
	UserID       string    `json:"user_id"`
	Username     string    `json:"username,omitempty"`
	FirstName    string    `json:"first_name,omitempty"`
	LastName     string    `json:"last_name,omitempty"`
	Verified     bool      `json:"verified"`
	NonCustodial bool      `json:"non_custodial"`
	LinkedAt     time.Time `json:"linked_at"`
}

type TelegramLinkAuthority interface {
	LinkTelegram(context.Context, string, string) (TelegramAccount, error)
	UnlinkTelegram(context.Context, string, string) error
}

type TelegramConnectorAdapter struct {
	Authority TelegramLinkAuthority
}

func NewTelegramConnectorAdapter(authority TelegramLinkAuthority) *TelegramConnectorAdapter {
	return &TelegramConnectorAdapter{Authority: authority}
}

func NewTelegramConnectorService(authority TelegramLinkAuthority) (*ConnectorService, error) {
	registry, err := NewConnectorRegistry(NewTelegramConnectorAdapter(authority))
	if err != nil {
		return nil, err
	}
	return NewConnectorService(registry), nil
}

func (a *TelegramConnectorAdapter) Descriptor() ConnectorDescriptor {
	capabilities := []ConnectorCapability{ConnectorCapabilityLink}
	if _, ok := a.Authority.(TelegramSyncAuthority); ok {
		capabilities = append(capabilities, ConnectorCapabilityPull)
	}
	return ConnectorDescriptor{
		Provider:     TelegramProvider,
		DisplayName:  "Telegram",
		Capabilities: capabilities,
	}
}

func (a *TelegramConnectorAdapter) Link(ctx context.Context, actor string, req ConnectorLinkRequest) (ConnectorConnection, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return ConnectorConnection{}, ErrUnauthorized
	}
	if normalizeProvider(req.Provider) != TelegramProvider {
		return ConnectorConnection{}, ErrInvalidInput
	}
	authorizationRef := strings.TrimSpace(req.AuthorizationRef)
	if authorizationRef == "" || len([]byte(authorizationRef)) > MaxConnectorOpaqueBytes {
		return ConnectorConnection{}, ErrInvalidInput
	}
	if a == nil || a.Authority == nil {
		return ConnectorConnection{}, errors.New("mail: telegram link authority unavailable")
	}

	account, err := a.Authority.LinkTelegram(ctx, actor, authorizationRef)
	if err != nil {
		return ConnectorConnection{}, fmt.Errorf("mail: telegram link authority: %w", err)
	}
	account = normalizeTelegramAccount(account)
	if err := validateTelegramAccount(account); err != nil {
		return ConnectorConnection{}, err
	}

	display := telegramDisplayName(account)
	return ConnectorConnection{
		ID:           "telegram:" + account.UserID,
		Provider:     TelegramProvider,
		Identity:     actor,
		ExternalID:   account.UserID,
		DisplayName:  display,
		LinkedAt:     account.LinkedAt,
		UpdatedAt:    account.LinkedAt,
		Active:       true,
		NonCustodial: true,
	}, nil
}

func (a *TelegramConnectorAdapter) Unlink(ctx context.Context, actor, connectionID string) error {
	actor = strings.TrimSpace(actor)
	connectionID = strings.TrimSpace(connectionID)
	if actor == "" {
		return ErrUnauthorized
	}
	userID, ok := telegramUserIDFromConnectionID(connectionID)
	if !ok {
		return ErrInvalidInput
	}
	if a == nil || a.Authority == nil {
		return errors.New("mail: telegram link authority unavailable")
	}
	if err := a.Authority.UnlinkTelegram(ctx, actor, userID); err != nil {
		return fmt.Errorf("mail: telegram unlink authority: %w", err)
	}
	return nil
}

func (a *TelegramConnectorAdapter) Pull(ctx context.Context, actor string, req ConnectorPullRequest) (ConnectorPullResult, error) {
	syncAuthority, ok := a.Authority.(TelegramSyncAuthority)
	if !ok {
		return ConnectorPullResult{}, ErrConnectorUnsupported
	}
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return ConnectorPullResult{}, ErrUnauthorized
	}
	if normalizeProvider(req.Provider) != TelegramProvider {
		return ConnectorPullResult{}, ErrInvalidInput
	}
	userID, ok := telegramUserIDFromConnectionID(strings.TrimSpace(req.ConnectionID))
	if !ok {
		return ConnectorPullResult{}, ErrInvalidInput
	}
	cursor := strings.TrimSpace(req.Cursor)
	if len([]byte(cursor)) > MaxTelegramSyncCursorBytes {
		return ConnectorPullResult{}, ErrInvalidInput
	}
	page, err := syncAuthority.PullTelegram(ctx, actor, userID, cursor)
	if err != nil {
		return ConnectorPullResult{}, fmt.Errorf("mail: telegram sync authority: %w", err)
	}
	page.NextCursor = strings.TrimSpace(page.NextCursor)
	if len([]byte(page.NextCursor)) > MaxTelegramSyncCursorBytes {
		return ConnectorPullResult{}, ErrTelegramInvalidResult
	}
	items := make([]ConnectorItem, 0, len(page.Messages))
	for _, message := range page.Messages {
		if err := validateTelegramInboundMessage(message); err != nil {
			return ConnectorPullResult{}, err
		}
		raw, err := json.Marshal(message)
		if err != nil {
			return ConnectorPullResult{}, fmt.Errorf("mail: encode telegram sync message: %w", err)
		}
		items = append(items, ConnectorItem{
			ExternalID: message.MessageID,
			OccurredAt: message.CreatedAt.UTC(),
			Kind:       TelegramSyncItemKind,
			Payload:    string(raw),
		})
	}
	return ConnectorPullResult{
		Provider: TelegramProvider, ConnectionID: req.ConnectionID, Items: items, NextCursor: page.NextCursor,
	}, nil
}

func (a *TelegramConnectorAdapter) Push(context.Context, string, ConnectorPushRequest) (ConnectorPushResult, error) {
	return ConnectorPushResult{}, ErrConnectorUnsupported
}

func (a *TelegramConnectorAdapter) VerifyWebhook(context.Context, ConnectorWebhookRequest) (ConnectorWebhookResult, error) {
	return ConnectorWebhookResult{}, ErrConnectorUnsupported
}

func normalizeTelegramAccount(account TelegramAccount) TelegramAccount {
	account.UserID = strings.TrimSpace(account.UserID)
	account.Username = strings.TrimSpace(account.Username)
	account.FirstName = strings.TrimSpace(account.FirstName)
	account.LastName = strings.TrimSpace(account.LastName)
	return account
}

func validateTelegramAccount(account TelegramAccount) error {
	if !validTelegramUserID(account.UserID) ||
		len([]byte(account.Username)) > 128 ||
		len([]byte(account.FirstName)) > 128 ||
		len([]byte(account.LastName)) > 128 ||
		(account.Username == "" && account.FirstName == "") ||
		!account.Verified ||
		!account.NonCustodial ||
		account.LinkedAt.IsZero() {
		return ErrTelegramInvalidResult
	}
	return nil
}

func validTelegramUserID(value string) bool {
	value = strings.TrimSpace(value)
	if len(value) < 1 || len(value) > 20 || value == "0" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func telegramUserIDFromConnectionID(connectionID string) (string, bool) {
	const prefix = "telegram:"
	if !strings.HasPrefix(connectionID, prefix) {
		return "", false
	}
	userID := strings.TrimPrefix(connectionID, prefix)
	return userID, validTelegramUserID(userID)
}

func telegramDisplayName(account TelegramAccount) string {
	name := strings.TrimSpace(strings.TrimSpace(account.FirstName + " " + account.LastName))
	if name != "" {
		return name
	}
	if account.Username != "" {
		return "@" + account.Username
	}
	return account.UserID
}
