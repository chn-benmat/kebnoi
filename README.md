# เก็บน้อย (Kebnoi)

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

ระบบยังไม่มีการยืนยันอีเมลหรือกู้คืนรหัสผ่านทางอีเมล หน้า “ลืมรหัสผ่าน” คงไว้เพื่อแจ้งให้ติดต่อผู้ดูแลระบบ

จากโฟลเดอร์ `frontend`:

```powershell
npm install
npm run dev
```

สมัครสมาชิกผ่าน Go API; รหัสผ่านถูกเก็บเป็น bcrypt hash, access token หมดอายุใน 15 นาที และ access/refresh token ถูกเก็บในฐานข้อมูลในรูป hash เส้นทาง Auth เป็น public; เส้นทางข้อมูลและแก้ไขบัญชีต้องมี `Authorization: Bearer <access token>`

## API

- `POST /api/auth/signup`, `POST /api/auth/login`
- `POST /api/auth/refresh`, `POST /api/auth/logout`
- `GET /api/health`, `GET /api/bootstrap`
- `POST /api/families`, `POST /api/families/join`, `POST /api/families/leave`
- `GET/POST /api/transactions`, `PATCH/DELETE /api/transactions/:id`
- `PATCH /api/profile`, `POST /api/profile/avatar`, `PATCH /api/auth/credentials`, `PATCH /api/auth/password`, `DELETE /api/account`

ทุกคำสั่ง SQL ใช้ parameter binding; API ตรวจเจ้าของรายการก่อนแก้ไขหรือลบ session และข้อมูลผู้ใช้ถูกลบตาม foreign key เมื่อปิดบัญชี
