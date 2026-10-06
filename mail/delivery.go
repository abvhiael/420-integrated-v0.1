package mail

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"
)

type DeliveryStatus string

const (
	DeliveryQueued    DeliveryStatus = "QUEUED"
	DeliverySending   DeliveryStatus = "SENDING"
	DeliveryRetrying  DeliveryStatus = "RETRYING"
	DeliveryDelivered DeliveryStatus = "DELIVERED"
	DeliveryFailed    DeliveryStatus = "FAILED"
	DeliveryCancelled DeliveryStatus = "CANCELLED"

	MaxDeliveryAttempts     = 3
	MaxOutboxItemsPerSender = 1000
)

var (
	ErrDeliveryConflict = errors.New("mail: delivery state conflict")
	ErrOutboxFull       = errors.New("mail: outbox capacity exceeded")
)

type Delivery struct {
	ID                 string         `json:"id"`
	Owner              string         `json:"owner"`
	Recipient          string         `json:"recipient"`
	Subject            string         `json:"subject"`
	Source             string         `json:"source"`
	IdempotencyKey     string         `json:"idempotency_key"`
	ConversationID     string         `json:"conversation_id,omitempty"`
	ReplyTo            string         `json:"reply_to,omitempty"`
	StagingBodyRef     string         `json:"staging_body_ref,omitempty"`
	StagingBodyDigest  string         `json:"staging_body_digest,omitempty"`
	RequestFingerprint string         `json:"-"`
	Status             DeliveryStatus `json:"status"`
	Attempts           uint32         `json:"attempts"`
	LastError          string         `json:"last_error,omitempty"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	LastAttemptAt      *time.Time     `json:"last_attempt_at,omitempty"`
	DeliveredAt        *time.Time     `json:"delivered_at,omitempty"`
	CancelledAt        *time.Time     `json:"cancelled_at,omitempty"`
	Version            uint32         `json:"version"`
}

func (s *Service) QueueDelivery(ctx context.Context, actor string, req SendRequest) (Delivery, error) {
	actor = strings.TrimSpace(actor)
	req.Sender = strings.TrimSpace(req.Sender)
	req.Recipient = strings.TrimSpace(req.Recipient)
	req.Subject = strings.TrimSpace(req.Subject)
	req.Source = strings.TrimSpace(req.Source)
	req.IdempotencyKey = strings.TrimSpace(req.IdempotencyKey)
	req.ConversationID = strings.TrimSpace(req.ConversationID)
	req.ReplyTo = strings.TrimSpace(req.ReplyTo)
	if actor == "" || req.Sender == "" || actor != req.Sender {
		return Delivery{}, ErrUnauthorized
	}
	if req.Recipient == "" || req.IdempotencyKey == "" || req.Subject == "" || req.Body == "" || req.Source != ServiceID || len([]byte(req.Subject)) > MaxSubjectBytes || len([]byte(req.Body)) > MaxBodyBytes {
		return Delivery{}, ErrInvalidInput
	}
	if s.Identities == nil || s.Blobs == nil || s.Store == nil {
		return Delivery{}, errors.New("mail: service dependencies unavailable")
	}
	if err := s.Identities.ResolveIdentity(ctx, req.Sender); err != nil {
		return Delivery{}, err
	}
	if err := s.Identities.ResolveIdentity(ctx, req.Recipient); err != nil {
		return Delivery{}, err
	}

	id := deterministicMessageID(req.Sender, req.Recipient, req.IdempotencyKey)
	key := deliveryKey(req.Sender, id)
	fp := requestFingerprint(req)
	var existing Delivery
	var found bool
	if err := s.Store.View(ctx, func(data *storeData) error {
		existing, found = data.Deliveries[key]
		if found {
			return nil
		}
		if deliveryActiveCount(data, req.Sender) >= MaxOutboxItemsPerSender {
			return ErrOutboxFull
		}
		if existingID, ok := data.ByIdem[req.Sender+"\x00"+req.IdempotencyKey]; ok {
			if msg := data.Messages[existingID]; msg.Fingerprint != fp {
				return ErrIdempotencyConflict
			}
			return ErrDeliveryConflict
		}
		return nil
	}); err != nil {
		return Delivery{}, err
	}
	if found {
		if existing.RequestFingerprint != fp {
			return Delivery{}, ErrIdempotencyConflict
		}
		return existing, nil
	}

	ref, digest, err := s.Blobs.PutPrivate(ctx, actor, []byte(req.Body))
	if err != nil {
		return Delivery{}, err
	}
	if ref == "" || digest == "" {
		return Delivery{}, errors.New("mail: storage returned incomplete outbox body evidence")
	}
	now := s.Now().UTC()
	delivery := Delivery{
		ID: id, Owner: actor, Recipient: req.Recipient, Subject: req.Subject, Source: req.Source,
		IdempotencyKey: req.IdempotencyKey, ConversationID: req.ConversationID, ReplyTo: req.ReplyTo,
		StagingBodyRef: ref, StagingBodyDigest: digest, RequestFingerprint: fp,
		Status: DeliveryQueued, CreatedAt: now, UpdatedAt: now, Version: 1,
	}
	msg := Message{
		ID: id, Sender: actor, Recipient: req.Recipient, Subject: req.Subject,
		BodyRef: ref, BodyDigest: digest, CreatedAt: now, UpdatedAt: now,
		Status: string(DeliveryQueued), Visibility: "PRIVATE", Source: req.Source, Version: 1,
	}
	readAt := now
	state := MailboxState{MessageID: id, Owner: actor, Folder: FolderOutbox, ReadAt: &readAt, UpdatedAt: now, Version: 1}

	result := delivery
	if err := s.Store.Update(ctx, func(data *storeData) error {
		if current, ok := data.Deliveries[key]; ok {
			if current.RequestFingerprint != fp {
				return ErrIdempotencyConflict
			}
			result = current
			return nil
		}
		if deliveryActiveCount(data, actor) >= MaxOutboxItemsPerSender {
			return ErrOutboxFull
		}
		data.Deliveries[key] = delivery
		data.Messages[id] = msg
		data.Mailbox[mailboxKey(actor, id)] = state
		result = delivery
		return nil
	}); err != nil {
		return Delivery{}, err
	}
	return result, nil
}

func (s *Service) GetDelivery(ctx context.Context, actor, id string) (Delivery, error) {
	actor = strings.TrimSpace(actor)
	id = strings.TrimSpace(id)
	if actor == "" {
		return Delivery{}, ErrUnauthorized
	}
	var delivery Delivery
	var ok bool
	if err := s.Store.View(ctx, func(data *storeData) error {
		delivery, ok = data.Deliveries[deliveryKey(actor, id)]
		return nil
	}); err != nil {
		return Delivery{}, err
	}
	if !ok {
		return Delivery{}, ErrNotFound
	}
	return delivery, nil
}

func (s *Service) ListOutbox(ctx context.Context, actor string) ([]Delivery, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return nil, ErrUnauthorized
	}
	items := []Delivery{}
	err := s.Store.View(ctx, func(data *storeData) error {
		for _, delivery := range data.Deliveries {
			if delivery.Owner == actor {
				items = append(items, delivery)
			}
		}
		return nil
	})
	sort.Slice(items, func(i, j int) bool {
		if items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].ID < items[j].ID
		}
		return items[i].CreatedAt.Before(items[j].CreatedAt)
	})
	return items, err
}

func (s *Service) ProcessDelivery(ctx context.Context, actor, id string) (Delivery, error) {
	actor = strings.TrimSpace(actor)
	id = strings.TrimSpace(id)
	if actor == "" {
		return Delivery{}, ErrUnauthorized
	}
	var delivery Delivery
	if err := s.Store.Update(ctx, func(data *storeData) error {
		key := deliveryKey(actor, id)
		current, ok := data.Deliveries[key]
		if !ok {
			return ErrNotFound
		}
		switch current.Status {
		case DeliveryQueued, DeliveryRetrying:
			if current.Attempts >= MaxDeliveryAttempts {
				return ErrDeliveryConflict
			}
			current.Attempts++
			now := s.Now().UTC()
			current.Status = DeliverySending
			current.LastAttemptAt = &now
			current.UpdatedAt = now
			current.Version++
			current.LastError = ""
			data.Deliveries[key] = current
			if msg, ok := data.Messages[id]; ok {
				msg.Status = string(DeliverySending)
				msg.UpdatedAt = now
				msg.Version++
				data.Messages[id] = msg
			}
			delivery = current
		case DeliverySending:
			delivery = current
		default:
			return ErrDeliveryConflict
		}
		return nil
	}); err != nil {
		return Delivery{}, err
	}

	body, err := s.Blobs.GetPrivate(ctx, actor, delivery.StagingBodyRef)
	if err != nil {
		return s.recordDeliveryFailure(ctx, delivery, err)
	}
	req := SendRequest{
		IdempotencyKey: delivery.IdempotencyKey,
		Sender:         actor,
		Recipient:      delivery.Recipient,
		Subject:        delivery.Subject,
		Body:           string(body),
		ConversationID: delivery.ConversationID,
		ReplyTo:        delivery.ReplyTo,
		Source:         delivery.Source,
	}
	if _, err := s.Send(ctx, actor, req); err != nil {
		return s.recordDeliveryFailure(ctx, delivery, err)
	}

	var result Delivery
	if err := s.Store.Update(ctx, func(data *storeData) error {
		key := deliveryKey(actor, id)
		current, ok := data.Deliveries[key]
		if !ok {
			return ErrNotFound
		}
		if current.Status != DeliverySending {
			if current.Status == DeliveryDelivered {
				result = current
				return nil
			}
			return ErrDeliveryConflict
		}
		now := s.Now().UTC()
		current.Status = DeliveryDelivered
		current.DeliveredAt = &now
		current.UpdatedAt = now
		current.LastError = ""
		current.Version++
		data.Deliveries[key] = current
		result = current
		return nil
	}); err != nil {
		return Delivery{}, err
	}
	if deleter, ok := s.Blobs.(PrivateBlobDeleteStore); ok {
		_ = deleter.DeletePrivate(ctx, actor, delivery.StagingBodyRef)
	}
	return result, nil
}

func (s *Service) RetryDelivery(ctx context.Context, actor, id string) (Delivery, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return Delivery{}, ErrUnauthorized
	}
	var result Delivery
	if err := s.Store.Update(ctx, func(data *storeData) error {
		key := deliveryKey(actor, strings.TrimSpace(id))
		current, ok := data.Deliveries[key]
		if !ok {
			return ErrNotFound
		}
		if current.Status != DeliveryFailed || current.Attempts >= MaxDeliveryAttempts {
			return ErrDeliveryConflict
		}
		now := s.Now().UTC()
		current.Status = DeliveryRetrying
		current.UpdatedAt = now
		current.LastError = ""
		current.Version++
		data.Deliveries[key] = current
		if msg, ok := data.Messages[current.ID]; ok {
			msg.Status = string(DeliveryRetrying)
			msg.UpdatedAt = now
			msg.Version++
			data.Messages[current.ID] = msg
		}
		result = current
		return nil
	}); err != nil {
		return Delivery{}, err
	}
	return result, nil
}

func (s *Service) CancelDelivery(ctx context.Context, actor, id string) (Delivery, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return Delivery{}, ErrUnauthorized
	}
	var result Delivery
	if err := s.Store.Update(ctx, func(data *storeData) error {
		key := deliveryKey(actor, strings.TrimSpace(id))
		current, ok := data.Deliveries[key]
		if !ok {
			return ErrNotFound
		}
		switch current.Status {
		case DeliveryQueued, DeliveryRetrying, DeliveryFailed:
		default:
			return ErrDeliveryConflict
		}
		now := s.Now().UTC()
		current.Status = DeliveryCancelled
		current.CancelledAt = &now
		current.UpdatedAt = now
		current.Version++
		data.Deliveries[key] = current
		if msg, ok := data.Messages[current.ID]; ok {
			msg.Status = string(DeliveryCancelled)
			msg.UpdatedAt = now
			msg.Version++
			data.Messages[current.ID] = msg
		}
		result = current
		return nil
	}); err != nil {
		return Delivery{}, err
	}
	if deleter, ok := s.Blobs.(PrivateBlobDeleteStore); ok {
		_ = deleter.DeletePrivate(ctx, actor, result.StagingBodyRef)
	}
	return result, nil
}

func (s *Service) recordDeliveryFailure(ctx context.Context, delivery Delivery, cause error) (Delivery, error) {
	var result Delivery
	err := s.Store.Update(ctx, func(data *storeData) error {
		key := deliveryKey(delivery.Owner, delivery.ID)
		current, ok := data.Deliveries[key]
		if !ok {
			return ErrNotFound
		}
		if current.Status != DeliverySending {
			return ErrDeliveryConflict
		}
		now := s.Now().UTC()
		if retryableDeliveryError(cause) && current.Attempts < MaxDeliveryAttempts {
			current.Status = DeliveryRetrying
		} else {
			current.Status = DeliveryFailed
		}
		current.LastError = cause.Error()
		current.UpdatedAt = now
		current.Version++
		data.Deliveries[key] = current
		if msg, ok := data.Messages[current.ID]; ok {
			msg.Status = string(current.Status)
			msg.UpdatedAt = now
			msg.Version++
			data.Messages[current.ID] = msg
		}
		result = current
		return nil
	})
	if err != nil {
		return Delivery{}, err
	}
	return result, cause
}

func retryableDeliveryError(err error) bool {
	return !(errors.Is(err, ErrUnauthorized) ||
		errors.Is(err, ErrInvalidInput) ||
		errors.Is(err, ErrIdempotencyConflict) ||
		errors.Is(err, ErrTrustRejected) ||
		errors.Is(err, ErrNotFound))
}

func deliveryKey(owner, id string) string {
	return owner + "\x00" + id
}

func deliveryActiveCount(data *storeData, owner string) int {
	n := 0
	for _, delivery := range data.Deliveries {
		if delivery.Owner != owner {
			continue
		}
		switch delivery.Status {
		case DeliveryQueued, DeliverySending, DeliveryRetrying, DeliveryFailed:
			n++
		}
	}
	return n
}

func validDeliveryStatus(status DeliveryStatus) bool {
	switch status {
	case DeliveryQueued, DeliverySending, DeliveryRetrying, DeliveryDelivered, DeliveryFailed, DeliveryCancelled:
		return true
	default:
		return false
	}
}

func validateDeliveryData(data *storeData) error {
	for key, delivery := range data.Deliveries {
		if key != deliveryKey(delivery.Owner, delivery.ID) || delivery.Owner == "" || delivery.ID == "" || delivery.Recipient == "" {
			return errors.New("invalid delivery identity")
		}
		if !validDeliveryStatus(delivery.Status) || delivery.Version == 0 || delivery.Attempts > MaxDeliveryAttempts {
			return errors.New("invalid delivery lifecycle")
		}
		if delivery.Source != ServiceID || delivery.IdempotencyKey == "" || delivery.RequestFingerprint == "" {
			return errors.New("invalid delivery request metadata")
		}
		if delivery.Status != DeliveryDelivered && delivery.StagingBodyRef == "" {
			return errors.New("delivery missing staging body")
		}
		msg, ok := data.Messages[delivery.ID]
		if !ok || msg.Sender != delivery.Owner || msg.Recipient != delivery.Recipient {
			return errors.New("delivery message linkage invalid")
		}
	}
	return nil
}
