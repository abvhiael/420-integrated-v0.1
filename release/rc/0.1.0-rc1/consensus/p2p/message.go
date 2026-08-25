package p2p

import (
	"context"
	"encoding/json"
)

type Topic string

const (
	TopicBlock       Topic = "/420/consensus/1/block"
	TopicAttestation Topic = "/420/consensus/1/attestation"
	TopicQC          Topic = "/420/consensus/1/qc"
	TopicHeartbeat   Topic = "/420/consensus/1/heartbeat"
	TopicStatus      Topic = "/420/consensus/1/status"
	TopicRandomness  Topic = "/420/consensus/1/randomness"
	TopicEvidence    Topic = "/420/consensus/1/evidence"
	TopicRecovery    Topic = "/420/consensus/1/recovery"
)

type Envelope struct {
	Topic     Topic           `json:"topic"`
	From      uint64          `json:"from"`
	Slot      uint64          `json:"slot"`
	MessageID string          `json:"message_id"`
	Payload   json.RawMessage `json:"payload"`
}

type Handler func(context.Context, Envelope)

type Transport interface {
	Publish(context.Context, Envelope) error
	Subscribe(Topic, Handler)
	Start(context.Context) error
	Close() error
}
