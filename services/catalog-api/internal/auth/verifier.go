package auth

import (
	"context"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const Issuer = "https://auth.magic.test:9443/realms/magic-shop"

var ErrForbidden = errors.New("token capability or certificate identity forbidden")

type Verifier struct {
	client    *http.Client
	mu        sync.Mutex
	keys      map[string]*rsa.PublicKey
	until     time.Time
	missUntil time.Time
	missKid   string
}
type jwkSet struct {
	Keys []struct {
		Kty string `json:"kty"`
		Kid string `json:"kid"`
		N   string `json:"n"`
		E   string `json:"e"`
		Alg string `json:"alg"`
		Use string `json:"use"`
	} `json:"keys"`
}

func NewVerifier() (*Verifier, error) {
	pem, err := os.ReadFile("/trust/server-ca.pem")
	if err != nil {
		return nil, err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(pem) {
		return nil, errors.New("server trust invalid")
	}
	transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: roots}, ResponseHeaderTimeout: 5 * time.Second, IdleConnTimeout: 10 * time.Second, MaxIdleConns: 2}
	return &Verifier{client: &http.Client{Timeout: 5 * time.Second, Transport: transport}, keys: make(map[string]*rsa.PublicKey)}, nil
}
func (v *Verifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if key := v.keys[kid]; key != nil && time.Now().Before(v.until) {
		return key, nil
	}
	if kid == v.missKid && time.Now().Before(v.missUntil) {
		return nil, errors.New("unknown signing key")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, Issuer+"/protocol/openid-connect/certs", nil)
	if err != nil {
		return nil, err
	}
	response, err := v.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, fmt.Errorf("JWKS status %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 1_048_577))
	if err != nil || len(body) > 1_048_576 {
		return nil, errors.New("JWKS response invalid or too large")
	}
	var set jwkSet
	if err = json.Unmarshal(body, &set); err != nil {
		return nil, err
	}
	keys := make(map[string]*rsa.PublicKey)
	if len(set.Keys) > 20 {
		return nil, errors.New("too many JWKS keys")
	}
	for _, j := range set.Keys {
		if j.Kty != "RSA" || j.Kid == "" || (j.Alg != "" && j.Alg != "RS256") || (j.Use != "" && j.Use != "sig") {
			continue
		}
		n, ne := base64.RawURLEncoding.DecodeString(j.N)
		e, ee := base64.RawURLEncoding.DecodeString(j.E)
		if ne != nil || ee != nil || len(n) < 256 || len(n) > 512 || len(e) < 1 || len(e) > 4 {
			continue
		}
		exponent := 0
		for _, part := range e {
			exponent = exponent*256 + int(part)
		}
		if exponent < 3 || exponent%2 == 0 {
			continue
		}
		keys[j.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: exponent}
	}
	if len(keys) == 0 {
		return nil, errors.New("JWKS has no supported signing keys")
	}
	v.keys = keys
	v.until = time.Now().Add(5 * time.Minute)
	key := keys[kid]
	if key == nil {
		v.missUntil = time.Now().Add(5 * time.Second)
		v.missKid = kid
		return nil, errors.New("unknown signing key")
	}
	v.missUntil = time.Time{}
	v.missKid = ""
	return key, nil
}
func (v *Verifier) Verify(ctx context.Context, raw, caller, certIdentity string) (jwt.MapClaims, error) {
	if len(raw) < 20 || len(raw) > 16_384 {
		return nil, errors.New("token length invalid")
	}
	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (any, error) {
		kid, ok := token.Header["kid"].(string)
		if !ok || kid == "" || len(kid) > 128 {
			return nil, errors.New("signing key id missing")
		}
		return v.key(ctx, kid)
	}, jwt.WithValidMethods([]string{"RS256"}), jwt.WithIssuer(Issuer), jwt.WithAudience("catalog-api"), jwt.WithExpirationRequired(), jwt.WithIssuedAt(), jwt.WithStrictDecoding())
	if err != nil || !token.Valid {
		return nil, errors.New("invalid access token")
	}
	if err = Authorize(claims, caller, certIdentity); err != nil {
		return nil, err
	}
	return claims, nil
}
func Authorize(claims jwt.MapClaims, caller, certIdentity string) error {
	if caller == "gateway" {
		if certIdentity == "" || claims["cert_identity"] != certIdentity || claims["azp"] != "shop-spa" || claims["typ"] != "Bearer" {
			return ErrForbidden
		}
		access, ok := claims["realm_access"].(map[string]any)
		if !ok {
			return ErrForbidden
		}
		roles, ok := access["roles"].([]any)
		if !ok {
			return ErrForbidden
		}
		for _, role := range roles {
			if role == "customer" || role == "shopkeeper" || role == "shop-admin" {
				return nil
			}
		}
		return ErrForbidden
	}
	if caller == "customer-api" {
		if claims["azp"] != "customer-catalog" || claims["typ"] != "Bearer" || claims["cert_identity"] != nil {
			return ErrForbidden
		}
		scope, ok := claims["scope"].(string)
		if !ok {
			return ErrForbidden
		}
		for _, part := range strings.Fields(scope) {
			if part == "catalog.quote" {
				return nil
			}
		}
	}
	return ErrForbidden
}
