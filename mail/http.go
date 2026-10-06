package mail

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
)

type AuthenticateFunc func(*http.Request) (string, error)

type HTTPHandler struct {
	Service      *Service
	Authenticate AuthenticateFunc
}

func (h HTTPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if h.Service == nil || h.Authenticate == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "mail service unavailable")
		return
	}
	actor, err := h.Authenticate(r)
	if err != nil || strings.TrimSpace(actor) == "" {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
		return
	}
	switch {
	case r.Method == http.MethodPost && r.URL.Path == "/v1/messages":
		h.send(w, r, actor)
	case r.Method == http.MethodGet && r.URL.Path == "/v1/inbox":
		h.inbox(w, r, actor)
	case r.URL.Path == "/v1/labels" || strings.HasPrefix(r.URL.Path, "/v1/labels/"):
		h.labels(w, r, actor)
	case r.URL.Path == "/v1/custom-folders" || strings.HasPrefix(r.URL.Path, "/v1/custom-folders/"):
		h.customFolders(w, r, actor)
	case r.URL.Path == "/v1/organization/bulk":
		h.bulkOrganization(w, r, actor)
	case r.URL.Path == "/v1/search":
		h.search(w, r, actor)
	case r.URL.Path == "/v1/rules" || strings.HasPrefix(r.URL.Path, "/v1/rules/"):
		h.rules(w, r, actor)
	case r.URL.Path == "/v1/trust/entries" || strings.HasPrefix(r.URL.Path, "/v1/trust/entries/") || r.URL.Path == "/v1/trust/settings":
		h.trust(w, r, actor)
	case r.URL.Path == "/v1/quarantine" || strings.HasPrefix(r.URL.Path, "/v1/quarantine/") || strings.HasPrefix(r.URL.Path, "/v1/reputation/"):
		h.protection(w, r, actor)
	case r.URL.Path == "/v1/conversations" || strings.HasPrefix(r.URL.Path, "/v1/conversations/"):
		h.conversations(w, r, actor)
	case r.URL.Path == "/v1/drafts" || strings.HasPrefix(r.URL.Path, "/v1/drafts/"):
		h.drafts(w, r, actor)
	case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/v1/mailboxes/"):
		h.mailbox(w, r, actor)
	case strings.HasPrefix(r.URL.Path, "/v1/messages/"):
		h.message(w, r, actor)
	default:
		writeError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
	}
}

func (h HTTPHandler) send(w http.ResponseWriter, r *http.Request, actor string) {
	defer r.Body.Close()
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, MaxBodyBytes+4096))
	dec.DisallowUnknownFields()
	var req SendRequest
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
		return
	}
	msg, err := h.Service.Send(r.Context(), actor, req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, msg)
}

func (h HTTPHandler) inbox(w http.ResponseWriter, r *http.Request, actor string) {
	limit := DefaultPageSize
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil {
			limit = n
		}
	}
	page, err := h.Service.Inbox(r.Context(), actor, r.URL.Query().Get("cursor"), limit)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h HTTPHandler) mailbox(w http.ResponseWriter, r *http.Request, actor string) {
	folder := MailboxFolder(strings.ToUpper(strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/mailboxes/"), "/")))
	limit := DefaultPageSize
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil {
			limit = n
		}
	}
	page, err := h.Service.Mailbox(r.Context(), actor, folder, r.URL.Query().Get("cursor"), limit)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h HTTPHandler) labels(w http.ResponseWriter, r *http.Request, actor string) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/labels"), "/")
	if rest == "" {
		switch r.Method {
		case http.MethodGet:
			labels, err := h.Service.ListLabels(r.Context(), actor)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, labels)
		case http.MethodPost:
			defer r.Body.Close()
			var req struct {
				Name string `json:"name"`
			}
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10))
			dec.DisallowUnknownFields()
			if err := dec.Decode(&req); err != nil {
				writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
				return
			}
			label, err := h.Service.CreateLabel(r.Context(), actor, req.Name)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusCreated, label)
		default:
			writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		}
		return
	}
	parts := strings.Split(rest, "/")
	if len(parts) == 1 && r.Method == http.MethodDelete {
		if err := h.Service.DeleteLabel(r.Context(), actor, parts[0]); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if len(parts) == 2 && parts[1] == "messages" && r.Method == http.MethodGet {
		page, err := h.Service.MessagesByLabel(r.Context(), actor, parts[0], r.URL.Query().Get("cursor"), parseLimit(r))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, page)
		return
	}
	writeError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
}

