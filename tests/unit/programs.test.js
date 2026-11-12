import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'

const fake = vi.hoisted(() => ({ profile:null, fetchMyBookings:vi.fn(), fetchEvents:vi.fn() }))
vi.mock('../../src/lib/api.js', () => ({ fetchMyBookings:fake.fetchMyBookings, fetchEvents:fake.fetchEvents }))
vi.mock('../../src/composables/useAuth.js', () => ({
  useAuth:() => ({ profile:ref(fake.profile), ready:Promise.resolve(), isAdmin:ref(fake.profile.role === 'admin'), signOut:vi.fn(), setMode:vi.fn() }),
}))
vi.mock('../../src/composables/useToast.js', () => ({ useToast:() => ({ show:vi.fn() }) }))
import {
  ENGINEERING, PROGRAM_GROUPS, PROGRAMS, OTHER_FACULTIES, programByCode, programLabel, searchPrograms,
} from '../../src/lib/programs.js'
import Profile from '../../src/views/Profile.vue'

const ISE = ['ADME', 'AERO', 'ChPE', 'ICE', 'NANO', 'RAI', 'SEMI']
const REGULAR = ['AUTO', 'CHE', 'CE', 'CP', 'CEDT', 'EE', 'ENV', 'GEO', 'IE', 'ME', 'MT', 'MP', 'NRE', 'SV']

test('engineering has 21 programs, the 7 ISE ones first', () => {
  expect(ENGINEERING).toBe('Engineering')
  expect(PROGRAM_GROUPS.map(g => g.id)).toEqual(['ise', 'regular'])
  expect(PROGRAMS.map(p => p.code)).toEqual([...ISE, ...REGULAR])
  expect(PROGRAMS).toHaveLength(21)
  expect(PROGRAMS.filter(p => p.group === 'ise')).toHaveLength(7)
  expect(new Set(PROGRAMS.map(p => p.code)).size).toBe(21)
  expect(OTHER_FACULTIES).toHaveLength(20)
  expect(OTHER_FACULTIES).not.toContain(ENGINEERING)
})

test('programByCode is an exact match or null', () => {
  expect(programByCode('ICE')).toMatchObject({ code:'ICE', name:'Information and Communication Engineering', group:'ise' })
  expect(programByCode('CP')).toMatchObject({ name:'Computer Engineering', group:'regular' })
  for (const miss of ['ice', 'ISE', '', null, undefined, 'Other']) expect(programByCode(miss)).toBeNull()
})

test('programLabel gives the full name for a known code and the raw text otherwise', () => {
  expect(programLabel('AERO')).toBe('Aerospace Engineering')
  expect(programLabel('Accounting')).toBe('Accounting')
  expect(programLabel('')).toBe('')
  expect(programLabel(null)).toBe('')
  expect(programLabel(undefined)).toBe('')
})

test('searchPrograms filters by code or name, case-insensitively, and drops empty groups', () => {
  expect(searchPrograms('')).toEqual(PROGRAM_GROUPS)
  expect(searchPrograms('   ')).toEqual(PROGRAM_GROUPS)
  expect(searchPrograms('aero').map(g => [g.id, g.programs.map(p => p.code)])).toEqual([['ise', ['AERO']]])
  expect(searchPrograms('COMPUTER').map(g => [g.id, g.programs.map(p => p.code)])).toEqual([['regular', ['CP', 'CEDT']]])
  expect(searchPrograms('cedt').flatMap(g => g.programs.map(p => p.code))).toEqual(['CEDT'])
  expect(searchPrograms('engineering').flatMap(g => g.programs)).toHaveLength(21)
  expect(searchPrograms('zzz')).toEqual([])
})

const renderProfile = async profile => {
  fake.profile = profile
  const w = mount(Profile)
  await flushPromises()
  return w
}
const wrappers = []
beforeEach(() => {
  fake.fetchMyBookings.mockResolvedValue([])
  fake.fetchEvents.mockResolvedValue([])
})
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()) })

test('profile shows the full program name for an engineering student', async () => {
  const w = await renderProfile({ id:'u', fullName:'Napat Srisuk', studentId:'6638012321', faculty:'Engineering', program:'ICE', year:3, role:'student' })
  wrappers.push(w)
  expect(w.find('.prof-head .muted').text()).toBe('Information and Communication Engineering, year 3')
})

test('profile without a faculty (older rows) still shows the program and year', async () => {
  const w = await renderProfile({ id:'u', fullName:'Napat Srisuk', studentId:'6638012321', faculty:null, program:'NANO', year:2, role:'student' })
  wrappers.push(w)
  expect(w.find('.prof-head .muted').text()).toBe('Nano Engineering, year 2')
})

test('profile adds the faculty for a non-engineering student', async () => {
  const w = await renderProfile({ id:'u', fullName:'Mali Chai', studentId:'6638012322', faculty:'Commerce and Accountancy', program:'Accounting', year:1, role:'student' })
  wrappers.push(w)
  expect(w.find('.prof-head .muted').text()).toBe('Accounting, Commerce and Accountancy, year 1')
})

test('profile still labels admins as club admin', async () => {
  const w = await renderProfile({ id:'a', fullName:'Club Admin', studentId:null, faculty:null, program:null, year:null, role:'admin' })
  wrappers.push(w)
  expect(w.find('.prof-head .muted').text()).toBe('Club admin')
})
