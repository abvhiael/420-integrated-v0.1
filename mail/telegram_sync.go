package mail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

const (
	TelegramSyncItemKind       = "TELEGRAM_MESSAGE"
	MaxTelegramUsernameBytes   = 128
	MaxTelegramChatTitleBytes  = 256
	MaxTelegramSyncCursorBytes = 64 << 10
)

var ErrTelegramSyncConflict = errors.New("mail: telegram sync conflict")

type TelegramInboundMessage struct {
	MessageID      string    `json:"message_id"`
	AuthorID       string    `json:"author_id"`
	AuthorUsername string    `json:"author_username,omitempty"`
	ChatID         string    `json:"chat_id"`
	ChatTitle      string    `json:"chat_title,omitempty"`
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"created_at"`
}

type TelegramSyncPage struct {
	Messages   []TelegramInboundMessage `json:"messages"`
	NextCursor string                   `json:"next_cursor,omitempty"`
}

type TelegramSyncAuthority interface {
	PullTelegram(context.Context, string, string, string) (TelegramSyncPage, error)
}

type TelegramSyncState struct {
	Owner        string    `json:"owner"`
	ConnectionID string    `json:"connection_id"`
	Cursor       string    `json:"cursor,omitempty"`
	LastSyncAt   time.Time `json:"last_sync_at"`
	Version      uint32    `json:"version"`
}

type TelegramSyncResult struct {
	ConnectionID string        `json:"connection_id"`
	Imported     []MailboxItem `json:"imported"`
	NextCursor   string        `json:"next_cursor,omitempty"`
	SyncedAt     time.Time     `json:"synced_at"`
}

type TelegramSyncService struct {
	Connectors *ConnectorService
	Mail       *Service
}

func NewTelegramSyncService(connectors *ConnectorService, mail *Service) *TelegramSyncService {
	return &TelegramSyncService{Connectors: connectors, Mail: mail}
}

func (s *TelegramSyncService) Sync(ctx context.Context, actor, connectionID string) (TelegramSyncResult, error) {
	actor = strings.TrimSpace(actor)
	connectionID = strings.TrimSpace(connectionID)
	if actor == "" {
		return TelegramSyncResult{}, ErrUnauthorized
	}
	if _, ok := telegramUserIDFromConnectionID(connectionID); !ok {
		return TelegramSyncResult{}, ErrInvalidInput
	}
	if s == nil || s.Connectors == nil || s.Mail == nil || s.Mail.Store == nil || s.Mail.Blobs == nil {
		return TelegramSyncResult{}, errors.New("mail: telegram sync dependencies unavailable")
	}

	cursor, err := s.currentCursor(ctx, actor, connectionID)
	if err != nil {
		return TelegramSyncResult{}, err
	}
	pulled, err := s.Connectors.Pull(ctx, actor, ConnectorPullRequest{
		Provider: TelegramProvider, ConnectionID: connectionID, Cursor: cursor,
	})
	if err != nil {
		return TelegramSyncResult{}, err
	}
	if pulled.Provider != TelegramProvider || pulled.ConnectionID != connectionID || len([]byte(pulled.NextCursor)) > MaxTelegramSyncCursorBytes {
		return TelegramSyncResult{}, ErrTelegramInvalidResult
	}

	messages := make([]TelegramInboundMessage, 0, len(pulled.Items))
	for _, item := range pulled.Items {
		if item.Kind != TelegramSyncItemKind {
			return TelegramSyncResult{}, ErrTelegramInvalidResult
		}
		var msg TelegramInboundMessage
		if err := json.Unmarshal([]byte(item.Payload), &msg); err != nil {
			return TelegramSyncResult{}, ErrTelegramInvalidResult
		}
		if msg.MessageID != item.ExternalID || !msg.CreatedAt.Equal(item.OccurredAt) {
			return TelegramSyncResult{}, ErrTelegramInvalidResult
		}
		if err := validateTelegramInboundMessage(msg); err != nil {
			return TelegramSyncResult{}, err
		}
		messages = append(messages, msg)
	}
	sort.Slice(messages, func(i, j int) bool {
		if messages[i].CreatedAt.Equal(messages[j].CreatedAt) {
			return messages[i].MessageID < messages[j].MessageID
		}
		return messages[i].CreatedAt.Before(messages[j].CreatedAt)
	})

	imported := make([]MailboxItem, 0, len(messages))
	for _, external := range messages {
		item, created, err := s.materialize(ctx, actor, connectionID, external)
		if err != nil {
			return TelegramSyncResult{}, err
		}
		if created {
			imported = append(imported, item)
		}
	}

	now := s.Mail.Now().UTC()
	if err := s.Mail.Store.Update(ctx, func(data *storeData) error {
		key := telegramSyncStateKey(actor, connectionID)
		state := data.TelegramSync[key]
		if state.Owner != "" && (state.Owner != actor || state.ConnectionID != connectionID) {
			return ErrTelegramSyncConflict
		}
		state.Owner = actor
		state.ConnectionID = connectionID
		state.Cursor = pulled.NextCursor
		state.LastSyncAt = now
		if state.Version == 0 {
			state.Version = 1
		} else {
			state.Version++
		}
		data.TelegramSync[key] = state
		return nil
	}); err != nil {
		return TelegramSyncResult{}, err
	}

	return TelegramSyncResult{
		ConnectionID: connectionID,
		Imported:     imported,
		NextCursor:   pulled.NextCursor,
		SyncedAt:     now,
	}, nil
}

func (s *TelegramSyncService) currentCursor(ctx context.Context, actor, connectionID string) (string, error) {
	var cursor string
	if err := s.Mail.Store.View(ctx, func(data *storeData) error {
		state, ok := data.TelegramSync[telegramSyncStateKey(actor, connectionID)]
		if !ok {
			return nil
		}
		if state.Owner != actor || state.ConnectionID != connectionID {
			return ErrTelegramSyncConflict
		}
		cursor = state.Cursor
		return nil
	}); err != nil {
		return "", err
	}
	return cursor, nil
}

func (s *TelegramSyncService) materialize(ctx context.Context, actor, connectionID string, external TelegramInboundMessage) (MailboxItem, bool, error) {
	sender := "telegram:" + external.AuthorID
	idem := "telegram-sync:" + connectionID + ":" + external.ChatID + ":" + external.MessageID
	idemKey := actor + "\x00" + idem
	fp := telegramSyncFingerprint(connectionID, external)

	var existingID string
	var existing Message
	if err := s.Mail.Store.View(ctx, func(data *storeData) error {
		if id, ok := data.ByIdem[idemKey]; ok {
			existingID = id
			existing = data.Messages[id]
		}
		return nil
	}); err != nil {
		return MailboxItem{}, false, err
	}
	if existingID != "" {
		if existing.Fingerprint != fp {
			return MailboxItem{}, false, ErrTelegramSyncConflict
		}
		var state MailboxState
		var ok bool
		if err := s.Mail.Store.View(ctx, func(data *storeData) error {
			state, ok = data.Mailbox[mailboxKey(actor, existingID)]
			return nil
		}); err != nil {
			return MailboxItem{}, false, err
		}
		if !ok {
			return MailboxItem{}, false, ErrTelegramSyncConflict
		}
		return MailboxItem{Message: existing, State: state}, false, nil
	}

	bodyRef, digest, err := putPrivateVerified(ctx, s.Mail.Blobs, actor, []byte(external.Content))
	if err != nil {
		return MailboxItem{}, false, fmt.Errorf("telegram sync private body storage: %w", err)
	}
	if bodyRef == "" || digest == "" {
		return MailboxItem{}, false, errors.New("mail: telegram sync storage returned incomplete body evidence")
	}

	id := deterministicMessageID(sender, actor, idem)
	subject := "Telegram"
	if external.ChatTitle != "" {
		subject = "Telegram · " + external.ChatTitle
	} else if external.AuthorUsername != "" {
		subject = "Telegram · @" + external.AuthorUsername
	}
	if len([]byte(subject)) > MaxSubjectBytes {
		subject = "Telegram"
	}
	conversationID := deterministicTelegramConversationID(actor, connectionID, external.ChatID)
	now := s.Mail.Now().UTC()
	msg := Message{
		ID: id, Sender: sender, Recipient: actor, Subject: subject, BodyRef: bodyRef, BodyDigest: digest,
		ConversationID: conversationID, CreatedAt: external.CreatedAt.UTC(), UpdatedAt: now,
		Status: "DELIVERED", Visibility: "PRIVATE", Source: TelegramProvider, Version: 1,
		Fingerprint: fp, IdempotencyKey: idem,
	}
	state := MailboxState{MessageID: id, Owner: actor, Folder: FolderInbox, UpdatedAt: now, Version: 1}
	created := false
	muted := false

	if err := s.Mail.Store.Update(ctx, func(data *storeData) error {
		if existingID, ok := data.ByIdem[idemKey]; ok {
			existing := data.Messages[existingID]
			if existing.Fingerprint != fp {
				return ErrTelegramSyncConflict
			}
			return nil
		}
		decision, err := evaluateTrustPolicy(data, actor, msg, external.Content)
		if err != nil {
			return err
		}
		protection := evaluateSpamProtection(data, actor, msg, external.Content, decision)
		protection = applyExternalImpersonationSignals(protection, TelegramProvider, external.AuthorUsername)
		if err := applyIncomingRules(data, actor, msg, external.Content, &state, now); err != nil {
			return err
		}
		threadState := data.ConversationStates[conversationStateKey(actor, conversationID)]
		if threadState.Archived && state.Folder == FolderInbox {
			state.PreviousFolder = FolderInbox
			state.Folder = FolderArchive
			t := now
			state.ArchivedAt = &t
		}
		if threadState.Muted || decision.Muted {
			state.Muted = true
			muted = true
		}
		if protection.Quarantine {
			if state.Folder != FolderJunk {
				state.PreviousFolder = state.Folder
			}
			state.Folder = FolderJunk
			t := now
			state.JunkedAt = &t
			state.Muted = true
			muted = true
		}
		data.Messages[id] = msg
		data.ByIdem[idemKey] = id
		data.Mailbox[mailboxKey(actor, id)] = state
		recordDeliveryProtection(data, actor, msg, external.Content, protection, now)
		created = true
		return nil
	}); err != nil {
		return MailboxItem{}, false, err
	}

	if !created {
		var stored Message
		if err := s.Mail.Store.View(ctx, func(data *storeData) error {
			stored = data.Messages[data.ByIdem[idemKey]]
			state = data.Mailbox[mailboxKey(actor, stored.ID)]
			return nil
		}); err != nil {
			return MailboxItem{}, false, err
		}
		return MailboxItem{Message: stored, State: state}, false, nil
	}
	if !muted && s.Mail.Notify != nil {
		_ = s.Mail.Notify.NotifyMail(ctx, Notification{MessageID: id, Recipient: actor, Sender: sender, Source: TelegramProvider})
	}
	return MailboxItem{Message: msg, State: state}, true, nil
}

func validateTelegramInboundMessage(msg TelegramInboundMessage) error {
	msg.AuthorUsername = strings.TrimSpace(msg.AuthorUsername)
	msg.ChatTitle = strings.TrimSpace(msg.ChatTitle)
	if !validTelegramPositiveID(msg.MessageID) ||
		!validTelegramUserID(msg.AuthorID) ||
		!validTelegramChatID(msg.ChatID) ||
		len([]byte(msg.AuthorUsername)) > MaxTelegramUsernameBytes ||
		len([]byte(msg.ChatTitle)) > MaxTelegramChatTitleBytes ||
		len([]byte(msg.Content)) > MaxBodyBytes ||
		msg.CreatedAt.IsZero() {
		return ErrTelegramInvalidResult
	}
	return nil
}

func validTelegramPositiveID(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" || value == "0" || len(value) > 20 {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func validTelegramChatID(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 21 {
		return false
	}
	if value[0] == '-' {
		value = value[1:]
	}
	return validTelegramPositiveID(value)
}

func telegramSyncStateKey(owner, connectionID string) string {
	return owner + "\x00" + connectionID
}

func telegramSyncFingerprint(connectionID string, msg TelegramInboundMessage) string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		"420/MAIL/TELEGRAM/SYNC/V1", connectionID, msg.MessageID, msg.AuthorID, msg.AuthorUsername,
		msg.ChatID, msg.ChatTitle, msg.Content, msg.CreatedAt.UTC().Format(time.RFC3339Nano),
	}, "\x00")))
	return hex.EncodeToString(sum[:])
}

func deterministicTelegramConversationID(owner, connectionID, chatID string) string {
	sum := sha256.Sum256([]byte("420/MAIL/TELEGRAM/CONVERSATION/V1\x00" + owner + "\x00" + connectionID + "\x00" + chatID))
	return "conv_telegram_" + hex.EncodeToString(sum[:16])
}

func validateTelegramSyncData(data *storeData) error {
	for key, state := range data.TelegramSync {
		if state.Owner == "" || state.ConnectionID == "" || state.Version == 0 || state.LastSyncAt.IsZero() ||
			len([]byte(state.Cursor)) > MaxTelegramSyncCursorBytes {
			return ErrTelegramInvalidResult
		}
		if _, ok := telegramUserIDFromConnectionID(state.ConnectionID); !ok {
			return ErrTelegramInvalidResult
		}
		if key != telegramSyncStateKey(state.Owner, state.ConnectionID) {
			return ErrTelegramSyncConflict
		}
	}
	return nil
}
