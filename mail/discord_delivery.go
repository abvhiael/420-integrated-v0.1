package mail

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

const (
	DiscordDeliveryKind            = "DISCORD_DELIVERY"
	MaxDiscordDeliveryContentBytes = 2000
)

var ErrDiscordDeliveryConflict = errors.New("mail: discord delivery conflict")

type DiscordDeliveryMessage struct {
	ChannelID        string `json:"channel_id"`
	Content          string `json:"content"`
	ReplyToMessageID string `json:"reply_to_message_id,omitempty"`
}

type DiscordDeliveryReceipt struct {
	MessageID  string    `json:"message_id"`
	ChannelID  string    `json:"channel_id"`
	AcceptedAt time.Time `json:"accepted_at"`
}

type DiscordDeliveryAuthority interface {
	DeliverDiscord(context.Context, string, string, string, DiscordDeliveryMessage) (DiscordDeliveryReceipt, error)
}

type DiscordDeliveryRequest struct {
	ConnectionID   string `json:"connection_id"`
	ChannelID      string `json:"channel_id"`
	Content        string `json:"content"`
	ReplyToMessageID string `json:"reply_to_message_id,omitempty"`
	IdempotencyKey string `json:"idempotency_key"`
}

type DiscordDeliveryResult struct {
	ConnectionID string    `json:"connection_id"`
	ChannelID    string    `json:"channel_id"`
	MessageID    string    `json:"message_id"`
	AcceptedAt   time.Time `json:"accepted_at"`
	Accepted     bool      `json:"accepted"`
}

type DiscordDeliveryService struct {
	Connectors *ConnectorService
}

func NewDiscordDeliveryService(connectors *ConnectorService) *DiscordDeliveryService {
	return &DiscordDeliveryService{Connectors: connectors}
}

func (s *DiscordDeliveryService) Deliver(ctx context.Context, actor string, req DiscordDeliveryRequest) (DiscordDeliveryResult, error) {
	actor = strings.TrimSpace(actor)
	req.ConnectionID = strings.TrimSpace(req.ConnectionID)
	req.ChannelID = strings.TrimSpace(req.ChannelID)
	req.Content = strings.TrimSpace(req.Content)
	req.ReplyToMessageID = strings.TrimSpace(req.ReplyToMessageID)
	req.IdempotencyKey = strings.TrimSpace(req.IdempotencyKey)
	if actor == "" {
		return DiscordDeliveryResult{}, ErrUnauthorized
	}
	if s == nil || s.Connectors == nil {
		return DiscordDeliveryResult{}, errors.New("mail: discord delivery dependencies unavailable")
	}
	if _, ok := discordUserIDFromConnectionID(req.ConnectionID); !ok ||
		!validDiscordSnowflake(req.ChannelID) ||
		(req.ReplyToMessageID != "" && !validDiscordSnowflake(req.ReplyToMessageID)) ||
		req.Content == "" || len([]byte(req.Content)) > MaxDiscordDeliveryContentBytes ||
		req.IdempotencyKey == "" || len([]byte(req.IdempotencyKey)) > 256 {
		return DiscordDeliveryResult{}, ErrInvalidInput
	}
	payload, err := json.Marshal(DiscordDeliveryMessage{
		ChannelID: req.ChannelID, Content: req.Content, ReplyToMessageID: req.ReplyToMessageID,
	})
	if err != nil {
		return DiscordDeliveryResult{}, err
	}
	out, err := s.Connectors.Push(ctx, actor, ConnectorPushRequest{
		Provider: DiscordProvider, ConnectionID: req.ConnectionID, Kind: DiscordDeliveryKind,
		Payload: string(payload), IdempotencyKey: req.IdempotencyKey,
	})
	if err != nil {
		return DiscordDeliveryResult{}, err
	}
	if !validDiscordSnowflake(out.ExternalID) {
		return DiscordDeliveryResult{}, ErrDiscordInvalidResult
	}
	return DiscordDeliveryResult{
		ConnectionID: out.ConnectionID,
		ChannelID:    req.ChannelID,
		MessageID:    out.ExternalID,
		AcceptedAt:   out.AcceptedAt.UTC(),
		Accepted:     out.Accepted,
	}, nil
}

func validateDiscordDeliveryMessage(msg DiscordDeliveryMessage) error {
	msg.ChannelID = strings.TrimSpace(msg.ChannelID)
	msg.Content = strings.TrimSpace(msg.Content)
	msg.ReplyToMessageID = strings.TrimSpace(msg.ReplyToMessageID)
	if !validDiscordSnowflake(msg.ChannelID) ||
		(msg.ReplyToMessageID != "" && !validDiscordSnowflake(msg.ReplyToMessageID)) ||
		msg.Content == "" || len([]byte(msg.Content)) > MaxDiscordDeliveryContentBytes {
		return ErrDiscordInvalidResult
	}
	return nil
}
