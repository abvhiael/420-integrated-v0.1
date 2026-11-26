package api

import (
	"errors"
	"net/http"

	"github.com/420integrated/420-integrated/explorer/service"
)

func (s *Server) handleCompensation(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	view, err := s.service.Compensation(r.Context(), r.PathValue("hash"))
	if errors.Is(err, service.ErrInvalidCompensationHash) {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, view)
}
