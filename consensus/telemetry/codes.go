package telemetry

import (
	"errors"
	"os"
	"regexp"
	"strconv"
	"strings"
)

var nativeSequence = regexp.MustCompile(`420 system call sequence ([0-9]{1,20}): execution reverted`)

// SettlementCode emits only a closed vocabulary, even if an RPC error includes
// a destination URL, revert text, credentials or an adversarial error string.
func SettlementCode(err error) (string, uint64) {
	if err == nil {
		return "", 0
	}
	var path *os.PathError
	if errors.As(err, &path) {
		return "PERSISTENCE_FAILURE", 0
	}
	text := err.Error()
	if match := nativeSequence.FindStringSubmatch(text); len(match) == 2 {
		n, e := strconv.ParseUint(match[1], 10, 64)
		if e == nil {
			return "EXECUTION_NATIVE_CALL_REJECTED", n
		}
	}
	for _, rule := range []struct{ contains, code string }{{"history missing durable settled checkpoint", "DURABLE_SETTLEMENT_HISTORY_MISSING"},
		{"INVALID", "EXECUTION_REJECTED"},
		{"restart reconciliation required", "RESTART_RECONCILIATION_REQUIRED"}, {"finalized", "FINALIZED_BOUNDARY_REJECTED"}, {"already recorded", "DUPLICATE_SETTLEMENT_REJECTED"}, {"execution chain mismatch", "EXECUTION_CHAIN_MISMATCH"}, {"INVALID", "EXECUTION_REJECTED"}} {
		if strings.Contains(text, rule.contains) {
			return rule.code, 0
		}
	}
	return "SETTLEMENT_UNAVAILABLE", 0
}

func SigningCode(err error) string {
	if err == nil {
		return ""
	}
	text := err.Error()
	if strings.Contains(text, "offline signing history rollback") {
		return "SIGNING_HISTORY_ROLLBACK"
	}
	if strings.Contains(text, "protected signing history unavailable") {
		return "SIGNING_HISTORY_UNAVAILABLE"
	}
	var path *os.PathError
	if errors.As(err, &path) {
		return "PERSISTENCE_FAILURE"
	}
	return "SIGNING_PROTECTION_FAILURE"
}
