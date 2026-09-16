package hardening

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/420integrated/420-integrated/verify/submission"
)

const Phase = "VERIFY-9"

const (
	MaxRequestBytes     int64 = 8 << 20
	MaxSourceFiles            = 256
	MaxSourceFileBytes        = 1 << 20
	MaxSourceBytesTotal       = 6 << 20
	MaxStandardJSONBytes      = 7 << 20
	MaxFlattenedBytes         = 4 << 20
)

var forbiddenKeys = map[string]struct{}{
	"privatekey": {}, "private_key": {}, "mnemonic": {}, "seedphrase": {}, "seed_phrase": {},
	"walletsecret": {}, "wallet_secret": {}, "signingkey": {}, "signing_key": {}, "keystorepassword": {},
}

func ValidateRawJSON(raw []byte) error {
	if len(raw) == 0 { return errors.New("request body is required") }
	if int64(len(raw)) > MaxRequestBytes { return errors.New("request body exceeds limit") }
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var value any
	if err := dec.Decode(&value); err != nil { return fmt.Errorf("invalid JSON: %w", err) }
	if dec.More() { return errors.New("multiple JSON values are not allowed") }
	var trailing any
	if err := dec.Decode(&trailing); err == nil { return errors.New("trailing JSON value is not allowed") }
	return rejectSecrets(value)
}

func ValidateSubmission(s submission.Submission) error {
	if len(s.StandardJSON) > MaxStandardJSONBytes { return errors.New("standard JSON input exceeds limit") }
	if len(s.Flattened) > MaxFlattenedBytes { return errors.New("flattened source exceeds limit") }
	if len(s.Sources) > MaxSourceFiles { return errors.New("source file count exceeds limit") }
	total := 0
	for _, source := range s.Sources {
		if len(source.Content) > MaxSourceFileBytes { return fmt.Errorf("source file %q exceeds limit", source.Path) }
		total += len(source.Content)
		if total > MaxSourceBytesTotal { return errors.New("total source bytes exceed limit") }
	}
	return nil
}

func rejectSecrets(value any) error {
	switch v := value.(type) {
	case map[string]any:
		for key, child := range v {
			norm := strings.ToLower(strings.TrimSpace(key))
			if _, blocked := forbiddenKeys[norm]; blocked { return fmt.Errorf("secret-bearing field %q is not accepted", key) }
			if err := rejectSecrets(child); err != nil { return err }
		}
	case []any:
		for _, child := range v { if err := rejectSecrets(child); err != nil { return err } }
	}
	return nil
}
