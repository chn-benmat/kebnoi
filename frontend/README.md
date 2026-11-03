# เก็บน้อย

เว็บตัวอย่างสำหรับบันทึกรายรับและรายจ่ายของครอบครัว สร้างด้วย Vite, React, TypeScript, Tailwind CSS และ shadcn/ui

## เริ่มต้น

```bash
npm install
npm run dev
```

เปิด URL ที่ Vite แสดง แล้วเลือก **เข้าสู่บัญชีตัวอย่าง** หรือสมัครบัญชีใหม่ รหัสครอบครัวตัวอย่างคือ `2024` (รหัสนี้ใช้ได้เฉพาะข้อมูลในเบราว์เซอร์เดียวกัน)

```bash
npm run build
npm run lint
node --experimental-strip-types --test tests/domain.test.ts
```

## โครงสร้าง

- `src/domain` — ชนิดข้อมูลและกฎการคำนวณช่วงเวลาและรหัสครอบครัว
- `src/data` — ข้อมูลตัวอย่างและการเก็บข้อมูลใน localStorage
- `src/components` และ `src/App.tsx` — หน้าจอและการโต้ตอบ
- `tokens.css` — สีและฟอนต์ของหน้าจอ

## ข้อจำกัดของข้อมูลจำลอง

บัญชี รหัสผ่าน รูปโปรไฟล์ และรายการทั้งหมดเก็บใน localStorage ของเบราว์เซอร์ ไม่ได้เชื่อม backend หรือแชร์ข้ามอุปกรณ์ และการล้างข้อมูลเว็บไซต์จะลบข้อมูลเหล่านี้ ระบบนี้จำลองการเข้าสู่ระบบเท่านั้น รหัสผ่านไม่ได้รับการป้องกันสำหรับใช้งานจริง จึงไม่ควรใช้รหัสผ่านจริง ฟังก์ชันลืมรหัสผ่านไม่ส่งอีเมลจริง

---

## Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
