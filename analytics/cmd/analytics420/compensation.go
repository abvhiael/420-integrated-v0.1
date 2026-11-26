package main

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/420integrated/420-integrated/analytics/indexerclient"
)

func compensationHandler(client *indexerclient.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		from, fromErr := strconv.ParseUint(r.URL.Query().Get("from"), 10, 64)
		to, toErr := strconv.ParseUint(r.URL.Query().Get("to"), 10, 64)
		if fromErr != nil || toErr != nil || from >= to {
			http.Error(w, "expected from < to in Unix seconds", http.StatusBadRequest)
			return
		}
		report, err := client.CompensationReport(r.Context(), from, to)
		if err != nil || len(report) == 0 || !json.Valid(report) || report[0] != '{' {
			http.Error(w, "compensation report unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write(report)
	}
}
