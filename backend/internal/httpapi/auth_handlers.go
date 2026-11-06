package httpapi

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/chn-benmat/backend/internal/auth"
	"github.com/gofiber/fiber/v3"
)

type authRequest struct {
	Name            string `json:"name"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

const sessionCookie = "kebnoi_session"

func (h *handlers) setSessionCookie(c fiber.Ctx, token string, maxAge int) {
	sameSite := "Lax"
	if h.secureCookie {
		sameSite = "None"
	}
	c.Cookie(&fiber.Cookie{Name: sessionCookie, Value: token, Path: "/api", MaxAge: maxAge, HTTPOnly: true, Secure: h.secureCookie, SameSite: sameSite})
}

func (h *handlers) forgotPassword(c fiber.Ctx) error {
	var in authRequest
	if c.Bind().JSON(&in) != nil || !validEmail(in.Email) {
		return fiber.NewError(fiber.StatusBadRequest, "กรุณาตรวจสอบอีเมล")
	}
	exists, err := h.auth.EmailExists(c.Context(), in.Email)
	if err != nil {
		return err
	}
	if !exists {
		return fiber.NewError(fiber.StatusNotFound, "ไม่พบบัญชีที่ใช้อีเมลนี้")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *handlers) resetPassword(c fiber.Ctx) error {
	var in authRequest
	if c.Bind().JSON(&in) != nil || !validEmail(in.Email) || len(in.NewPassword) < 6 || len(in.NewPassword) > 72 {
		return fiber.NewError(fiber.StatusBadRequest, "กรุณาตรวจสอบอีเมลและรหัสผ่านใหม่ความยาว 6–72 ไบต์")
	}
	err := h.auth.ResetPassword(c.Context(), in.Email, in.NewPassword)
	if errors.Is(err, auth.ErrUserNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "ไม่พบบัญชีที่ใช้อีเมลนี้")
	}
	if err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *handlers) signUp(c fiber.Ctx) error {
	var in authRequest
	if c.Bind().JSON(&in) != nil || utf8.RuneCountInString(strings.TrimSpace(in.Name)) < 1 || utf8.RuneCountInString(in.Name) > 40 || !validEmail(in.Email) || len(in.Password) < 6 || len(in.Password) > 72 {
		return fiber.NewError(fiber.StatusBadRequest, "กรุณาตรวจสอบชื่อ อีเมล และรหัสผ่าน (อย่างน้อย 6 ตัวอักษร)")
	}
	if !auth.IsAllowedSignupEmail(in.Email) {
		return fiber.NewError(fiber.StatusBadRequest, "อีเมลนี้ยังไม่รองรับ กรุณาตรวจสอบอีเมลแล้วลองอีกครั้ง")
	}
	session, err := h.auth.Signup(c.Context(), in.Name, in.Email, in.Password)
	if errors.Is(err, auth.ErrEmailExists) {
		return fiber.NewError(fiber.StatusConflict, "อีเมลนี้ถูกใช้งานแล้ว")
	}
	if errors.Is(err, auth.ErrInvalidInput) {
		return fiber.NewError(fiber.StatusBadRequest, "ข้อมูลสมัครสมาชิกไม่ถูกต้อง")
	}
	if err != nil {
		return err
	}
	h.setSessionCookie(c, session.RefreshToken, int((30 * 24 * time.Hour).Seconds()))
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{})
}

func (h *handlers) signIn(c fiber.Ctx) error {
	var in authRequest
	if c.Bind().JSON(&in) != nil || !validEmail(in.Email) || in.Password == "" {
		return fiber.NewError(fiber.StatusBadRequest, "กรุณากรอกอีเมลและรหัสผ่าน")
	}
	session, err := h.auth.Login(c.Context(), in.Email, in.Password)
	if errors.Is(err, auth.ErrInvalidCredentials) {
		return fiber.NewError(fiber.StatusUnauthorized, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
	}
	if err != nil {
		return err
	}
	h.setSessionCookie(c, session.RefreshToken, int((30 * 24 * time.Hour).Seconds()))
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *handlers) refresh(c fiber.Ctx) error {
	token := c.Cookies(sessionCookie)
	if token == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่")
	}
	session, err := h.auth.Refresh(c.Context(), token)
	if errors.Is(err, auth.ErrInvalidCredentials) {
		return fiber.NewError(fiber.StatusUnauthorized, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่")
	}
	if err != nil {
		return err
	}
	h.setSessionCookie(c, session.RefreshToken, int((30 * 24 * time.Hour).Seconds()))
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *handlers) signOut(c fiber.Ctx) error {
	if err := h.auth.Logout(c.Context(), c.Cookies(sessionCookie)); err != nil {
		return err
	}
	h.setSessionCookie(c, "", -1)
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *handlers) updateCredentials(c fiber.Ctx) error {
	var in authRequest
	if c.Bind().JSON(&in) != nil || !validEmail(in.Email) {
		return fiber.NewError(fiber.StatusBadRequest, "กรุณาตรวจสอบอีเมล")
	}
	changedEmail, err := h.auth.UpdateCredentials(c.Context(), auth.UserID(c), in.Email)
	if errors.Is(err, auth.ErrEmailExists) {
		return fiber.NewError(fiber.StatusConflict, "อีเมลนี้ถูกใช้งานแล้ว")
	}
	if errors.Is(err, auth.ErrInvalidInput) {
		return fiber.NewError(fiber.StatusBadRequest, "ข้อมูลบัญชีไม่ถูกต้อง")
	}
	if errors.Is(err, auth.ErrUserNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "ไม่พบบัญชีผู้ใช้")
	}
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"email_changed": changedEmail})
}

func (h *handlers) changePassword(c fiber.Ctx) error {
	var in authRequest
	if c.Bind().JSON(&in) != nil || in.CurrentPassword == "" || len(in.NewPassword) < 6 || len(in.NewPassword) > 72 {
		return fiber.NewError(fiber.StatusBadRequest, "กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร")
	}
	if err := h.auth.ChangePassword(c.Context(), auth.UserID(c), in.CurrentPassword, in.NewPassword); errors.Is(err, auth.ErrWrongCurrentPassword) {
		return fiber.NewError(fiber.StatusUnauthorized, "รหัสผ่านปัจจุบันไม่ถูกต้อง")
	} else if errors.Is(err, auth.ErrInvalidInput) {
		return fiber.NewError(fiber.StatusBadRequest, "รหัสผ่านใหม่ต้องมีความยาว 6–72 ตัวอักษร")
	} else if err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func validEmail(value string) bool {
	value = strings.TrimSpace(value)
	parts := strings.Split(value, "@")
	return len(value) <= 254 && len(parts) == 2 && parts[0] != "" && strings.Contains(parts[1], ".") && !strings.ContainsAny(value, " \t\r\n")
}
