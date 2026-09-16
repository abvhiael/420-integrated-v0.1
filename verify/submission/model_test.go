package submission

import (
	"encoding/json"
	"testing"
)

func buildSettings() BuildSettings {
	return BuildSettings{
		CompilerVersion:"0.8.24+commit.e11b9ed9", OptimizerEnabled:true, OptimizerRuns:200,
		EVMVersion:"cancun", ViaIR:true, MetadataHashMode:"ipfs", ConstructorArgsKnown:true,
		ConstructorArguments:"0x1234",
		Libraries:[]LibraryLink{{Source:"lib/Math.sol",Library:"Math",Address:"0x1111111111111111111111111111111111111111"}},
	}
}

func TestMultiFileCommitmentIsOrderIndependentButContentSensitive(t *testing.T) {
	a,err:=NewMultiFile(map[string]string{"B.sol":"contract B {}","A.sol":"contract A {}"},buildSettings()); if err!=nil{t.Fatal(err)}
	b,err:=NewMultiFile(map[string]string{"A.sol":"contract A {}","B.sol":"contract B {}"},buildSettings()); if err!=nil{t.Fatal(err)}
	if a.BundleHash!=b.BundleHash { t.Fatalf("transport/map ordering changed source commitment: %s != %s",a.BundleHash,b.BundleHash) }
	c,err:=NewMultiFile(map[string]string{"A.sol":"contract A { }","B.sol":"contract B {}"},buildSettings()); if err!=nil{t.Fatal(err)}
	if a.BundleHash==c.BundleHash { t.Fatal("semantic/source byte change must change source commitment") }
	if err:=a.ValidateCommitment(); err!=nil{t.Fatal(err)}
}

func TestStandardJSONPreservesSubmittedSemanticBytes(t *testing.T) {
	raw:=[]byte(`{"language":"Solidity","sources":{"A.sol":{"content":"contract A {}"}},"settings":{"optimizer":{"enabled":true,"runs":200},"viaIR":true}}`)
	s,err:=NewStandardJSON(raw,buildSettings()); if err!=nil{t.Fatal(err)}
	if string(s.StandardJSON)!=string(raw) { t.Fatal("standard JSON input was rewritten") }
	if err:=s.ValidateCommitment(); err!=nil{t.Fatal(err)}
	mutated:=append([]byte(nil),raw...); mutated=append(mutated,' ')
	s.StandardJSON=json.RawMessage(mutated)
	if err:=s.ValidateCommitment(); err==nil { t.Fatal("changed standard JSON bytes must invalidate commitment") }
}

func TestFlattenedInputIsCompatibilityClassAndCommittedExactly(t *testing.T) {
	src:="// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\ncontract A {}\n"
	s,err:=NewFlattened("Flattened.sol",src,buildSettings()); if err!=nil{t.Fatal(err)}
	if s.Kind!=InputFlattened || s.Flattened!=src || len(s.Sources)!=1 || s.Sources[0].Content!=src { t.Fatal("flattened source was not preserved exactly") }
	if err:=s.ValidateCommitment(); err!=nil{t.Fatal(err)}
}

func TestBuildSettingsRequireReproductionCriticalEvidence(t *testing.T) {
	cases:=[]struct{name string; mutate func(*BuildSettings)}{
		{"compiler",func(b *BuildSettings){b.CompilerVersion=""}},
		{"evm version",func(b *BuildSettings){b.EVMVersion=""}},
		{"metadata mode",func(b *BuildSettings){b.MetadataHashMode=""}},
		{"library address",func(b *BuildSettings){b.Libraries[0].Address="0x1234"}},
		{"constructor arguments",func(b *BuildSettings){b.ConstructorArguments="not-hex"}},
	}
	for _,tc:=range cases { t.Run(tc.name,func(t *testing.T){b:=buildSettings(); tc.mutate(&b); if b.Validate()==nil{t.Fatal("expected invalid reproduction evidence to be rejected")}}) }
}

func TestSubmissionRejectsPathTraversalAndCommitmentTampering(t *testing.T) {
	if _,err:=NewMultiFile(map[string]string{"../secret.sol":"contract X {}"},buildSettings()); err==nil{t.Fatal("path traversal must be rejected")}
	s,err:=NewMultiFile(map[string]string{"A.sol":"contract A {}"},buildSettings()); if err!=nil{t.Fatal(err)}
	s.BundleHash="sha256:deadbeef"
	if s.ValidateCommitment()==nil { t.Fatal("tampered bundle commitment must be rejected") }
}
