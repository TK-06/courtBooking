import { afterEach, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ProgramPicker from '../../src/components/ProgramPicker.vue'

const ORDER = [
  'ADME', 'AERO', 'ChPE', 'ICE', 'NANO', 'RAI', 'SEMI',
  'AUTO', 'CHE', 'CE', 'CP', 'CEDT', 'EE', 'ENV', 'GEO', 'IE', 'ME', 'MT', 'MP', 'NRE', 'SV',
]
const mounted = []
function render(props = {}) {
  const w = mount(ProgramPicker, { props:{ modelValue:'', ...props }, attachTo:document.body })
  mounted.push(w)
  return w
}
afterEach(() => mounted.splice(0).forEach(w => w.unmount()))
const trigger = w => w.find('#f-program')
const dialog = w => w.find('[role="dialog"]')
const search = w => w.find('input[aria-label="Search programs"]')
const codes = w => w.findAll('.prog-opt').map(o => o.find('.prog-code').text())
async function open(w) {
  await trigger(w).trigger('click')
  await nextTick()
}

test('trigger is a dialog button that says what to do until a program is chosen', () => {
  const w = render()
  expect(trigger(w).element.tagName).toBe('BUTTON')
  expect(trigger(w).attributes('type')).toBe('button')
  expect(trigger(w).attributes('aria-haspopup')).toBe('dialog')
  expect(trigger(w).text()).toContain('Choose your program')
  expect(dialog(w).exists()).toBe(false)
})

test('trigger shows the code badge, full name and program kind', () => {
  const ise = render({ modelValue:'ICE' })
  expect(ise.find('.pp-badge').text()).toBe('ICE')
  expect(trigger(ise).text()).toContain('Information and Communication Engineering')
  expect(trigger(ise).text()).toContain('ISE · international program')
  const regular = render({ modelValue:'CP' })
  expect(regular.find('.pp-badge').text()).toBe('CP')
  expect(trigger(regular).text()).toContain('Computer Engineering')
  expect(trigger(regular).text()).toContain('Regular program')
})

test('opening shows an accessible dialog with 21 options, ISE first, and focuses the search box', async () => {
  const w = render()
  await open(w)
  const sheet = dialog(w)
  expect(sheet.exists()).toBe(true)
  expect(sheet.attributes('aria-modal')).toBe('true')
  const heading = w.find('#' + sheet.attributes('aria-labelledby'))
  expect(heading.text()).toBe('Your program')
  expect(sheet.text()).toContain('Faculty of Engineering · 21 programs')
  expect(w.findAll('button').some(b => b.text() === 'Done')).toBe(true)
  expect(search(w).attributes('placeholder')).toBe('Search, e.g. computer or AERO')
  expect(document.activeElement).toBe(search(w).element)
  expect(w.findAll('.prog-opt')).toHaveLength(21)
  expect(codes(w)).toEqual(ORDER)
  expect(w.findAll('.prog-opt').every(o => o.attributes('type') === 'button')).toBe(true)
  expect(w.findAll('.pp-group-h').map(h => h.text())).toEqual([
    expect.stringContaining('ISE · International School'),
    expect.stringContaining('Regular programs'),
  ])
  expect(w.find('.prog-opt').text()).toContain('Automotive Design and Manufacturing Engineering')
})

test('search filters by code or name and an empty result explains how to find a program', async () => {
  const w = render()
  await open(w)
  await search(w).setValue('computer')
  expect(codes(w)).toEqual(['CP', 'CEDT'])
  expect(w.findAll('.pp-group-h')).toHaveLength(1)
  await search(w).setValue('aero')
  expect(codes(w)).toEqual(['AERO'])
  await search(w).setValue('zzq')
  expect(w.findAll('.prog-opt')).toHaveLength(0)
  expect(w.text()).toContain('No program matches “zzq”. Try the short code, like ICE or CEDT.')
  await search(w).setValue('')
  expect(w.findAll('.prog-opt')).toHaveLength(21)
  expect(w.text()).not.toContain('No program matches')
})

test('the selected program is pressed and marked with a check', async () => {
  const w = render({ modelValue:'RAI' })
  await open(w)
  const pressed = w.findAll('.prog-opt').filter(o => o.attributes('aria-pressed') === 'true')
  expect(pressed.map(o => o.find('.prog-code').text())).toEqual(['RAI'])
  expect(pressed[0].find('svg').exists()).toBe(true)
  expect(w.findAll('.prog-opt').filter(o => o.attributes('aria-pressed') === 'false')).toHaveLength(20)
})

test('choosing an option emits its code, closes the dialog and returns focus to the trigger', async () => {
  const w = render()
  await open(w)
  await w.findAll('.prog-opt').find(o => o.find('.prog-code').text() === 'AERO').trigger('click')
  await nextTick()
  expect(w.emitted('update:modelValue')).toEqual([['AERO']])
  expect(dialog(w).exists()).toBe(false)
  expect(document.activeElement).toBe(trigger(w).element)
})

test('Escape closes without choosing and returns focus to the trigger', async () => {
  const w = render({ modelValue:'ICE' })
  await open(w)
  await search(w).trigger('keydown', { key:'Escape' })
  await nextTick()
  expect(dialog(w).exists()).toBe(false)
  expect(w.emitted('update:modelValue')).toBeUndefined()
  expect(document.activeElement).toBe(trigger(w).element)
})

test('the scrim and Done button also close it, and reopening starts with a clear search', async () => {
  const w = render()
  await open(w)
  await search(w).setValue('nano')
  await w.find('.pp-scrim').trigger('click')
  expect(dialog(w).exists()).toBe(false)
  await open(w)
  expect(search(w).element.value).toBe('')
  expect(w.findAll('.prog-opt')).toHaveLength(21)
  await w.findAll('button').find(b => b.text() === 'Done').trigger('click')
  expect(dialog(w).exists()).toBe(false)
  expect(w.emitted('update:modelValue')).toBeUndefined()
})
