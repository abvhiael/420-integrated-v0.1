package hardening

import (
	"strings"
	"testing"

	"github.com/420integrated/420-integrated/verify/submission"
)

func TestValidateRawJSONRejectsSecretFields(t *testing.T) {
	for _, raw := range []string{
		`{"privateKey":"0xdead"}`,
		`{"nested":{"mnemonic":"word word"}}`,
		`{"items":[{"seed_phrase":"secret"}]}`,
	} {
		if err := ValidateRawJSON([]byte(raw)); err == nil { t.Fatalf("expected secret rejection for %s", raw) }
	}
}

func TestValidateRawJSONRejectsTrailingValue(t *testing.T) {
	if err := ValidateRawJSON([]byte(`{"ok":true} {"extra":true}`)); err == nil { t.Fatal("expected trailing JSON rejection") }
}

func TestValidateSubmissionRejectsOversizedSource(t *testing.T) {
	s := submission.Submission{Sources: []submission.SourceFile{{Path:"A.sol", Content:strings.Repeat("x", MaxSourceFileBytes+1)}}}
	if err := ValidateSubmission(s); err == nil { t.Fatal("expected oversized source rejection") }
}

func TestValidateSubmissionRejectsTooManyFiles(t *testing.T) {
	s := submission.Submission{Sources: make([]submission.SourceFile, MaxSourceFiles+1)}
	if err := ValidateSubmission(s); err == nil { t.Fatal("expected source count rejection") }
}

func TestValidateSubmissionAllowsBoundedInputs(t *testing.T) {
	s := submission.Submission{Sources: []submission.SourceFile{{Path:"A.sol", Content:"contract A {}"}}}
	if err := ValidateSubmission(s); err != nil { t.Fatalf("unexpected rejection: %v", err) }
}
