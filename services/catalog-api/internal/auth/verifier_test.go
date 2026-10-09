package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"math/big"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestVerifierRotatesKeysAndChecksClaims(t *testing.T) {
	first, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	second, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	active := map[string]*rsa.PrivateKey{"first": first}
	fetches := 0
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != Issuer+"/protocol/openid-connect/certs" {
			t.Fatal("unexpected JWKS URL")
		}
		fetches++
		keys := make([]map[string]string, 0, len(active))
		for kid, key := range active {
			keys = append(keys, map[string]string{"kid": kid, "kty": "RSA", "alg": "RS256", "use": "sig", "n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()), "e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes())})
		}
		body, _ := json.Marshal(map[string]any{"keys": keys})
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(body))), Header: make(http.Header)}, nil
	})}
	v := &Verifier{client: client, keys: make(map[string]*rsa.PublicKey)}
	makeToken := func(kid string, key *rsa.PrivateKey, audience string) string {
		claims := jwt.MapClaims{"iss": Issuer, "aud": audience, "exp": time.Now().Add(time.Minute).Unix(), "iat": time.Now().Unix(), "azp": "shop-spa", "typ": "Bearer", "cert_identity": "selected", "realm_access": map[string]any{"roles": []string{"customer"}}}
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
		token.Header["kid"] = kid
		raw, signErr := token.SignedString(key)
		if signErr != nil {
			t.Fatal(signErr)
		}
		return raw
	}
	ctx := context.Background()
	if _, err := v.Verify(ctx, makeToken("first", first, "catalog-api"), "gateway", "selected"); err != nil {
		t.Fatal(err)
	}
	if fetches != 1 {
		t.Fatalf("first key fetched %d times", fetches)
	}
	if _, err := v.Verify(ctx, makeToken("first", first, "wrong-api"), "gateway", "selected"); err == nil {
		t.Fatal("wrong audience accepted")
	}
	if _, err := v.Verify(ctx, makeToken("absent", second, "catalog-api"), "gateway", "selected"); err == nil {
		t.Fatal("unknown key accepted")
	}
	if fetches != 2 {
		t.Fatalf("unknown key fetched %d times", fetches)
	}
	active["second"] = second
	if _, err := v.Verify(ctx, makeToken("second", second, "catalog-api"), "gateway", "selected"); err != nil {
		t.Fatalf("rotated key rejected: %v", err)
	}
	if fetches != 3 {
		t.Fatalf("rotation fetched %d times", fetches)
	}
	if _, err := v.Verify(ctx, makeToken("second", second, "catalog-api"), "gateway", "wrong"); !errors.Is(err, ErrForbidden) {
		t.Fatal("mismatched certificate identity accepted")
	}
}

func TestCertificateTokenPairing(t *testing.T) {
	user := jwt.MapClaims{"azp": "shop-spa", "typ": "Bearer", "cert_identity": "opaque-user", "realm_access": map[string]any{"roles": []any{"customer"}}}
	if err := Authorize(user, "gateway", "opaque-user"); err != nil {
		t.Fatal(err)
	}
	if err := Authorize(user, "gateway", "other"); !errors.Is(err, ErrForbidden) {
		t.Fatal("identity mismatch accepted")
	}
	if err := Authorize(user, "customer-api", ""); !errors.Is(err, ErrForbidden) {
		t.Fatal("user token accepted as service")
	}
	service := jwt.MapClaims{"azp": "customer-catalog", "typ": "Bearer", "scope": "openid catalog.quote"}
	if err := Authorize(service, "customer-api", ""); err != nil {
		t.Fatal(err)
	}
	service["scope"] = "openid"
	if err := Authorize(service, "customer-api", ""); !errors.Is(err, ErrForbidden) {
		t.Fatal("missing scope accepted")
	}
}

func TestSignedClaimAndServiceScopeBoundaries(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	v := &Verifier{keys: map[string]*rsa.PublicKey{"test": &key.PublicKey}, until: time.Now().Add(time.Minute)}
	now := time.Now()
	base := jwt.MapClaims{
		"iss": Issuer, "aud": "catalog-api", "sub": "10101010-1010-4010-8010-101010101010",
		"iat": now.Unix(), "exp": now.Add(time.Minute).Unix(), "typ": "Bearer",
		"azp": "shop-spa", "cert_identity": "selected", "realm_access": map[string]any{"roles": []string{"customer"}},
	}
	sign := func(changes jwt.MapClaims) string {
		claims := jwt.MapClaims{}
		for name, value := range base {
			claims[name] = value
		}
		for name, value := range changes {
			claims[name] = value
		}
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
		token.Header["kid"] = "test"
		raw, signErr := token.SignedString(key)
		if signErr != nil {
			t.Fatal(signErr)
		}
		return raw
	}
	ctx := context.Background()
	for name, changes := range map[string]jwt.MapClaims{
		"expired":        {"iat": now.Add(-4 * time.Minute).Unix(), "exp": now.Add(-2 * time.Minute).Unix()},
		"not yet valid":  {"nbf": now.Add(2 * time.Minute).Unix()},
		"wrong issuer":   {"iss": "https://wrong.magic.test/realms/magic-shop"},
		"wrong audience": {"aud": "customer-api"},
	} {
		t.Run(name, func(t *testing.T) {
			if _, verifyErr := v.Verify(ctx, sign(changes), "gateway", "selected"); verifyErr == nil {
				t.Fatal("invalid signed claim accepted")
			}
		})
	}
	service := jwt.MapClaims{"azp": "customer-catalog", "cert_identity": nil, "scope": "openid catalog.quote"}
	if _, err := v.Verify(ctx, sign(service), "customer-api", ""); err != nil {
		t.Fatalf("valid service capability rejected: %v", err)
	}
	service["scope"] = "openid"
	if _, err := v.Verify(ctx, sign(service), "customer-api", ""); !errors.Is(err, ErrForbidden) {
		t.Fatal("service token without catalog.quote accepted")
	}
}
