package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
)

var ErrSnapshotUnavailable = errors.New("snapshot unavailable")

type Backend interface {
	Health() (model.Health, error)
	Block(number uint64) (model.BlockRecord, bool, error)
	Blocks(cursor *Cursor, limit uint32) (BlockPage, error)
	Transaction(hash string) (model.TransactionRecord, bool, error)
	Receipt(txHash string) (model.ReceiptRecord, bool, error)
	LogsByBlock(number uint64) ([]model.LogRecord, error)
	ServiceVersion(serviceID string, version uint32) (decoder.ServiceVersion, error)
}

type addressBackend interface { AddressTransactions(address string, limit uint32) (AddressTransactionPage, error) }
type registryBackend interface { Service(string) (decoder.ServiceSummary, error); Services() []decoder.ServiceSummary }
type Server struct { backend Backend }
func NewServer(backend Backend) *Server { return &Server{backend: backend} }

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", s.health)
	mux.HandleFunc("GET /v1/blocks/{number}", s.block)
	mux.HandleFunc("GET /v1/blocks", s.blocks)
	mux.HandleFunc("GET /v1/transactions", s.transactions)
	mux.HandleFunc("GET /v1/transactions/{hash}", s.transaction)
	mux.HandleFunc("GET /v1/receipts/{hash}", s.receipt)
	mux.HandleFunc("GET /v1/blocks/{number}/logs", s.blockLogs)
	mux.HandleFunc("GET /v1/contracts/{address}", s.contract)
	mux.HandleFunc("GET /v1/services", s.services)
	mux.HandleFunc("GET /v1/services/{service}", s.service)
	mux.HandleFunc("GET /v1/services/{service}/versions/{version}", s.serviceVersion)
	return mux
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) { h,err:=s.backend.Health(); if err!=nil{writeError(w,http.StatusServiceUnavailable,err);return}; writeJSON(w,http.StatusOK,HealthResponse{Health:h,CanonicalAuthority:false}) }
func (s *Server) block(w http.ResponseWriter,r *http.Request){n,err:=strconv.ParseUint(r.PathValue("number"),10,64);if err!=nil{writeError(w,http.StatusBadRequest,err);return};b,ok,err:=s.backend.Block(n);if err!=nil{writeError(w,http.StatusServiceUnavailable,err);return};if !ok{writeError(w,http.StatusNotFound,errors.New("block not indexed"));return};writeJSON(w,http.StatusOK,b)}
func (s *Server) transaction(w http.ResponseWriter,r *http.Request){tx,ok,err:=s.backend.Transaction(r.PathValue("hash"));if err!=nil{writeError(w,http.StatusServiceUnavailable,err);return};if !ok{writeError(w,http.StatusNotFound,errors.New("transaction not indexed"));return};writeJSON(w,http.StatusOK,ReadResponse[model.TransactionRecord]{Data:tx,CanonicalAuthority:false})}
func (s *Server) transactions(w http.ResponseWriter,r *http.Request){address:=r.URL.Query().Get("address");if address==""{writeError(w,http.StatusBadRequest,errors.New("address query required"));return};limit:=uint32(50);if raw:=r.URL.Query().Get("limit");raw!=""{n,err:=strconv.ParseUint(raw,10,32);if err!=nil||n==0||n>250{writeError(w,http.StatusBadRequest,ErrInvalidCursor);return};limit=uint32(n)};backend,ok:=s.backend.(addressBackend);if !ok{writeError(w,http.StatusServiceUnavailable,ErrAddressQueryUnavailable);return};page,err:=backend.AddressTransactions(address,limit);if err!=nil{status:=http.StatusServiceUnavailable;if errors.Is(err,ErrSnapshotUnavailable){status=http.StatusConflict};writeError(w,status,err);return};writeJSON(w,http.StatusOK,page)}
func (s *Server) receipt(w http.ResponseWriter,r *http.Request){receipt,ok,err:=s.backend.Receipt(r.PathValue("hash"));if err!=nil{writeError(w,http.StatusServiceUnavailable,err);return};if !ok{writeError(w,http.StatusNotFound,errors.New("receipt not indexed"));return};writeJSON(w,http.StatusOK,ReadResponse[model.ReceiptRecord]{Data:receipt,CanonicalAuthority:false})}
func (s *Server) blockLogs(w http.ResponseWriter,r *http.Request){n,err:=strconv.ParseUint(r.PathValue("number"),10,64);if err!=nil{writeError(w,http.StatusBadRequest,err);return};logs,err:=s.backend.LogsByBlock(n);if err!=nil{writeError(w,http.StatusServiceUnavailable,err);return};writeJSON(w,http.StatusOK,ReadResponse[[]model.LogRecord]{Data:logs,CanonicalAuthority:false})}
func (s *Server) services(w http.ResponseWriter,_ *http.Request){backend,ok:=s.backend.(registryBackend);if !ok{writeError(w,http.StatusServiceUnavailable,errors.New("registry query unavailable"));return};writeJSON(w,http.StatusOK,ReadResponse[[]decoder.ServiceSummary]{Data:backend.Services(),CanonicalAuthority:false})}
func (s *Server) service(w http.ResponseWriter,r *http.Request){backend,ok:=s.backend.(registryBackend);if !ok{writeError(w,http.StatusServiceUnavailable,errors.New("registry query unavailable"));return};record,err:=backend.Service(r.PathValue("service"));if err!=nil{status:=http.StatusServiceUnavailable;if errors.Is(err,decoder.ErrUnknownServiceVersion){status=http.StatusNotFound};writeError(w,status,err);return};writeJSON(w,http.StatusOK,ReadResponse[decoder.ServiceSummary]{Data:record,CanonicalAuthority:false})}
func (s *Server) serviceVersion(w http.ResponseWriter,r *http.Request){n,err:=strconv.ParseUint(r.PathValue("version"),10,32);if err!=nil||n==0{writeError(w,http.StatusBadRequest,decoder.ErrUnknownServiceVersion);return};record,err:=s.backend.ServiceVersion(r.PathValue("service"),uint32(n));if err!=nil{status:=http.StatusServiceUnavailable;if errors.Is(err,decoder.ErrUnknownServiceVersion){status=http.StatusNotFound};writeError(w,status,err);return};writeJSON(w,http.StatusOK,ReadResponse[decoder.ServiceVersion]{Data:record,CanonicalAuthority:false})}
func (s *Server) blocks(w http.ResponseWriter,r *http.Request){limit:=uint32(50);if raw:=r.URL.Query().Get("limit");raw!=""{n,err:=strconv.ParseUint(raw,10,32);if err!=nil||n==0||n>250{writeError(w,http.StatusBadRequest,ErrInvalidCursor);return};limit=uint32(n)};var cur *Cursor;if raw:=r.URL.Query().Get("cursor");raw!=""{decoded,err:=DecodeCursor(raw);if err!=nil{writeError(w,http.StatusBadRequest,err);return};cur=&decoded;limit=decoded.Limit};page,err:=s.backend.Blocks(cur,limit);if err!=nil{status:=http.StatusServiceUnavailable;if errors.Is(err,ErrSnapshotUnavailable){status=http.StatusConflict};writeError(w,status,err);return};writeJSON(w,http.StatusOK,page)}
func writeJSON(w http.ResponseWriter,status int,v any){w.Header().Set("content-type","application/json");w.WriteHeader(status);_=json.NewEncoder(w).Encode(v)}
func writeError(w http.ResponseWriter,status int,err error){writeJSON(w,status,map[string]any{"error":err.Error(),"canonicalAuthority":false})}
