package authority

import (
	"context"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/media/node/ethadapter"
)

var ErrMalformedAuthorityState = errors.New("420media authority: malformed canonical state")

type EthereumIdentityReader struct {
	rpc      ethadapter.RPC
	identity string
	selector string
}

func NewEthereumIdentityReader(rpc ethadapter.RPC, identity, profilesSelector string) (*EthereumIdentityReader, error) {
	if rpc == nil || !validHex(identity, 20) || !validHex(profilesSelector, 4) {
		return nil, ErrInvalidActor
	}
	return &EthereumIdentityReader{rpc: rpc, identity: strings.ToLower(identity), selector: strings.ToLower(profilesSelector)}, nil
}

func (r *EthereumIdentityReader) Profile(ctx context.Context, profileID [32]byte) (IdentityProfile, error) {
	if profileID == ([32]byte{}) {
		return IdentityProfile{}, ErrInvalidActor
	}
	raw, err := r.call(ctx, r.identity, r.selector+hex.EncodeToString(profileID[:]))
	if err != nil {
		return IdentityProfile{}, err
	}
	words, err := decodeWords(raw, 7)
	if err != nil {
		return IdentityProfile{}, err
	}
	controller, err := decodeAddress(words[0])
	if err != nil {
		return IdentityProfile{}, err
	}
	active, err := decodeBool(words[6])
	if err != nil {
		return IdentityProfile{}, err
	}
	return IdentityProfile{Controller: controller, Active: active}, nil
}

func (r *EthereumIdentityReader) call(ctx context.Context, to, data string) (string, error) {
	var raw string
	if err := r.rpc.Call(ctx, "eth_call", []any{map[string]any{"to": to, "data": data}, "latest"}, &raw); err != nil {
		return "", err
	}
	return raw, nil
}

type EthereumRightsReader struct {
	rpc               ethadapter.RPC
	assets            string
	claims            string
	router            string
	subjectSelector   string
	claimSelector     string
	effectiveSelector string
	canUseSelector    string
}

func NewEthereumRightsReader(
	rpc ethadapter.RPC,
	assets, claims, router string,
	subjectSelector, claimSelector, effectiveSelector, canUseSelector string,
) (*EthereumRightsReader, error) {
	for _, addr := range []string{assets, claims, router} {
		if !validHex(addr, 20) {
			return nil, ErrInvalidRights
		}
	}
	for _, selector := range []string{subjectSelector, claimSelector, effectiveSelector, canUseSelector} {
		if !validHex(selector, 4) {
			return nil, ErrInvalidRights
		}
	}
	if rpc == nil {
		return nil, ErrInvalidRights
	}
	return &EthereumRightsReader{
		rpc:               rpc,
		assets:            strings.ToLower(assets),
		claims:            strings.ToLower(claims),
		router:            strings.ToLower(router),
		subjectSelector:   strings.ToLower(subjectSelector),
		claimSelector:     strings.ToLower(claimSelector),
		effectiveSelector: strings.ToLower(effectiveSelector),
		canUseSelector:    strings.ToLower(canUseSelector),
	}, nil
}

func (r *EthereumRightsReader) Subject(ctx context.Context, subjectID [32]byte) (RightsSubject, error) {
	if subjectID == ([32]byte{}) {
		return RightsSubject{}, ErrInvalidRights
	}
	raw, err := r.call(ctx, r.assets, r.subjectSelector+hex.EncodeToString(subjectID[:]))
	if err != nil {
		return RightsSubject{}, err
	}
	words, err := decodeWords(raw, 6)
	if err != nil {
		return RightsSubject{}, err
	}
	exists, err := decodeBool(words[5])
	if err != nil || !exists {
		return RightsSubject{}, ErrMalformedAuthorityState
	}
	controller, err := decodeAddress(words[1])
	if err != nil {
		return RightsSubject{}, err
	}
	return RightsSubject{Controller: controller, ProvenanceHash: words[3]}, nil
}

