package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/chn-benmat/backend/internal/auth"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func TestPasswordResetEndpoints(t *testing.T) {
	dsn := os.Getenv("KEBNOI_TEST_DSN")
	if dsn == "" {
		t.Skip("set KEBNOI_TEST_DSN to run the MySQL integration test")
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	id := uuid.NewString()
	email := id + "@example.com"
	hash, err := bcrypt.GenerateFromPassword([]byte("old-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(`INSERT INTO kebnoi_users(id,email,password_hash) VALUES(?,?,?)`, id, email, string(hash)); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(`DELETE FROM kebnoi_users WHERE id=?`, id); err != nil {
			t.Error(err)
		}
	})
	app := fiber.New(fiber.Config{ErrorHandler: ErrorHandler})
	Register(app, nil, auth.New(db), "http://localhost:5173")
	post := func(path string, body any, want int) {
		t.Helper()
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest("POST", path, strings.NewReader(string(payload)))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != want {
			t.Fatalf("%s: got status %d, want %d", path, resp.StatusCode, want)
		}
	}
	post("/api/auth/forgot-password", fiber.Map{"email": "missing-" + email}, 404)
	post("/api/auth/forgot-password", fiber.Map{"email": email}, 204)
	post("/api/auth/reset-password", fiber.Map{"email": email, "new_password": "short"}, 400)
	post("/api/auth/reset-password", fiber.Map{"email": email, "new_password": "new-password"}, 204)
	if _, err := auth.New(db).Login(t.Context(), email, "new-password"); err != nil {
		t.Fatalf("new password login: %v", err)
	}
}
