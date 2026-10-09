package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/golang-jwt/jwt/v5"
	"magic-shop/catalog-api/internal/auth"
	"magic-shop/catalog-api/internal/domain"
	"magic-shop/catalog-api/internal/store"
)

type api struct {
	db     *store.Store
	verify *auth.Verifier
	spec   []byte
	hash   string
}
type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func answer(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
func fail(w http.ResponseWriter, status int, code string) { answer(w, status, errorBody{code, code}) }
func dbFailure(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		fail(w, 404, "not_found")
	case errors.Is(err, store.ErrConflict):
		fail(w, 409, "conflict")
	default:
		log.Printf("catalog storage failure: %T", err)
		fail(w, 503, "dependency_unavailable")
	}
}
func dbContext(r *http.Request) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), 5*time.Second)
}
func bearer(r *http.Request) string {
	v := r.Header.Values("Authorization")
	if len(v) != 1 || !strings.HasPrefix(v[0], "Bearer ") {
		return ""
	}
	return strings.TrimPrefix(v[0], "Bearer ")
}
func role(claims jwt.MapClaims, expected ...string) bool {
	access, ok := claims["realm_access"].(map[string]any)
	if !ok {
		return false
	}
	roles, ok := access["roles"].([]any)
	if !ok {
		return false
	}
	for _, r := range roles {
		for _, e := range expected {
			if r == e {
				return true
			}
		}
	}
	return false
}
func (a *api) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	public := path == "/api/catalog/items" || strings.HasPrefix(path, "/api/catalog/items/")
	private := path == "/internal/catalog/quotes" || path == "/internal/openapi.json"
	if !public && !private {
		fail(w, 404, "not_found")
		return
	}
	if r.TLS == nil || len(r.TLS.PeerCertificates) == 0 {
		fail(w, 403, "forbidden")
		return
	}
	caller := r.TLS.PeerCertificates[0].Subject.CommonName
	if public && caller != "gateway" || private && caller != "customer-api" {
		fail(w, 403, "forbidden")
		return
	}
	raw := bearer(r)
	if raw == "" {
		fail(w, 401, "invalid_token")
		return
	}
	identity := ""
	if public {
		identity = r.Header.Get("X-Cert-Identity")
	}
	claims, err := a.verify.Verify(r.Context(), raw, caller, identity)
	if err != nil {
		if errors.Is(err, auth.ErrForbidden) {
			fail(w, 403, "forbidden")
		} else {
			fail(w, 401, "invalid_token")
		}
		return
	}
	if private {
		if r.URL.RawQuery != "" {
			fail(w, 400, "invalid_request")
			return
		}
		if path == "/internal/openapi.json" {
			if r.Method != http.MethodGet {
				fail(w, 404, "not_found")
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-OpenAPI-SHA256", a.hash)
			w.WriteHeader(200)
			_, _ = w.Write(a.spec)
			return
		}
		if r.Method != http.MethodPost {
			fail(w, 404, "not_found")
			return
		}
		a.quote(w, r)
		return
	}
	if path == "/api/catalog/items" {
		switch r.Method {
		case http.MethodGet:
			a.list(w, r)
		case http.MethodPost:
			if r.URL.RawQuery != "" {
				fail(w, 400, "invalid_request")
				return
			}
			if !role(claims, "shopkeeper", "shop-admin") {
				fail(w, 403, "forbidden")
				return
			}
			a.create(w, r)
		default:
			fail(w, 404, "not_found")
		}
		return
	}
	id := strings.TrimPrefix(path, "/api/catalog/items/")
	if !domain.ValidID(id) {
		fail(w, 400, "invalid_request")
		return
	}
	if r.URL.RawQuery != "" {
		fail(w, 400, "invalid_request")
		return
	}
	switch r.Method {
	case http.MethodGet:
		a.get(w, r, id)
	case http.MethodPatch:
		if !role(claims, "shopkeeper", "shop-admin") {
			fail(w, 403, "forbidden")
			return
		}
		a.update(w, r, id)
	case http.MethodDelete:
		if !role(claims, "shopkeeper", "shop-admin") {
			fail(w, 403, "forbidden")
			return
		}
		a.archive(w, r, id)
	default:
		fail(w, 404, "not_found")
	}
}
func (a *api) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	for key, values := range q {
		if len(values) != 1 || (key != "limit" && key != "cursor" && key != "categoryId" && key != "search") {
			fail(w, 400, "invalid_request")
			return
		}
	}
	limit := 20
	if q.Has("limit") {
		n, err := strconv.Atoi(q.Get("limit"))
		if err != nil || n < 1 || n > 100 {
			fail(w, 400, "invalid_request")
			return
		}
		limit = n
	}
	cursor := ""
	if q.Has("cursor") {
		encoded := q.Get("cursor")
		if len(encoded) == 0 || len(encoded) > 512 {
			fail(w, 400, "invalid_request")
			return
		}
		decoded, err := base64.RawURLEncoding.DecodeString(encoded)
		if err != nil || !domain.ValidID(string(decoded)) {
			fail(w, 400, "invalid_request")
			return
		}
		cursor = string(decoded)
	}
	category := q.Get("categoryId")
	if q.Has("categoryId") && !domain.ValidID(category) {
		fail(w, 400, "invalid_request")
		return
	}
	search := q.Get("search")
	if q.Has("search") && (utf8.RuneCountInString(search) == 0 || utf8.RuneCountInString(search) > 100) {
		fail(w, 400, "invalid_request")
		return
	}
	ctx, cancel := dbContext(r)
	defer cancel()
	items, more, err := a.db.List(ctx, limit, cursor, category, search)
	if err != nil {
		dbFailure(w, err)
		return
	}
	var next *string
	if more {
		value := base64.RawURLEncoding.EncodeToString([]byte(items[len(items)-1].ID))
		next = &value
	}
	answer(w, 200, struct {
		Items      []domain.Item `json:"items"`
		NextCursor *string       `json:"nextCursor"`
	}{items, next})
}
func (a *api) get(w http.ResponseWriter, r *http.Request, id string) {
	ctx, cancel := dbContext(r)
	defer cancel()
	item, err := a.db.Get(ctx, id)
	if err != nil {
		dbFailure(w, err)
		return
	}
	answer(w, 200, item)
}
func readObject(r *http.Request) (map[string]json.RawMessage, error) {
	mediaType, _, parseErr := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if parseErr != nil || mediaType != "application/json" {
		return nil, errors.New("JSON required")
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 16_385))
	if err != nil || len(body) > 16_384 {
		return nil, errors.New("body too large")
	}
	d := json.NewDecoder(bytes.NewReader(body))
	var value map[string]json.RawMessage
	if err := d.Decode(&value); err != nil || value == nil {
		return nil, errors.New("invalid JSON")
	}
	var trailing any
	if d.Decode(&trailing) != io.EOF {
		return nil, errors.New("trailing content")
	}
	return value, nil
}
func fields(data map[string]json.RawMessage, base *domain.Item) (domain.Fields, error) {
	allowed := map[string]bool{"name": true, "description": true, "rarity": true, "image": true, "priceCopper": true, "categoryId": true, "displayStock": true}
	if len(data) == 0 {
		return domain.Fields{}, errors.New("empty")
	}
	for key, value := range data {
		if !allowed[key] || string(value) == "null" {
			return domain.Fields{}, errors.New("unknown or null field")
		}
	}
	var f domain.Fields
	if base != nil {
		f = domain.Fields{Name: base.Name, Description: base.Description, Rarity: base.Rarity, Image: base.Image, PriceCopper: base.PriceCopper, CategoryID: base.CategoryID, DisplayStock: base.DisplayStock}
	}
	for _, key := range []string{"name", "description", "rarity", "image"} {
		if raw, ok := data[key]; ok {
			var s string
			if json.Unmarshal(raw, &s) != nil {
				return f, errors.New("invalid text")
			}
			switch key {
			case "name":
				f.Name = s
			case "description":
				f.Description = s
			case "rarity":
				f.Rarity = s
			case "image":
				f.Image = s
			}
		} else if base == nil {
			return f, errors.New("missing field")
		}
	}
	if raw, ok := data["priceCopper"]; ok {
		var n json.Number
		if json.Unmarshal(raw, &n) != nil {
			return f, errors.New("invalid price")
		}
		amount, err := n.Int64()
		if err != nil {
			return f, err
		}
		f.PriceCopper = amount
	} else if base == nil {
		return f, errors.New("missing price")
	}
	if raw, ok := data["categoryId"]; ok {
		var s string
		if json.Unmarshal(raw, &s) != nil {
			return f, errors.New("invalid category")
		}
		f.CategoryID = &s
	}
	if raw, ok := data["displayStock"]; ok {
		var n json.Number
		if json.Unmarshal(raw, &n) != nil {
			return f, errors.New("invalid stock")
		}
		stock, err := n.Int64()
		if err != nil || stock < 0 || stock > 1_000_000 {
			return f, errors.New("invalid stock")
		}
		value := int(stock)
		f.DisplayStock = &value
	}
	return f, domain.ValidateFields(f)
}
func (a *api) create(w http.ResponseWriter, r *http.Request) {
	data, err := readObject(r)
	if err != nil {
		fail(w, 400, "invalid_request")
		return
	}
	f, err := fields(data, nil)
	if err != nil {
		fail(w, 400, "invalid_request")
		return
	}
	random := make([]byte, 8)
	if _, err = rand.Read(random); err != nil {
		fail(w, 503, "dependency_unavailable")
		return
	}
	item := domain.Item{ID: "item-" + hex.EncodeToString(random), Name: f.Name, Description: f.Description, Rarity: f.Rarity, Image: f.Image, PriceCopper: f.PriceCopper, CategoryID: f.CategoryID, DisplayStock: f.DisplayStock, Active: true}
	ctx, cancel := dbContext(r)
	defer cancel()
	if err = a.db.Create(ctx, item); err != nil {
		dbFailure(w, err)
		return
	}
	w.Header().Set("Location", "/api/catalog/items/"+item.ID)
	answer(w, 201, item)
}
func (a *api) update(w http.ResponseWriter, r *http.Request, id string) {
	data, err := readObject(r)
	if err != nil {
		fail(w, 400, "invalid_request")
		return
	}
	ctx, cancel := dbContext(r)
	defer cancel()
	item, err := a.db.Get(ctx, id)
	if err != nil {
		dbFailure(w, err)
		return
	}
	f, err := fields(data, &item)
	if err != nil {
		fail(w, 400, "invalid_request")
		return
	}
	item.Name = f.Name
	item.Description = f.Description
	item.Rarity = f.Rarity
	item.Image = f.Image
	item.PriceCopper = f.PriceCopper
	item.CategoryID = f.CategoryID
	item.DisplayStock = f.DisplayStock
	if err = a.db.Update(ctx, item); err != nil {
		dbFailure(w, err)
		return
	}
	answer(w, 200, item)
}
func (a *api) archive(w http.ResponseWriter, r *http.Request, id string) {
	ctx, cancel := dbContext(r)
	defer cancel()
	if err := a.db.Archive(ctx, id); err != nil {
		dbFailure(w, err)
		return
	}
	w.WriteHeader(204)
}
func (a *api) quote(w http.ResponseWriter, r *http.Request) {
	data, err := readObject(r)
	if err != nil || len(data) != 1 {
		fail(w, 400, "invalid_request")
		return
	}
	raw, ok := data["lines"]
	if !ok {
		fail(w, 400, "invalid_request")
		return
	}
	var lines []domain.QuoteLine
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&lines) != nil || len(lines) < 1 || len(lines) > 50 {
		fail(w, 400, "invalid_request")
		return
	}
	ids := make([]string, 0, len(lines))
	for _, line := range lines {
		if !domain.ValidID(line.ItemID) || line.Quantity < 1 || line.Quantity > 100 {
			fail(w, 400, "invalid_request")
			return
		}
		ids = append(ids, line.ItemID)
	}
	ctx, cancel := dbContext(r)
	defer cancel()
	items, err := a.db.Many(ctx, ids)
	if err != nil {
		dbFailure(w, err)
		return
	}
	quote, err := domain.QuoteItems(lines, items)
	if err != nil {
		fail(w, 422, "unprocessable")
		return
	}
	answer(w, 200, quote)
}
func tlsOptions() (*tls.Config, error) {
	ca, err := os.ReadFile("/trust/service-ca.pem")
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(ca) {
		return nil, errors.New("invalid service CA")
	}
	block, _ := pem.Decode(ca)
	if block == nil {
		return nil, errors.New("invalid CA PEM")
	}
	issuer, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, err
	}
	raw, err := os.ReadFile("/trust/service.crl.pem")
	if err != nil {
		return nil, err
	}
	block, _ = pem.Decode(raw)
	if block == nil {
		return nil, errors.New("invalid CRL PEM")
	}
	crl, err := x509.ParseRevocationList(block.Bytes)
	if err != nil {
		return nil, err
	}
	if err = crl.CheckSignatureFrom(issuer); err != nil {
		return nil, err
	}
	return &tls.Config{MinVersion: tls.VersionTLS12, ClientAuth: tls.RequireAndVerifyClientCert, ClientCAs: pool, VerifyConnection: func(state tls.ConnectionState) error {
		if len(state.PeerCertificates) == 0 || len(state.VerifiedChains) == 0 {
			return errors.New("verified caller required")
		}
		now := time.Now()
		if now.Before(crl.ThisUpdate) || now.After(crl.NextUpdate) {
			return errors.New("service CRL expired")
		}
		for _, entry := range crl.RevokedCertificateEntries {
			if state.PeerCertificates[0].SerialNumber.Cmp(entry.SerialNumber) == 0 {
				return errors.New("revoked caller")
			}
		}
		return nil
	}}, nil
}
func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	db, err := store.Open(ctx)
	if err != nil {
		log.Fatal("catalog database connect failed: ", err)
	}
	defer db.Close()
	if err = db.Initialize(ctx); err != nil {
		log.Fatal("catalog migration or seed failed: ", err)
	}
	verifier, err := auth.NewVerifier()
	if err != nil {
		log.Fatal(err)
	}
	spec, err := os.ReadFile("/app/contracts/catalog.json")
	if err != nil {
		log.Fatal(err)
	}
	hash := sha256.Sum256(spec)
	options, err := tlsOptions()
	if err != nil {
		log.Fatal(err)
	}
	a := &api{db: db, verify: verifier, spec: spec, hash: hex.EncodeToString(hash[:])}
	server := &http.Server{Addr: ":8443", Handler: a, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 5 * time.Second, MaxHeaderBytes: 8192, TLSConfig: options}
	management := &http.Server{Addr: "127.0.0.1:9000", ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health/ready" {
			http.NotFound(w, r)
			return
		}
		ctx, cancel := dbContext(r)
		defer cancel()
		if err := db.Ready(ctx); err != nil {
			w.WriteHeader(503)
			return
		}
		w.WriteHeader(200)
		_, _ = w.Write([]byte("UP"))
	})}
	go func() { log.Print(management.ListenAndServe()) }()
	log.Fatal(server.ListenAndServeTLS("/credentials/cert.pem", "/credentials/key.pem"))
}
