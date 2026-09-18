package httpapi

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/reputation/interactions"
	"github.com/420integrated/420-integrated/reputation/model"
	"github.com/420integrated/420-integrated/reputation/service"
)

const maxBodyBytes = 1 << 20

type ReviewService interface {
	CreateReview(context.Context, service.CreateReviewInput, time.Time) (model.Review, error)
	GetReview(context.Context, string) (model.Review, error)
	ListReviews(context.Context, model.Domain, model.SubjectRef) ([]model.Review, error)
	UpdateReview(context.Context, service.UpdateReviewInput, time.Time) (model.Review, error)
}

type Server struct {
	service ReviewService
	now     func() time.Time
	idem    *idempotencyStore
}

func New(svc ReviewService) (*Server, error) {
	if svc == nil {
		return nil, errors.New("reputation review HTTP service is required")
	}
	return &Server{service: svc, now: time.Now, idem: newIdempotencyStore()}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/reviews", s.create)
	mux.HandleFunc("GET /v1/reviews/{reviewId}", s.get)
	mux.HandleFunc("GET /v1/reviews/{domain}/{subjectType}/{subjectId}", s.list)
	mux.HandleFunc("PATCH /v1/reviews/{reviewId}", s.update)
	return mux
}

type createRequest struct {
	ReviewID        string   `json:"reviewId"`
	Domain          string   `json:"domain"`
	SubjectType     string   `json:"subjectType"`
	SubjectID       string   `json:"subjectId"`
	ReviewerType    string   `json:"reviewerType"`
	ReviewerID      string   `json:"reviewerId"`
	Rating          uint8    `json:"rating"`
	BodyRef         string   `json:"bodyRef"`
	AttachmentRefs  []string `json:"attachmentRefs"`
	Verification    string   `json:"verification"`
	InteractionKind string   `json:"interactionKind"`
	EvidenceRef     string   `json:"evidenceRef"`
}

type updateRequest struct {
	ActorType      string   `json:"actorType"`
	ActorID        string   `json:"actorId"`
	ExpectedVersion uint32  `json:"expectedVersion"`
	Rating          uint8    `json:"rating"`
	BodyRef         string   `json:"bodyRef"`
	AttachmentRefs  []string `json:"attachmentRefs"`
}

func (s *Server) create(w http.ResponseWriter, r *http.Request) {
	body, err := readBody(r)
	if err != nil { badRequest(w, err); return }
	fp := fingerprint("POST /v1/reviews", body)
	if replay, ok, err := s.idem.Get(r.Header.Get("Idempotency-Key"), fp); err != nil {
		badRequest(w, err); return
	} else if ok {
		writeRaw(w, replay.Status, replay.Body); return
	}
	var req createRequest
	if err := decodeStrict(body, &req); err != nil { badRequest(w, err); return }
	review, err := s.service.CreateReview(r.Context(), service.CreateReviewInput{
		ID: req.ReviewID,
		Domain: model.Domain(strings.ToUpper(strings.TrimSpace(req.Domain))),
		Subject: model.SubjectRef{Type:req.SubjectType, ID:req.SubjectID},
		Author: model.SubjectRef{Type:req.ReviewerType, ID:req.ReviewerID},
		Rating:req.Rating, BodyRef:req.BodyRef, AttachmentRefs:req.AttachmentRefs,
		Verification:model.VerificationState(strings.ToUpper(strings.TrimSpace(req.Verification))),
		InteractionKind:interactions.Kind(strings.ToUpper(strings.TrimSpace(req.InteractionKind))),
		EvidenceRef:req.EvidenceRef,
	}, s.now().UTC())
	if err != nil { badRequest(w, err); return }
	payload, _ := json.Marshal(review)
	s.idem.Put(r.Header.Get("Idempotency-Key"), idempotencyResult{Fingerprint:fp, Status:http.StatusCreated, Body:payload})
	writeRaw(w, http.StatusCreated, payload)
}

func (s *Server) get(w http.ResponseWriter, r *http.Request) {
	review, err := s.service.GetReview(r.Context(), r.PathValue("reviewId"))
	if err != nil { http.Error(w, err.Error(), http.StatusNotFound); return }
	writeJSON(w, http.StatusOK, review)
}

func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	reviews, err := s.service.ListReviews(r.Context(),
		model.Domain(strings.ToUpper(strings.TrimSpace(r.PathValue("domain")))),
		model.SubjectRef{Type:r.PathValue("subjectType"), ID:r.PathValue("subjectId")})
	if err != nil { badRequest(w, err); return }
	limit := 50
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 200 { badRequest(w, errors.New("limit must be between 1 and 200")); return }
		limit = n
	}
	if len(reviews) > limit { reviews = reviews[:limit] }
	writeJSON(w, http.StatusOK, map[string]any{"items":reviews, "count":len(reviews)})
}

func (s *Server) update(w http.ResponseWriter, r *http.Request) {
	body, err := readBody(r)
	if err != nil { badRequest(w, err); return }
	fp := fingerprint("PATCH /v1/reviews/"+r.PathValue("reviewId"), body)
	if replay, ok, err := s.idem.Get(r.Header.Get("Idempotency-Key"), fp); err != nil {
		badRequest(w, err); return
	} else if ok {
		writeRaw(w, replay.Status, replay.Body); return
	}
	var req updateRequest
	if err := decodeStrict(body, &req); err != nil { badRequest(w, err); return }
	review, err := s.service.UpdateReview(r.Context(), service.UpdateReviewInput{
		ReviewID:r.PathValue("reviewId"), ExpectedVersion:req.ExpectedVersion,
		Actor:model.SubjectRef{Type:req.ActorType, ID:req.ActorID},
		Rating:req.Rating, BodyRef:req.BodyRef, AttachmentRefs:req.AttachmentRefs,
	}, s.now().UTC())
	if err != nil { badRequest(w, err); return }
	payload, _ := json.Marshal(review)
	s.idem.Put(r.Header.Get("Idempotency-Key"), idempotencyResult{Fingerprint:fp, Status:http.StatusOK, Body:payload})
	writeRaw(w, http.StatusOK, payload)
}

func readBody(r *http.Request) ([]byte, error) {
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
	if err != nil { return nil, err }
	if len(body) > maxBodyBytes { return nil, errors.New("request body too large") }
	if len(bytes.TrimSpace(body)) == 0 { return nil, errors.New("request body is required") }
	return body, nil
}

func decodeStrict(body []byte, out any) error {
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(out); err != nil { return err }
	if dec.Decode(&struct{}{}) != io.EOF { return errors.New("request must contain one JSON object") }
	return nil
}

func fingerprint(route string, body []byte) string {
	sum := sha256.Sum256(append([]byte(route+"\x00"), body...))
	return hex.EncodeToString(sum[:])
}

func badRequest(w http.ResponseWriter, err error) {
	writeJSON(w, http.StatusBadRequest, map[string]string{"error":err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	payload, err := json.Marshal(value)
	if err != nil { http.Error(w, "response encoding failed", http.StatusInternalServerError); return }
	writeRaw(w, status, payload)
}

func writeRaw(w http.ResponseWriter, status int, payload []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_, _ = w.Write(append(append([]byte(nil), payload...), '\n'))
}
