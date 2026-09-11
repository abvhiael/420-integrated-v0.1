package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	explorerservice "github.com/420integrated/420-integrated/explorer/service"
)

// Server exposes Explorer presentation resources only. Its Service dependency
// is itself backed exclusively by the shared 420Indexer read API; this layer
// must never gain a direct RPC, checkpoint, reorg, or decoder dependency.
type Server struct {
	service *explorerservice.Service
	mux     *http.ServeMux
}

type errorResponse struct {
	Error string `json:"error"`
}

func NewServer(service *explorerservice.Service) (*Server, error) {
	if service == nil {
		return nil, errors.New("420Explorer service required")
	}
	s := &Server{service: service, mux: http.NewServeMux()}
	s.routes()
	return s, nil
}

func (s *Server) Handler() http.Handler { return s.mux }

func (s *Server) routes() {
	s.mux.HandleFunc("GET /v1/status", s.handleStatus)
	s.mux.HandleFunc("GET /v1/blocks", s.handleBlocks)
	s.mux.HandleFunc("GET /v1/blocks/{number}", s.handleBlock)
	s.mux.HandleFunc("GET /v1/transactions/{hash}", s.handleTransaction)
	s.mux.HandleFunc("GET /v1/receipts/{hash}", s.handleReceipt)
	s.mux.HandleFunc("GET /v1/services/{service}/versions/{version}", s.handleServiceVersion)
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	status, err := s.service.NetworkStatus(r.Context())
	if err != nil {
		writeJSON(w, explorerErrorStatus(err), status)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (s *Server) handleBlocks(w http.ResponseWriter, r *http.Request) {
	var limit uint64
	var err error
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		limit, err = strconv.ParseUint(raw, 10, 32)
		if err != nil || limit == 0 {
			writeError(w, http.StatusBadRequest, "invalid limit")
			return
		}
	}
	page, err := s.service.BlockPage(r.Context(), uint32(limit), r.URL.Query().Get("cursor"))
	if err != nil {
		writeError(w, explorerErrorStatus(err), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) handleBlock(w http.ResponseWriter, r *http.Request) {
	number, err := strconv.ParseUint(r.PathValue("number"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid block number")
		return
	}
	view, err := s.service.BlockDetail(r.Context(), number)
	if err != nil {
		writeError(w, explorerErrorStatus(err), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (s *Server) handleTransaction(w http.ResponseWriter, r *http.Request) {
	hash := strings.TrimSpace(r.PathValue("hash"))
	if hash == "" {
		writeError(w, http.StatusBadRequest, "transaction hash required")
		return
	}
	view, err := s.service.TransactionDetail(r.Context(), hash)
	if err != nil {
		writeError(w, explorerErrorStatus(err), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (s *Server) handleReceipt(w http.ResponseWriter, r *http.Request) {
	hash := strings.TrimSpace(r.PathValue("hash"))
	if hash == "" {
		writeError(w, http.StatusBadRequest, "transaction hash required")
		return
	}
	view, err := s.service.ReceiptDetail(r.Context(), hash)
	if err != nil {
		writeError(w, explorerErrorStatus(err), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (s *Server) handleServiceVersion(w http.ResponseWriter, r *http.Request) {
	serviceID := strings.TrimSpace(r.PathValue("service"))
	if serviceID == "" {
		writeError(w, http.StatusBadRequest, "service id required")
		return
	}
	version, err := strconv.ParseUint(r.PathValue("version"), 10, 32)
	if err != nil || version == 0 {
		writeError(w, http.StatusBadRequest, "invalid service version")
		return
	}
	record, err := s.service.ServiceVersion(r.Context(), serviceID, uint32(version))
	if err != nil {
		writeError(w, explorerErrorStatus(err), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, record)
}

func explorerErrorStatus(err error) int {
	switch {
	case errors.Is(err, explorerservice.ErrWrongChain),
		errors.Is(err, explorerservice.ErrIndexerStale),
		errors.Is(err, explorerservice.ErrIndexerDegraded):
		return http.StatusServiceUnavailable
	default:
		return http.StatusBadGateway
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
