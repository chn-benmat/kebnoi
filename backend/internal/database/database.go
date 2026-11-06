package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	mysqlDriver "github.com/go-sql-driver/mysql"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Config struct {
	Host     string
	Port     string
	Name     string
	User     string
	Password string
}

func Open(cfg Config) (*sql.DB, error) {
	dsn := mysqlDriver.Config{
		User:                 cfg.User,
		Passwd:               cfg.Password,
		Net:                  "tcp",
		Addr:                 cfg.Host + ":" + cfg.Port,
		DBName:               cfg.Name,
		AllowNativePasswords: true,
		ParseTime:            true,
		Loc:                  time.UTC,
		Params:               map[string]string{"time_zone": "'+00:00'"},
	}
	db, err := sql.Open("mysql", dsn.FormatDSN())
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func Migrate(ctx context.Context, db *sql.DB) error {
	startedAt := time.Now()
	log.Println("[database] starting schema migration")
	gdb, err := gorm.Open(mysql.New(mysql.Config{Conn: db}), &gorm.Config{Logger: logger.Default.LogMode(logger.Warn)})
	if err != nil {
		wrappedErr := fmt.Errorf("open GORM migration connection: %w", err)
		log.Printf("[database] migration failed after %s: %v", time.Since(startedAt).Round(time.Millisecond), wrappedErr)
		return wrappedErr
	}
	for _, table := range []string{"kebnoi_email_verification_tokens", "kebnoi_password_reset_tokens"} {
		if gdb.Migrator().HasTable(table) {
			if err := gdb.Migrator().DropTable(table); err != nil {
				wrappedErr := fmt.Errorf("remove obsolete auth table %s: %w", table, err)
				log.Printf("[database] migration failed after %s: %v", time.Since(startedAt).Round(time.Millisecond), wrappedErr)
				return wrappedErr
			}
			log.Printf("[database] removed obsolete table %s", table)
		}
	}
	if gdb.Migrator().HasColumn(&User{}, "email_verified_at") {
		if err := gdb.Migrator().DropColumn(&User{}, "email_verified_at"); err != nil {
			wrappedErr := fmt.Errorf("remove obsolete email verification column: %w", err)
			log.Printf("[database] migration failed after %s: %v", time.Since(startedAt).Round(time.Millisecond), wrappedErr)
			return wrappedErr
		}
		log.Println("[database] removed obsolete email_verified_at column")
	}
	// Older builds accidentally created this relationship backwards:
	// kebnoi_users.id -> kebnoi_profiles.id. Drop only that known bad FK;
	// the intended profile-to-user FK is created explicitly below.
	var wrongProfileFK int64
	if err := gdb.WithContext(ctx).Raw(`
		SELECT COUNT(*)
		FROM information_schema.KEY_COLUMN_USAGE
		WHERE CONSTRAINT_SCHEMA = DATABASE()
		  AND TABLE_NAME = 'kebnoi_users'
		  AND CONSTRAINT_NAME = 'fk_kebnoi_profiles_user'
		  AND REFERENCED_TABLE_NAME = 'kebnoi_profiles'
	`).Scan(&wrongProfileFK).Error; err != nil {
		wrappedErr := fmt.Errorf("check for outdated profile foreign key: %w", err)
		log.Printf("[database] migration failed after %s: %v", time.Since(startedAt).Round(time.Millisecond), wrappedErr)
		return wrappedErr
	}
	if wrongProfileFK > 0 {
		if err := gdb.WithContext(ctx).Exec("ALTER TABLE kebnoi_users DROP FOREIGN KEY fk_kebnoi_profiles_user").Error; err != nil {
			wrappedErr := fmt.Errorf("remove outdated profile foreign key: %w", err)
			log.Printf("[database] migration failed after %s: %v", time.Since(startedAt).Round(time.Millisecond), wrappedErr)
			return wrappedErr
		}
		log.Println("[database] removed outdated reversed profile foreign key")
	}
	if err := gdb.WithContext(ctx).AutoMigrate(allModels...); err != nil {
		wrappedErr := fmt.Errorf("apply database schema: %w", err)
		log.Printf("[database] migration failed after %s: %v", time.Since(startedAt).Round(time.Millisecond), wrappedErr)
		return wrappedErr
	}
	// Profile and User share the same ID. Create this FK explicitly so GORM
	// cannot infer the relationship in the reverse direction.
	var profileUserFK int64
	if err := gdb.WithContext(ctx).Raw(`
		SELECT COUNT(*)
		FROM information_schema.KEY_COLUMN_USAGE
		WHERE CONSTRAINT_SCHEMA = DATABASE()
		  AND TABLE_NAME = 'kebnoi_profiles'
		  AND COLUMN_NAME = 'id'
		  AND REFERENCED_TABLE_NAME = 'kebnoi_users'
		  AND REFERENCED_COLUMN_NAME = 'id'
	`).Scan(&profileUserFK).Error; err != nil {
		wrappedErr := fmt.Errorf("check profile-to-user foreign key: %w", err)
		log.Printf("[database] migration failed after %s: %v", time.Since(startedAt).Round(time.Millisecond), wrappedErr)
		return wrappedErr
	}
	if profileUserFK == 0 {
		if err := gdb.WithContext(ctx).Exec(`
			ALTER TABLE kebnoi_profiles
			ADD CONSTRAINT fk_kebnoi_profiles_user
			FOREIGN KEY (id) REFERENCES kebnoi_users(id) ON DELETE CASCADE
		`).Error; err != nil {
			wrappedErr := fmt.Errorf("create profile-to-user foreign key: %w", err)
			log.Printf("[database] migration failed after %s: %v", time.Since(startedAt).Round(time.Millisecond), wrappedErr)
			return wrappedErr
		}
		log.Println("[database] created profile-to-user foreign key")
	}
	log.Printf("[database] migration succeeded in %s", time.Since(startedAt).Round(time.Millisecond))
	return nil
}
