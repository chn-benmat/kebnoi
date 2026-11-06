package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/chn-benmat/backend/internal/domain"
	"github.com/google/uuid"
)

var ErrNotFound = errors.New("not found")
var ErrAlreadyInFamily = errors.New("already in a family")

type Store struct{ db *sql.DB }

func New(db *sql.DB) *Store { return &Store{db: db} }

func (s *Store) Bootstrap(ctx context.Context, userID string) (domain.Bootstrap, error) {
	var me domain.User
	if err := s.db.QueryRowContext(ctx, `SELECT p.id,p.display_name,p.email,p.avatar_url,p.family_id
		FROM kebnoi_profiles p WHERE p.id=?`, userID).Scan(&me.ID, &me.Name, &me.Email, &me.Avatar, &me.FamilyID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Bootstrap{}, ErrNotFound
		}
		return domain.Bootstrap{}, err
	}
	out := domain.Bootstrap{Users: []domain.User{me}, Families: []domain.Family{}, Transactions: []domain.Transaction{}, CurrentUserID: userID}
	if me.FamilyID == nil {
		return out, nil
	}
	var family domain.Family
	if err := s.db.QueryRowContext(ctx, `SELECT id,name,join_code FROM kebnoi_families WHERE id=?`, *me.FamilyID).Scan(&family.ID, &family.Name, &family.Code); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return out, ErrNotFound
		}
		return out, err
	}
	out.Families = append(out.Families, family)
	out.Users = make([]domain.User, 0)
	rows, err := s.db.QueryContext(ctx, `SELECT id,display_name,email,avatar_url,family_id
		FROM kebnoi_profiles WHERE family_id=? ORDER BY created_at ASC`, *me.FamilyID)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Avatar, &u.FamilyID); err != nil {
			rows.Close()
			return out, err
		}
		out.Users = append(out.Users, u)
	}
	if err := rows.Close(); err != nil {
		return out, err
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	txRows, err := s.db.QueryContext(ctx, `SELECT id,user_id,family_id,kind,entry_date,description,amount,recorded_hour
		FROM kebnoi_transactions WHERE family_id=? ORDER BY entry_date DESC,created_at DESC`, *me.FamilyID)
	if err != nil {
		return out, err
	}
	defer txRows.Close()
	for txRows.Next() {
		var t domain.Transaction
		var date time.Time
		if err := txRows.Scan(&t.ID, &t.UserID, &t.FamilyID, &t.Kind, &date, &t.Description, &t.Amount, &t.RecordedHour); err != nil {
			return out, err
		}
		t.Date = date.Format("2006-01-02")
		out.Transactions = append(out.Transactions, t)
	}
	return out, txRows.Err()
}

func (s *Store) CreateFamily(ctx context.Context, userID, name string) (domain.Family, error) {
	name = strings.TrimSpace(name)
	for attempt := 0; attempt < 30; attempt++ {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return domain.Family{}, err
		}
		var member sql.NullString
		if err = tx.QueryRowContext(ctx, `SELECT family_id FROM kebnoi_profiles WHERE id=? FOR UPDATE`, userID).Scan(&member); err != nil {
			tx.Rollback()
			if errors.Is(err, sql.ErrNoRows) {
				return domain.Family{}, ErrNotFound
			}
			return domain.Family{}, err
		}
		if member.Valid {
			tx.Rollback()
			return domain.Family{}, ErrAlreadyInFamily
		}
		code, err := randomCode()
		if err != nil {
			tx.Rollback()
			return domain.Family{}, err
		}
		f := domain.Family{ID: uuid.NewString(), Name: name, Code: code}
		if _, err = tx.ExecContext(ctx, `INSERT INTO kebnoi_families(id,name,join_code,created_by) VALUES(?,?,?,?)`, f.ID, f.Name, f.Code, userID); err != nil {
			tx.Rollback()
			if isDuplicate(err) {
				continue
			}
			return domain.Family{}, err
		}
		if _, err = tx.ExecContext(ctx, `UPDATE kebnoi_profiles SET family_id=? WHERE id=?`, f.ID, userID); err != nil {
			tx.Rollback()
			return domain.Family{}, err
		}
		if err = tx.Commit(); err != nil {
			return domain.Family{}, err
		}
		return f, nil
	}
	return domain.Family{}, errors.New("could not allocate family code")
}

