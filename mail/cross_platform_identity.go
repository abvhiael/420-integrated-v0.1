package mail

import (
	"context"
	"sort"
	"strings"
	"time"
)

type VerifiedIdentityAssurance string

const (
	VerifiedIdentityProviderAuthority VerifiedIdentityAssurance = "PROVIDER_AUTHORITY_VERIFIED"
	VerifiedIdentityWallet            VerifiedIdentityAssurance = "WALLET_VERIFIED"
)

type VerifiedPlatformIdentity struct {
	Provider     string                    `json:"provider"`
	ConnectionID string                    `json:"connection_id"`
	ExternalID   string                    `json:"external_id"`
	Assurance    VerifiedIdentityAssurance `json:"assurance"`
	VerifiedAt   time.Time                 `json:"verified_at"`
	ChainID      uint64                    `json:"chain_id,omitempty"`
	Account      string                    `json:"account,omitempty"`
}

type CrossPlatformVerifiedIdentity struct {
	Identity string                     `json:"identity"`
	Accounts []VerifiedPlatformIdentity `json:"accounts"`
}

func (s *Service) CrossPlatformIdentity(ctx context.Context, actor string) (CrossPlatformVerifiedIdentity, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return CrossPlatformVerifiedIdentity{}, ErrUnauthorized
	}
	if s == nil || s.Store == nil {
		return CrossPlatformVerifiedIdentity{}, ErrInvalidInput
	}

	records := map[string]VerifiedPlatformIdentity{}
	if err := s.Store.View(ctx, func(data *storeData) error {
		for _, state := range data.DiscordSync {
			if state.Owner != actor {
				continue
			}
			userID, ok := discordUserIDFromConnectionID(state.ConnectionID)
			if !ok {
				continue
			}
			key := DiscordProvider + "\x00" + state.ConnectionID
			records[key] = VerifiedPlatformIdentity{
				Provider: DiscordProvider, ConnectionID: state.ConnectionID, ExternalID: userID,
				Assurance: VerifiedIdentityProviderAuthority, VerifiedAt: state.LastSyncAt.UTC(),
			}
		}
		for _, state := range data.TelegramSync {
			if state.Owner != actor {
				continue
			}
			userID, ok := telegramUserIDFromConnectionID(state.ConnectionID)
			if !ok {
				continue
			}
			key := TelegramProvider + "\x00" + state.ConnectionID
			records[key] = VerifiedPlatformIdentity{
				Provider: TelegramProvider, ConnectionID: state.ConnectionID, ExternalID: userID,
				Assurance: VerifiedIdentityProviderAuthority, VerifiedAt: state.LastSyncAt.UTC(),
			}
		}
		for _, state := range data.DiscordWalletVerifications {
			if state.Owner != actor || !state.Verified || state.VerifiedAt.IsZero() {
				continue
			}
			userID, ok := discordUserIDFromConnectionID(state.ConnectionID)
			if !ok || userID != state.DiscordUserID {
				continue
			}
			key := DiscordProvider + "\x00" + state.ConnectionID
			records[key] = VerifiedPlatformIdentity{
				Provider: DiscordProvider, ConnectionID: state.ConnectionID, ExternalID: state.DiscordUserID,
				Assurance: VerifiedIdentityWallet, VerifiedAt: state.VerifiedAt.UTC(),
				ChainID: state.ChainID, Account: state.Account,
			}
		}
		return nil
	}); err != nil {
		return CrossPlatformVerifiedIdentity{}, err
	}

	accounts := make([]VerifiedPlatformIdentity, 0, len(records))
	for _, record := range records {
		accounts = append(accounts, record)
	}
	sort.Slice(accounts, func(i, j int) bool {
		if accounts[i].Provider == accounts[j].Provider {
			return accounts[i].ConnectionID < accounts[j].ConnectionID
		}
		return accounts[i].Provider < accounts[j].Provider
	})
	return CrossPlatformVerifiedIdentity{Identity: actor, Accounts: accounts}, nil
}
