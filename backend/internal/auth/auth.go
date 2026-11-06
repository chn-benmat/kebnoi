package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidCredentials = errors.New("invalid credentials")
var ErrWrongCurrentPassword = errors.New("current password is incorrect")
var ErrEmailExists = errors.New("email already in use")
var ErrInvalidInput = errors.New("invalid input")
var ErrUserNotFound = errors.New("user not found")

const accessLifetime = 15 * time.Minute
const refreshLifetime = 30 * 24 * time.Hour

var signupEmailDomains = map[string]struct{}{
	"gmail.com": {}, "googlemail.com": {},
	"outlook.com": {}, "outlook.co.th": {}, "hotmail.com": {}, "hotmail.co.th": {}, "hotmail.co.uk": {}, "hotmail.fr": {}, "hotmail.de": {}, "hotmail.it": {}, "hotmail.es": {}, "live.com": {}, "live.co.uk": {}, "msn.com": {},
	"yahoo.com": {}, "yahoo.co.th": {}, "yahoo.co.uk": {}, "yahoo.co.jp": {}, "ymail.com": {},
	"icloud.com": {}, "me.com": {}, "mac.com": {},
	"proton.me": {}, "protonmail.com": {}, "pm.me": {},
	"aol.com": {}, "gmx.com": {}, "gmx.de": {}, "web.de": {}, "mail.com": {},
	"fastmail.com": {}, "fastmail.fm": {}, "zoho.com": {}, "zohomail.com": {},
	"tuta.com": {}, "tuta.io": {}, "tutanota.com": {}, "yandex.com": {}, "yandex.ru": {},
}

func IsAllowedSignupEmail(email string) bool {
	_, domain, ok := strings.Cut(strings.ToLower(strings.TrimSpace(email)), "@")
	if !ok {
		return false
	}
	_, allowed := signupEmailDomains[domain]
	return allowed
}

type Session struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

type User struct {
	ID    string
	Email string
	Name  string
}

type Manager struct {
	db *sql.DB
}

func New(db *sql.DB) *Manager { return &Manager{db: db} }

