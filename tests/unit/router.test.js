import { test, expect, vi } from 'vitest'
vi.mock('../../src/lib/supabase.js', () => ({ supabase:{} }))
import { guard, routes } from '../../src/router.js'

test('requires a session for protected routes', () => expect(guard({meta:{auth:true}}, {session:null})).toEqual({name:'signin'}))
test('requires admin role', () => expect(guard({meta:{admin:true}}, {session:{}, profile:{role:'student'}})).toEqual({name:'home'}))
test('signed-in student skips sign-in', () => expect(guard({name:'signin'}, {session:{}, profile:{role:'student'}})).toEqual({name:'home'}))
test('unauthenticated admin route goes to sign-in', () => expect(guard({meta:{admin:true}}, {session:null})).toEqual({name:'signin'}))
test('admin may open admin routes', () => expect(guard({meta:{admin:true}}, {session:{}, profile:{role:'admin'}})).toBe(true))
test('session without profile cannot open protected content', () => expect(guard({meta:{auth:true}}, {session:{}, profile:null})).toEqual({name:'signin'}))
test('all planned routes exist with protected metadata', () => {
  const names = ['signin','home','book','booking/:id','bookings','borrow','club','profile','admin-today','admin-bookings','admin-courts','admin-equipment','admin-members']
  expect(routes.filter(r => r.name).map(r => r.name)).toEqual(names)
  expect(routes.filter(r => r.name && r.name !== 'signin').every(r => r.meta.auth)).toBe(true)
  expect(routes.filter(r => r.name?.startsWith('admin-')).every(r => r.meta.admin)).toBe(true)
})
