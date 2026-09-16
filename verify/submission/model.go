package submission

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

type InputKind string

const (
	InputStandardJSON InputKind = "STANDARD_JSON"
	InputMultiFile    InputKind = "MULTI_FILE"
	InputFlattened    InputKind = "FLATTENED_COMPAT"
)

type SourceFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type LibraryLink struct {
	Source  string `json:"source"`
	Library string `json:"library"`
	Address string `json:"address"`
}

type BuildSettings struct {
	CompilerVersion     string        `json:"compilerVersion"`
	OptimizerEnabled    bool          `json:"optimizerEnabled"`
	OptimizerRuns       uint64        `json:"optimizerRuns"`
	EVMVersion          string        `json:"evmVersion"`
	ViaIR               bool          `json:"viaIR"`
	MetadataHashMode    string        `json:"metadataHashMode"`
	Libraries           []LibraryLink `json:"libraries,omitempty"`
	ConstructorArguments string       `json:"constructorArguments,omitempty"`
	ConstructorArgsKnown bool         `json:"constructorArgsKnown"`
}

type Submission struct {
	Kind          InputKind       `json:"kind"`
	StandardJSON  json.RawMessage `json:"standardJson,omitempty"`
	Sources       []SourceFile    `json:"sources,omitempty"`
	Flattened     string          `json:"flattened,omitempty"`
	Build         BuildSettings   `json:"build"`
	BundleHash    string          `json:"bundleHash"`
}

func NewStandardJSON(raw []byte, build BuildSettings) (Submission, error) {
	if !json.Valid(raw) { return Submission{}, errors.New("standard json input must be valid JSON") }
	if err := build.Validate(); err != nil { return Submission{}, err }
	s := Submission{Kind: InputStandardJSON, StandardJSON: append(json.RawMessage(nil), raw...), Build: build}
	s.BundleHash = hashParts([]part{{name:"standard-json", content:raw}})
	return s, nil
}

func NewMultiFile(files map[string]string, build BuildSettings) (Submission, error) {
	if err := build.Validate(); err != nil { return Submission{}, err }
	if len(files) == 0 { return Submission{}, errors.New("at least one source file is required") }
	paths := make([]string,0,len(files)); for p := range files { paths = append(paths,p) }; sort.Strings(paths)
	sources := make([]SourceFile,0,len(paths)); parts := make([]part,0,len(paths))
	for _, p := range paths {
		if err := validatePath(p); err != nil { return Submission{}, err }
		content := files[p]
		sources = append(sources, SourceFile{Path:p, Content:content})
		parts = append(parts, part{name:p, content:[]byte(content)})
	}
	return Submission{Kind:InputMultiFile, Sources:sources, Build:build, BundleHash:hashParts(parts)}, nil
}

func NewFlattened(filename, source string, build BuildSettings) (Submission, error) {
	if err := build.Validate(); err != nil { return Submission{}, err }
	if err := validatePath(filename); err != nil { return Submission{}, err }
	if source == "" { return Submission{}, errors.New("flattened source is required") }
	return Submission{Kind:InputFlattened, Flattened:source, Sources:[]SourceFile{{Path:filename,Content:source}}, Build:build, BundleHash:hashParts([]part{{name:filename,content:[]byte(source)}})}, nil
}

func (b BuildSettings) Validate() error {
	if strings.TrimSpace(b.CompilerVersion)=="" { return errors.New("compiler version is required") }
	if strings.TrimSpace(b.EVMVersion)=="" { return errors.New("evm version is required") }
	if strings.TrimSpace(b.MetadataHashMode)=="" { return errors.New("metadata hash mode is required") }
	for _, l := range b.Libraries {
		if err:=validatePath(l.Source); err!=nil { return fmt.Errorf("library source: %w",err) }
		if strings.TrimSpace(l.Library)=="" { return errors.New("library name is required") }
		if !validAddress(l.Address) { return fmt.Errorf("invalid library address for %s",l.Library) }
	}
	if b.ConstructorArgsKnown && !validHexBytes(b.ConstructorArguments) { return errors.New("known constructor arguments must be 0x-prefixed hex bytes") }
	return nil
}

func (s Submission) ValidateCommitment() error {
	var want string
	switch s.Kind {
	case InputStandardJSON:
		if !json.Valid(s.StandardJSON) { return errors.New("standard json input must be valid JSON") }
		want=hashParts([]part{{name:"standard-json",content:s.StandardJSON}})
	case InputMultiFile, InputFlattened:
		if len(s.Sources)==0 { return errors.New("source files are required") }
		parts:=make([]part,0,len(s.Sources)); seen:=map[string]bool{}
		for _, f:=range s.Sources { if err:=validatePath(f.Path); err!=nil{return err}; if seen[f.Path]{return errors.New("duplicate source path")}; seen[f.Path]=true; parts=append(parts,part{name:f.Path,content:[]byte(f.Content)}) }
		sort.Slice(parts,func(i,j int)bool{return parts[i].name<parts[j].name}); want=hashParts(parts)
	default: return errors.New("unsupported input kind")
	}
	if s.BundleHash!=want { return errors.New("source bundle commitment mismatch") }
	return s.Build.Validate()
}

type part struct{name string; content []byte}
func hashParts(parts []part) string {
	h:=sha256.New(); var n [8]byte
	for _,p:=range parts { binary.BigEndian.PutUint64(n[:],uint64(len(p.name))); h.Write(n[:]); h.Write([]byte(p.name)); binary.BigEndian.PutUint64(n[:],uint64(len(p.content))); h.Write(n[:]); h.Write(p.content) }
	return "sha256:"+hex.EncodeToString(h.Sum(nil))
}
func validatePath(p string) error { p=strings.TrimSpace(p); if p==""||strings.HasPrefix(p,"/")||strings.Contains(p,"\\")||strings.Contains(p,"../")||p==".."{return errors.New("source path must be relative and traversal-free")}; return nil }
func validAddress(v string) bool { if len(v)!=42||!strings.HasPrefix(v,"0x"){return false}; _,err:=hex.DecodeString(v[2:]); return err==nil }
func validHexBytes(v string) bool { if !strings.HasPrefix(v,"0x")||len(v)%2!=0{return false}; _,err:=hex.DecodeString(v[2:]); return err==nil }
