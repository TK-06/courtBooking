import { vi } from 'vitest'
vi.mock('../../src/lib/supabase.js', () => ({ supabase:{} }))
import { mount } from '@vue/test-utils'
import App from '../../src/App.vue'
test('app mounts with a router view', () => {
  const w = mount(App, { global: { stubs: ['router-view'] } })
  expect(w.html()).toContain('router-view')
})
