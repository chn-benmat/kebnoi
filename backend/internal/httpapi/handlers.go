package httpapi

import (
	"bytes"
	"errors"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"strings"
	"unicode/utf8"

	"github.com/chn-benmat/backend/internal/auth"
	"github.com/chn-benmat/backend/internal/domain"
	"github.com/chn-benmat/backend/internal/store"
	"github.com/gofiber/fiber/v3"
)

const maxAvatarBytes = 1 << 20

func (h *handlers) bootstrap(c fiber.Ctx) error {
	user := auth.CurrentUser(c)
	result, err := h.store.Bootstrap(c.Context(), user.ID)
	if err != nil {
		return err
	}
	return c.JSON(result)
}

type familyRequest struct {
	Name string `json:"name"`
	Code string `json:"code"`
}

func (h *handlers) createFamily(c fiber.Ctx) error {
	var in familyRequest
	if c.Bind().JSON(&in) != nil || utf8.RuneCountInString(strings.TrimSpace(in.Name)) < 1 || utf8.RuneCountInString(in.Name) > 80 {
		return fiber.NewError(fiber.StatusBadRequest, "ชื่อครอบครัวต้องมีความยาว 1–80 ตัวอักษร")
	}
	f, err := h.store.CreateFamily(c.Context(), auth.UserID(c), in.Name)
	if errors.Is(err, store.ErrAlreadyInFamily) {
		return fiber.NewError(fiber.StatusConflict, "คุณอยู่ในครอบครัวแล้ว")
	}
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(f)
}
func (h *handlers) joinFamily(c fiber.Ctx) error {
	var in familyRequest
	if c.Bind().JSON(&in) != nil || len(in.Code) != 4 {
		return fiber.NewError(fiber.StatusBadRequest, "กรุณากรอกรหัสครอบครัว 4 หลัก")
	}
	f, err := h.store.JoinFamily(c.Context(), auth.UserID(c), in.Code)
	if errors.Is(err, store.ErrAlreadyInFamily) {
		return fiber.NewError(fiber.StatusConflict, "คุณอยู่ในครอบครัวแล้ว")
	}
	if errors.Is(err, store.ErrNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "ไม่พบรหัสครอบครัวนี้")
	}
	if err != nil {
		return err
	}
	return c.JSON(f)
}
func (h *handlers) leaveFamily(c fiber.Ctx) error {
	if err := h.store.LeaveFamily(c.Context(), auth.UserID(c)); err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}
func (h *handlers) listTransactions(c fiber.Ctx) error {
	user := auth.CurrentUser(c)
	data, err := h.store.Bootstrap(c.Context(), user.ID)
	if err != nil {
		return err
	}
	return c.JSON(data.Transactions)
}
func (h *handlers) createTransaction(c fiber.Ctx) error {
	var in domain.TransactionInput
	if c.Bind().JSON(&in) != nil || !store.ValidTransaction(in) {
		return fiber.NewError(fiber.StatusBadRequest, "กรุณาตรวจสอบข้อมูลรายการ")
	}
	t, err := h.store.CreateTransaction(c.Context(), auth.UserID(c), in)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(t)
}
func (h *handlers) updateTransaction(c fiber.Ctx) error {
	var in domain.TransactionInput
	if c.Bind().JSON(&in) != nil || !store.ValidTransaction(in) {
		return fiber.NewError(fiber.StatusBadRequest, "กรุณาตรวจสอบข้อมูลรายการ")
	}
	t, err := h.store.UpdateTransaction(c.Context(), auth.UserID(c), c.Params("id"), in)
	if errors.Is(err, store.ErrNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "ไม่พบรายการ")
	}
	if err != nil {
		return err
	}
	return c.JSON(t)
}
func (h *handlers) deleteTransaction(c fiber.Ctx) error {
	err := h.store.DeleteTransaction(c.Context(), auth.UserID(c), c.Params("id"))
	if errors.Is(err, store.ErrNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "ไม่พบรายการ")
	}
	if err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

type profileRequest struct {
	Name string `json:"name"`
}

func (h *handlers) updateProfile(c fiber.Ctx) error {
	var in profileRequest
	if c.Bind().JSON(&in) != nil || utf8.RuneCountInString(strings.TrimSpace(in.Name)) < 1 || utf8.RuneCountInString(in.Name) > 40 {
		return fiber.NewError(fiber.StatusBadRequest, "ชื่อผู้ใช้ต้องมีความยาว 1–40 ตัวอักษร")
	}
	u, err := h.store.UpdateProfile(c.Context(), auth.UserID(c), in.Name)
	if err != nil {
		return err
	}
	return c.JSON(u)
}

func (h *handlers) uploadAvatar(c fiber.Ctx) error {
	header, err := c.FormFile("avatar")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "กรุณาเลือกรูปโปรไฟล์")
	}
	if header.Size <= 0 || header.Size > maxAvatarBytes {
		return fiber.NewError(fiber.StatusBadRequest, "รูปโปรไฟล์ต้องมีขนาดไม่เกิน 1 MB")
	}
	file, err := header.Open()
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "อ่านไฟล์รูปภาพไม่สำเร็จ")
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxAvatarBytes+1))
	if err != nil {
		return err
	}
	if len(data) == 0 || len(data) > maxAvatarBytes {
		return fiber.NewError(fiber.StatusBadRequest, "รูปโปรไฟล์ต้องมีขนาดไม่เกิน 1 MB")
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "ไฟล์นี้ไม่ใช่รูปภาพ PNG, JPEG หรือ GIF ที่ถูกต้อง")
	}
	if config.Width <= 0 || config.Height <= 0 || config.Width > 4096 || config.Height > 4096 || int64(config.Width)*int64(config.Height) > 16*1024*1024 {
		return fiber.NewError(fiber.StatusBadRequest, "ขนาดรูปภาพใหญ่เกินกำหนด")
	}
	mimeTypes := map[string]string{"jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif"}
	mime, ok := mimeTypes[format]
	if !ok {
		return fiber.NewError(fiber.StatusBadRequest, "รองรับรูปภาพ PNG, JPEG หรือ GIF เท่านั้น")
	}
	user, err := h.store.UpdateAvatar(c.Context(), auth.UserID(c), data, mime)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return fiber.NewError(fiber.StatusNotFound, "ไม่พบบัญชีผู้ใช้")
		}
		return err
	}
	return c.JSON(user)
}

func (h *handlers) getAvatar(c fiber.Ctx) error {
	data, mime, err := h.store.Avatar(c.Context(), c.Params("id"))
	if errors.Is(err, store.ErrNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "ไม่พบรูปโปรไฟล์")
	}
	if err != nil {
		return err
	}
	c.Set(fiber.HeaderContentType, mime)
	c.Set(fiber.HeaderCacheControl, "public, max-age=3600")
	return c.Send(data)
}

func (h *handlers) deleteAccount(c fiber.Ctx) error {
	if err := h.auth.DeleteAccount(c.Context(), auth.UserID(c)); err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}
