package domain

type User struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Email    string  `json:"email"`
	Avatar   *string `json:"avatar,omitempty"`
	FamilyID *string `json:"familyId,omitempty"`
}

type Family struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}

type Transaction struct {
	ID           string  `json:"id"`
	UserID       string  `json:"userId"`
	FamilyID     string  `json:"familyId"`
	Kind         string  `json:"kind"`
	Date         string  `json:"date"`
	Description  string  `json:"description"`
	Amount       float64 `json:"amount"`
	RecordedHour int     `json:"recordedHour"`
}

type Bootstrap struct {
	Users         []User        `json:"users"`
	Families      []Family      `json:"families"`
	Transactions  []Transaction `json:"transactions"`
	CurrentUserID string        `json:"currentUserId"`
}

type TransactionInput struct {
	Kind        string  `json:"kind"`
	Date        string  `json:"date"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
}
