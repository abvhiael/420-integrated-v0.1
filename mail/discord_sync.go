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
	DiscordSyncItemKind = "DISCORD_MESSAGE"
	MaxDiscordUsernameBytes = 128
	MaxDiscordChannelNameBytes = 128
	MaxDiscordSyncCursorBytes = 64 << 10
)

var ErrDiscordSyncConflict = errors.New("mail: discord sync conflict")

type DiscordInboundMessage struct {
	MessageID      string    `json:"message_id"`
	AuthorID       string    `json:"author_id"`
	AuthorUsername string    `json:"author_username"`
	ChannelID      string    `json:"channel_id"`
	ChannelName    string    `json:"channel_name,omitempty"`
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"created_at"`
}

type DiscordSyncPage struct {
	Messages   []DiscordInboundMessage `json:"messages"`
	NextCursor string                  `json:"next_cursor,omitempty"`
}

type DiscordSyncAuthority interface {
	PullDiscord(context.Context, string, string, string) (DiscordSyncPage, error)
}

type DiscordSyncState struct {
	Owner        string    `json:"owner"`
	ConnectionID string    `json:"connection_id"`
	Cursor       string    `json:"cursor,omitempty"`
	LastSyncAt   time.Time `json:"last_sync_at"`
	Version      uint32    `json:"version"`
}

type DiscordSyncResult struct {
	ConnectionID string          `json:"connection_id"`
	Imported     []MailboxItem   `json:"imported"`
	NextCursor   string          `json:"next_cursor,omitempty"`
	SyncedAt     time.Time       `json:"synced_at"`
}

type DiscordSyncService struct {
	Connectors *ConnectorService
	Mail       *Service
}

func NewDiscordSyncService(connectors *ConnectorService, mail *Service) *DiscordSyncService {
	return &DiscordSyncService{Connectors: connectors, Mail: mail}
}

func (s *DiscordSyncService) Sync(ctx context.Context, actor, connectionID string) (DiscordSyncResult, error) {
	actor = strings.TrimSpace(actor)
	connectionID = strings.TrimSpace(connectionID)
	if actor == "" {
		return DiscordSyncResult{}, ErrUnauthorized
	}
	if _, ok := discordUserIDFromConnectionID(connectionID); !ok {
		return DiscordSyncResult{}, ErrInvalidInput
	}
	if s == nil || s.Connectors == nil || s.Mail == nil || s.Mail.Store == nil || s.Mail.Blobs == nil {
		return DiscordSyncResult{}, errors.New("mail: discord sync dependencies unavailable")
	}

	cursor, err := s.currentCursor(ctx, actor, connectionID)
	if err != nil {
		return DiscordSyncResult{}, err
	}
	pulled, err := s.Connectors.Pull(ctx, actor, ConnectorPullRequest{
		Provider: DiscordProvider, ConnectionID: connectionID, Cursor: cursor,
	})
	if err != nil {
		return DiscordSyncResult{}, err
	}
	if pulled.Provider != DiscordProvider || pulled.ConnectionID != connectionID || len([]byte(pulled.NextCursor)) > MaxDiscordSyncCursorBytes {
		return DiscordSyncResult{}, ErrDiscordInvalidResult
	}

	messages := make([]DiscordInboundMessage, 0, len(pulled.Items))
	for _, item := range pulled.Items {
		if item.Kind != DiscordSyncItemKind {
			return DiscordSyncResult{}, ErrDiscordInvalidResult
		}
		var msg DiscordInboundMessage
		if err := json.Unmarshal([]byte(item.Payload), &msg); err != nil {
			return DiscordSyncResult{}, ErrDiscordInvalidResult
		}
		if msg.MessageID != item.ExternalID || !msg.CreatedAt.Equal(item.OccurredAt) {
			return DiscordSyncResult{}, ErrDiscordInvalidResult
		}
		if err := validateDiscordInboundMessage(msg); err != nil {
			return DiscordSyncResult{}, err
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
			return DiscordSyncResult{}, err
		}
		if created {
			imported = append(imported, item)
		}
	}

	now := s.Mail.Now().UTC()
	if err := s.Mail.Store.Update(ctx, func(data *storeData) error {
		key := discordSyncStateKey(actor, connectionID)
		state := data.DiscordSync[key]
		if state.Owner != "" && (state.Owner != actor || state.ConnectionID != connectionID) {
			return ErrDiscordSyncConflict
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
		data.DiscordSync[key] = state
		return nil
	}); err != nil {
		return DiscordSyncResult{}, err
	}

	return DiscordSyncResult{
		ConnectionID: connectionID,
		Imported:     imported,
		NextCursor:   pulled.NextCursor,
		SyncedAt:     now,
	}, nil
}

func (s *DiscordSyncService) currentCursor(ctx context.Context, actor, connectionID string) (string, error) {
	var cursor string
	if err := s.Mail.Store.View(ctx, func(data *storeData) error {
		state, ok := data.DiscordSync[discordSyncStateKey(actor, connectionID)]
		if !ok {
			return nil
		}
		if state.Owner != actor || state.ConnectionID != connectionID {
			return ErrDiscordSyncConflict
		}
		cursor = state.Cursor
		return nil
	}); err != nil {
		return "", err
	}
	return cursor, nil
}

func (s *DiscordSyncService) materialize(ctx context.Context, actor, connectionID string, external DiscordInboundMessage) (MailboxItem, bool, error) {
	sender := "discord:" + external.AuthorID
	idem := "discord-sync:" + connectionID + ":" + external.MessageID
	idemKey := actor + "\x00" + idem
	fp := discordSyncFingerprint(connectionID, external)

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
			return MailboxItem{}, false, ErrDiscordSyncConflict
		}
		state, err := s.Mail.GetMailboxState(ctx, actor, existingID)
		if err != nil {
			return MailboxItem{}, false, err
		}
		return MailboxItem{Message: existing, State: state}, false, nil
	}

	bodyRef, digest, err := s.Mail.Blobs.PutPrivate(ctx, actor, []byte(external.Content))
	if err != nil {
		return MailboxItem{}, false, fmt.Errorf("discord sync private body storage: %w", err)
	}
	if bodyRef == "" || digest == "" {
		return MailboxItem{}, false, errors.New("mail: discord sync storage returned incomplete body evidence")
	}

	id := deterministicMessageID(sender, actor, idem)
	subject := "Discord · " + external.AuthorUsername
	if external.ChannelName != "" {
		subject = "Discord · #" + external.ChannelName
	}
	if len([]byte(subject)) > MaxSubjectBytes {
		subject = "Discord"
	}
	conversationID := deterministicDiscordConversationID(actor, connectionID, external.ChannelID)
	now := s.Mail.Now().UTC()
	msg := Message{
		ID: id, Sender: sender, Recipient: actor, Subject: subject, BodyRef: bodyRef, BodyDigest: digest,
		ConversationID: conversationID, CreatedAt: external.CreatedAt.UTC(), UpdatedAt: now,
		Status: "DELIVERED", Visibility: "PRIVATE", Source: DiscordProvider, Version: 1,
		Fingerprint: fp, IdempotencyKey: idem,
	}
	state := MailboxState{MessageID: id, Owner: actor, Folder: FolderInbox, UpdatedAt: now, Version: 1}
	created := false
	muted := false

	if err := s.Mail.Store.Update(ctx, func(data *storeData) error {
		if existingID, ok := data.ByIdem[idemKey]; ok {
			existing := data.Messages[existingID]
			if existing.Fingerprint != fp {
				return ErrDiscordSyncConflict
			}
			return nil
		}
		decision, err := evaluateTrustPolicy(data, actor, msg, external.Content)
		if err != nil {
			return err
		}
		protection := evaluateSpamProtection(data, actor, msg, external.Content, decision)
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
		_ = s.Mail.Notify.NotifyMail(ctx, Notification{MessageID: id, Recipient: actor, Sender: sender, Source: DiscordProvider})
	}
	return MailboxItem{Message: msg, State: state}, true, nil
}

func validateDiscordInboundMessage(msg DiscordInboundMessage) error {
	msg.AuthorUsername = strings.TrimSpace(msg.AuthorUsername)
	msg.ChannelName = strings.TrimSpace(msg.ChannelName)
	if !validDiscordSnowflake(msg.MessageID) || !validDiscordSnowflake(msg.AuthorID) || !validDiscordSnowflake(msg.ChannelID) ||
		msg.AuthorUsername == "" || len([]byte(msg.AuthorUsername)) > MaxDiscordUsernameBytes ||
		len([]byte(msg.ChannelName)) > MaxDiscordChannelNameBytes || len([]byte(msg.Content)) > MaxBodyBytes ||
		msg.CreatedAt.IsZero() {
		return ErrDiscordInvalidResult
	}
	return nil
}

func discordSyncStateKey(owner, connectionID string) string {
	return owner + "\x00" + connectionID
}

func discordSyncFingerprint(connectionID string, msg DiscordInboundMessage) string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		"420/MAIL/DISCORD/SYNC/V1", connectionID, msg.MessageID, msg.AuthorID, msg.AuthorUsername,
		msg.ChannelID, msg.ChannelName, msg.Content, msg.CreatedAt.UTC().Format(time.RFC3339Nano),
	}, "\x00")))
	return hex.EncodeToString(sum[:])
}

func deterministicDiscordConversationID(owner, connectionID, channelID string) string {
	sum := sha256.Sum256([]byte("420/MAIL/DISCORD/CONVERSATION/V1\x00" + owner + "\x00" + connectionID + "\x00" + channelID))
	return "conv_discord_" + hex.EncodeToString(sum[:16])
}


func validateDiscordSyncData(data *storeData) error {
	for key, state := range data.DiscordSync {
		if state.Owner == "" || state.ConnectionID == "" || state.Version == 0 || state.LastSyncAt.IsZero() ||
			len([]byte(state.Cursor)) > MaxDiscordSyncCursorBytes {
			return ErrDiscordInvalidResult
		}
		if _, ok := discordUserIDFromConnectionID(state.ConnectionID); !ok {
			return ErrDiscordInvalidResult
		}
		if key != discordSyncStateKey(state.Owner, state.ConnectionID) {
			return ErrDiscordSyncConflict
		}
	}
	return nil
}
