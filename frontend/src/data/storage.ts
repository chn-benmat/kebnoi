import { localDate, type Database } from '../domain/model'

const KEY = 'kebnoi-mock-v1'
function daysAgo(days: number) { const date = new Date(); date.setDate(date.getDate() - days); return localDate(date) }
function seed(): Database {
  return {
    currentUserId: null,
    families: [{ id: 'family-demo', name: 'บ้านเก็บเก่ง', code: '2024' }],
    users: [
      { id: 'user-demo', name: 'มิน', email: 'min@example.com', password: '123456', familyId: 'family-demo' },
      { id: 'user-mom', name: 'คุณแม่', email: 'mom@example.com', password: '123456', familyId: 'family-demo' },
      { id: 'user-dad', name: 'คุณพ่อ', email: 'dad@example.com', password: '123456', familyId: 'family-demo' },
    ],
    transactions: [
      { id: '1', userId: 'user-demo', familyId: 'family-demo', kind: 'expense', date: daysAgo(0), recordedHour: 10, description: 'ชานมไข่มุก', amount: 85 },
      { id: '2', userId: 'user-mom', familyId: 'family-demo', kind: 'expense', date: daysAgo(0), recordedHour: 13, description: 'ของเข้าบ้าน', amount: 560 },
      { id: '3', userId: 'user-demo', familyId: 'family-demo', kind: 'income', date: daysAgo(1), description: 'เงินค่าขนม', amount: 1500 },
      { id: '4', userId: 'user-dad', familyId: 'family-demo', kind: 'expense', date: daysAgo(2), description: 'อาหารเย็น', amount: 320 },
      { id: '5', userId: 'user-mom', familyId: 'family-demo', kind: 'income', date: daysAgo(3), description: 'เงินเดือน', amount: 15000 },
      { id: '6', userId: 'user-demo', familyId: 'family-demo', kind: 'expense', date: daysAgo(4), description: 'อุปกรณ์การเรียน', amount: 240 },
      { id: '7', userId: 'user-dad', familyId: 'family-demo', kind: 'income', date: daysAgo(5), description: 'รายได้พิเศษ', amount: 3200 },
      { id: '8', userId: 'user-mom', familyId: 'family-demo', kind: 'expense', date: daysAgo(6), description: 'ตลาดนัดวันหยุด', amount: 780 },
    ],
  }
}
export function loadDatabase(): Database {
  try { const saved = localStorage.getItem(KEY); return saved ? JSON.parse(saved) as Database : seed() } catch { return seed() }
}
export function saveDatabase(db: Database) { localStorage.setItem(KEY, JSON.stringify(db)) }
