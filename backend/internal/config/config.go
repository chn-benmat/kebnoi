package config

import (
	"bufio"
	"os"
	"strings"
)

type Config struct {
	Port, FrontendOrigin                       string
	DBHost, DBPort, DBName, DBUser, DBPassword string
}

func Load() (Config, error) {
	loadFile(".env.local")
	loadFile(".env")
	c := Config{
		Port:           value("PORT", "8080"),
		FrontendOrigin: strings.TrimRight(value("FRONTEND_ORIGIN", "http://localhost:5173"), "/"),
		DBHost:         value("DB_HOST", "localhost"),
		DBPort:         value("DB_PORT", "3306"),
		DBName:         value("DB_NAME", "kebnoi_db"),
		DBUser:         value("DB_USER", "root"),
		DBPassword:     os.Getenv("DB_PASSWORD"),
	}
	return c, nil
}

func value(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func loadFile(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		line := strings.TrimSpace(s.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key, value = strings.TrimSpace(key), strings.Trim(strings.TrimSpace(value), "\"'")
		if key != "" && os.Getenv(key) == "" {
			_ = os.Setenv(key, value)
		}
	}
}
