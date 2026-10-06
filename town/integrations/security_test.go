package integrations

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/town/model"
)

func TestSecuritySearchPoisoningFailsClosed(t *testing.T) {
	now := time.Unix(1700000000, 0).UTC()
	cases := []PublicDocument{
		{Kind: "post", ID: "post:1", CommunityID: "community:1", Title: "private", Visibility: model.VisibilityPrivate, Active: true, IndexedAt: now},
		{Kind: "post", ID: "post:1", CommunityID: "community:1", Title: "inactive", Visibility: model.VisibilityPublic, Active: false, IndexedAt: now},
		{Kind: "unknown", ID: "post:1", CommunityID: "community:1", Title: "wrong kind", Visibility: model.VisibilityPublic, Active: true, IndexedAt: now},
		{Kind: "post", ID: "post:1", CommunityID: "", Title: "missing community", Visibility: model.VisibilityPublic, Active: true, IndexedAt: now},
	}
	for i, doc := range cases {
		if _, err := SearchResult(doc); err == nil {
			t.Fatalf("poison case %d unexpectedly admitted: %+v", i, doc)
		}
	}
}

func TestSecurityMessengerEnvelopeContainsNoPlaintextSurface(t *testing.T) {
	typ := reflect.TypeOf(EncryptedEnvelope{})
	for _, forbidden := range []string{"Plaintext", "Body", "Subject", "MessageText", "Content"} {
		if _, ok := typ.FieldByName(forbidden); ok {
			t.Fatalf("encrypted envelope exposes plaintext-like field %s", forbidden)
		}
	}
}

func TestSecurityMessengerRejectsMalformedEnvelopeBeforeTransport(t *testing.T) {
	cases := []EncryptedEnvelope{
		{ConversationID: "conv-1", SenderID: "profile:alice", RecipientID: "profile:bob", Sequence: 1, EnvelopeSHA256: "bad", StorageRefSHA256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", Ciphertext: []byte{1}},
		{ConversationID: "conv-1", SenderID: "profile:alice", RecipientID: "profile:alice", Sequence: 1, EnvelopeSHA256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", StorageRefSHA256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", Ciphertext: []byte{1}},
		{ConversationID: "conv-1", SenderID: "profile:alice", RecipientID: "profile:bob", Sequence: 1, EnvelopeSHA256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", StorageRefSHA256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", Ciphertext: nil},
	}
	for i, e := range cases {
		tx := &transportFake{}
		a := MessengerAdapter{Authority: messengerAuthorityFake{active: true, participant: true}, Transport: tx}
		if _, err := a.Send(context.Background(), e); err == nil {
			t.Fatalf("malformed envelope case %d unexpectedly accepted", i)
		}
		if tx.got.ConversationID != "" {
			t.Fatalf("malformed envelope case %d reached transport", i)
		}
	}
}
