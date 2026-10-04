package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/420integrated/420-integrated/verify/store"
	"github.com/420integrated/420-integrated/verify/submission"
)

type processorCapture struct {
	record store.Record
	got    submission.Submission
}

func (p *processorCapture) Verify(_ context.Context, _ uint64, _ string, submitted submission.Submission) (store.Record, error) {
	p.got = submitted
	return p.record, nil
}

func TestSubmissionDerivesOmittedBundleCommitmentBeforeProcessing(t *testing.T) {
	s, record, submitted := fixture(t)
	want := submitted.BundleHash
	submitted.BundleHash = ""
	capture := &processorCapture{record: record}
	service, err := New(s, capture)
	if err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(SubmissionRequest{PublishSource:true,ChainID: 420, Address: record.Deployment.Address, Submission: submitted})
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	service.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/v1/verify/submissions", bytes.NewReader(body)))
	if w.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if capture.got.BundleHash != want {
		t.Fatalf("processor got bundle hash %q want %q", capture.got.BundleHash, want)
	}
}

func TestSubmissionRejectsIncorrectSuppliedBundleCommitment(t *testing.T) {
	s, record, submitted := fixture(t)
	submitted.BundleHash = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	service, err := New(s, processorStub{record: record})
	if err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(SubmissionRequest{PublishSource:true,ChainID: 420, Address: record.Deployment.Address, Submission: submitted})
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	service.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/v1/verify/submissions", bytes.NewReader(body)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}


func TestSubmissionRequiresExplicitSourcePublicationConsent(t *testing.T) {
	s, record, submitted := fixture(t)
	service, err := New(s, processorStub{record: record})
	if err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(SubmissionRequest{
		ChainID:    420,
		Address:    record.Deployment.Address,
		Submission: submitted,
	})
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	service.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/v1/verify/submissions", bytes.NewReader(body)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if !bytes.Contains(w.Body.Bytes(), []byte("publishSource=true")) {
		t.Fatalf("missing publication-consent diagnostic: %s", w.Body.String())
	}
}
