package mail

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

const (
	TelegramDeliveryKind            = "TELEGRAM_DELIVERY"
	MaxTelegramDeliveryContentBytes = 4096
)

var ErrTelegramDeliveryConflict = errors.New("mail: telegram delivery conflict")

type TelegramDeliveryMessage struct {
	ChatID           string `json:"chat_id"`
	Content          string `json:"content"`
	ReplyToMessageID string `json:"reply_to_message_id,omitempty"`
}

type TelegramDeliveryReceipt struct {
	MessageID  string    `json:"message_id"`
	ChatID     string    `json:"chat_id"`
	AcceptedAt time.Time `json:"accepted_at"`
}

type TelegramDeliveryAuthority interface {
	DeliverTelegram(context.Context, string, string, string, TelegramDeliveryMessage) (TelegramDeliveryReceipt, error)
}

type TelegramDeliveryRequest struct {
	ConnectionID     string `json:"connection_id"`
	ChatID           string `json:"chat_id"`
	Content          string `json:"content"`
	ReplyToMessageID string `json:"reply_to_message_id,omitempty"`
	IdempotencyKey   string `json:"idempotency_key"`
}

type TelegramDeliveryResult struct {
	ConnectionID string    `json:"connection_id"`
	ChatID       string    `json:"chat_id"`
	MessageID    string    `json:"message_id"`
	AcceptedAt   time.Time `json:"accepted_at"`
	Accepted     bool      `json:"accepted"`
}

type TelegramDeliveryService struct {
	Connectors *ConnectorService
}

func NewTelegramDeliveryService(connectors *ConnectorService) *TelegramDeliveryService {
	return &TelegramDeliveryService{Connectors: connectors}
}

func (s *TelegramDeliveryService) Deliver(ctx context.Context, actor string, req TelegramDeliveryRequest) (TelegramDeliveryResult, error) {
	actor = strings.TrimSpace(actor)
	req.ConnectionID = strings.TrimSpace(req.ConnectionID)
	req.ChatID = strings.TrimSpace(req.ChatID)
	req.Content = strings.TrimSpace(req.Content)
	req.ReplyToMessageID = strings.TrimSpace(req.ReplyToMessageID)
	req.IdempotencyKey = strings.TrimSpace(req.IdempotencyKey)

	if actor == "" {
		return TelegramDeliveryResult{}, ErrUnauthorized
	}
	if s == nil || s.Connectors == nil {
		return TelegramDeliveryResult{}, errors.New("mail: telegram delivery dependencies unavailable")
	}
	if _, ok := telegramUserIDFromConnectionID(req.ConnectionID); !ok ||
		!validTelegramChatID(req.ChatID) ||
		(req.ReplyToMessageID != "" && !validTelegramPositiveID(req.ReplyToMessageID)) ||
		req.Content == "" || len([]byte(req.Content)) > MaxTelegramDeliveryContentBytes ||
		req.IdempotencyKey == "" || len([]byte(req.IdempotencyKey)) > 256 {
		return TelegramDeliveryResult{}, ErrInvalidInput
	}

	payload, err := json.Marshal(TelegramDeliveryMessage{
		ChatID: req.ChatID, Content: req.Content, ReplyToMessageID: req.ReplyToMessageID,
	})
	if err != nil {
		return TelegramDeliveryResult{}, err
	}

	out, err := s.Connectors.Push(ctx, actor, ConnectorPushRequest{
		Provider: TelegramProvider, ConnectionID: req.ConnectionID, Kind: TelegramDeliveryKind,
		Payload: string(payload), IdempotencyKey: req.IdempotencyKey,
	})
	if err != nil {
		return TelegramDeliveryResult{}, err
	}
	if out.Provider != TelegramProvider ||
		out.ConnectionID != req.ConnectionID ||
		!validTelegramPositiveID(out.ExternalID) ||
		out.AcceptedAt.IsZero() ||
		!out.Accepted {
		return TelegramDeliveryResult{}, ErrTelegramInvalidResult
	}

	return TelegramDeliveryResult{
		ConnectionID: out.ConnectionID,
		ChatID:       req.ChatID,
		MessageID:    out.ExternalID,
		AcceptedAt:   out.AcceptedAt.UTC(),
		Accepted:     true,
	}, nil
}

func validateTelegramDeliveryMessage(msg TelegramDeliveryMessage) error {
	msg.ChatID = strings.TrimSpace(msg.ChatID)
	msg.Content = strings.TrimSpace(msg.Content)
	msg.ReplyToMessageID = strings.TrimSpace(msg.ReplyToMessageID)
	if !validTelegramChatID(msg.ChatID) ||
		(msg.ReplyToMessageID != "" && !validTelegramPositiveID(msg.ReplyToMessageID)) ||
		msg.Content == "" || len([]byte(msg.Content)) > MaxTelegramDeliveryContentBytes {
		return ErrTelegramInvalidResult
	}
	return nil
}
