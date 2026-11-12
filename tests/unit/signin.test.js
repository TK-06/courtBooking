import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const fake = vi.hoisted(() => ({ signIn:vi.fn(), signUp:vi.fn(), replace:vi.fn() }))
vi.mock('../../src/lib/supabase.js', () => ({ supabase:{} }))
vi.mock('../../src/composables/useAuth.js', () => ({ useAuth:() => ({ signIn:fake.signIn, signUp:fake.signUp, error:ref('') }) }))
vi.mock('vue-router', () => ({ useRouter:() => ({ replace:fake.replace }) }))
import SignIn from '../../src/views/SignIn.vue'
import { MESSAGES } from '../../src/lib/rules.js'
import { OTHER_FACULTIES } from '../../src/lib/programs.js'

const mounted = []
const render = () => { const w = mount(SignIn); mounted.push(w); return w }
beforeEach(() => {
  vi.clearAllMocks()
  fake.signIn.mockResolvedValue({ session:{ user:{ id:'a' } } })
  fake.signUp.mockResolvedValue({ session:{ user:{ id:'u' } } })
})
afterEach(() => mounted.splice(0).forEach(w => w.unmount()))

const button = (w, text) => w.findAll('button').find(b => b.text() === text)
const alertText = w => w.find('[role="alert"]').text()
async function fillSignIn(w, login = '6638012321', pass = 'password') {
  await w.find('#f-login').setValue(login)
  await w.find('#f-pass').setValue(pass)
}
async function createTab(w) {
  await w.findAll('[role="tab"]')[1].trigger('click')
  await w.find('#f-name').setValue('Napat Srisuk')
  await w.find('#f-sid').setValue('6638012321')
}
async function pickProgram(w, code) {
  await w.find('#f-program').trigger('click')
  await w.findAll('.prog-opt').find(o => o.find('.prog-code').text() === code).trigger('click')
}
const SIGN_UP = {
  fullName:'Napat Srisuk', studentId:'6638012321', faculty:'Engineering', program:'ICE', year:1,
  email:'6638012321@student.chula.ac.th', password:'password',
}

// --- sign in ---------------------------------------------------------------
test('the sign-in tab asks for one login, a password and shows the club copy', () => {
  const w = render()
  const tabs = w.findAll('[role="tab"]')
  expect(tabs.map(t => t.text())).toEqual(['Sign in', 'Create account'])
  expect(tabs[0].attributes('aria-selected')).toBe('true')
  expect(w.find('h1').text()).toBe('Book a court at CUB 13.')
  expect(w.find('.si-art').text()).toContain('Intania Tennis Club')
  expect(w.find('.si-art').text()).toContain('CUB 13 · open 08:00–22:00')
  expect(w.text()).not.toContain('sample data')
  expect(w.text()).toContain('Student project for an ISE course assignment.')
  expect(w.text()).toContain('2 courts · up to 2 hours a day · book 14 days ahead')
  const login = w.find('#f-login')
  expect(w.find('label[for="f-login"]').text()).toBe('Student ID or Chula email')
  expect(login.attributes()).toMatchObject({ autocomplete:'username', placeholder:'6638012321', autocapitalize:'off', spellcheck:'false' })
  expect(w.text()).toContain('Your 10-digit ID is enough. Club admins sign in with their email.')
  expect(w.find('#f-pass').attributes('autocomplete')).toBe('current-password')
  expect(w.find('[type="submit"]').text()).toBe('Sign in')
  expect(w.find('#f-email').exists()).toBe(false)
  expect(w.find('#f-name').exists()).toBe(false)
})

test('a 10-digit ID signs in and shows which Chula address it will use', async () => {
  const w = render()
  expect(w.find('.si-chip').exists()).toBe(false)
  await w.find('#f-login').setValue('663801232')
  expect(w.find('.si-chip').exists()).toBe(false)
  await fillSignIn(w)
  expect(w.find('.si-chip').text()).toBe('Signing in as 6638012321@student.chula.ac.th')
  await w.find('form').trigger('submit')
  await flushPromises()
  expect(fake.signIn).toHaveBeenCalledWith('6638012321', 'password')
  expect(fake.replace).toHaveBeenCalledWith({ name:'home' })
})

