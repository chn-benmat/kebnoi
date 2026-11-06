import type { Database, Family, Transaction, User } from "../domain/model";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");
let authenticated = false;

class ApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

function apiError(message: string) {
  return new ApiError(message || "เชื่อมต่อระบบไม่สำเร็จ");
}

async function responseValue<T>(
  response: Response,
  failureMessage: string,
): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new ApiError(body.error || failureMessage, response.status);
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
      credentials: "include",
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
  await publicRequest<void>("/auth/login", { email, password });
  authenticated = true;
  return bootstrap();
}

export async function signUp(name: string, email: string, password: string) {
  await publicRequest<void>("/auth/signup", { name, email, password });
  authenticated = true;
  return bootstrap();
}

export function checkResetEmail(email: string) {
  return publicRequest<void>("/auth/forgot-password", { email });
}

export function resetPassword(email: string, newPassword: string) {
  return publicRequest<void>("/auth/reset-password", {
    email,
    new_password: newPassword,
  });
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
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export async function signOut() {
  await publicRequest<void>("/auth/logout", {});
  authenticated = false;
}

export function hasSession() {
  return authenticated;
}

export async function restoreSession(): Promise<Database | null> {
  try {
    const data = await bootstrap();
    authenticated = true;
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      authenticated = false;
      return null;
    }
    throw error;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const failureMessage = path.startsWith("/transactions")
    ? "บันทึกรายการไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"
    : path === "/profile" || path === "/auth/credentials"
      ? "บันทึกข้อมูลโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง"
      : path === "/families" || path.startsWith("/families/")
        ? "ดำเนินการกับครอบครัวไม่สำเร็จ กรุณาลองอีกครั้ง"
        : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  try {
    const response = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
    return await responseValue<T>(response, failureMessage);
  } catch (error) {
    if (error instanceof TypeError) throw apiError(failureMessage);
    throw error;
  }
}

export function bootstrap() {
  return request<Database>("/bootstrap");
}
export function createFamily(name: string) {
  return request<Family>("/families", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
export function joinFamily(code: string) {
  return request<Family>("/families/join", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
export function leaveFamily() {
  return request<void>("/families/leave", { method: "POST" });
}
export function createTransaction(
  data: Pick<Transaction, "kind" | "description" | "amount" | "date">,
) {
  return request<Transaction>("/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export function updateTransaction(
  id: string,
  data: Pick<Transaction, "kind" | "description" | "amount" | "date">,
) {
  return request<Transaction>(`/transactions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
export function deleteTransaction(id: string) {
  return request<void>(`/transactions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
export function updateProfile(name: string) {
  return request<User>("/profile", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
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
  authenticated = false;
}
export function emptyDatabase(): Database {
  return { users: [], families: [], transactions: [], currentUserId: null };
}
