package auth

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"strings"
	"testing"

	_ "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func TestResetPasswordMySQL(t *testing.T) {
	dsn := os.Getenv("KEBNOI_TEST_DSN")
	if dsn == "" {
		t.Skip("set KEBNOI_TEST_DSN to run the MySQL integration test")
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	ctx := context.Background()
	id := uuid.NewString()
	email := id + "@example.com"
	oldHash, err := bcrypt.GenerateFromPassword([]byte("old-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.ExecContext(ctx, `INSERT INTO kebnoi_users(id,email,password_hash) VALUES(?,?,?)`, id, email, string(oldHash)); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.ExecContext(ctx, `DELETE FROM kebnoi_users WHERE id=?`, id); err != nil {
			t.Error(err)
		}
	})
	m := New(db)
	if exists, err := m.EmailExists(ctx, "  "+strings.ToUpper(email)+"  "); err != nil || !exists {
		t.Fatalf("existing email: exists=%v err=%v", exists, err)
	}
	if exists, err := m.EmailExists(ctx, "missing-"+email); err != nil || exists {
		t.Fatalf("missing email: exists=%v err=%v", exists, err)
	}
	if err := m.ResetPassword(ctx, "missing-"+email, "new-password"); !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("missing account: %v", err)
	}
	if err := m.ResetPassword(ctx, email, "short"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("short password: %v", err)
	}
	session, err := m.Login(ctx, email, "old-password")
	if err != nil {
		t.Fatal(err)
	}
	if err := m.ResetPassword(ctx, email, "new-password"); err != nil {
		t.Fatal(err)
	}
	var hash string
	if err := db.QueryRowContext(ctx, `SELECT password_hash FROM kebnoi_users WHERE id=?`, id).Scan(&hash); err != nil {
		t.Fatal(err)
	}
	if hash == "new-password" || bcrypt.CompareHashAndPassword([]byte(hash), []byte("new-password")) != nil {
		t.Fatal("new password was not stored as a bcrypt hash")
	}
	if _, err := m.Login(ctx, email, "old-password"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("old password: %v", err)
	}
	if _, err := m.Login(ctx, email, "new-password"); err != nil {
		t.Fatalf("new password: %v", err)
	}
	if _, err := m.Refresh(ctx, session.RefreshToken); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("old session: %v", err)
	}
}
