import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { inPeriod, leaveFamily, makeCode, spendingRanking, type Database } from '../src/domain/model.ts'
import { curvePath } from '../src/domain/chart.ts'

test('periods include their boundaries and exclude future transactions', () => {
  const now = new Date(2026, 10, 3, 12)
  assert.equal(inPeriod('2026-11-03', 'today', now), true)
  assert.equal(inPeriod('2026-11-02', 'today', now), false)
  assert.equal(inPeriod('2026-10-28', 'week', now), true)
  assert.equal(inPeriod('2026-10-27', 'week', now), false)
  assert.equal(inPeriod('2026-11-01', 'month', now), true)
  assert.equal(inPeriod('2026-10-31', 'month', now), false)
  assert.equal(inPeriod('2026-11-04', 'month', now), false)
})

test('family codes are four digits and do not reuse an existing code', () => {
  const families = Array.from({ length: 9999 }, (_, i) => ({ id: String(i), name: 'test', code: String(i).padStart(4, '0') }))
  assert.equal(makeCode(families), '9999')
})

test('leaving a family keeps transactions with their original family and ranking', () => {
  const db: Database = {
    currentUserId: 'a', families: [{ id: 'f', name: 'Family', code: '1234' }],
    users: [{ id: 'a', name: 'A', email: 'a@example.com', password: '123456', familyId: 'f' }, { id: 'b', name: 'B', email: 'b@example.com', password: '123456', familyId: 'f' }],
    transactions: [{ id: 't', userId: 'a', familyId: 'f', date: '2026-11-03', kind: 'expense', amount: 100, description: 'test' }],
  }
  const next = leaveFamily(db, 'a')
  assert.equal(next.users[0].familyId, undefined)
  assert.equal(next.users[1].familyId, 'f')
  assert.deepEqual(next.transactions, db.transactions)
  assert.deepEqual(spendingRanking(next.users, 'f', next.transactions).map(({ member, amount }) => [member.id, amount]), [['a', 100], ['b', 0]])
  assert.equal(db.users[0].familyId, 'f')
})

test('curved chart passes through values without overshooting and handles one point', () => {
  assert.equal(curvePath([0, 100, 0], 100), 'M 0 90 C 25 90, 25 15, 50 15 C 75 15, 75 90, 100 90')
  assert.equal(curvePath([50], 100), 'M 0 52.5 H 100')
  assert.equal(curvePath([], 100), '')
})
