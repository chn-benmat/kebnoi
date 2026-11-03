export type Kind = 'income' | 'expense'
export type Period = 'today' | 'week' | 'month'
export interface User { id: string; name: string; email: string; avatar?: string; familyId?: string }
export interface Family { id: string; name: string; code: string }
export interface Transaction { id: string; userId: string; familyId: string; kind: Kind; date: string; description: string; amount: number; recordedHour?: number }
export interface Database { users: User[]; families: Family[]; transactions: Transaction[]; currentUserId: string | null; loading?: boolean }

export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const money = (value: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
export function inPeriod(date: string, period: Period, now = new Date()) {
  const today = localDate(now)
  if (date > today) return false
  if (period === 'today') return date === today
  if (period === 'month') return date.startsWith(today.slice(0, 7))
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  return date >= localDate(start)
}
export function makeCode(families: Family[]) {
  const available = Array.from({ length: 10000 }, (_, index) => String(index).padStart(4, '0')).filter(code => !families.some(family => family.code === code))
  if (!available.length) throw new Error('ไม่มีรหัสครอบครัวว่าง')
  return available[Math.floor(Math.random() * available.length)]
}

export function leaveFamily(db: Database, userId: string): Database {
  return { ...db, users: db.users.map(user => user.id === userId ? { ...user, familyId: undefined } : user) }
}

export function spendingRanking(users: User[], familyId: string, transactions: Transaction[]) {
  const totals = new Map<string, number>()
  for (const item of transactions) {
    if (item.familyId === familyId && item.kind === 'expense') totals.set(item.userId, (totals.get(item.userId) ?? 0) + item.amount)
  }
  return users.filter(user => user.familyId === familyId || totals.has(user.id))
    .map(member => ({ member, amount: totals.get(member.id) ?? 0 }))
    .sort((a, b) => b.amount - a.amount)
}
