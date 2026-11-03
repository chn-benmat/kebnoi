package store

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/chn-benmat/backend/internal/domain"
)

var ErrNotFound = errors.New("not found")
var ErrAlreadyInFamily = errors.New("already in a family")

type Store struct {
	baseURL, apiKey string
	client          *http.Client
}

func New(baseURL, apiKey string) *Store {
	return &Store{baseURL: strings.TrimRight(baseURL, "/"), apiKey: apiKey, client: &http.Client{Timeout: 12 * time.Second}}
}

type remoteError struct {
	Status  int
	Message string `json:"message"`
	Code    string `json:"code"`
}

type profileRecord struct {
	ID          string  `json:"id"`
	DisplayName string  `json:"display_name"`
	Email       string  `json:"email"`
	AvatarURL   *string `json:"avatar_url"`
	FamilyID    *string `json:"family_id"`
}
type familyRecord struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Code string `json:"join_code"`
}
type transactionRecord struct {
	ID           string  `json:"id"`
	UserID       string  `json:"user_id"`
	FamilyID     string  `json:"family_id"`
	Kind         string  `json:"kind"`
	Date         string  `json:"entry_date"`
	Description  string  `json:"description"`
	Amount       float64 `json:"amount"`
	RecordedHour int     `json:"recorded_hour"`
}

func (p profileRecord) user() domain.User {
	return domain.User{ID: p.ID, Name: p.DisplayName, Email: p.Email, Avatar: p.AvatarURL, FamilyID: p.FamilyID}
}
func (f familyRecord) family() domain.Family {
	return domain.Family{ID: f.ID, Name: f.Name, Code: f.Code}
}
func (t transactionRecord) transaction() domain.Transaction {
	return domain.Transaction{ID: t.ID, UserID: t.UserID, FamilyID: t.FamilyID, Kind: t.Kind, Date: t.Date, Description: t.Description, Amount: t.Amount, RecordedHour: t.RecordedHour}
}

func (e *remoteError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return http.StatusText(e.Status)
}

func (s *Store) request(ctx context.Context, method, path string, params url.Values, body any, prefer string) ([]byte, int, error) {
	target := s.baseURL + path
	if len(params) > 0 {
		target += "?" + params.Encode()
	}
	var payload io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, 0, err
		}
		payload = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, target, payload)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("apikey", s.apiKey)
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Accept-Profile", "public")
	if method != http.MethodGet && method != http.MethodHead {
		req.Header.Set("Content-Profile", "public")
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if prefer != "" {
		req.Header.Set("Prefer", prefer)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, resp.StatusCode, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var re remoteError
		re.Status = resp.StatusCode
		_ = json.Unmarshal(data, &re)
		if re.Message == "" {
			re.Message = strings.TrimSpace(string(data))
		}
		return nil, resp.StatusCode, &re
	}
	return data, resp.StatusCode, nil
}

func (s *Store) rows(ctx context.Context, table string, params url.Values, out any) error {
	data, _, err := s.request(ctx, http.MethodGet, "/rest/v1/"+table, params, nil, "")
	if err != nil {
		return err
	}
	return json.Unmarshal(data, out)
}
func (s *Store) write(ctx context.Context, method, table string, params url.Values, body any, out any) error {
	data, _, err := s.request(ctx, method, "/rest/v1/"+table, params, body, "return=representation")
	if err != nil {
		return err
	}
	if out != nil {
		return json.Unmarshal(data, out)
	}
	return nil
}

func (s *Store) profile(ctx context.Context, id string) (domain.User, error) {
	params := url.Values{"select": {"id,display_name,email,avatar_url,family_id"}, "id": {"eq." + id}}
	var profiles []profileRecord
	if err := s.rows(ctx, "kebnoi_profiles", params, &profiles); err != nil {
		return domain.User{}, err
	}
	if len(profiles) == 0 {
		return domain.User{}, ErrNotFound
	}
	return profiles[0].user(), nil
}

