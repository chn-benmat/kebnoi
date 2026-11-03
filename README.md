# เก็บน้อย

เว็บบันทึกรายรับและรายจ่ายของครอบครัว ใช้ React/Vite, Go/Fiber และ Supabase สำหรับ Auth กับ Database

## โครงสร้าง

```text
backend/
  cmd/api/          จุดเริ่ม API
  internal/
    auth/           ตรวจ Supabase access token
    config/         โหลด environment
    domain/         แบบข้อมูลที่ API ใช้
    httpapi/        routes และ HTTP handlers
    store/          อ่านเขียนผ่าน Supabase Data API
  schema.sql        ตาราง ดัชนี และ RLS สำหรับ Supabase
frontend/src/data/api.ts  จุดเชื่อม Auth และ Go API
```

## ตั้งค่าครั้งแรก

1. เปิด Email provider ใน Supabase ที่ **Authentication → Providers → Email**
2. ถ้าโปรเจกต์ยังไม่มีตาราง `public.profiles` ของระบบอื่น ให้รัน [backend/schema.sql](backend/schema.sql) หนึ่งครั้งใน **SQL Editor**; หากมี `public.profiles` อยู่แล้ว ให้รัน [backend/migration_kebnoi_supabase.sql](backend/migration_kebnoi_supabase.sql) แทน เพื่อสร้างตารางชื่อ `kebnoi_*` โดยไม่แก้ตารางเดิม
3. คัดลอก `frontend/.env.example` เป็น `frontend/.env.local` และใส่ Supabase URL กับ Publishable key
4. คง `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ที่มีอยู่ และตรวจว่า `FRONTEND_ORIGIN=http://localhost:5173`
5. ตั้ง Site URL และ redirect URL ใน **Authentication → URL Configuration**

ห้ามนำ `SUPABASE_SERVICE_ROLE_KEY` ไปไว้ในตัวแปร `VITE_*` หรือส่งไปหน้าบ้าน ไฟล์ `.env.local` ต้องไม่ commit

## เริ่มระบบในเครื่อง

จากโฟลเดอร์ `backend`:

```powershell
go run ./cmd/api
```

จากโฟลเดอร์ `frontend`:

```powershell
npm install
npm run dev
```

หน้าบ้านสมัคร/เข้าสู่ระบบผ่าน Supabase Auth ส่วน Go API ตรวจ access token แล้วอ่านเขียนตารางผ่าน Supabase Data API (`/rest/v1`). ไม่ต้องตั้ง `DATABASE_URL` หรือเชื่อม Postgres โดยตรง ทุก endpoint ใต้ `/api` ยกเว้น `/api/health` ต้องมี `Authorization: Bearer <access token>`

## API ที่มีให้

- `GET /api/health`, `GET /api/bootstrap`
- `POST /api/families`, `POST /api/families/join`, `POST /api/families/leave`
- `GET/POST /api/transactions`, `PATCH/DELETE /api/transactions/:id`
- `PATCH /api/profile`, `DELETE /api/account`

RLS เปิดไว้บนตารางแอป; สิทธิ์ `anon` และ `authenticated` ถูกเพิกถอน ส่วน Go ใช้ `SUPABASE_SERVICE_ROLE_KEY` ฝั่งเซิร์ฟเวอร์เพื่อเรียก Data API และตรวจเจ้าของรายการก่อนแก้ไขหรือลบ คีย์นี้ห้ามส่งไปเบราว์เซอร์ ตรวจว่า Data API เปิดใช้งานและ schema `public` ถูก expose ใน Dashboard ด้วย

การยืนยันอีเมลและกู้รหัสผ่านทำผ่านการตั้งค่า Supabase Auth ส่วนอัปโหลดรูปโปรไฟล์ต้องตั้งค่า Supabase Storage เพิ่มก่อนใช้งาน
