package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
)

type Validator struct {
	baseURL, apiKey string
	client          *http.Client
}

type User struct {
	ID    string
	Email string
	Name  string
}

func New(baseURL, apiKey string) *Validator {
	return &Validator{baseURL: strings.TrimRight(baseURL, "/"), apiKey: apiKey, client: &http.Client{Timeout: 8 * time.Second}}
}

func (v *Validator) Middleware(c fiber.Ctx) error {
	parts := strings.SplitN(strings.TrimSpace(c.Get("Authorization")), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "sign in required")
	}
	ctx, cancel := context.WithTimeout(c.Context(), 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.baseURL+"/auth/v1/user", nil)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized)
	}
	req.Header.Set("apikey", v.apiKey)
	req.Header.Set("Authorization", "Bearer "+parts[1])
	resp, err := v.client.Do(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadGateway, "auth service unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired session")
	}
	var claims struct {
		ID       string `json:"id"`
		Email    string `json:"email"`
		Metadata struct {
			Name string `json:"name"`
		} `json:"user_metadata"`
	}
	if json.NewDecoder(resp.Body).Decode(&claims) != nil || claims.ID == "" {
		return fiber.NewError(fiber.StatusUnauthorized)
	}
	c.Locals("userID", claims.ID)
	c.Locals("userEmail", claims.Email)
	c.Locals("userName", claims.Metadata.Name)
	return c.Next()
}

func UserID(c fiber.Ctx) string { return c.Locals("userID").(string) }
func CurrentUser(c fiber.Ctx) User {
	return User{ID: UserID(c), Email: c.Locals("userEmail").(string), Name: c.Locals("userName").(string)}
}
