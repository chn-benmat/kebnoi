package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port, FrontendOrigin, SupabaseURL, SupabaseServiceKey string
}

func Load() (Config, error) {
	loadFile(".env.local")
	loadFile(".env")
	c := Config{
		Port:               value("PORT", "8080"),
		FrontendOrigin:     value("FRONTEND_ORIGIN", "http://localhost:5173"),
		SupabaseURL:        strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"),
		SupabaseServiceKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
	}
	if c.SupabaseURL == "" || c.SupabaseServiceKey == "" {
		return Config{}, fmt.Errorf("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env.local")
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
