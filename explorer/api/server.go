package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	explorerservice "github.com/420integrated/420-integrated/explorer/service"
	explorerweb "github.com/420integrated/420-integrated/explorer/web"
)

type Server struct { service *explorerservice.Service; mux *http.ServeMux }
type errorResponse struct { Error string `json:"error"` }
type healthResponse struct { Service string `json:"service"`; Status string `json:"status"`; CanonicalAuthority bool `json:"canonicalAuthority"`; DataSource string `json:"dataSource"` }
type readinessResponse struct { Ready bool `json:"ready"`; Status explorerservice.NetworkStatus `json:"status"`; Issue *OperationalIssue `json:"issue,omitempty"` }
type capabilitiesResponse struct { Service string `json:"service"`; Qualification string `json:"qualification"`; CanonicalAuthority bool `json:"canonicalAuthority"`; DataSource string `json:"dataSource"`; Endpoints []string `json:"endpoints"` }

func NewServer(service *explorerservice.Service) (*Server,error){if service==nil{return nil,errors.New("420Explorer service required")};s:=&Server{service:service,mux:http.NewServeMux()};s.routes();return s,nil}
func (s *Server) Handler() http.Handler{return provenanceHeaders(s.mux)}
func provenanceHeaders(next http.Handler) http.Handler{return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){if strings.HasPrefix(r.URL.Path,"/v1/"){w.Header().Set("X-420-Service","420Explorer");w.Header().Set("X-420-Data-Source","420Indexer");w.Header().Set("X-420-Canonical-Authority","false");w.Header().Set("X-420-Consumer-Qualification","QUALIFIED_INDEXER_API_CONSUMER")};next.ServeHTTP(w,r)})}
func (s *Server) routes(){
	s.mux.HandleFunc("GET /v1/health",s.handleHealth)
	s.mux.HandleFunc("GET /v1/ready",s.handleReady)
	s.mux.HandleFunc("GET /v1/capabilities",s.handleCapabilities)
	s.mux.HandleFunc("GET /v1/status",s.handleStatus)
	s.mux.HandleFunc("GET /v1/blocks",s.handleBlocks)
	s.mux.HandleFunc("GET /v1/blocks/{number}",s.handleBlock)
	s.mux.HandleFunc("GET /v1/transactions/{hash}",s.handleTransaction)
	s.mux.HandleFunc("GET /v1/receipts/{hash}",s.handleReceipt)
	s.mux.HandleFunc("GET /v1/addresses/{address}",s.handleAddress)
	s.mux.HandleFunc("GET /v1/contracts/{address}",s.handleContract)
	s.mux.HandleFunc("GET /v1/services",s.handleServices)
	s.mux.HandleFunc("GET /v1/services/{service}",s.handleService)
	s.mux.HandleFunc("GET /v1/services/{service}/versions/{version}",s.handleServiceVersion)
	s.mux.HandleFunc("GET /v1/assets/activity",s.handleAssetActivity)
	s.mux.HandleFunc("GET /v1/consensus",s.handleConsensus)
	s.mux.Handle("/", explorerweb.Handler())
}
func (s *Server) handleHealth(w http.ResponseWriter,r *http.Request){writeJSON(w,http.StatusOK,healthResponse{Service:"420Explorer",Status:"LIVE",CanonicalAuthority:false,DataSource:"420Indexer"})}
func (s *Server) handleReady(w http.ResponseWriter,r *http.Request){status,err:=s.service.NetworkStatus(r.Context());if err!=nil{issue:=operationalIssue(err);if issue.Retryable{w.Header().Set("Retry-After","15")};writeJSON(w,http.StatusServiceUnavailable,readinessResponse{Ready:false,Status:status,Issue:&issue});return};writeJSON(w,http.StatusOK,readinessResponse{Ready:true,Status:status})}
func (s *Server) handleCapabilities(w http.ResponseWriter,r *http.Request){writeJSON(w,http.StatusOK,capabilitiesResponse{Service:"420Explorer",Qualification:"QUALIFIED_INDEXER_API_CONSUMER",CanonicalAuthority:false,DataSource:"420Indexer",Endpoints:[]string{"/v1/health","/v1/ready","/v1/status","/v1/blocks","/v1/transactions/{hash}","/v1/receipts/{hash}","/v1/addresses/{address}","/v1/contracts/{address}","/v1/services","/v1/assets/activity","/v1/consensus"}})}
func (s *Server) handleStatus(w http.ResponseWriter,r *http.Request){status,err:=s.service.NetworkStatus(r.Context());if err!=nil{issue:=operationalIssue(err);if issue.Retryable{w.Header().Set("Retry-After","15")};writeJSON(w,explorerErrorStatus(err),statusFailureResponse{Status:status,Issue:issue});return};writeJSON(w,http.StatusOK,status)}
func (s *Server) handleBlocks(w http.ResponseWriter,r *http.Request){var limit uint64;var err error;if raw:=strings.TrimSpace(r.URL.Query().Get("limit"));raw!=""{limit,err=strconv.ParseUint(raw,10,32);if err!=nil||limit==0{writeError(w,http.StatusBadRequest,"invalid limit");return}};page,err:=s.service.BlockPage(r.Context(),uint32(limit),r.URL.Query().Get("cursor"));if err!=nil{writeError(w,explorerErrorStatus(err),err.Error());return};writeJSON(w,http.StatusOK,page)}
func (s *Server) handleBlock(w http.ResponseWriter,r *http.Request){number,err:=strconv.ParseUint(r.PathValue("number"),10,64);if err!=nil{writeError(w,http.StatusBadRequest,"invalid block number");return};view,err:=s.service.BlockDetail(r.Context(),number);if err!=nil{writeError(w,explorerErrorStatus(err),err.Error());return};writeJSON(w,http.StatusOK,view)}
func (s *Server) handleTransaction(w http.ResponseWriter,r *http.Request){hash:=strings.TrimSpace(r.PathValue("hash"));if hash==""{writeError(w,http.StatusBadRequest,"transaction hash required");return};view,err:=s.service.TransactionDetail(r.Context(),hash);if err!=nil{writeError(w,explorerErrorStatus(err),err.Error());return};writeJSON(w,http.StatusOK,view)}
func (s *Server) handleReceipt(w http.ResponseWriter,r *http.Request){hash:=strings.TrimSpace(r.PathValue("hash"));if hash==""{writeError(w,http.StatusBadRequest,"transaction hash required");return};view,err:=s.service.ReceiptDetail(r.Context(),hash);if err!=nil{writeError(w,explorerErrorStatus(err),err.Error());return};writeJSON(w,http.StatusOK,view)}
func (s *Server) handleAddress(w http.ResponseWriter,r *http.Request){var limit uint64;var err error;if raw:=strings.TrimSpace(r.URL.Query().Get("limit"));raw!=""{limit,err=strconv.ParseUint(raw,10,32);if err!=nil||limit==0||limit>250{writeError(w,http.StatusBadRequest,"invalid limit");return}};view,err:=s.service.Address(r.Context(),r.PathValue("address"),uint32(limit));if err!=nil{status:=explorerErrorStatus(err);if errors.Is(err,explorerservice.ErrInvalidAddress){status=http.StatusBadRequest};writeError(w,status,err.Error());return};writeJSON(w,http.StatusOK,view)}
func (s *Server) handleContract(w http.ResponseWriter,r *http.Request){view,err:=s.service.ContractDetail(r.Context(),r.PathValue("address"));if err!=nil{status:=explorerErrorStatus(err);if strings.Contains(err.Error(),"invalid contract address"){status=http.StatusBadRequest};writeError(w,status,err.Error());return};writeJSON(w,http.StatusOK,view)}
func (s *Server) handleServices(w http.ResponseWriter,r *http.Request){view,err:=s.service.Registry(r.Context());if err!=nil{writeError(w,explorerErrorStatus(err),err.Error());return};writeJSON(w,http.StatusOK,view)}
func (s *Server) handleService(w http.ResponseWriter,r *http.Request){id:=strings.TrimSpace(r.PathValue("service"));if id==""{writeError(w,http.StatusBadRequest,"service id required");return};view,err:=s.service.RegistryService(r.Context(),id);if err!=nil{writeError(w,explorerErrorStatus(err),err.Error());return};writeJSON(w,http.StatusOK,view)}
func (s *Server) handleServiceVersion(w http.ResponseWriter,r *http.Request){serviceID:=strings.TrimSpace(r.PathValue("service"));if serviceID==""{writeError(w,http.StatusBadRequest,"service id required");return};version,err:=strconv.ParseUint(r.PathValue("version"),10,32);if err!=nil||version==0{writeError(w,http.StatusBadRequest,"invalid service version");return};record,err:=s.service.ServiceVersion(r.Context(),serviceID,uint32(version));if err!=nil{writeError(w,explorerErrorStatus(err),err.Error());return};writeJSON(w,http.StatusOK,record)}
func (s *Server) handleAssetActivity(w http.ResponseWriter,r *http.Request){var limit uint64;var err error;if raw:=strings.TrimSpace(r.URL.Query().Get("limit"));raw!=""{limit,err=strconv.ParseUint(raw,10,32);if err!=nil||limit==0||limit>250{writeError(w,http.StatusBadRequest,"invalid limit");return}};view,err:=s.service.AssetActivity(r.Context(),r.URL.Query().Get("assetKey"),r.URL.Query().Get("address"),uint32(limit));if err!=nil{status:=explorerErrorStatus(err);if errors.Is(err,explorerservice.ErrInvalidAddress){status=http.StatusBadRequest};writeError(w,status,err.Error());return};writeJSON(w,http.StatusOK,view)}
func (s *Server) handleConsensus(w http.ResponseWriter,r *http.Request){view,err:=s.service.Consensus(r.Context());if err!=nil{writeError(w,explorerErrorStatus(err),err.Error());return};writeJSON(w,http.StatusOK,view)}
func explorerErrorStatus(err error)int{switch{case errors.Is(err,explorerservice.ErrWrongChain),errors.Is(err,explorerservice.ErrIndexerStale),errors.Is(err,explorerservice.ErrIndexerDegraded),errors.Is(err,explorerservice.ErrIndexerInconsistent):return http.StatusServiceUnavailable;default:return http.StatusBadGateway}}
func writeError(w http.ResponseWriter,status int,message string){writeJSON(w,status,errorResponse{Error:message})}
func writeJSON(w http.ResponseWriter,status int,value any){w.Header().Set("Content-Type","application/json");w.Header().Set("Cache-Control","no-store");w.WriteHeader(status);_=json.NewEncoder(w).Encode(value)}