func (h HTTPHandler) customFolders(w http.ResponseWriter, r *http.Request, actor string) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/custom-folders"), "/")
	if rest == "" {
		switch r.Method {
		case http.MethodGet:
			folders, err := h.Service.ListCustomFolders(r.Context(), actor)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, folders)
		case http.MethodPost:
			defer r.Body.Close()
			var req struct {
				Name string `json:"name"`
			}
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10))
			dec.DisallowUnknownFields()
			if err := dec.Decode(&req); err != nil {
				writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
				return
			}
			folder, err := h.Service.CreateCustomFolder(r.Context(), actor, req.Name)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusCreated, folder)
		default:
			writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		}
		return
	}
	parts := strings.Split(rest, "/")
	if len(parts) == 1 && r.Method == http.MethodDelete {
		if err := h.Service.DeleteCustomFolder(r.Context(), actor, parts[0]); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if len(parts) == 2 && parts[1] == "messages" && r.Method == http.MethodGet {
		page, err := h.Service.MessagesByCustomFolder(r.Context(), actor, parts[0], r.URL.Query().Get("cursor"), parseLimit(r))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, page)
		return
	}
	writeError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
}

func (h HTTPHandler) drafts(w http.ResponseWriter, r *http.Request, actor string) {
	if r.URL.Path == "/v1/drafts" {
		switch r.Method {
		case http.MethodGet:
			items, err := h.Service.ListDrafts(r.Context(), actor)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, items)
		case http.MethodPost:
			defer r.Body.Close()
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, MaxBodyBytes+8192))
			dec.DisallowUnknownFields()
			var input DraftCreateRequest
			if err := dec.Decode(&input); err != nil {
				writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
				return
			}
			view, err := h.Service.CreateDraft(r.Context(), actor, input)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusCreated, view)
		default:
			writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		}
		return
	}
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/drafts/"), "/")
	if id == "" || strings.Contains(id, "/") {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
		return
	}
	switch r.Method {
	case http.MethodGet:
		view, err := h.Service.GetDraft(r.Context(), actor, id)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, view)
	case http.MethodPut:
		defer r.Body.Close()
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, MaxBodyBytes+8192))
		dec.DisallowUnknownFields()
		var input DraftSaveRequest
		if err := dec.Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
			return
		}
		view, err := h.Service.SaveDraft(r.Context(), actor, id, input)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, view)
	case http.MethodDelete:
		raw := r.URL.Query().Get("expected_version")
		version, err := strconv.ParseUint(raw, 10, 32)
		if err != nil || version == 0 {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "expected_version is required")
			return
		}
		if err := h.Service.DiscardDraft(r.Context(), actor, id, uint32(version)); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
	}
}

func (h HTTPHandler) conversations(w http.ResponseWriter, r *http.Request, actor string) {
	if r.URL.Path == "/v1/conversations" {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
			return
		}
		items, err := h.Service.ListConversations(r.Context(), actor)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, items)
		return
	}
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/conversations/"), "/")
	if id == "" || strings.Contains(id, "/") {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
		return
	}
	switch r.Method {
	case http.MethodGet:
		view, err := h.Service.GetConversation(r.Context(), actor, id)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, view)
	case http.MethodPatch:
		defer r.Body.Close()
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10))
		dec.DisallowUnknownFields()
		var update ConversationUpdate
		if err := dec.Decode(&update); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
			return
		}
		state, err := h.Service.UpdateConversation(r.Context(), actor, id, update)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, state)
	default:
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
	}
}

