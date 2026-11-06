package database

import "time"

type User struct {
	ID           string    `gorm:"type:char(36);primaryKey"`
	Email        string    `gorm:"type:varchar(254);not null;uniqueIndex:uq_kebnoi_users_email"`
	PasswordHash string    `gorm:"type:varchar(72);not null"`
	CreatedAt    time.Time `gorm:"type:datetime(3);not null;default:CURRENT_TIMESTAMP(3)"`
	Sessions     []Session `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
}

func (User) TableName() string { return "kebnoi_users" }

type Profile struct {
	ID          string    `gorm:"type:char(36);primaryKey"`
	DisplayName string    `gorm:"type:varchar(40);not null"`
	Email       string    `gorm:"type:varchar(254);not null"`
	AvatarURL   *string   `gorm:"type:varchar(2048)"`
	AvatarData  []byte    `gorm:"type:longblob"`
	AvatarMime  string    `gorm:"type:varchar(64);not null;default:''"`
	FamilyID    *string   `gorm:"type:char(36);index:idx_kebnoi_profiles_family_created,priority:1"`
	CreatedAt   time.Time `gorm:"type:datetime(3);not null;default:CURRENT_TIMESTAMP(3);index:idx_kebnoi_profiles_family_created,priority:2"`
	Family      *Family   `gorm:"foreignKey:FamilyID;references:ID;constraint:OnDelete:SET NULL"`
}

func (Profile) TableName() string { return "kebnoi_profiles" }

type Family struct {
	ID        string    `gorm:"type:char(36);primaryKey"`
	Name      string    `gorm:"type:varchar(80);not null"`
	JoinCode  string    `gorm:"type:char(4);not null;uniqueIndex:uq_kebnoi_families_join_code"`
	CreatedBy string    `gorm:"type:char(36);not null;index:idx_kebnoi_families_created_by"`
	CreatedAt time.Time `gorm:"type:datetime(3);not null;default:CURRENT_TIMESTAMP(3)"`
	Creator   User      `gorm:"foreignKey:CreatedBy;references:ID;constraint:OnDelete:CASCADE"`
}

func (Family) TableName() string { return "kebnoi_families" }

type Transaction struct {
	ID           string    `gorm:"type:char(36);primaryKey"`
	UserID       string    `gorm:"type:char(36);not null;index:idx_kebnoi_transactions_user"`
	FamilyID     string    `gorm:"type:char(36);not null;index:idx_kebnoi_transactions_family_date_created,priority:1"`
	Kind         string    `gorm:"type:enum('income','expense');not null"`
	EntryDate    time.Time `gorm:"type:date;not null;index:idx_kebnoi_transactions_family_date_created,priority:2,sort:desc"`
	Description  string    `gorm:"type:varchar(80);not null"`
	Amount       float64   `gorm:"type:decimal(12,2);not null"`
	RecordedHour int       `gorm:"type:tinyint unsigned;not null"`
	CreatedAt    time.Time `gorm:"type:datetime(3);not null;default:CURRENT_TIMESTAMP(3);index:idx_kebnoi_transactions_family_date_created,priority:3,sort:desc"`
	User         User      `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
	Family       Family    `gorm:"foreignKey:FamilyID;references:ID;constraint:OnDelete:CASCADE"`
}

func (Transaction) TableName() string { return "kebnoi_transactions" }

type Session struct {
	ID               string     `gorm:"type:char(36);primaryKey"`
	UserID           string     `gorm:"type:char(36);not null;index:idx_kebnoi_sessions_user"`
	AccessTokenHash  string     `gorm:"type:char(64);not null;uniqueIndex:uq_kebnoi_sessions_access_hash"`
	RefreshTokenHash string     `gorm:"type:char(64);not null;uniqueIndex:uq_kebnoi_sessions_refresh_hash"`
	AccessExpiresAt  time.Time  `gorm:"type:datetime(3);not null;index:idx_kebnoi_sessions_access_expiry"`
	ExpiresAt        time.Time  `gorm:"type:datetime(3);not null;index:idx_kebnoi_sessions_expiry"`
	RevokedAt        *time.Time `gorm:"type:datetime(3)"`
	CreatedAt        time.Time  `gorm:"type:datetime(3);not null;default:CURRENT_TIMESTAMP(3)"`
	User             User       `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
}

func (Session) TableName() string { return "kebnoi_sessions" }

var allModels = []any{
	&User{}, &Profile{}, &Family{}, &Transaction{}, &Session{},
}