func (s *Store) Bootstrap(ctx context.Context, userID, email, name string) (domain.Bootstrap, error) {
	me, err := s.profile(ctx, userID)
	if errors.Is(err, ErrNotFound) {
		name = strings.TrimSpace(name)
		if name == "" {
			name = strings.TrimSpace(strings.Split(email, "@")[0])
		}
		if name == "" {
			name = "สมาชิก"
		}
		var created []profileRecord
		err = s.write(ctx, http.MethodPost, "kebnoi_profiles", url.Values{"on_conflict": {"id"}}, map[string]string{"id": userID, "display_name": name, "email": email}, &created)
		if err != nil {
			return domain.Bootstrap{}, err
		}
		if len(created) == 0 {
			return domain.Bootstrap{}, ErrNotFound
		}
		me, err = created[0].user(), nil
	}
	if err != nil {
		return domain.Bootstrap{}, err
	}
	out := domain.Bootstrap{Users: []domain.User{me}, Families: []domain.Family{}, Transactions: []domain.Transaction{}, CurrentUserID: userID}
	if me.FamilyID == nil {
		return out, nil
	}
	familyParams := url.Values{"select": {"id,name,join_code"}, "id": {"eq." + *me.FamilyID}}
	var familyRows []familyRecord
	if err = s.rows(ctx, "kebnoi_families", familyParams, &familyRows); err != nil {
		return out, err
	}
	if len(familyRows) == 0 {
		return out, ErrNotFound
	}
	out.Families = append(out.Families, familyRows[0].family())
	memberParams := url.Values{"select": {"id,display_name,email,avatar_url,family_id"}, "family_id": {"eq." + *me.FamilyID}, "order": {"created_at.asc"}}
	var profiles []profileRecord
	if err = s.rows(ctx, "kebnoi_profiles", memberParams, &profiles); err != nil {
		return out, err
	}
	out.Users = make([]domain.User, 0, len(profiles))
	for _, profile := range profiles {
		out.Users = append(out.Users, profile.user())
	}
	txParams := url.Values{"select": {"id,user_id,family_id,kind,entry_date,description,amount,recorded_hour"}, "family_id": {"eq." + *me.FamilyID}, "order": {"entry_date.desc,created_at.desc"}}
	var txRows []transactionRecord
	if err = s.rows(ctx, "kebnoi_transactions", txParams, &txRows); err != nil {
		return out, err
	}
	for _, row := range txRows {
		out.Transactions = append(out.Transactions, row.transaction())
	}
	return out, nil
}

func (s *Store) Transactions(ctx context.Context, familyID string) ([]domain.Transaction, error) {
	params := url.Values{"select": {"id,user_id,family_id,kind,entry_date,description,amount,recorded_hour"}, "family_id": {"eq." + familyID}, "order": {"entry_date.desc,created_at.desc"}}
	rows := []transactionRecord{}
	err := s.rows(ctx, "kebnoi_transactions", params, &rows)
	items := make([]domain.Transaction, 0, len(rows))
	for _, row := range rows {
		items = append(items, row.transaction())
	}
	return items, err
}

func randomCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(10000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%04d", n.Int64()), nil
}
func (s *Store) CreateFamily(ctx context.Context, userID, name string) (domain.Family, error) {
	me, err := s.profile(ctx, userID)
	if err != nil {
		return domain.Family{}, err
	}
	if me.FamilyID != nil {
		return domain.Family{}, ErrAlreadyInFamily
	}
	var family domain.Family
	for i := 0; i < 20; i++ {
		code, err := randomCode()
		if err != nil {
			return family, err
		}
		body := map[string]any{"name": strings.TrimSpace(name), "join_code": code, "created_by": userID}
		params := url.Values{"select": {"id,name,join_code"}}
		var created []familyRecord
		err = s.write(ctx, http.MethodPost, "kebnoi_families", params, body, &created)
		if err == nil && len(created) > 0 {
			family = created[0].family()
			break
		}
		var re *remoteError
		if !errors.As(err, &re) || re.Status != http.StatusConflict {
			return family, err
		}
	}
	if family.ID == "" {
		return family, errors.New("could not allocate family code")
	}
	if err = s.setFamily(ctx, userID, &family.ID); err != nil {
		_, _, _ = s.request(ctx, http.MethodDelete, "/rest/v1/families", url.Values{"id": {"eq." + family.ID}}, nil, "return=minimal")
		return domain.Family{}, err
	}
	return family, nil
}

func (s *Store) setFamily(ctx context.Context, userID string, familyID *string) error {
	params := url.Values{"id": {"eq." + userID}}
	body := map[string]any{"family_id": familyID}
	var changed []json.RawMessage
	if err := s.write(ctx, http.MethodPatch, "kebnoi_profiles", params, body, &changed); err != nil {
		return err
	}
	if len(changed) == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) JoinFamily(ctx context.Context, userID, code string) (domain.Family, error) {
	me, err := s.profile(ctx, userID)
	if err != nil {
		return domain.Family{}, err
	}
	if me.FamilyID != nil {
		return domain.Family{}, ErrAlreadyInFamily
	}
	params := url.Values{"select": {"id,name,join_code"}, "join_code": {"eq." + code}}
	var families []familyRecord
	if err = s.rows(ctx, "kebnoi_families", params, &families); err != nil {
		return domain.Family{}, err
	}
	if len(families) == 0 {
		return domain.Family{}, ErrNotFound
	}
	f := families[0].family()
	if err = s.setFamily(ctx, userID, &f.ID); err != nil {
		return domain.Family{}, err
	}
	return f, nil
}
func (s *Store) LeaveFamily(ctx context.Context, userID string) error {
	return s.setFamily(ctx, userID, nil)
}