func (h HTTPHandler) protection(w http.ResponseWriter, r *http.Request, actor string) {
	if r.URL.Path == "/v1/quarantine" {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
			return
		}
		records, err := h.Service.ListQuarantine(r.Context(), actor)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, records)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/v1/quarantine/") {
		rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/quarantine/"), "/")
		parts := strings.Split(rest, "/")
		if len(parts) == 2 && parts[1] == "release" && r.Method == http.MethodPost {
			state, err := h.Service.ReleaseQuarantine(r.Context(), actor, parts[0])
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, state)
			return
		}
		writeError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
		return
	}
	if strings.HasPrefix(r.URL.Path, "/v1/reputation/") {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
			return
		}
		sender := strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/reputation/"), "/")
		if sender == "" || strings.Contains(sender, "/") {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
			return
		}
		rep, err := h.Service.GetSenderReputation(r.Context(), actor, sender)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, rep)
		return
	}
	writeError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
}

func (h HTTPHandler) trust(w http.ResponseWriter, r *http.Request, actor string) {
	if r.URL.Path == "/v1/trust/settings" {
		switch r.Method {
		case http.MethodGet:
			settings, err := h.Service.GetTrustSettings(r.Context(), actor)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, settings)
		case http.MethodPut:
			defer r.Body.Close()
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
			dec.DisallowUnknownFields()
			var input TrustSettingsInput
			if err := dec.Decode(&input); err != nil {
				writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
				return
			}
			settings, err := h.Service.UpdateTrustSettings(r.Context(), actor, input.RequireTrusted)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, settings)
		default:
			writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		}
		return
	}

	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/trust/entries"), "/")
	if rest == "" {
		switch r.Method {
		case http.MethodGet:
			entries, err := h.Service.ListTrustEntries(r.Context(), actor)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, entries)
		case http.MethodPut:
			defer r.Body.Close()
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
			dec.DisallowUnknownFields()
			var input TrustEntryInput
			if err := dec.Decode(&input); err != nil {
				writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
				return
			}
			entry, err := h.Service.PutTrustEntry(r.Context(), actor, input.Kind, input.Value, input.Disposition)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, entry)
		default:
			writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		}
		return
	}
	if strings.Contains(rest, "/") {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
		return
	}
	if r.Method != http.MethodDelete {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	if err := h.Service.DeleteTrustEntry(r.Context(), actor, rest); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h HTTPHandler) rules(w http.ResponseWriter, r *http.Request, actor string) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/rules"), "/")
	if rest == "" {
		switch r.Method {
		case http.MethodGet:
			rules, err := h.Service.ListRules(r.Context(), actor)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, rules)
		case http.MethodPost:
			defer r.Body.Close()
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32<<10))
			dec.DisallowUnknownFields()
			var input RuleInput
			if err := dec.Decode(&input); err != nil {
				writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
				return
			}
			rule, err := h.Service.CreateRule(r.Context(), actor, input)
			if err != nil {
				writeServiceError(w, err)
				return
			}
			writeJSON(w, http.StatusCreated, rule)
		default:
			writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		}
		return
	}
	if strings.Contains(rest, "/") {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
		return
	}
	switch r.Method {
	case http.MethodPut:
		defer r.Body.Close()
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32<<10))
		dec.DisallowUnknownFields()
		var input RuleInput
		if err := dec.Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
			return
		}
		rule, err := h.Service.UpdateRule(r.Context(), actor, rest, input)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, rule)
	case http.MethodDelete:
		if err := h.Service.DeleteRule(r.Context(), actor, rest); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
	}
}

