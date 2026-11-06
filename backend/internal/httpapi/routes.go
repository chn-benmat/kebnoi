package httpapi

import (
	"errors"
	"log"
	"net/http"

	"github.com/chn-benmat/backend/internal/auth"
	"github.com/chn-benmat/backend/internal/store"
	"github.com/gofiber/fiber/v3"
)

type handlers struct {
	store *store.Store
	auth  *auth.Manager
}

func Register(app *fiber.App, data *store.Store, manager *auth.Manager) {
	h := &handlers{store: data, auth: manager}
	app.Get("/api/health", func(c fiber.Ctx) error { return c.JSON(fiber.Map{"status": "ok"}) })
	app.Post("/api/auth/signup", h.signUp)
	app.Post("/api/auth/login", h.signIn)
	app.Post("/api/auth/refresh", h.refresh)
	app.Post("/api/auth/logout", h.signOut)
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
