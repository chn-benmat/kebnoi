# เก็บหน่อย

เว็บบันทึกรายรับและรายจ่ายของครอบครัว ใช้ React/Vite, Go/Fiber และ MySQL โดย Go API จัดการบัญชีผู้ใช้และการอ่านเขียนข้อมูลทั้งหมด

## โครงสร้าง

```text
backend/
  main.go                          จุดเริ่ม API
	internal/database/               โมเดล GORM และ auto migration ตอนเริ่มระบบ
  internal/auth/                   สมัคร เข้าสู่ระบบ และตรวจ session
  internal/config/                 โหลด environment
  internal/domain/                 แบบข้อมูลที่ API ใช้
  internal/httpapi/                routes และ HTTP handlers
  internal/store/                  อ่านเขียนข้อมูลผ่าน MySQL
  profile.avatar_data             รูปโปรไฟล์เก็บเป็น LONGBLOB ใน MySQL
  .env.example                     ตัวอย่างการตั้งค่า backend
frontend/src/data/api.ts           จุดเชื่อม React กับ Go API
```

## ตั้งค่าครั้งแรก

1. ติดตั้ง MySQL 8.0.16 ขึ้นไป แล้วสร้างฐานข้อมูล `kebnoi_db` (หรือกำหนดชื่ออื่นใน `DB_NAME`); ตัวอย่างเช่น `CREATE DATABASE kebnoi_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
2. คัดลอก `backend/.env.example` เป็น `backend/.env.local` แล้วกำหนดค่า MySQL ให้ตรงกับเครื่อง
3. คัดลอก `frontend/.env.example` เป็น `frontend/.env.local`; ค่า `VITE_API_URL` ปกติใช้ `http://localhost:8080` และต้องตรงกับพอร์ต backend

อย่า commit ไฟล์ `.env.local`; ตัวแปร `VITE_*` จะถูกส่งไปยังเบราว์เซอร์

## เริ่มระบบในเครื่อง

จากโฟลเดอร์ `backend`:

```powershell
go run main.go
```

การเริ่ม API จะเรียก GORM `AutoMigrate` ก่อนเปิดพอร์ต แล้วสร้าง/อัปเกรดตารางที่แอปต้องใช้โดยอัตโนมัติ ดังนั้นเพื่อนที่ pull โค้ดชุดเดียวกันเพียงสร้างฐานข้อมูล ตั้ง `.env.local` จากไฟล์ตัวอย่าง แล้วรัน `go run main.go` เหมือนกันได้ การ migrate จะสร้าง schema สำหรับการใช้งานปัจจุบัน รวมถึงเอาตาราง token สำหรับยืนยันอีเมล/รีเซ็ตรหัสผ่านและคอลัมน์ `email_verified_at` เก่าออก

หน้า “ลืมรหัสผ่าน” ตรวจสอบอีเมลในฐานข้อมูล แล้วให้ตั้งรหัสผ่านใหม่โดยไม่ส่งอีเมลยืนยัน รหัสผ่านใหม่เก็บเป็น bcrypt hash และเซสชันเดิมถูกยกเลิก

**ข้อจำกัดด้านความปลอดภัย:** ผู้ที่รู้อีเมลของบัญชีสามารถเปลี่ยนรหัสผ่านและเข้าถึงบัญชีนั้นได้ทันที ระบบนี้จึงไม่ปลอดภัยสำหรับใช้งานจริงที่มีข้อมูลผู้ใช้ ควรเพิ่มการยืนยันตัวตนก่อนเปิดให้บุคคลทั่วไปใช้งาน

จากโฟลเดอร์ `frontend`:

```powershell
npm install
npm run dev
```

สมัครสมาชิกผ่าน Go API; รหัสผ่านและโทเคนเซสชันเก็บเป็น hash ในฐานข้อมูล เซสชันของเว็บมีอายุ 30 วันและใช้ HttpOnly cookie แทน localStorage โดย backend ตรวจสอบเซสชันกับ MySQL ทุกครั้ง คำขอที่เปลี่ยนข้อมูลต้องมาจาก `FRONTEND_ORIGIN` ที่ตั้งค่าไว้ ใน production ให้ใช้ HTTPS ทั้ง frontend และ backend; เบราว์เซอร์ที่บล็อก third-party cookies อาจต้องใช้ frontend และ backend บนเว็บไซต์เดียวกัน

## API

- `POST /api/auth/signup`, `POST /api/auth/login`
- `POST /api/auth/refresh`, `POST /api/auth/logout`
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- `GET /api/health`, `GET /api/bootstrap`
- `POST /api/families`, `POST /api/families/join`, `POST /api/families/leave`
- `GET/POST /api/transactions`, `PATCH/DELETE /api/transactions/:id`
- `PATCH /api/profile`, `POST /api/profile/avatar`, `PATCH /api/auth/credentials`, `PATCH /api/auth/password`, `DELETE /api/account`

ทุกคำสั่ง SQL ใช้ parameter binding; API ตรวจเจ้าของรายการก่อนแก้ไขหรือลบ session และข้อมูลผู้ใช้ถูกลบตาม foreign key เมื่อปิดบัญชี

ทดสอบการกู้รหัสผ่านกับ MySQL ที่ migrate แล้วได้โดยตั้ง `KEBNOI_TEST_DSN` เป็น DSN ของฐานข้อมูลทดสอบ แล้วรัน `go test ./...` จากโฟลเดอร์ `backend` การทดสอบสร้างและลบบัญชีชั่วคราวของตัวเอง
