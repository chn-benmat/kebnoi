package httpapi

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/chn-benmat/backend/internal/auth"
	"github.com/chn-benmat/backend/internal/store"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

func TestCookieSession(t *testing.T) {
	dsn := os.Getenv("KEBNOI_TEST_DSN")
	if dsn == "" {
		t.Skip("set KEBNOI_TEST_DSN to run the MySQL integration test")
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	email := uuid.NewString() + "@gmail.com"
	t.Cleanup(func() {
		if _, err := db.Exec(`DELETE FROM kebnoi_users WHERE email=?`, email); err != nil {
			t.Error(err)
		}
	})
	app := fiber.New(fiber.Config{ErrorHandler: ErrorHandler})
	Register(app, store.New(db), auth.New(db), "http://localhost:5173")
	call := func(method, path, origin string, body any, cookie *http.Cookie) *http.Response {
		t.Helper()
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(method, path, strings.NewReader(string(payload)))
		req.Header.Set("Content-Type", "application/json")
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		if cookie != nil {
			req.AddCookie(cookie)
		}
		resp, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = resp.Body.Close() })
		return resp
	}
	origin := "http://localhost:5173"
	resp := call("POST", "/api/auth/signup", origin, fiber.Map{"name": "Test", "email": email, "password": "test-password"}, nil)
	if resp.StatusCode != 201 {
		t.Fatalf("signup: %d", resp.StatusCode)
	}
	var cookie *http.Cookie
	for _, c := range resp.Cookies() {
		if c.Name == sessionCookie {
			cookie = c
		}
	}
	if cookie == nil || !cookie.HttpOnly || cookie.Path != "/api" || cookie.Value == "" {
		t.Fatalf("invalid session cookie: %+v", cookie)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil || strings.Contains(string(body), cookie.Value) {
		t.Fatalf("signup exposed token: %s, %v", body, err)
	}
	if got := call("GET", "/api/bootstrap", origin, nil, cookie).StatusCode; got != 200 {
		t.Fatalf("bootstrap with cookie: %d", got)
	}
	if got := call("POST", "/api/auth/logout", "", nil, cookie).StatusCode; got != 403 {
		t.Fatalf("missing origin: %d", got)
	}
	if got := call("POST", "/api/auth/logout", "https://attacker.example", nil, cookie).StatusCode; got != 403 {
		t.Fatalf("foreign origin: %d", got)
	}
	resp = call("POST", "/api/auth/logout", origin, nil, cookie)
	if resp.StatusCode != 204 {
		t.Fatalf("logout: %d", resp.StatusCode)
	}
	if cookies := resp.Cookies(); len(cookies) != 1 || cookies[0].MaxAge >= 0 || cookies[0].Path != "/api" {
		t.Fatalf("logout did not clear cookie: %+v", cookies)
	}
	if got := call("GET", "/api/bootstrap", origin, nil, cookie).StatusCode; got != 401 {
		t.Fatalf("revoked cookie: %d", got)
	}
	resp = call("POST", "/api/auth/login", origin, fiber.Map{"email": email, "password": "test-password"}, nil)
	if resp.StatusCode != 204 || len(resp.Cookies()) == 0 {
		t.Fatalf("login: %d", resp.StatusCode)
	}
}

func TestSecureSessionCookie(t *testing.T) {
	app := fiber.New()
	h := &handlers{secureCookie: true}
	app.Get("/", func(c fiber.Ctx) error {
		h.setSessionCookie(c, "token", 3600)
		return c.SendStatus(204)
	})
	resp, err := app.Test(httptest.NewRequest("GET", "/", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	cookies := resp.Cookies()
	if len(cookies) != 1 || !cookies[0].Secure || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteNoneMode {
		t.Fatalf("insecure HTTPS cookie: %+v", cookies)
	}
}
