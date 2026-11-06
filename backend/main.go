package main

import (
	"context"
	"log"
	"time"

	"github.com/chn-benmat/backend/internal/auth"
	"github.com/chn-benmat/backend/internal/config"
	"github.com/chn-benmat/backend/internal/database"
	"github.com/chn-benmat/backend/internal/httpapi"
	"github.com/chn-benmat/backend/internal/store"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/static"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	db, err := database.Open(database.Config{
		Host: cfg.DBHost, Port: cfg.DBPort, Name: cfg.DBName,
		User: cfg.DBUser, Password: cfg.DBPassword,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := database.Migrate(ctx, db); err != nil {
		log.Fatal(err)
	}
	app := fiber.New(fiber.Config{AppName: "Kebnoi API", BodyLimit: 2 << 20, ErrorHandler: httpapi.ErrorHandler})
	app.Use(recover.New(), logger.New())
	app.Get("/uploads/avatars/*", static.New("./uploads/avatars"))
	app.Use(cors.New(cors.Config{AllowOrigins: []string{cfg.FrontendOrigin}, AllowMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"}, AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"}}))
	data := store.New(db)
	manager := auth.New(db)
	httpapi.Register(app, data, manager)
	log.Fatal(app.Listen(":" + cfg.Port))
}
