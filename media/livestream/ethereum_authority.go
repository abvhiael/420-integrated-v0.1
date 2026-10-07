package livestream

import (
	"context"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/media/node/ethadapter"
)

var ErrMalformedStreamState = errors.New("420media livestream: malformed canonical stream state")

type EthereumStreamAuthority struct {
	rpc      ethadapter.RPC
	registry string
	selector string
}

func NewEthereumStreamAuthority(rpc ethadapter.RPC, registry, streamsSelector string) (*EthereumStreamAuthority, error) {
	if rpc == nil || !validHex(registry, 20) || !validHex(streamsSelector, 4) {
		return nil, ErrInvalidRequest
	}
	return &EthereumStreamAuthority{
		rpc: rpc, registry: strings.ToLower(registry), selector: strings.ToLower(streamsSelector),
	}, nil
}

func (a *EthereumStreamAuthority) Snapshot(ctx context.Context, streamID [32]byte) (StreamSnapshot, error) {
	if streamID == ([32]byte{}) {
		return StreamSnapshot{}, ErrInvalidRequest
	}
	data := a.selector + hex.EncodeToString(streamID[:])
	var raw string
	if err := a.rpc.Call(ctx, "eth_call", []any{
		map[string]any{"to": a.registry, "data": data},
		"latest",
	}, &raw); err != nil {
		return StreamSnapshot{}, err
	}
	words, err := streamWords(raw)
	if err != nil || len(words) != 8 {
		return StreamSnapshot{}, ErrMalformedStreamState
	}
	exists, err := streamBool(words[7])
	if err != nil || !exists {
		return StreamSnapshot{}, ErrMalformedStreamState
	}
	state, err := streamUint(words[6])
	if err != nil || state < 1 || state > 4 {
		return StreamSnapshot{}, ErrMalformedStreamState
	}
	controller := "0x" + hex.EncodeToString(words[0][12:])
	if controller == "0x0000000000000000000000000000000000000000" {
		return StreamSnapshot{}, ErrMalformedStreamState
	}
	return StreamSnapshot{Controller: controller, Retired: state == 4}, nil
}

func validHex(v string, bytes int) bool {
	if !strings.HasPrefix(v, "0x") || len(v) != 2+bytes*2 {
		return false
	}
	_, err := hex.DecodeString(v[2:])
	return err == nil
}

func streamWords(raw string) ([][32]byte, error) {
	if !strings.HasPrefix(raw, "0x") || (len(raw)-2)%64 != 0 {
		return nil, ErrMalformedStreamState
	}
	b, err := hex.DecodeString(raw[2:])
	if err != nil {
		return nil, ErrMalformedStreamState
	}
	words := make([][32]byte, len(b)/32)
	for i := range words {
		copy(words[i][:], b[i*32:(i+1)*32])
	}
	return words, nil
}

func streamUint(word [32]byte) (uint64, error) {
	for _, b := range word[:24] {
		if b != 0 {
			return 0, ErrMalformedStreamState
		}
	}
	var n uint64
	for _, b := range word[24:] {
		n = n<<8 | uint64(b)
	}
	return n, nil
}

func streamBool(word [32]byte) (bool, error) {
	n, err := streamUint(word)
	if err != nil || n > 1 {
		return false, ErrMalformedStreamState
	}
	return n == 1, nil
}

var _ StreamAuthority = (*EthereumStreamAuthority)(nil)
