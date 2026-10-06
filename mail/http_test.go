package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func testHTTPHandler(t *testing.T) (HTTPHandler, *Service, string) {
	t.Helper()
	s, _ := testService()
	msg, err := s.Send(context.Background(), "alice.420", SendRequest{
		IdempotencyKey: "http-state",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "hello",
		Body:           "body",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	h := HTTPHandler{
		Service: s,
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
	return h, s, msg.ID
}

func performMailRequest(t *testing.T, h HTTPHandler, method, path, actor string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var raw []byte
	if body != nil {
		var err error
		raw, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	req.Header.Set("X-Test-Actor", actor)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHTTPMailboxLifecycleRoutes(t *testing.T) {
	h, _, id := testHTTPHandler(t)

	rec := performMailRequest(t, h, http.MethodGet, "/v1/mailboxes/INBOX", "bob.420", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("inbox status=%d body=%s", rec.Code, rec.Body.String())
	}
	var page MailboxPage
	if err := json.Unmarshal(rec.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].State.Folder != FolderInbox {
		t.Fatalf("unexpected inbox payload: %+v", page)
	}

	archive := FolderArchive
	rec = performMailRequest(t, h, http.MethodPatch, "/v1/messages/"+id+"/mailbox", "bob.420", MailboxUpdate{Folder: &archive})
	if rec.Code != http.StatusOK {
		t.Fatalf("archive status=%d body=%s", rec.Code, rec.Body.String())
	}

	trash := FolderTrash
	rec = performMailRequest(t, h, http.MethodPatch, "/v1/messages/"+id+"/mailbox", "bob.420", MailboxUpdate{Folder: &trash})
	if rec.Code != http.StatusOK {
		t.Fatalf("trash status=%d body=%s", rec.Code, rec.Body.String())
	}

	rec = performMailRequest(t, h, http.MethodDelete, "/v1/messages/"+id, "bob.420", nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete status=%d body=%s", rec.Code, rec.Body.String())
	}

	rec = performMailRequest(t, h, http.MethodGet, "/v1/messages/"+id+"/mailbox", "bob.420", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("deleted state remained visible: status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPRestoreAndInvalidTransition(t *testing.T) {
	h, _, id := testHTTPHandler(t)

	drafts := FolderDrafts
	rec := performMailRequest(t, h, http.MethodPatch, "/v1/messages/"+id+"/mailbox", "bob.420", MailboxUpdate{Folder: &drafts})
	if rec.Code != http.StatusConflict {
		t.Fatalf("reserved-folder transition status=%d body=%s", rec.Code, rec.Body.String())
	}

	trash := FolderTrash
	rec = performMailRequest(t, h, http.MethodPatch, "/v1/messages/"+id+"/mailbox", "bob.420", MailboxUpdate{Folder: &trash})
	if rec.Code != http.StatusOK {
		t.Fatalf("trash status=%d body=%s", rec.Code, rec.Body.String())
	}
	rec = performMailRequest(t, h, http.MethodPost, "/v1/messages/"+id+"/restore", "bob.420", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("restore status=%d body=%s", rec.Code, rec.Body.String())
	}
	var state MailboxState
	if err := json.Unmarshal(rec.Body.Bytes(), &state); err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderInbox {
		t.Fatalf("restore folder=%s", state.Folder)
	}
}

func TestHTTPUnreadAndFlags(t *testing.T) {
	h, _, id := testHTTPHandler(t)
	yes := true

	rec := performMailRequest(t, h, http.MethodPost, "/v1/messages/"+id+"/read", "bob.420", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("read status=%d body=%s", rec.Code, rec.Body.String())
	}
	rec = performMailRequest(t, h, http.MethodPatch, "/v1/messages/"+id+"/mailbox", "bob.420", MailboxUpdate{Starred: &yes, Pinned: &yes, Muted: &yes})
	if rec.Code != http.StatusOK {
		t.Fatalf("flags status=%d body=%s", rec.Code, rec.Body.String())
	}
	rec = performMailRequest(t, h, http.MethodPost, "/v1/messages/"+id+"/unread", "bob.420", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("unread status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPMailboxRequiresOwnership(t *testing.T) {
	h, _, id := testHTTPHandler(t)
	rec := performMailRequest(t, h, http.MethodGet, "/v1/messages/"+id+"/mailbox", "mallory.420", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("foreign mailbox state leaked: status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPLabelsCustomFoldersAndBulkOrganization(t *testing.T) {
	h, _, id := testHTTPHandler(t)

	rec := performMailRequest(t, h, http.MethodPost, "/v1/labels", "bob.420", map[string]string{"name": "Receipts"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create label status=%d body=%s", rec.Code, rec.Body.String())
	}
	var label LabelDefinition
	if err := json.Unmarshal(rec.Body.Bytes(), &label); err != nil {
		t.Fatal(err)
	}

	rec = performMailRequest(t, h, http.MethodPost, "/v1/custom-folders", "bob.420", map[string]string{"name": "Purchases"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create folder status=%d body=%s", rec.Code, rec.Body.String())
	}
	var folder CustomFolder
	if err := json.Unmarshal(rec.Body.Bytes(), &folder); err != nil {
		t.Fatal(err)
	}

	rec = performMailRequest(t, h, http.MethodPatch, "/v1/organization/bulk", "bob.420", BulkOrganizationRequest{
		MessageIDs: []string{id}, AddLabelIDs: []string{label.ID}, CustomFolderID: &folder.ID,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("bulk organization status=%d body=%s", rec.Code, rec.Body.String())
	}

	rec = performMailRequest(t, h, http.MethodGet, "/v1/labels/"+label.ID+"/messages", "bob.420", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("label messages status=%d body=%s", rec.Code, rec.Body.String())
	}
	var byLabel MailboxPage
	if err := json.Unmarshal(rec.Body.Bytes(), &byLabel); err != nil {
		t.Fatal(err)
	}
	if len(byLabel.Items) != 1 || byLabel.Items[0].Message.ID != id {
		t.Fatalf("unexpected label messages: %+v", byLabel)
	}

	rec = performMailRequest(t, h, http.MethodGet, "/v1/custom-folders/"+folder.ID+"/messages", "bob.420", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("folder messages status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPOrganizationOwnershipAndSystemLabelProtection(t *testing.T) {
	h, s, id := testHTTPHandler(t)
	labels, err := s.ListLabels(context.Background(), "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(labels) == 0 {
		t.Fatal("system labels missing")
	}
	rec := performMailRequest(t, h, http.MethodDelete, "/v1/labels/"+labels[0].ID, "bob.420", nil)
	if rec.Code != http.StatusConflict {
		t.Fatalf("system label delete status=%d body=%s", rec.Code, rec.Body.String())
	}

	aliceLabel, err := s.CreateLabel(context.Background(), "alice.420", "Alice only")
	if err != nil {
		t.Fatal(err)
	}
	rec = performMailRequest(t, h, http.MethodPatch, "/v1/messages/"+id+"/organization", "bob.420", OrganizationUpdate{AddLabelIDs: []string{aliceLabel.ID}})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("cross-owner label assignment status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPPrivateSearch(t *testing.T) {
	h, _, id := testHTTPHandler(t)
	rec := performMailRequest(t, h, http.MethodPost, "/v1/search", "bob.420", SearchRequest{Query: "hello"})
	if rec.Code != http.StatusOK {
		t.Fatalf("search status=%d body=%s", rec.Code, rec.Body.String())
	}
	var out SearchResult
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Items) != 1 || out.Items[0].Message.ID != id {
		t.Fatalf("search payload mismatch: %+v", out)
	}

	rec = performMailRequest(t, h, http.MethodPost, "/v1/search", "mallory.420", SearchRequest{Query: "hello"})
	if rec.Code != http.StatusOK {
		t.Fatalf("foreign search status=%d body=%s", rec.Code, rec.Body.String())
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Items) != 0 {
		t.Fatalf("foreign search leaked mailbox data: %+v", out)
	}
}

func TestHTTPPrivateSearchRejectsInvalidInput(t *testing.T) {
	h, _, _ := testHTTPHandler(t)
	rec := performMailRequest(t, h, http.MethodPost, "/v1/search", "bob.420", SearchRequest{Query: strings.Repeat("x", MaxSearchQueryBytes+1)})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("oversized search status=%d body=%s", rec.Code, rec.Body.String())
	}
	rec = performMailRequest(t, h, http.MethodGet, "/v1/search", "bob.420", nil)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("search method status=%d body=%s", rec.Code, rec.Body.String())
	}
}


func TestHTTPRulesCRUDAndDeliveryApplication(t *testing.T) {
	h, s, _ := testHTTPHandler(t)
	archive := FolderArchive
	rec := performMailRequest(t, h, http.MethodPost, "/v1/rules", "bob.420", RuleInput{
		Name:      "Alice archive",
		Condition: RuleCondition{SenderEquals: "alice.420"},
		Action:    RuleAction{Folder: &archive, Starred: boolPtr(true)},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create rule status=%d body=%s", rec.Code, rec.Body.String())
	}
	var rule MailRule
	if err := json.Unmarshal(rec.Body.Bytes(), &rule); err != nil {
		t.Fatal(err)
	}
	if rule.ID == "" || rule.Owner != "bob.420" || !rule.Enabled {
		t.Fatalf("unexpected created rule: %+v", rule)
	}

	rec = performMailRequest(t, h, http.MethodGet, "/v1/rules", "bob.420", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("list rules status=%d body=%s", rec.Code, rec.Body.String())
	}
	var listed []MailRule
	if err := json.Unmarshal(rec.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed) != 1 || listed[0].ID != rule.ID {
		t.Fatalf("unexpected rules listing: %+v", listed)
	}

	msg, err := s.Send(context.Background(), "alice.420", SendRequest{
		IdempotencyKey: "http-rule-send", Sender: "alice.420", Recipient: "bob.420",
		Subject: "hello", Body: "body", Source: ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.GetMailboxState(context.Background(), "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderArchive || !state.Starred {
		t.Fatalf("HTTP-created rule did not execute: %+v", state)
	}

	disabled := false
	rec = performMailRequest(t, h, http.MethodPut, "/v1/rules/"+rule.ID, "bob.420", RuleInput{
		Name: "Alice archive disabled", Enabled: &disabled,
		Condition: RuleCondition{SenderEquals: "alice.420"},
		Action:    RuleAction{Folder: &archive},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("update rule status=%d body=%s", rec.Code, rec.Body.String())
	}

	rec = performMailRequest(t, h, http.MethodDelete, "/v1/rules/"+rule.ID, "alice.420", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("foreign rule delete status=%d body=%s", rec.Code, rec.Body.String())
	}
	rec = performMailRequest(t, h, http.MethodDelete, "/v1/rules/"+rule.ID, "bob.420", nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete rule status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPRulesRejectInvalidTargetsAndUnknownFields(t *testing.T) {
	h, _, _ := testHTTPHandler(t)
	sent := FolderSent
	rec := performMailRequest(t, h, http.MethodPost, "/v1/rules", "bob.420", RuleInput{
		Name: "bad folder", Condition: RuleCondition{SenderEquals: "alice.420"}, Action: RuleAction{Folder: &sent},
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("forbidden rule folder status=%d body=%s", rec.Code, rec.Body.String())
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/rules", bytes.NewBufferString(`{"name":"x","condition":{"sender_equals":"alice.420"},"action":{"starred":true},"unexpected":1}`))
	req.Header.Set("Authorization", "bob.420")
	recorder := httptest.NewRecorder()
	h.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("unknown rule field status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}