test('an email login, including a non-Chula admin email, is passed through and shows no chip', async () => {
  const w = render()
  await fillSignIn(w, 'admin@example.com')
  expect(w.find('.si-chip').exists()).toBe(false)
  await w.find('form').trigger('submit')
  await flushPromises()
  expect(fake.signIn).toHaveBeenCalledWith('admin@example.com', 'password')
  expect(fake.replace).toHaveBeenCalledWith({ name:'home' })
})

test('an invalid login or a short password shows an inline alert and does not call sign-in', async () => {
  const w = render()
  await fillSignIn(w, 'napat')
  await w.find('form').trigger('submit')
  expect(alertText(w)).toBe(MESSAGES.login)
  expect(w.find('[role="alert"]').classes()).toContain('err')
  await fillSignIn(w, '6638012321', 'short')
  await w.find('form').trigger('submit')
  expect(alertText(w)).toBe(MESSAGES.password)
  expect(fake.signIn).not.toHaveBeenCalled()
  await fillSignIn(w, '66380123', 'password')
  await w.find('form').trigger('submit')
  expect(alertText(w)).toBe(MESSAGES.login)
})

test('the password can be shown and hidden with a pressed toggle', async () => {
  const w = render()
  const toggle = w.find('.pw-toggle')
  expect(toggle.attributes('type')).toBe('button')
  expect(toggle.text()).toBe('Show')
  expect(toggle.attributes('aria-pressed')).toBe('false')
  expect(w.find('#f-pass').attributes('type')).toBe('password')
  await toggle.trigger('click')
  expect(w.find('.pw-toggle').text()).toBe('Hide')
  expect(w.find('.pw-toggle').attributes('aria-pressed')).toBe('true')
  expect(w.find('#f-pass').attributes('type')).toBe('text')
  await w.find('.pw-toggle').trigger('click')
  expect(w.find('#f-pass').attributes('type')).toBe('password')
})

test('"New here? Create an account" switches to the create-account tab', async () => {
  const w = render()
  expect(w.text()).toContain('New here?')
  await fillSignIn(w, 'napat')
  await w.find('form').trigger('submit')
  expect(w.find('[role="alert"]').exists()).toBe(true)
  await button(w, 'Create an account').trigger('click')
  expect(w.findAll('[role="tab"]')[1].attributes('aria-selected')).toBe('true')
  expect(w.find('#f-name').exists()).toBe(true)
  expect(w.find('[role="alert"]').exists()).toBe(false)
})

test('API errors are visible and repeated submits are blocked while pending', async () => {
  let reject
  fake.signIn.mockReturnValue(new Promise((_resolve, fail) => { reject = fail }))
  const w = render()
  await fillSignIn(w)
  await w.find('form').trigger('submit')
  await w.find('form').trigger('submit')
  expect(fake.signIn).toHaveBeenCalledTimes(1)
  expect(w.find('[type="submit"]').attributes('disabled')).toBeDefined()
  expect(w.find('[type="submit"]').attributes('aria-busy')).toBe('true')
  expect(w.find('form').attributes('aria-busy')).toBe('true')
  reject(new Error('Invalid login credentials'))
  await flushPromises()
  expect(alertText(w)).toBe('Invalid login credentials')
  expect(w.find('[type="submit"]').attributes('disabled')).toBeUndefined()
})

