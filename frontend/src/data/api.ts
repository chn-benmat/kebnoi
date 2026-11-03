import type { Database, Family, Transaction, User } from '../domain/model'

type Session = { access_token: string; refresh_token: string }
type AuthResult = Session & { expires_in?: number }
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '')
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const SESSION_KEY = 'kebnoi-auth-v1'
let session: Session | null = null
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null } catch { session = null }

function persist(next: Session | null) { session = next; if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next)); else localStorage.removeItem(SESSION_KEY) }
function apiError(message: string) { return new Error(message || 'เชื่อมต่อระบบไม่สำเร็จ') }

async function authRequest(path: string, body: object, method = 'POST') {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw apiError('ยังไม่ได้ตั้งค่า Supabase Auth ใน frontend/.env.local')
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, { method, headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify(body) })
  const result = await response.json().catch(() => ({})) as AuthResult & { msg?: string; message?: string; error_description?: string }
  if (!response.ok) throw apiError(result.msg || result.message || result.error_description || 'ดำเนินการไม่สำเร็จ')
  return result
}

export async function signIn(email: string, password: string) { const result = await authRequest('token?grant_type=password', { email, password }); persist(result); return bootstrap() }
export async function signUp(name: string, email: string, password: string) { const result = await authRequest('signup', { email, password, data: { name } }); if (!result.access_token || !result.refresh_token) return null; persist(result); return bootstrap() }
export async function resetPassword(email: string) { await authRequest('recover', { email }) }
export async function resendConfirmation(email: string) { await authRequest('resend', { type: 'signup', email }) }
export async function updateCredentials(email: string, password?: string) { await authRequest('user', { email, ...(password ? { password } : {}) }, 'PUT') }
export async function signOut() { const old = session; persist(null); if (old && SUPABASE_URL) await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${old.access_token}` } }).catch(() => undefined) }
export function hasSession() { return Boolean(session?.access_token) }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!session) throw apiError('กรุณาเข้าสู่ระบบอีกครั้ง')
  const call = () => fetch(`${API_URL}/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}`, ...options.headers } })
  let response = await call()
  if (response.status === 401 && session?.refresh_token) {
    try { const fresh = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token }); persist(fresh); response = await call() }
    catch { persist(null); throw apiError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่') }
  }
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw apiError(body.error || 'เชื่อมต่อระบบไม่สำเร็จ') }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function bootstrap() { return request<Database>('/bootstrap') }
export function createFamily(name: string) { return request<Family>('/families', { method: 'POST', body: JSON.stringify({ name }) }) }
export function joinFamily(code: string) { return request<Family>('/families/join', { method: 'POST', body: JSON.stringify({ code }) }) }
export function leaveFamily() { return request<void>('/families/leave', { method: 'POST' }) }
export function createTransaction(data: Pick<Transaction, 'kind' | 'description' | 'amount' | 'date'>) { return request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) }) }
export function updateTransaction(id: string, data: Pick<Transaction, 'kind' | 'description' | 'amount' | 'date'>) { return request<Transaction>(`/transactions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }) }
export function deleteTransaction(id: string) { return request<void>(`/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' }) }
export function updateProfile(name: string) { return request<User>('/profile', { method: 'PATCH', body: JSON.stringify({ name }) }) }
export async function deleteAccount() { await request<void>('/account', { method: 'DELETE' }); await signOut() }
export function emptyDatabase(): Database { return { users: [], families: [], transactions: [], currentUserId: null } }
