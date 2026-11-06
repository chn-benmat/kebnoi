package httpapi

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/chn-benmat/backend/internal/auth"
	"github.com/chn-benmat/backend/internal/store"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
)

type handlers struct {
	store        *store.Store
	auth         *auth.Manager
	secureCookie bool
}

func Register(app *fiber.App, data *store.Store, manager *auth.Manager, frontendOrigin string) {
	h := &handlers{store: data, auth: manager, secureCookie: strings.HasPrefix(frontendOrigin, "https://")}
	app.Use("/api", func(c fiber.Ctx) error {
		origin := c.Get("Origin")
		if origin != "" && origin != frontendOrigin {
			return fiber.NewError(fiber.StatusForbidden, "origin not allowed")
		}
		if c.Method() != fiber.MethodGet && c.Method() != fiber.MethodHead && c.Method() != fiber.MethodOptions && c.Cookies(sessionCookie) != "" && origin != frontendOrigin {
			return fiber.NewError(fiber.StatusForbidden, "origin required")
		}
		return c.Next()
	})
	app.Get("/api/health", func(c fiber.Ctx) error { return c.JSON(fiber.Map{"status": "ok"}) })
	app.Post("/api/auth/signup", h.signUp)
	app.Post("/api/auth/login", h.signIn)
	app.Post("/api/auth/refresh", h.refresh)
	app.Post("/api/auth/logout", h.signOut)
	app.Post("/api/auth/forgot-password", limiter.New(limiter.Config{Max: 5, Expiration: 15 * time.Minute}), h.forgotPassword)
	app.Post("/api/auth/reset-password", limiter.New(limiter.Config{Max: 10, Expiration: 15 * time.Minute}), h.resetPassword)
	app.Get("/api/avatars/:id", h.getAvatar)
	api := app.Group("/api", manager.Middleware)
	api.Patch("/auth/credentials", h.updateCredentials)
	api.Patch("/auth/password", h.changePassword)
	api.Get("/bootstrap", h.bootstrap)
	api.Post("/families", h.createFamily)
	api.Post("/families/join", h.joinFamily)
	api.Post("/families/leave", h.leaveFamily)
	api.Get("/transactions", h.listTransactions)
	api.Post("/transactions", h.createTransaction)
	api.Patch("/transactions/:id", h.updateTransaction)
	api.Delete("/transactions/:id", h.deleteTransaction)
	api.Patch("/profile", h.updateProfile)
	api.Post("/profile/avatar", h.uploadAvatar)
	api.Delete("/account", h.deleteAccount)
}

func ErrorHandler(c fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	var fe *fiber.Error
	if errors.As(err, &fe) {
		code = fe.Code
	}
	if code >= fiber.StatusInternalServerError {
		log.Printf("[http] %s %s failed with status %d: %v", c.Method(), c.Path(), code, err)
	}
	message := http.StatusText(code)
	if fe != nil && code < 500 {
		message = fe.Message
	} else if code >= 500 {
		message = "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"
	}
	return c.Status(code).JSON(fiber.Map{"error": message})
}