// --- create account --------------------------------------------------------
test('create account is one form on one page with every field', async () => {
  const w = render()
  await w.findAll('[role="tab"]')[1].trigger('click')
  expect(w.findAll('form')).toHaveLength(1)
  expect(w.find('#f-login').exists()).toBe(false)
  expect(w.find('#f-name').attributes('autocomplete')).toBe('name')
  const sid = w.find('#f-sid')
  expect(sid.attributes()).toMatchObject({ inputmode:'numeric', maxlength:'10' })
  expect(w.find('label[for="f-name"]').text()).toBe('Full name')
  expect(w.find('label[for="f-sid"]').text()).toBe('Student ID')
  expect(w.find('label[for="f-faculty"]').text()).toBe('Faculty')
  expect(w.find('label[for="f-year"]').text()).toBe('Year')

  const faculty = w.find('#f-faculty')
  expect(faculty.element.tagName).toBe('SELECT')
  expect(faculty.element.value).toBe('Engineering')
  expect(faculty.element.firstElementChild.textContent).toBe('Engineering')
  const group = faculty.find('optgroup')
  expect(group.attributes('label')).toBe('Other faculties')
  expect(group.findAll('option').map(o => o.text())).toEqual(OTHER_FACULTIES)

  const year = w.find('#f-year')
  expect(year.element.tagName).toBe('SELECT')
  expect(year.findAll('option').map(o => o.text())).toEqual(['1', '2', '3', '4', '5', '6'])
  expect(year.element.value).toBe('1')

  expect(w.find('#f-program').exists()).toBe(true)
  expect(w.find('#f-program').text()).toContain('Choose your program')
  expect(w.find('#f-program-text').exists()).toBe(false)
  const pass = w.find('#f-pass')
  expect(pass.attributes()).toMatchObject({ autocomplete:'new-password', placeholder:'At least 8 characters' })
  expect(w.text()).toContain('By creating an account you agree to the court rules: up to 2 hours a day, cancel at least 2 hours before, bring your own equipment and tidy up after.')
  expect(w.find('[type="submit"]').text()).toBe('Create account')
})

test('the Chula email is derived from the student ID in a read-only row', async () => {
  const w = render()
  await w.findAll('[role="tab"]')[1].trigger('click')
  expect(w.find('#f-email').exists()).toBe(false)
  expect(w.find('.email-ro').text()).toContain('Fills in from your student ID')
  await w.find('#f-sid').setValue('66380')
  expect(w.find('.email-ro').text()).toContain('Fills in from your student ID')
  await w.find('#f-sid').setValue('6638012321')
  expect(w.find('.email-ro').text()).toContain('6638012321@student.chula.ac.th')
  expect(w.text()).toContain('Made from your student ID. Club admin with another address?')
  expect(button(w, 'Use a different email').attributes('type')).toBe('button')
})

test('engineering sign-up sends the faculty, picked program, year and derived email', async () => {
  const w = render()
  await createTab(w)
  await pickProgram(w, 'ICE')
  expect(w.find('#f-program').text()).toContain('Information and Communication Engineering')
  await w.find('#f-year').setValue('3')
  await w.find('#f-pass').setValue('password')
  await w.find('form').trigger('submit')
  await flushPromises()
  expect(fake.signUp).toHaveBeenCalledTimes(1)
  expect(fake.signUp).toHaveBeenCalledWith({ ...SIGN_UP, year:3 })
  expect(fake.replace).toHaveBeenCalledWith({ name:'home' })
})

test('create account validates in order and never calls the server on a client error', async () => {
  const w = render()
  await w.findAll('[role="tab"]')[1].trigger('click')
  await w.find('#f-pass').setValue('password')
  await w.find('form').trigger('submit')
  expect(alertText(w)).toBe(MESSAGES.nameAndId)
  await createTab(w)
  await w.find('#f-pass').setValue('password')
  await w.find('form').trigger('submit')
  expect(alertText(w)).toBe('Choose your program.')
  await pickProgram(w, 'ICE')
  await w.find('#f-pass').setValue('short')
  await w.find('form').trigger('submit')
  expect(alertText(w)).toBe(MESSAGES.password)
  expect(fake.signUp).not.toHaveBeenCalled()
})

test('another faculty swaps the picker for a typed program and sends it', async () => {
  const w = render()
  await createTab(w)
  await w.find('#f-faculty').setValue('Commerce and Accountancy')
  expect(w.find('#f-program').exists()).toBe(false)
  const text = w.find('#f-program-text')
  expect(text.element.tagName).toBe('INPUT')
  expect(text.attributes('placeholder')).toBe('e.g. Accounting')
  expect(w.find('label[for="f-program-text"]').text()).toBe('Program')
  await w.find('#f-pass').setValue('password')
  await w.find('form').trigger('submit')
  expect(alertText(w)).toBe('Choose your program.')
  await text.setValue('  Accounting ')
  await w.find('form').trigger('submit')
  await flushPromises()
  expect(fake.signUp).toHaveBeenCalledWith({ ...SIGN_UP, faculty:'Commerce and Accountancy', program:'Accounting' })
})

