# เก็บหน่อย

React/Vite interface for the Kebnoi family income and expense tracker. Authentication and app data are provided by the Go API; the browser does not connect directly to MySQL.

## Run locally

```bash
npm install
npm run dev
```

The API defaults to `http://localhost:8080`. To use another API address, set `VITE_API_URL` in `.env.local`; see `.env.example`.

## Build

```bash
npm run build
```
