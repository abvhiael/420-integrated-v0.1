package mail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

const SignalNotificationKind = "NEW_MAIL"

var ErrSignalNotificationInvalidResult = errors.New("mail: invalid signal notification result")

type SignalNotificationRequest struct {
	EventID           string `json:"event_id"`
	RecipientIdentity string `json:"recipient_identity"`
	Kind              string `json:"kind"`
	Title             string `json:"title"`
	IdempotencyKey    string `json:"idempotency_key"`
}

type SignalNotificationReceipt struct {
	DeliveryID string    `json:"delivery_id,omitempty"`
	AcceptedAt time.Time `json:"accepted_at,omitempty"`
	Accepted   bool      `json:"accepted"`
	Suppressed bool      `json:"suppressed"`
}

type SignalNotificationAuthority interface {
	DeliverSignalNotification(context.Context, SignalNotificationRequest) (SignalNotificationReceipt, error)
}

type SignalNotificationService struct {
	Authority SignalNotificationAuthority
}

func NewSignalNotificationService(authority SignalNotificationAuthority) *SignalNotificationService {
	return &SignalNotificationService{Authority: authority}
}

func (s *SignalNotificationService) Notify(ctx context.Context, n Notification) (SignalNotificationReceipt, error) {
	n.MessageID = strings.TrimSpace(n.MessageID)
	n.Recipient = strings.TrimSpace(n.Recipient)
	if n.MessageID == "" || n.Recipient == "" {
		return SignalNotificationReceipt{}, ErrInvalidInput
	}
	if s == nil || s.Authority == nil {
		return SignalNotificationReceipt{}, errors.New("mail: signal notification authority unavailable")
	}
	req := SignalNotificationRequest{
		EventID:           "mail:" + n.MessageID,
		RecipientIdentity: n.Recipient,
		Kind:              SignalNotificationKind,
		Title:             "New 420Mail message",
		IdempotencyKey:    signalNotificationIdempotencyKey(n.Recipient, n.MessageID),
	}
	out, err := s.Authority.DeliverSignalNotification(ctx, req)
	if err != nil {
		return SignalNotificationReceipt{}, err
	}
	out.DeliveryID = strings.TrimSpace(out.DeliveryID)
	if out.Accepted == out.Suppressed {
		return SignalNotificationReceipt{}, ErrSignalNotificationInvalidResult
	}
	if out.Accepted {
		if out.DeliveryID == "" || out.AcceptedAt.IsZero() {
			return SignalNotificationReceipt{}, ErrSignalNotificationInvalidResult
		}
	} else {
		if out.DeliveryID != "" || !out.AcceptedAt.IsZero() {
			return SignalNotificationReceipt{}, ErrSignalNotificationInvalidResult
		}
	}
	return out, nil
}

type SignalNotificationSink struct {
	Primary NotificationSink
	Signal  *SignalNotificationService
	Router  *UnifiedNotificationRouter
}

func NewSignalNotificationSink(primary NotificationSink, signal *SignalNotificationService) *SignalNotificationSink {
	return &SignalNotificationSink{
		Primary: primary,
		Signal:  signal,
		Router:  NewUnifiedNotificationRouter(primary, signal),
	}
}

func (s *SignalNotificationSink) NotifyMail(ctx context.Context, n Notification) error {
	if s == nil {
		return nil
	}
	if s.Router != nil {
		return s.Router.NotifyMail(ctx, n)
	}
	return NewUnifiedNotificationRouter(s.Primary, s.Signal).NotifyMail(ctx, n)
}

func signalNotificationIdempotencyKey(recipient, messageID string) string {
	sum := sha256.Sum256([]byte("420/MAIL/SIGNAL/NOTIFICATION/V1\x00" + strings.TrimSpace(recipient) + "\x00" + strings.TrimSpace(messageID)))
	return "signal-mail-" + hex.EncodeToString(sum[:])
}