test('switching faculty clears the program in both directions', async () => {
  const w = render()
  await createTab(w)
  await pickProgram(w, 'AERO')
  expect(w.find('#f-program').text()).toContain('Aerospace Engineering')
  await w.find('#f-faculty').setValue('Law')
  expect(w.find('#f-program-text').element.value).toBe('')
  await w.find('#f-program-text').setValue('Business Law')
  await w.find('#f-faculty').setValue('Engineering')
  expect(w.find('#f-program').text()).toContain('Choose your program')
  await w.find('#f-faculty').setValue('Law')
  expect(w.find('#f-program-text').element.value).toBe('')
})

test('a different email can be typed for club admins, and the Chula email can be restored', async () => {
  const w = render()
  await createTab(w)
  await pickProgram(w, 'ICE')
  await w.find('#f-pass').setValue('password')
  await button(w, 'Use a different email').trigger('click')
  expect(w.find('.email-ro').exists()).toBe(false)
  const email = w.find('#f-email')
  expect(email.attributes('type')).toBe('email')
  await email.setValue('Admin@Example.com')
  await w.find('form').trigger('submit')
  await flushPromises()
  expect(fake.signUp).toHaveBeenCalledWith({ ...SIGN_UP, email:'Admin@Example.com' })
  fake.signUp.mockClear()
  await button(w, 'Use my Chula email').trigger('click')
  expect(w.find('#f-email').exists()).toBe(false)
  expect(w.find('.email-ro').text()).toContain('6638012321@student.chula.ac.th')
  await w.find('form').trigger('submit')
  await flushPromises()
  expect(fake.signUp).toHaveBeenCalledWith(SIGN_UP)
})

test('a custom email must look like an email; the server decides whether it is allowed', async () => {
  const w = render()
  await createTab(w)
  await pickProgram(w, 'ICE')
  await w.find('#f-pass').setValue('password')
  await button(w, 'Use a different email').trigger('click')
  await w.find('#f-email').setValue('not-an-email')
  await w.find('form').trigger('submit')
  expect(alertText(w)).toBe('Enter a valid email address.')
  expect(fake.signUp).not.toHaveBeenCalled()
  fake.signUp.mockRejectedValue(new Error(MESSAGES.email))
  await w.find('#f-email').setValue('member@example.com')
  await w.find('form').trigger('submit')
  await flushPromises()
  expect(fake.signUp).toHaveBeenCalledTimes(1)
  expect(alertText(w)).toBe(MESSAGES.email)
})

test('email confirmation shows the requested notice and keeps sign-in one tap away', async () => {
  fake.signUp.mockResolvedValue({ session:null })
  const w = render()
  await createTab(w)
  await pickProgram(w, 'ICE')
  await w.find('#f-pass').setValue('password')
  await w.find('form').trigger('submit')
  await flushPromises()
  expect(w.find('[role="status"]').text()).toBe('Check your email to confirm your account, then sign in.')
  expect(fake.replace).not.toHaveBeenCalled()
  expect(w.findAll('[role="tab"]')[0].exists()).toBe(true)
})

// --- layout ----------------------------------------------------------------
test('the court drawing is hidden on phones by a selector that beats the scoped .court-art rule', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/signin.css'), 'utf8')
  const desktopAt = css.indexOf('@media (min-width:900px)')
  expect(desktopAt).toBeGreaterThan(0)
  const phone = css.slice(0, desktopAt)
  const desktop = css.slice(desktopAt)
  // A bare `.si-court{display:none}` loses to CourtArt's `.court-art[data-v-…]{display:block}`.
  expect(phone).toMatch(/\.si-art\s+\.si-court\.court-art\s*\{[^}]*display:\s*none/)
  expect(phone).not.toMatch(/(^|\})\s*\.si-court\s*\{[^}]*display:\s*none/)
  expect(desktop).toMatch(/\.si-art\s+\.si-court\.court-art\s*\{[^}]*display:\s*block/)
})
