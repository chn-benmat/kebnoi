import type { Database, Family, Transaction, User } from "../domain/model";

type Session = { access_token: string; refresh_token: string; expires_in?: number };
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");
const SESSION_KEY = "kebnoi-mysql-auth-v1";
let session: Session | null = null;
let refreshInFlight: Promise<Session> | null = null;

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Session>;
  return typeof candidate.access_token === "string" && candidate.access_token.length > 0
    && typeof candidate.refresh_token === "string" && candidate.refresh_token.length > 0;
}

try {
  const stored: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  session = isSession(stored) ? stored : null;
  if (stored && !session) localStorage.removeItem(SESSION_KEY);
} catch {
  session = null;
}

function persist(next: Session | null) {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    // Keep the current page authenticated if storage is blocked, and make the
    // persistence problem visible in the browser console.
    console.error("[auth] unable to persist session in localStorage:", error);
  }
}

function apiError(message: string) {
  return new Error(message || "เชื่อมต่อระบบไม่สำเร็จ");
}

async function responseValue<T>(response: Response, failureMessage: string): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw apiError(body.error || failureMessage);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function publicRequest<T>(path: string, body: object): Promise<T> {
  const isLogin = path === "/auth/login";
  const failureMessage = isLogin
    ? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หากยังไม่ได้ให้ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต"
    : path === "/auth/signup"
      ? "ไม่สามารถเชื่อมต่อระบบเพื่อสมัครสมาชิกได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง"
    : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  try {
    const response = await fetch(`${API_URL}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await responseValue<T>(response, failureMessage);
  } catch (error) {
    if (error instanceof TypeError) throw apiError(failureMessage);
    throw error;
  }
}

export async function signIn(email: string, password: string) {
  const result = await publicRequest<Session>("/auth/login", { email, password });
  persist(result);
  return bootstrap();
}

export async function signUp(name: string, email: string, password: string) {
  const result = await publicRequest<Session>("/auth/signup", { name, email, password });
  persist(result);
  return bootstrap();
}

export function updateCredentials(email: string) {
  return request<{ email_changed: boolean }>("/auth/credentials", {
    method: "PATCH",
    body: JSON.stringify({ email }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<void>("/auth/password", {
    method: "PATCH",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function signOut() {
  const previous = session;
  persist(null);
  // Let a token rotation already in progress finish, then revoke the newest
  // refresh token. Otherwise logout could send an obsolete token and leave
  // the server-side session active.
  await refreshInFlight?.catch(() => undefined);
  const refreshToken = session?.refresh_token || previous?.refresh_token;
  persist(null);
  if (refreshToken) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => undefined);
  }
}

export function hasSession() {
  return Boolean(session?.access_token);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!session) throw apiError("กรุณาเข้าสู่ระบบอีกครั้ง");
  const failureMessage = path.startsWith("/transactions")
    ? "บันทึกรายการไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"
    : path === "/profile" || path === "/auth/credentials"
      ? "บันทึกข้อมูลโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง"
      : path === "/families" || path.startsWith("/families/")
        ? "ดำเนินการกับครอบครัวไม่สำเร็จ กรุณาลองอีกครั้ง"
        : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  const call = () => fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: requestHeaders(options.headers, options.body, session!.access_token),
  });
  let response: Response;
  try {
    response = await call();
  } catch (error) {
    if (error instanceof TypeError) throw apiError(failureMessage);
    throw error;
  }
  if (response.status === 401 && session?.refresh_token) {
    try {
      await refreshSession();
      response = await call();
    } catch {
      if (!session?.access_token || !session.refresh_token) {
        throw apiError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      }
      throw apiError("ต่ออายุเซสชันไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  }
  return responseValue<T>(response, failureMessage);
}

function requestHeaders(input: HeadersInit | undefined, body: BodyInit | null | undefined, accessToken: string) {
  const headers = new Headers(input);
  if (!(body instanceof FormData)) headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${accessToken}`);
  return headers;
}

function refreshSession(): Promise<Session> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = session?.refresh_token;
  if (!refreshToken) return Promise.reject(apiError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"));

  refreshInFlight = publicRequest<Session>("/auth/refresh", { refresh_token: refreshToken })
    .then((fresh) => {
      persist(fresh);
      return fresh;
    })
    .catch((error: unknown) => {
      // A different request may already have rotated the token. Do not erase
      // that newer session when this refresh attempt fails with an old token.
      if (session?.refresh_token === refreshToken) persist(null);
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export function bootstrap() {
  return request<Database>("/bootstrap");
}
export function createFamily(name: string) {
  return request<Family>("/families", { method: "POST", body: JSON.stringify({ name }) });
}
export function joinFamily(code: string) {
  return request<Family>("/families/join", { method: "POST", body: JSON.stringify({ code }) });
}
export function leaveFamily() {
  return request<void>("/families/leave", { method: "POST" });
}
export function createTransaction(data: Pick<Transaction, "kind" | "description" | "amount" | "date">) {
  return request<Transaction>("/transactions", { method: "POST", body: JSON.stringify(data) });
}
export function updateTransaction(id: string, data: Pick<Transaction, "kind" | "description" | "amount" | "date">) {
  return request<Transaction>(`/transactions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
}
export function deleteTransaction(id: string) {
  return request<void>(`/transactions/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export function updateProfile(name: string) {
  return request<User>("/profile", { method: "PATCH", body: JSON.stringify({ name }) });
}
export function uploadProfileAvatar(file: File) {
  const body = new FormData();
  body.append("avatar", file);
  return request<User>("/profile/avatar", { method: "POST", body });
}
export function assetURL(path: string | undefined) {
  if (!path) return undefined;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
export async function deleteAccount() {
  await request<void>("/account", { method: "DELETE" });
  persist(null);
}
export function emptyDatabase(): Database {
  return { users: [], families: [], transactions: [], currentUserId: null };
}
