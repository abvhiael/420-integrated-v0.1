package matcher

import (
	"errors"
	"fmt"
	"strings"

	"github.com/420integrated/420-integrated/verify/architecture"
	"github.com/420integrated/420-integrated/verify/compiler"
	"github.com/420integrated/420-integrated/verify/evidence"
	"github.com/420integrated/420-integrated/verify/submission"
)

const Phase = "VERIFY-5"

type Reason string

const (
	ReasonExactRuntimeMatch          Reason = "EXACT_RUNTIME_MATCH"
	ReasonExactCreationMatch         Reason = "EXACT_CREATION_MATCH"
	ReasonCreationUnavailable        Reason = "CREATION_CONTEXT_UNAVAILABLE"
	ReasonRuntimeMismatch            Reason = "RUNTIME_BYTECODE_MISMATCH"
	ReasonCreationMismatch           Reason = "CREATION_BYTECODE_MISMATCH"
	ReasonCompiledRuntimeMissing     Reason = "COMPILED_RUNTIME_MISSING"
	ReasonCanonicalRuntimeMissing    Reason = "CANONICAL_RUNTIME_MISSING"
	ReasonInvalidCanonicalEvidence   Reason = "INVALID_CANONICAL_EVIDENCE"
	ReasonInvalidBuildEvidence       Reason = "INVALID_BUILD_EVIDENCE"
	ReasonMetadataRelevant           Reason = "METADATA_DIFFERENCE_RELEVANT"
	ReasonLibraryLinksRelevant       Reason = "LIBRARY_LINKS_RELEVANT"
	ReasonImmutablesRelevant         Reason = "IMMUTABLE_REFERENCES_RELEVANT"
)

type Diagnostic struct {
	Reason  Reason `json:"reason"`
	Message string `json:"message"`
}

type Context struct {
	MetadataHashMode string                   `json:"metadataHashMode,omitempty"`
	Libraries        []submission.LibraryLink `json:"libraries,omitempty"`
	HasImmutables    bool                     `json:"hasImmutables"`
}

type Result struct {
	Class               architecture.ResultClass `json:"class"`
	BindingKey          string                   `json:"bindingKey,omitempty"`
	RuntimeExact        bool                     `json:"runtimeExact"`
	CreationCompared    bool                     `json:"creationCompared"`
	CreationExact       bool                     `json:"creationExact"`
	Diagnostics         []Diagnostic             `json:"diagnostics"`
	ComparisonContext   Context                  `json:"comparisonContext"`
}

func Classify(chain evidence.DeploymentEvidence, build compiler.BuildEvidence, submissionModel submission.Submission, hasImmutables bool) Result {
	ctx := Context{MetadataHashMode: submissionModel.Build.MetadataHashMode, Libraries: append([]submission.LibraryLink(nil), submissionModel.Build.Libraries...), HasImmutables: hasImmutables}
	result := Result{Class: architecture.ResultUnverifiable, ComparisonContext: ctx}

	if err := chain.Validate(); err != nil {
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonInvalidCanonicalEvidence, Message: err.Error()})
		return result
	}
	result.BindingKey = chain.BindingKey()
	if err := validateBuild(build); err != nil {
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonInvalidBuildEvidence, Message: err.Error()})
		return result
	}

	canonicalRuntime, err := normalizeBytecode(chain.RuntimeBytecode)
	if err != nil || canonicalRuntime == "0x" {
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonCanonicalRuntimeMissing, Message: "canonical deployed runtime bytecode is unavailable or invalid"})
		return result
	}
	compiledRuntime, err := normalizeBytecode(build.RuntimeBytecode)
	if err != nil || compiledRuntime == "0x" {
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonCompiledRuntimeMissing, Message: "compiler output did not contain valid deployed runtime bytecode"})
		return result
	}

	if canonicalRuntime != compiledRuntime {
		result.Class = architecture.ResultMismatch
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonRuntimeMismatch, Message: "compiled runtime bytecode does not exactly equal canonical deployed runtime bytecode"})
		appendDifferenceContext(&result)
		return result
	}

	result.RuntimeExact = true
	result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonExactRuntimeMatch, Message: "compiled runtime bytecode exactly matches canonical deployed runtime bytecode"})

	if chain.Creation == nil || strings.TrimSpace(chain.Creation.CreationBytecode) == "" {
		result.Class = architecture.ResultPartialMatch
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonCreationUnavailable, Message: "runtime matches exactly, but canonical creation bytecode is not recoverable for comparison"})
		return result
	}

	result.CreationCompared = true
	canonicalCreation, err := normalizeBytecode(chain.Creation.CreationBytecode)
	if err != nil || canonicalCreation == "0x" {
		result.Class = architecture.ResultUnverifiable
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonInvalidCanonicalEvidence, Message: "canonical creation bytecode is invalid"})
		return result
	}
	compiledCreation, err := normalizeBytecode(build.CreationBytecode)
	if err != nil || compiledCreation == "0x" {
		result.Class = architecture.ResultUnverifiable
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonInvalidBuildEvidence, Message: "compiler output did not contain valid creation bytecode required for comparison"})
		return result
	}
	if canonicalCreation != compiledCreation {
		result.Class = architecture.ResultMismatch
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonCreationMismatch, Message: "runtime matches, but compiled creation bytecode does not exactly equal recovered canonical creation bytecode"})
		appendDifferenceContext(&result)
		return result
	}

	result.CreationExact = true
	result.Class = architecture.ResultFullMatch
	result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonExactCreationMatch, Message: "compiled creation bytecode exactly matches recovered canonical creation bytecode"})
	return result
}

func appendDifferenceContext(result *Result) {
	if strings.TrimSpace(result.ComparisonContext.MetadataHashMode) != "" {
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonMetadataRelevant, Message: fmt.Sprintf("metadata is compared as emitted; configured bytecodeHash mode is %q and is never silently stripped", result.ComparisonContext.MetadataHashMode)})
	}
	if len(result.ComparisonContext.Libraries) > 0 {
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonLibraryLinksRelevant, Message: "linked-library addresses are part of the compiled bytecode and are never wildcarded during comparison"})
	}
	if result.ComparisonContext.HasImmutables {
		result.Diagnostics = append(result.Diagnostics, Diagnostic{Reason: ReasonImmutablesRelevant, Message: "immutable-reference bytes are compared exactly and are never silently masked"})
	}
}

func validateBuild(build compiler.BuildEvidence) error {
	if strings.TrimSpace(build.CompilerVersion) == "" { return errors.New("compiler version is required") }
	if strings.TrimSpace(build.BundleHash) == "" { return errors.New("source bundle hash is required") }
	if strings.TrimSpace(build.InputSHA256) == "" || strings.TrimSpace(build.OutputSHA256) == "" { return errors.New("compiler input/output commitments are required") }
	return nil
}

func normalizeBytecode(value string) (string, error) {
	value = strings.TrimSpace(strings.ToLower(value))
	if !strings.HasPrefix(value, "0x") { return "", errors.New("bytecode must be 0x-prefixed") }
	hex := value[2:]
	if len(hex)%2 != 0 { return "", errors.New("bytecode must contain whole bytes") }
	for _, r := range hex {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')) { return "", errors.New("bytecode contains non-hex characters") }
	}
	return value, nil
}
