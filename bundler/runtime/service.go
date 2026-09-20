package runtime

import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "net/http"
 "sync/atomic"
 "time"
)

type ExecutionProbe interface {
 ChainID(context.Context) (uint64,error)
 EntryPointCode(context.Context,string) (string,error)
 LatestBlockTime(context.Context) (time.Time,error)
}

type Service struct {
 cfg Config
 probe ExecutionProbe
 ready atomic.Bool
 headUnix atomic.Int64
}
func NewService(cfg Config,probe ExecutionProbe)(*Service,error){
 if err:=cfg.Validate();err!=nil{return nil,err}
 if probe==nil{return nil,errors.New("execution probe is required")}
 return &Service{cfg:cfg,probe:probe},nil
}
func (s *Service) Ready()bool{return s.ready.Load()}
func (s *Service) Qualify(ctx context.Context,now time.Time)error{
 if now.IsZero(){return errors.New("qualification time is required")}
 chainID,err:=s.probe.ChainID(ctx)
 if err!=nil{s.ready.Store(false);return fmt.Errorf("execution chain identity unavailable: %w",err)}
 if chainID!=s.cfg.ChainID{s.ready.Store(false);return fmt.Errorf("wrong chain: configured=%d actual=%d",s.cfg.ChainID,chainID)}
 code,err:=s.probe.EntryPointCode(ctx,s.cfg.EntryPoint)
 if err!=nil{s.ready.Store(false);return fmt.Errorf("entry point unavailable: %w",err)}
 if code==""||code=="0x"||code=="0x0"{s.ready.Store(false);return errors.New("entry point has no deployed code")}
 headTime,err:=s.probe.LatestBlockTime(ctx)
 if err!=nil{s.ready.Store(false);return fmt.Errorf("latest block unavailable: %w",err)}
 if headTime.IsZero()||headTime.After(now.Add(time.Second))||now.Sub(headTime)>s.cfg.MaxHeadAge{s.ready.Store(false);return fmt.Errorf("execution head is stale or invalid: head_time=%s",headTime.UTC().Format(time.RFC3339))}
 s.headUnix.Store(headTime.Unix());s.ready.Store(true);return nil
}
func (s *Service) Handler()http.Handler{
 mux:=http.NewServeMux()
 mux.HandleFunc("GET /healthz",func(w http.ResponseWriter,_ *http.Request){
  writeJSON(w,http.StatusOK,map[string]any{"service":"420Bundler","status":"ok","canonical":false,"custodial":false,"authorization_authority":false})
 })
 mux.HandleFunc("GET /readyz",func(w http.ResponseWriter,_ *http.Request){
  if !s.ready.Load(){writeJSON(w,http.StatusServiceUnavailable,map[string]any{"service":"420Bundler","ready":false,"canonical":false});return}
  writeJSON(w,http.StatusOK,map[string]any{"service":"420Bundler","ready":true,"canonical":false,"chain_id":s.cfg.ChainID,"entry_point":s.cfg.EntryPoint,"head_observed_at":time.Unix(s.headUnix.Load(),0).UTC().Format(time.RFC3339)})
 })
 return mux
}
func writeJSON(w http.ResponseWriter,status int,v any){w.Header().Set("Content-Type","application/json");w.WriteHeader(status);_=json.NewEncoder(w).Encode(v)}