func (s *Store) JoinFamily(ctx context.Context, userID, code string) (domain.Family, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Family{}, err
	}
	defer tx.Rollback()
	var familyID, name, joinCode string
	if err = tx.QueryRowContext(ctx, `SELECT id,name,join_code FROM kebnoi_families WHERE join_code=?`, code).Scan(&familyID, &name, &joinCode); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Family{}, ErrNotFound
		}
		return domain.Family{}, err
	}
	res, err := tx.ExecContext(ctx, `UPDATE kebnoi_profiles SET family_id=? WHERE id=? AND family_id IS NULL`, familyID, userID)
	if err != nil {
		return domain.Family{}, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return domain.Family{}, err
	}
	if n == 0 {
		var exists int
		if err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM kebnoi_profiles WHERE id=?`, userID).Scan(&exists); err != nil {
			return domain.Family{}, err
		}
		if exists == 0 {
			return domain.Family{}, ErrNotFound
		}
		return domain.Family{}, ErrAlreadyInFamily
	}
	if err = tx.Commit(); err != nil {
		return domain.Family{}, err
	}
	return domain.Family{ID: familyID, Name: name, Code: joinCode}, nil
}

func (s *Store) LeaveFamily(ctx context.Context, userID string) error {
	res, err := s.db.ExecContext(ctx, `UPDATE kebnoi_profiles SET family_id=NULL WHERE id=?`, userID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err == nil && n == 0 {
		return ErrNotFound
	}
	return err
}

func (s *Store) CreateTransaction(ctx context.Context, userID string, in domain.TransactionInput) (domain.Transaction, error) {
	var familyID sql.NullString
	if err := s.db.QueryRowContext(ctx, `SELECT family_id FROM kebnoi_profiles WHERE id=?`, userID).Scan(&familyID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Transaction{}, ErrNotFound
		}
		return domain.Transaction{}, err
	}
	if !familyID.Valid {
		return domain.Transaction{}, ErrNotFound
	}
	id := uuid.NewString()
	if _, err := s.db.ExecContext(ctx, `INSERT INTO kebnoi_transactions(id,user_id,family_id,kind,entry_date,description,amount,recorded_hour) VALUES(?,?,?,?,?,?,?,?)`, id, userID, familyID.String, in.Kind, in.Date, strings.TrimSpace(in.Description), in.Amount, time.Now().UTC().Hour()); err != nil {
		return domain.Transaction{}, err
	}
	return s.transaction(ctx, id, userID)
}

func (s *Store) UpdateTransaction(ctx context.Context, userID, id string, in domain.TransactionInput) (domain.Transaction, error) {
	res, err := s.db.ExecContext(ctx, `UPDATE kebnoi_transactions t SET kind=?,entry_date=?,description=?,amount=?
		WHERE id=? AND user_id=? AND EXISTS (
			SELECT 1 FROM kebnoi_profiles p WHERE p.id=? AND p.family_id=t.family_id
		)`, in.Kind, in.Date, strings.TrimSpace(in.Description), in.Amount, id, userID, userID)
	if err != nil {
		return domain.Transaction{}, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return domain.Transaction{}, err
	}
	if n == 0 {
		return domain.Transaction{}, ErrNotFound
	}
	return s.transaction(ctx, id, userID)
}

func (s *Store) transaction(ctx context.Context, id, userID string) (domain.Transaction, error) {
	var t domain.Transaction
	var date time.Time
	err := s.db.QueryRowContext(ctx, `SELECT id,user_id,family_id,kind,entry_date,description,amount,recorded_hour FROM kebnoi_transactions WHERE id=? AND user_id=?`, id, userID).Scan(&t.ID, &t.UserID, &t.FamilyID, &t.Kind, &date, &t.Description, &t.Amount, &t.RecordedHour)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Transaction{}, ErrNotFound
	}
	t.Date = date.Format("2006-01-02")
	return t, err
}

func (s *Store) DeleteTransaction(ctx context.Context, userID, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE t FROM kebnoi_transactions t
		WHERE t.id=? AND t.user_id=? AND EXISTS (
			SELECT 1 FROM kebnoi_profiles p WHERE p.id=? AND p.family_id=t.family_id
		)`, id, userID, userID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err == nil && n == 0 {
		return ErrNotFound
	}
	return err
}

func (s *Store) UpdateProfile(ctx context.Context, userID, name string) (domain.User, error) {
	if _, err := s.db.ExecContext(ctx, `UPDATE kebnoi_profiles SET display_name=? WHERE id=?`, strings.TrimSpace(name), userID); err != nil {
		return domain.User{}, err
	}
	var u domain.User
	err := s.db.QueryRowContext(ctx, `SELECT id,display_name,email,avatar_url,family_id FROM kebnoi_profiles WHERE id=?`, userID).Scan(&u.ID, &u.Name, &u.Email, &u.Avatar, &u.FamilyID)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.User{}, ErrNotFound
	}
	return u, err
}

func (s *Store) UpdateAvatar(ctx context.Context, userID string, data []byte, mime string) (domain.User, error) {
	avatarURL := "/api/avatars/" + userID
	result, err := s.db.ExecContext(ctx, `UPDATE kebnoi_profiles SET avatar_url=?,avatar_data=?,avatar_mime=? WHERE id=?`, avatarURL, data, mime, userID)
	if err != nil {
		return domain.User{}, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return domain.User{}, err
	}
	if rows == 0 {
		return domain.User{}, ErrNotFound
	}
	var user domain.User
	err = s.db.QueryRowContext(ctx, `SELECT id,display_name,email,avatar_url,family_id FROM kebnoi_profiles WHERE id=?`, userID).Scan(&user.ID, &user.Name, &user.Email, &user.Avatar, &user.FamilyID)
	if err != nil {
		return domain.User{}, err
	}
	return user, nil
}

func (s *Store) Avatar(ctx context.Context, userID string) ([]byte, string, error) {
	var data []byte
	var mime string
	err := s.db.QueryRowContext(ctx, `SELECT avatar_data,avatar_mime FROM kebnoi_profiles WHERE id=?`, userID).Scan(&data, &mime)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && len(data) == 0) {
		return nil, "", ErrNotFound
	}
	return data, mime, err
}

func randomCode() (string, error) {
	n, err := bigInt(10000)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%04d", n), nil
}

func ValidTransaction(in domain.TransactionInput) bool {
	if (in.Kind != "income" && in.Kind != "expense") || in.Amount <= 0 || in.Amount > 1_000_000_000 || utf8.RuneCountInString(strings.TrimSpace(in.Description)) == 0 || utf8.RuneCountInString(in.Description) > 80 {
		return false
	}
	_, err := time.Parse("2006-01-02", in.Date)
	return err == nil
}

func isDuplicate(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "duplicate entry") || strings.Contains(strings.ToLower(err.Error()), "error 1062")
}

func bigInt(max int64) (int64, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(max))
	if err != nil {
		return 0, err
	}
	return n.Int64(), nil
}
