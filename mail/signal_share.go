package mail

import (
	"context"
	"errors"
	"strings"
	"time"
)

type SignalShareMode string

const (
	SignalShareModeShare   SignalShareMode = "SHARE"
	SignalShareModeForward SignalShareMode = "FORWARD"

	MaxSignalDestinationRefBytes = 512
	MaxSignalShareNoteBytes      = 2048
)

var ErrSignalShareInvalidResult = errors.New("mail: invalid signal share result")

type SignalShareRequest struct {
	MessageID      string          `json:"message_id"`
	DestinationRef string          `json:"destination_ref"`
	Mode           SignalShareMode `json:"mode"`
	Note           string          `json:"note,omitempty"`
	IdempotencyKey string          `json:"idempotency_key"`
}

type SignalSharePayload struct {
	Actor           string          `json:"actor"`
	DestinationRef  string          `json:"destination_ref"`
	Mode            SignalShareMode `json:"mode"`
	SourceMessageID string          `json:"source_message_id"`
	Subject         string          `json:"subject,omitempty"`
	Content         string          `json:"content"`
	Note            string          `json:"note,omitempty"`
	IdempotencyKey  string          `json:"idempotency_key"`
}

type SignalShareReceipt struct {
	DeliveryID string    `json:"delivery_id"`
	AcceptedAt time.Time `json:"accepted_at"`
	Accepted   bool      `json:"accepted"`
}

type SignalShareAuthority interface {
	DeliverSignalShare(context.Context, SignalSharePayload) (SignalShareReceipt, error)
}

type SignalShareService struct {
	Mail      *Service
	Authority SignalShareAuthority
}

func NewSignalShareService(mail *Service, authority SignalShareAuthority) *SignalShareService {
	return &SignalShareService{Mail: mail, Authority: authority}
}

func (s *SignalShareService) Deliver(ctx context.Context, actor string, req SignalShareRequest) (SignalShareReceipt, error) {
	actor = strings.TrimSpace(actor)
	req.MessageID = strings.TrimSpace(req.MessageID)
	req.DestinationRef = strings.TrimSpace(req.DestinationRef)
	req.Note = strings.TrimSpace(req.Note)
	req.IdempotencyKey = strings.TrimSpace(req.IdempotencyKey)

	if actor == "" {
		return SignalShareReceipt{}, ErrUnauthorized
	}
	if req.MessageID == "" ||
		req.DestinationRef == "" || len([]byte(req.DestinationRef)) > MaxSignalDestinationRefBytes ||
		(req.Mode != SignalShareModeShare && req.Mode != SignalShareModeForward) ||
		len([]byte(req.Note)) > MaxSignalShareNoteBytes ||
		req.IdempotencyKey == "" || len([]byte(req.IdempotencyKey)) > 256 {
		return SignalShareReceipt{}, ErrInvalidInput
	}
	if s == nil || s.Mail == nil || s.Authority == nil {
		return SignalShareReceipt{}, errors.New("mail: signal share dependencies unavailable")
	}

	body, msg, err := s.Mail.ReadBody(ctx, actor, req.MessageID)
	if err != nil {
		return SignalShareReceipt{}, err
	}

	payload := SignalSharePayload{
		Actor:           actor,
		DestinationRef:  req.DestinationRef,
		Mode:            req.Mode,
		SourceMessageID: msg.ID,
		Content:         string(body),
		Note:            req.Note,
		IdempotencyKey:  req.IdempotencyKey,
	}
	if req.Mode == SignalShareModeForward {
		payload.Subject = msg.Subject
	}

	out, err := s.Authority.DeliverSignalShare(ctx, payload)
	if err != nil {
		return SignalShareReceipt{}, err
	}
	out.DeliveryID = strings.TrimSpace(out.DeliveryID)
	if !out.Accepted || out.DeliveryID == "" || out.AcceptedAt.IsZero() {
		return SignalShareReceipt{}, ErrSignalShareInvalidResult
	}
	return out, nil
}
