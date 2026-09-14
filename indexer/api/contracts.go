package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

var ErrContractQueryUnavailable = errors.New("contract query unavailable")

type contractBackend interface {
	Contract(string) (model.ContractRecord, bool, error)
}

type contractStore interface {
	Contract(string) (model.ContractRecord, bool, error)
}

func (b *StoreBackend) Contract(address string) (model.ContractRecord, bool, error) {
	store, ok := b.store.(contractStore)
	if !ok { return model.ContractRecord{}, false, ErrContractQueryUnavailable }
	return store.Contract(strings.ToLower(address))
}

func (s *Server) contract(w http.ResponseWriter, r *http.Request) {
	address := strings.TrimSpace(r.PathValue("address"))
	if address == "" { writeError(w, http.StatusBadRequest, errors.New("contract address required")); return }
	backend, ok := s.backend.(contractBackend)
	if !ok { writeError(w, http.StatusNotImplemented, ErrContractQueryUnavailable); return }
	record, found, err := backend.Contract(address)
	if err != nil { writeError(w, http.StatusServiceUnavailable, err); return }
	if !found { writeError(w, http.StatusNotFound, errors.New("contract not indexed")); return }
	writeJSON(w, http.StatusOK, ReadResponse[model.ContractRecord]{Data: record, CanonicalAuthority: false})
}
