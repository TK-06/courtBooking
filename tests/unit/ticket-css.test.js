import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The ticket allows overflow-wrap:anywhere, so on a narrow phone a long title
// squeezed the date column until "13" broke into "1" over "3".
const css = readFileSync(resolve(__dirname, '../../src/styles/base.css'), 'utf8')
const rule = selector => css.match(new RegExp('^\\' + selector + '\\{([^}]*)\\}', 'm'))?.[1] ?? ''

test('ticket date column never shrinks', () => {
  expect(rule('.t-date')).toContain('flex:0 0 auto')
})

test('ticket day number stays on one line', () => {
  expect(rule('.t-day')).toContain('white-space:nowrap')
  expect(rule('.t-day')).toContain('overflow-wrap:normal')
})