func (h HTTPHandler) search(w http.ResponseWriter, r *http.Request, actor string) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	defer r.Body.Close()
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32<<10))
	dec.DisallowUnknownFields()
	var req SearchRequest
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
		return
	}
	out, err := h.Service.SearchMailbox(r.Context(), actor, req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h HTTPHandler) bulkOrganization(w http.ResponseWriter, r *http.Request, actor string) {
	if r.Method != http.MethodPatch {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	defer r.Body.Close()
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
	dec.DisallowUnknownFields()
	var req BulkOrganizationRequest
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
		return
	}
	out, err := h.Service.BulkUpdateOrganization(r.Context(), actor, req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func parseLimit(r *http.Request) int {
	limit := DefaultPageSize
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil {
			limit = n
		}
	}
	return limit
}

func (h HTTPHandler) message(w http.ResponseWriter, r *http.Request, actor string) {
	rest := strings.TrimPrefix(r.URL.Path, "/v1/messages/")
	parts := strings.Split(strings.Trim(rest, "/"), "/")
	if len(parts) == 1 && r.Method == http.MethodGet {
		body, msg, err := h.Service.ReadBody(r.Context(), actor, parts[0])
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, struct {
			Message Message `json:"message"`
			Body    string  `json:"body"`
		}{Message: msg, Body: string(body)})
		return
	}
	if len(parts) == 2 && parts[1] == "reply" && r.Method == http.MethodPost {
		defer r.Body.Close()
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, MaxBodyBytes+4096))
		dec.DisallowUnknownFields()
		var input ReplyRequest
		if err := dec.Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
			return
		}
		msg, err := h.Service.Reply(r.Context(), actor, parts[0], input)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, msg)
		return
	}
	if len(parts) == 2 && parts[1] == "abuse" && r.Method == http.MethodPost {
		defer r.Body.Close()
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10))
		dec.DisallowUnknownFields()
		var input AbuseReportInput
		if err := dec.Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
			return
		}
		report, err := h.Service.ReportAbuse(r.Context(), actor, parts[0], input.Kind)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, report)
		return
	}
	if len(parts) == 2 && parts[1] == "read" && r.Method == http.MethodPost {
		msg, err := h.Service.MarkRead(r.Context(), actor, parts[0])
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, msg)
		return
	}
	if len(parts) == 2 && parts[1] == "unread" && r.Method == http.MethodPost {
		state, err := h.Service.MarkUnread(r.Context(), actor, parts[0])
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, state)
		return
	}
	if len(parts) == 2 && parts[1] == "mailbox" && r.Method == http.MethodGet {
		state, err := h.Service.GetMailboxState(r.Context(), actor, parts[0])
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, state)
		return
	}
	if len(parts) == 2 && parts[1] == "mailbox" && r.Method == http.MethodPatch {
		defer r.Body.Close()
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
		dec.DisallowUnknownFields()
		var update MailboxUpdate
		if err := dec.Decode(&update); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
			return
		}
		state, err := h.Service.UpdateMailbox(r.Context(), actor, parts[0], update)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, state)
		return
	}
	if len(parts) == 2 && parts[1] == "organization" && r.Method == http.MethodPatch {
		defer r.Body.Close()
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
		dec.DisallowUnknownFields()
		var update OrganizationUpdate
		if err := dec.Decode(&update); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON request")
			return
		}
		state, err := h.Service.UpdateOrganization(r.Context(), actor, parts[0], update)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, state)
		return
	}
	if len(parts) == 2 && parts[1] == "restore" && r.Method == http.MethodPost {
		state, err := h.Service.RestoreFromTrash(r.Context(), actor, parts[0])
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, state)
		return
	}
	if len(parts) == 1 && r.Method == http.MethodDelete {
		if err := h.Service.PermanentlyDelete(r.Context(), actor, parts[0]); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrUnauthorized), errors.Is(err, ErrTrustRejected):
		writeError(w, http.StatusForbidden, "FORBIDDEN", err.Error())
	case errors.Is(err, ErrInvalidInput), errors.Is(err, ErrIdempotencyConflict):
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
	case errors.Is(err, ErrInvalidTransition), errors.Is(err, ErrOrganizationConflict), errors.Is(err, ErrSystemLabelImmutable), errors.Is(err, ErrRuleConflict), errors.Is(err, ErrAbuseReportConflict), errors.Is(err, ErrQuarantineReview), errors.Is(err, ErrDraftConflict):
		writeError(w, http.StatusConflict, "CONFLICT", err.Error())
	case errors.Is(err, ErrDraftDeleteUnavailable):
		writeError(w, http.StatusServiceUnavailable, "DRAFT_DELETE_UNAVAILABLE", err.Error())
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
	default:
		writeError(w, http.StatusBadGateway, "DEPENDENCY_FAILURE", "mail dependency failed")
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"code": code, "message": message})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
