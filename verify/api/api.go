package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/verify/architecture"
	"github.com/420integrated/420-integrated/verify/store"
	"github.com/420integrated/420-integrated/verify/submission"
)

const Phase = "VERIFY-8"
const warning = "verification only means published source/build inputs correspond to deployed code; it does not mean audited, safe, official, immutable, authorized, or non-malicious"

type EvidenceStore interface {
	History(bindingKey string) []store.Record
	Latest(bindingKey string) (store.Record, bool)
	Bindings() []string
}

type Processor interface {
	Verify(context.Context, uint64, string, submission.Submission) (store.Record, error)
}

type Service struct {
	store     EvidenceStore
	processor Processor
}

func New(evidenceStore EvidenceStore, processor Processor) (*Service, error) {
	if evidenceStore == nil { return nil, errors.New("evidence store is required") }
	return &Service{store:evidenceStore, processor:processor}, nil
}

type ConsumerView struct {
	Canonical              bool                     `json:"canonical"`
	VerificationClass      architecture.ResultClass `json:"verificationClass"`
	BindingKey             string                   `json:"bindingKey"`
	RecordHash             string                   `json:"recordHash"`
	ExplorerAddressPath    string                   `json:"explorerAddressPath"`
	RegistryAuthority      bool                     `json:"registryAuthority"`
	WalletAuthority        bool                     `json:"walletAuthority"`
	AppStoreSecurityContext bool                    `json:"appStoreSecurityContext"`
	Warning                string                   `json:"warning"`
}

type LookupResponse struct {
	Record      store.Record  `json:"record"`
	Integration ConsumerView `json:"integration"`
}

type SubmissionRequest struct {
	ChainID    uint64                `json:"chainId"`
	Address    string                `json:"address"`
	Submission submission.Submission `json:"submission"`
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/verify/{chainID}/{address}/{runtimeCodeHash}", s.lookup)
	mux.HandleFunc("GET /v1/verify/{chainID}/{address}/{runtimeCodeHash}/history", s.history)
	mux.HandleFunc("GET /v1/verify/evidence/{recordHash}", s.evidence)
	mux.HandleFunc("POST /v1/verify/submissions", s.submit)
	return mux
}

func (s *Service) lookup(w http.ResponseWriter, r *http.Request) {
	binding, err := bindingFromRequest(r)
	if err != nil { writeJSON(w,http.StatusBadRequest,errorBody(err)); return }
	record, ok := s.store.Latest(binding)
	if !ok { writeJSON(w,http.StatusNotFound,errorBody(errors.New("verification evidence not found"))); return }
	writeJSON(w,http.StatusOK,LookupResponse{Record:record,Integration:consumerView(record)})
}

func (s *Service) history(w http.ResponseWriter, r *http.Request) {
	binding, err := bindingFromRequest(r)
	if err != nil { writeJSON(w,http.StatusBadRequest,errorBody(err)); return }
	records := s.store.History(binding)
	if len(records)==0 { writeJSON(w,http.StatusNotFound,errorBody(errors.New("verification history not found"))); return }
	writeJSON(w,http.StatusOK,map[string]any{"bindingKey":binding,"canonical":false,"warning":warning,"records":records})
}

func (s *Service) evidence(w http.ResponseWriter, r *http.Request) {
	target := strings.TrimSpace(r.PathValue("recordHash"))
	if target=="" { writeJSON(w,http.StatusBadRequest,errorBody(errors.New("record hash is required"))); return }
	for _, binding := range s.store.Bindings() {
		for _, record := range s.store.History(binding) {
			if record.RecordHash == target {
				writeJSON(w,http.StatusOK,LookupResponse{Record:record,Integration:consumerView(record)})
				return
			}
		}
	}
	writeJSON(w,http.StatusNotFound,errorBody(errors.New("verification evidence not found")))
}

func (s *Service) submit(w http.ResponseWriter, r *http.Request) {
	if s.processor == nil {
		writeJSON(w,http.StatusServiceUnavailable,map[string]any{"error":"verification processor unavailable","canonical":false,"warning":warning})
		return
	}
	defer r.Body.Close()
	dec := json.NewDecoder(http.MaxBytesReader(w,r.Body,8<<20))
	dec.DisallowUnknownFields()
	var req SubmissionRequest
	if err:=dec.Decode(&req); err!=nil { writeJSON(w,http.StatusBadRequest,errorBody(fmt.Errorf("decode submission: %w",err))); return }
	if req.ChainID==0 || !validAddress(req.Address) { writeJSON(w,http.StatusBadRequest,errorBody(errors.New("non-zero chainId and valid address are required"))); return }
	if err:=req.Submission.ValidateCommitment(); err!=nil { writeJSON(w,http.StatusBadRequest,errorBody(fmt.Errorf("invalid source/build submission: %w",err))); return }
	record, err := s.processor.Verify(r.Context(),req.ChainID,strings.ToLower(req.Address),req.Submission)
	if err!=nil { writeJSON(w,http.StatusUnprocessableEntity,map[string]any{"error":err.Error(),"canonical":false,"warning":warning}); return }
	writeJSON(w,http.StatusCreated,LookupResponse{Record:record,Integration:consumerView(record)})
}

func bindingFromRequest(r *http.Request) (string,error) {
	chainID, err := strconv.ParseUint(strings.TrimSpace(r.PathValue("chainID")),10,64)
	if err!=nil || chainID==0 { return "",errors.New("chainID must be a non-zero uint64") }
	address := strings.ToLower(strings.TrimSpace(r.PathValue("address")))
	hash := strings.ToLower(strings.TrimSpace(r.PathValue("runtimeCodeHash")))
	if !validAddress(address) { return "",errors.New("valid contract address is required") }
	if !validHash(hash) { return "",errors.New("valid runtime code hash is required") }
	return store.ParseBindingKey(chainID,address,hash),nil
}

func consumerView(record store.Record) ConsumerView {
	return ConsumerView{
		Canonical:false,
		VerificationClass:record.Classification.Class,
		BindingKey:record.BindingKey,
		RecordHash:record.RecordHash,
		ExplorerAddressPath:fmt.Sprintf("/address/%s?chainId=%d",strings.ToLower(record.Deployment.Address),record.Deployment.ChainID),
		RegistryAuthority:false,
		WalletAuthority:false,
		AppStoreSecurityContext:true,
		Warning:warning,
	}
}

func errorBody(err error) map[string]any { return map[string]any{"error":err.Error(),"canonical":false,"warning":warning} }
func validAddress(v string) bool { return len(v)==42 && strings.HasPrefix(v,"0x") }
func validHash(v string) bool { return len(v)==66 && strings.HasPrefix(v,"0x") }
func writeJSON(w http.ResponseWriter,status int,v any){w.Header().Set("Content-Type","application/json"); w.WriteHeader(status); _=json.NewEncoder(w).Encode(v)}
