package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/420integrated/420-integrated/indexer/model"
)

var ErrSnapshotUnavailable = errors.New("snapshot unavailable")

// Backend is the stable read boundary consumed by 420Explorer, 420Search,
// 420Analytics, 420Notifications and 420Status. It exposes rebuildable indexed
// state only and cannot mutate canonical chain state.
type Backend interface {
	Health() (model.Health, error)
	Block(number uint64) (model.BlockRecord, bool, error)
	Blocks(cursor *Cursor, limit uint32) (BlockPage, error)
	Transaction(hash string) (model.TransactionRecord, bool, error)
	Receipt(txHash string) (model.ReceiptRecord, bool, error)
	LogsByBlock(number uint64) ([]model.LogRecord, error)
}

type Server struct { backend Backend }

func NewServer(backend Backend) *Server { return &Server{backend: backend} }

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", s.health)
	mux.HandleFunc("GET /v1/blocks/{number}", s.block)
	mux.HandleFunc("GET /v1/blocks", s.blocks)
	mux.HandleFunc("GET /v1/transactions/{hash}", s.transaction)
	mux.HandleFunc("GET /v1/receipts/{hash}", s.receipt)
	mux.HandleFunc("GET /v1/blocks/{number}/logs", s.blockLogs)
	return mux
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	h, err := s.backend.Health()
	if err != nil { writeError(w, http.StatusServiceUnavailable, err); return }
	writeJSON(w, http.StatusOK, HealthResponse{Health: h, CanonicalAuthority: false})
}

func (s *Server) block(w http.ResponseWriter, r *http.Request) {
	n, err := strconv.ParseUint(r.PathValue("number"), 10, 64)
	if err != nil { writeError(w, http.StatusBadRequest, err); return }
	b, ok, err := s.backend.Block(n)
	if err != nil { writeError(w, http.StatusServiceUnavailable, err); return }
	if !ok { writeError(w, http.StatusNotFound, errors.New("block not indexed")); return }
	writeJSON(w, http.StatusOK, b)
}

func (s *Server) transaction(w http.ResponseWriter, r *http.Request) {
	tx, ok, err := s.backend.Transaction(r.PathValue("hash"))
	if err != nil { writeError(w, http.StatusServiceUnavailable, err); return }
	if !ok { writeError(w, http.StatusNotFound, errors.New("transaction not indexed")); return }
	writeJSON(w, http.StatusOK, ReadResponse[model.TransactionRecord]{Data: tx, CanonicalAuthority: false})
}

func (s *Server) receipt(w http.ResponseWriter, r *http.Request) {
	receipt, ok, err := s.backend.Receipt(r.PathValue("hash"))
	if err != nil { writeError(w, http.StatusServiceUnavailable, err); return }
	if !ok { writeError(w, http.StatusNotFound, errors.New("receipt not indexed")); return }
	writeJSON(w, http.StatusOK, ReadResponse[model.ReceiptRecord]{Data: receipt, CanonicalAuthority: false})
}

func (s *Server) blockLogs(w http.ResponseWriter, r *http.Request) {
	n, err := strconv.ParseUint(r.PathValue("number"), 10, 64)
	if err != nil { writeError(w, http.StatusBadRequest, err); return }
	logs, err := s.backend.LogsByBlock(n)
	if err != nil { writeError(w, http.StatusServiceUnavailable, err); return }
	writeJSON(w, http.StatusOK, ReadResponse[[]model.LogRecord]{Data: logs, CanonicalAuthority: false})
}

func (s *Server) blocks(w http.ResponseWriter, r *http.Request) {
	limit := uint32(50)
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.ParseUint(raw, 10, 32)
		if err != nil || n == 0 || n > 250 { writeError(w, http.StatusBadRequest, ErrInvalidCursor); return }
		limit = uint32(n)
	}
	var cur *Cursor
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		decoded, err := DecodeCursor(raw)
		if err != nil { writeError(w, http.StatusBadRequest, err); return }
		cur = &decoded
		limit = decoded.Limit
	}
	page, err := s.backend.Blocks(cur, limit)
	if err != nil {
		status := http.StatusServiceUnavailable
		if errors.Is(err, ErrSnapshotUnavailable) { status = http.StatusConflict }
		writeError(w, status, err); return
	}
	writeJSON(w, http.StatusOK, page)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]any{"error": err.Error(), "canonicalAuthority": false})
}
