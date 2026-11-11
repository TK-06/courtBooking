import { afterEach, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useToast } from '../../src/composables/useToast.js'
import Toast from '../../src/components/Toast.vue'
afterEach(() => vi.useRealTimers())
test('singleton toast announces text and restarts its 2.8 second timer', async () => {
  vi.useFakeTimers()
  const first = useToast()
  const second = useToast()
  const w = mount(Toast)
  expect(first.message).toBe(second.message)
  first.show('Booked')
  await w.vm.$nextTick()
  expect(w.find('[aria-live="polite"]').text()).toBe('Booked')
  vi.advanceTimersByTime(2000)
  second.show('Cancelled')
  vi.advanceTimersByTime(800)
  expect(first.message.value).toBe('Cancelled')
  vi.advanceTimersByTime(2000)
  expect(first.message.value).toBe('')
  w.unmount()
})
