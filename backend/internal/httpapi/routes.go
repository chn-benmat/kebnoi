package httpapi

import (
	"errors"
	"net/http"

	"github.com/chn-benmat/backend/internal/auth"
	"github.com/chn-benmat/backend/internal/store"
	"github.com/gofiber/fiber/v3"
)

type handlers struct{ store *store.Store }

func Register(app *fiber.App, data *store.Store, validator *auth.Validator) {
	h := &handlers{store: data}
	app.Get("/api/health", func(c fiber.Ctx) error { return c.JSON(fiber.Map{"status": "ok"}) })
	api := app.Group("/api", validator.Middleware)
	api.Get("/bootstrap", h.bootstrap)
	api.Post("/families", h.createFamily)
	api.Post("/families/join", h.joinFamily)
	api.Post("/families/leave", h.leaveFamily)
	api.Get("/transactions", h.listTransactions)
	api.Post("/transactions", h.createTransaction)
	api.Patch("/transactions/:id", h.updateTransaction)
	api.Delete("/transactions/:id", h.deleteTransaction)
	api.Patch("/profile", h.updateProfile)
	api.Delete("/account", h.deleteAccount)
}

func ErrorHandler(c fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	var fe *fiber.Error
	if errors.As(err, &fe) {
		code = fe.Code
	}
	message := http.StatusText(code)
	if fe != nil && code < 500 {
		message = fe.Message
	}
	return c.Status(code).JSON(fiber.Map{"error": message})
}