func (s *Store) CreateTransaction(ctx context.Context, userID string, in domain.TransactionInput) (domain.Transaction, error) {
	me, err := s.profile(ctx, userID)
	if err != nil {
		return domain.Transaction{}, err
	}
	if me.FamilyID == nil {
		return domain.Transaction{}, ErrNotFound
	}
	body := map[string]any{"user_id": userID, "family_id": *me.FamilyID, "kind": in.Kind, "entry_date": in.Date, "description": strings.TrimSpace(in.Description), "amount": in.Amount}
	params := url.Values{"select": {"id,user_id,family_id,kind,entry_date,description,amount,recorded_hour"}}
	var items []transactionRecord
	err = s.write(ctx, http.MethodPost, "kebnoi_transactions", params, body, &items)
	if err != nil {
		return domain.Transaction{}, err
	}
	if len(items) == 0 {
		return domain.Transaction{}, ErrNotFound
	}
	return items[0].transaction(), nil
}
func (s *Store) UpdateTransaction(ctx context.Context, userID, id string, in domain.TransactionInput) (domain.Transaction, error) {
	me, err := s.profile(ctx, userID)
	if err != nil {
		return domain.Transaction{}, err
	}
	if me.FamilyID == nil {
		return domain.Transaction{}, ErrNotFound
	}
	params := url.Values{"id": {"eq." + id}, "user_id": {"eq." + userID}, "family_id": {"eq." + *me.FamilyID}}
	body := map[string]any{"kind": in.Kind, "entry_date": in.Date, "description": strings.TrimSpace(in.Description), "amount": in.Amount}
	params.Set("select", "id,user_id,family_id,kind,entry_date,description,amount,recorded_hour")
	var items []transactionRecord
	err = s.write(ctx, http.MethodPatch, "kebnoi_transactions", params, body, &items)
	if err != nil {
		return domain.Transaction{}, err
	}
	if len(items) == 0 {
		return domain.Transaction{}, ErrNotFound
	}
	return items[0].transaction(), nil
}
func (s *Store) DeleteTransaction(ctx context.Context, userID, id string) error {
	me, err := s.profile(ctx, userID)
	if err != nil {
		return err
	}
	if me.FamilyID == nil {
		return ErrNotFound
	}
	params := url.Values{"select": {"id"}, "id": {"eq." + id}, "user_id": {"eq." + userID}, "family_id": {"eq." + *me.FamilyID}}
	var deleted []struct {
		ID string `json:"id"`
	}
	if err = s.write(ctx, http.MethodDelete, "kebnoi_transactions", params, nil, &deleted); err != nil {
		return err
	}
	if len(deleted) == 0 {
		return ErrNotFound
	}
	return nil
}
func (s *Store) UpdateProfile(ctx context.Context, userID, name string) (domain.User, error) {
	var changed []json.RawMessage
	params := url.Values{"id": {"eq." + userID}}
	if err := s.write(ctx, http.MethodPatch, "kebnoi_profiles", params, map[string]string{"display_name": strings.TrimSpace(name)}, &changed); err != nil {
		return domain.User{}, err
	}
	if len(changed) == 0 {
		return domain.User{}, ErrNotFound
	}
	return s.profile(ctx, userID)
}
func (s *Store) DeleteAccount(ctx context.Context, userID string) error {
	_, _, err := s.request(ctx, http.MethodDelete, "/auth/v1/admin/users/"+url.PathEscape(userID), nil, nil, "")
	return err
}

func ValidTransaction(in domain.TransactionInput) bool {
	if (in.Kind != "income" && in.Kind != "expense") || in.Amount <= 0 || in.Amount > 1_000_000_000 || utf8.RuneCountInString(strings.TrimSpace(in.Description)) == 0 || utf8.RuneCountInString(in.Description) > 80 {
		return false
	}
	_, err := time.Parse("2006-01-02", in.Date)
	return err == nil
}