func (r *EthereumRightsReader) Right(ctx context.Context, rightID [32]byte) (Right, error) {
	if rightID == ([32]byte{}) {
		return Right{}, ErrInvalidRights
	}
	raw, err := r.call(ctx, r.claims, r.claimSelector+hex.EncodeToString(rightID[:]))
	if err != nil {
		return Right{}, err
	}
	words, err := decodeWords(raw, 10)
	if err != nil {
		return Right{}, err
	}
	exists, err := decodeBool(words[8])
	if err != nil || !exists {
		return Right{}, ErrMalformedAuthorityState
	}
	holder, err := decodeAddress(words[2])
	if err != nil {
		return Right{}, err
	}
	effectiveRaw, err := r.call(ctx, r.router, r.effectiveSelector+hex.EncodeToString(rightID[:]))
	if err != nil {
		return Right{}, err
	}
	effectiveWords, err := decodeWords(effectiveRaw, 1)
	if err != nil {
		return Right{}, err
	}
	effective, err := decodeBool(effectiveWords[0])
	if err != nil {
		return Right{}, err
	}
	return Right{SubjectID: words[0], Holder: holder, Effective: effective}, nil
}

func (r *EthereumRightsReader) CanUse(ctx context.Context, licenseID [32]byte, actor string, scopeHash [32]byte) (bool, error) {
	if licenseID == ([32]byte{}) || scopeHash == ([32]byte{}) {
		return false, ErrInvalidRights
	}
	wallet, ok := normalizeWallet(actor)
	if !ok {
		return false, ErrInvalidActor
	}
	addressBytes, _ := hex.DecodeString(wallet[2:])
	addressWord := make([]byte, 32)
	copy(addressWord[12:], addressBytes)
	data := r.canUseSelector +
		hex.EncodeToString(licenseID[:]) +
		hex.EncodeToString(addressWord) +
		hex.EncodeToString(scopeHash[:])
	raw, err := r.call(ctx, r.router, data)
	if err != nil {
		return false, err
	}
	words, err := decodeWords(raw, 1)
	if err != nil {
		return false, err
	}
	return decodeBool(words[0])
}

func (r *EthereumRightsReader) call(ctx context.Context, to, data string) (string, error) {
	var raw string
	if err := r.rpc.Call(ctx, "eth_call", []any{map[string]any{"to": to, "data": data}, "latest"}, &raw); err != nil {
		return "", err
	}
	return raw, nil
}

func validHex(v string, bytes int) bool {
	if !strings.HasPrefix(v, "0x") || len(v) != 2+bytes*2 {
		return false
	}
	_, err := hex.DecodeString(v[2:])
	return err == nil
}

func decodeWords(raw string, want int) ([][32]byte, error) {
	if !strings.HasPrefix(raw, "0x") || len(raw) != 2+want*64 {
		return nil, ErrMalformedAuthorityState
	}
	b, err := hex.DecodeString(raw[2:])
	if err != nil {
		return nil, ErrMalformedAuthorityState
	}
	words := make([][32]byte, want)
	for i := range words {
		copy(words[i][:], b[i*32:(i+1)*32])
	}
	return words, nil
}

func decodeAddress(word [32]byte) (string, error) {
	for _, b := range word[:12] {
		if b != 0 {
			return "", ErrMalformedAuthorityState
		}
	}
	v := "0x" + hex.EncodeToString(word[12:])
	if _, ok := normalizeWallet(v); !ok {
		return "", ErrMalformedAuthorityState
	}
	return v, nil
}

func decodeBool(word [32]byte) (bool, error) {
	for _, b := range word[:31] {
		if b != 0 {
			return false, ErrMalformedAuthorityState
		}
	}
	if word[31] > 1 {
		return false, ErrMalformedAuthorityState
	}
	return word[31] == 1, nil
}

var _ IdentityReader = (*EthereumIdentityReader)(nil)
var _ RightsReader = (*EthereumRightsReader)(nil)
