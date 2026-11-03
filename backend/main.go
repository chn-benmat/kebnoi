package main

import (
	"log"

	"github.com/chn-benmat/backend/internal/auth"
	"github.com/chn-benmat/backend/internal/config"
	"github.com/chn-benmat/backend/internal/httpapi"
	"github.com/chn-benmat/backend/internal/store"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	app := fiber.New(fiber.Config{AppName: "Kebnoi API", BodyLimit: 1 << 20, ErrorHandler: httpapi.ErrorHandler})
	app.Use(recover.New(), logger.New())
	app.Use(cors.New(cors.Config{AllowOrigins: []string{cfg.FrontendOrigin}, AllowMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"}, AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"}}))
	remote := store.New(cfg.SupabaseURL, cfg.SupabaseServiceKey)
	httpapi.Register(app, remote, auth.New(cfg.SupabaseURL, cfg.SupabaseServiceKey))
	log.Fatal(app.Listen(":" + cfg.Port))
}
