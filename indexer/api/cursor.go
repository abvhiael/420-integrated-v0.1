package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
)

var ErrInvalidCursor = errors.New("invalid snapshot cursor")

// Cursor pins pagination to a specific canonical snapshot so page boundaries remain deterministic
// even while the indexer continues ingesting newer blocks.
type Cursor struct {
	SnapshotHeight uint64 `json:"snapshotHeight"`
	SnapshotHash   string `json:"snapshotHash"`
	BeforeHeight   uint64 `json:"beforeHeight"`
	Limit          uint32 `json:"limit"`
}

func EncodeCursor(c Cursor) (string, error) {
	if c.SnapshotHash == "" || c.Limit == 0 { return "", ErrInvalidCursor }
	b, err := json.Marshal(c)
	if err != nil { return "", err }
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func DecodeCursor(v string) (Cursor, error) {
	b, err := base64.RawURLEncoding.DecodeString(v)
	if err != nil { return Cursor{}, ErrInvalidCursor }
	var c Cursor
	if err := json.Unmarshal(b, &c); err != nil { return Cursor{}, ErrInvalidCursor }
	if c.SnapshotHash == "" || c.Limit == 0 || c.BeforeHeight > c.SnapshotHeight { return Cursor{}, ErrInvalidCursor }
	return c, nil
}
