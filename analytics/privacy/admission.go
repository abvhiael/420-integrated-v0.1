package privacy

import (
	"errors"
	"fmt"
	"sort"
	"strings"
)

type Classification string

const (
	Public                   Classification = "public"
	PrivateMessenger         Classification = "private_messenger"
	PrivateCommons           Classification = "private_commons"
	PrivateIdentity          Classification = "private_identity"
	EncryptedResourcePayload Classification = "encrypted_resource_payload"
	RawAttentionTelemetry    Classification = "raw_attention_telemetry"
)

var excluded = map[Classification]struct{}{
	PrivateMessenger:         {},
	PrivateCommons:           {},
	PrivateIdentity:          {},
	EncryptedResourcePayload: {},
	RawAttentionTelemetry:    {},
}

func Normalize(value string) Classification {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return Public
	}
	return Classification(value)
}

func Admit(value string) error {
	class := Normalize(value)
	if class == Public {
		return nil
	}
	if _, blocked := excluded[class]; blocked {
		return fmt.Errorf("analytics privacy admission rejected protected class %s", class)
	}
	return errors.New("analytics privacy admission rejected unknown classification")
}

func Exclusions() []Classification {
	out := make([]Classification, 0, len(excluded))
	for class := range excluded {
		out = append(out, class)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

func IsExcluded(value string) bool {
	_, ok := excluded[Normalize(value)]
	return ok
}
