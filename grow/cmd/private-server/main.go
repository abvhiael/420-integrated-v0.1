// Command private-server exposes authenticated 420Grow cultivation data, entirely
// independent of the anonymous 420Location place discovery service.
package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	_ "github.com/lib/pq"

	"github.com/420integrated/420-integrated/grow/dashboard"
)

func databaseURL(raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || u == nil || u.Scheme != "postgresql" && u.Scheme != "postgres" ||
		u.Host == "" || u.User == nil || u.Query().Get("sslmode") != "verify-full" ||
		u.Fragment != "" {
		return "", errors.New("private PostgreSQL requires authenticated verify-full TLS")
	}
	return raw, nil
}
func main() {
	dsn, err := databaseURL(os.Getenv("GROW_PRIVATE_DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	cert := os.Getenv("GROW_PRIVATE_TLS_CERT")
	key := os.Getenv("GROW_PRIVATE_TLS_KEY")
	static := os.Getenv("GROW_PRIVATE_STATIC_DIR")
	clientCA := os.Getenv("GROW_PRIVATE_CLIENT_CA")
	if cert == "" || key == "" || static == "" || clientCA == "" {
		log.Fatal("private server requires TLS certificate, key, client CA and built static assets")
	}
	if stat, err := os.Stat(filepath.Join(static, "workspace.html")); err != nil || stat.IsDir() {
		log.Fatal("private static build is missing")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("private PostgreSQL driver unavailable")
	}
	defer db.Close()
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(3)
	db.SetConnMaxLifetime(20 * time.Minute)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	pingCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	if err = db.PingContext(pingCtx); err != nil {
		cancel()
		log.Fatal("private PostgreSQL unavailable")
	}
	cancel()

	mux := http.NewServeMux()
	if err = dashboard.MountPrivate(mux, db); err != nil {
		log.Fatal(err)
	}
	mux.HandleFunc("/runtime-config.js", func(w http.ResponseWriter, r *http.Request) {
		if r.TLS == nil || r.Method != http.MethodGet {
			http.Error(w, "private TLS required", http.StatusForbidden)
			return
		}
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write([]byte(`window.GROW420_CONFIG=Object.freeze({enabled:false,locationBaseUrl:""});window.GROW420_PRIVATE_CONFIG=Object.freeze({enabled:true,privateApiBaseUrl:` + jsOrigin(r.Host) + `});`))
	})
	staticHandler := http.FileServer(http.Dir(static))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Cache-Control", "no-store, private")
		staticHandler.ServeHTTP(w, r)
	}))
	addr := os.Getenv("GROW_PRIVATE_LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8443"
	}
	pem, err := os.ReadFile(clientCA)
	if err != nil {
		log.Fatal("private client CA unavailable")
	}
	clientPool := x509.NewCertPool()
	if !clientPool.AppendCertsFromPEM(pem) {
		log.Fatal("private client CA is invalid")
	}
	server := &http.Server{
		Addr: addr, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000")
			w.Header().Set("Referrer-Policy", "no-referrer")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
			mux.ServeHTTP(w, r)
		}),
		TLSConfig:         &tls.Config{MinVersion: tls.VersionTLS13, ClientAuth: tls.VerifyClientCertIfGiven, ClientCAs: clientPool},
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       45 * time.Second,
		MaxHeaderBytes:    16384,
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	log.Printf("420Grow private HTTPS service enabled on %s", strings.TrimSpace(addr))
	if err := server.ListenAndServeTLS(cert, key); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal("private TLS server terminated")
	}
}

// Return a JS string literal only after strict host validation; Host cannot
// inject executable code into the deployment runtime configuration.
func jsOrigin(host string) string {
	if host == "" || len(host) > 255 || strings.ContainsAny(host, "\"'\\<>\r\n ") {
		return "null"
	}
	for _, r := range host {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' ||
			r == '.' || r == '-' || r == ':' || r == '[' || r == ']') {
			return "null"
		}
	}
	return `"https://` + host + `/"`
}