func (m *Manager) Signup(ctx context.Context, name, email, password string) (Session, error) {
	name, email = strings.TrimSpace(name), strings.ToLower(strings.TrimSpace(email))
	if name == "" || len(name) > 40 || email == "" || !IsAllowedSignupEmail(email) || len(password) < 6 || len(password) > 72 {
		return Session{}, ErrInvalidInput
	}
	session, accessHash, refreshHash, err := newSession()
	if err != nil {
		return Session{}, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return Session{}, err
	}
	userID := uuid.NewString()
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return Session{}, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `INSERT INTO kebnoi_users(id,email,password_hash) VALUES(?,?,?)`, userID, email, string(hash)); err != nil {
		if isDuplicate(err) {
			return Session{}, ErrEmailExists
		}
		return Session{}, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO kebnoi_profiles(id,display_name,email) VALUES(?,?,?)`, userID, name, email); err != nil {
		return Session{}, err
	}
	if err = insertSession(ctx, tx, userID, accessHash, refreshHash); err != nil {
		return Session{}, err
	}
	if err = tx.Commit(); err != nil {
		return Session{}, err
	}
	return session, nil
}

func (m *Manager) Login(ctx context.Context, email, password string) (Session, error) {
	var userID, storedHash string
	err := m.db.QueryRowContext(ctx, `SELECT id,password_hash FROM kebnoi_users WHERE email=?`, strings.ToLower(strings.TrimSpace(email))).Scan(&userID, &storedHash)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(password)) != nil) {
		return Session{}, ErrInvalidCredentials
	}
	if err != nil {
		return Session{}, err
	}
	return m.createSession(ctx, userID)
}

func (m *Manager) createSession(ctx context.Context, userID string) (Session, error) {
	session, accessHash, refreshHash, err := newSession()
	if err != nil {
		return Session{}, err
	}
	_, err = m.db.ExecContext(ctx, `INSERT INTO kebnoi_sessions(id,user_id,access_token_hash,refresh_token_hash,access_expires_at,expires_at) VALUES(?,?,?,?,?,?)`, uuid.NewString(), userID, accessHash, refreshHash, time.Now().UTC().Add(accessLifetime), time.Now().UTC().Add(refreshLifetime))
	return session, err
}

func (m *Manager) Refresh(ctx context.Context, token string) (Session, error) {
	if token == "" {
		return Session{}, ErrInvalidCredentials
	}
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return Session{}, err
	}
	defer tx.Rollback()
	var sessionID, userID string
	err = tx.QueryRowContext(ctx, `SELECT id,user_id FROM kebnoi_sessions WHERE refresh_token_hash=? AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP(3) FOR UPDATE`, tokenHash(token)).Scan(&sessionID, &userID)
	if err != nil {
		return Session{}, ErrInvalidCredentials
	}
	session, accessHash, refreshHash, err := newSession()
	if err != nil {
		return Session{}, err
	}
	_, err = tx.ExecContext(ctx, `UPDATE kebnoi_sessions SET access_token_hash=?,refresh_token_hash=?,access_expires_at=?,expires_at=? WHERE id=?`, accessHash, refreshHash, time.Now().UTC().Add(accessLifetime), time.Now().UTC().Add(refreshLifetime), sessionID)
	if err != nil {
		return Session{}, err
	}
	if err = tx.Commit(); err != nil {
		return Session{}, err
	}
	return session, nil
}

func (m *Manager) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	_, err := m.db.ExecContext(ctx, `DELETE FROM kebnoi_sessions WHERE refresh_token_hash=?`, tokenHash(refreshToken))
	return err
}

func (m *Manager) Middleware(c fiber.Ctx) error {
	parts := strings.SplitN(strings.TrimSpace(c.Get("Authorization")), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "sign in required")
	}
	var user User
	err := m.db.QueryRowContext(c.Context(), `SELECT u.id,u.email,p.display_name
		FROM kebnoi_sessions s JOIN kebnoi_users u ON u.id=s.user_id
		JOIN kebnoi_profiles p ON p.id=u.id
		WHERE s.access_token_hash=? AND s.revoked_at IS NULL AND s.access_expires_at>CURRENT_TIMESTAMP(3)`, tokenHash(parts[1])).Scan(&user.ID, &user.Email, &user.Name)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired session")
	}
	c.Locals("userID", user.ID)
	c.Locals("userEmail", user.Email)
	c.Locals("userName", user.Name)
	return c.Next()
}

func (m *Manager) UpdateCredentials(ctx context.Context, userID, email string) (bool, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || len(email) > 254 {
		return false, ErrInvalidInput
	}
	var oldEmail string
	if err := m.db.QueryRowContext(ctx, `SELECT email FROM kebnoi_users WHERE id=?`, userID).Scan(&oldEmail); errors.Is(err, sql.ErrNoRows) {
		return false, ErrUserNotFound
	} else if err != nil {
		return false, err
	}
	emailChanged := !strings.EqualFold(oldEmail, email)
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()
	if emailChanged {
		_, err = tx.ExecContext(ctx, `UPDATE kebnoi_users SET email=? WHERE id=?`, email, userID)
	} else {
		_, err = tx.ExecContext(ctx, `UPDATE kebnoi_users SET email=? WHERE id=?`, email, userID)
	}
	if err != nil {
		if isDuplicate(err) {
			return false, ErrEmailExists
		}
		return false, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE kebnoi_profiles SET email=? WHERE id=?`, email, userID); err != nil {
		return false, err
	}
	if err = tx.Commit(); err != nil {
		return false, err
	}
	return emailChanged, nil
}

func (m *Manager) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	if len(currentPassword) < 1 || len(newPassword) < 6 || len(newPassword) > 72 {
		return ErrInvalidInput
	}
	var storedHash string
	err := m.db.QueryRowContext(ctx, `SELECT password_hash FROM kebnoi_users WHERE id=?`, userID).Scan(&storedHash)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrUserNotFound
	}
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(currentPassword)) != nil {
		return ErrWrongCurrentPassword
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = m.db.ExecContext(ctx, `UPDATE kebnoi_users SET password_hash=? WHERE id=?`, string(newHash), userID)
	return err
}

func (m *Manager) DeleteAccount(ctx context.Context, userID string) error {
	_, err := m.db.ExecContext(ctx, `DELETE FROM kebnoi_users WHERE id=?`, userID)
	return err
}

func UserID(c fiber.Ctx) string { return c.Locals("userID").(string) }
func CurrentUser(c fiber.Ctx) User {
	return User{ID: UserID(c), Email: c.Locals("userEmail").(string), Name: c.Locals("userName").(string)}
}

func newSession() (Session, string, string, error) {
	access, err := randomToken()
	if err != nil {
		return Session{}, "", "", err
	}
	refresh, err := randomToken()
	if err != nil {
		return Session{}, "", "", err
	}
	return Session{AccessToken: access, RefreshToken: refresh, ExpiresIn: int64(accessLifetime.Seconds())}, tokenHash(access), tokenHash(refresh), nil
}

func insertSession(ctx context.Context, tx *sql.Tx, userID, accessHash, refreshHash string) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO kebnoi_sessions(id,user_id,access_token_hash,refresh_token_hash,access_expires_at,expires_at) VALUES(?,?,?,?,?,?)`, uuid.NewString(), userID, accessHash, refreshHash, time.Now().UTC().Add(accessLifetime), time.Now().UTC().Add(refreshLifetime))
	return err
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
func isDuplicate(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "duplicate entry") || strings.Contains(strings.ToLower(err.Error()), "error 1062")
}
