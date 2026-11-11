import { watch } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuth } from './composables/useAuth.js'

const page = (name, title, component, path = `/${name}`, admin = false) => ({
  name, path, component, meta:{ auth:true, ...(admin ? { admin:true } : {}), title },
})

export const routes = [
  { name:'signin', path:'/signin', component:() => import('./views/SignIn.vue') },
  page('home', 'Home', () => import('./views/Home.vue')),
  page('book', 'Book a court', () => import('./views/BookFlow.vue')),
  page('booking/:id', 'Booking detail', () => import('./views/BookingDetail.vue'), '/booking/:id'),
  page('bookings', 'My bookings', () => import('./views/MyBookings.vue')),
  page('borrow', 'Borrow equipment', () => import('./views/Borrow.vue')),
  page('club', 'Club and contact', () => import('./views/Club.vue')),
  page('profile', 'Profile', () => import('./views/Profile.vue')),
  page('admin-today', 'Today', () => import('./views/admin/AdminToday.vue'), '/admin-today', true),
  page('admin-bookings', 'Bookings', () => import('./views/admin/AdminBookings.vue'), '/admin-bookings', true),
  page('admin-courts', 'Courts', () => import('./views/admin/AdminCourts.vue'), '/admin-courts', true),
  page('admin-equipment', 'Equipment', () => import('./views/admin/AdminEquipment.vue'), '/admin-equipment', true),
  page('admin-members', 'Members and log', () => import('./views/admin/AdminMembers.vue'), '/admin-members', true),
  { path:'/:pathMatch(.*)*', redirect:{ name:'home' } },
]

export function guard(to, { session, profile }) {
  if ((to.meta?.auth || to.meta?.admin) && (!session || !profile)) return { name:'signin' }
  if (to.meta?.admin && profile.role !== 'admin') return { name:'home' }
  if (to.name === 'signin' && session && profile) return { name:'home' }
  return true
}

const router = createRouter({ history:createWebHashHistory(import.meta.env.BASE_URL), routes })
let watchingAuth = false
router.beforeEach(async to => {
  const auth = useAuth()
  await auth.ready
  if (!watchingAuth) {
    watchingAuth = true
    watch([auth.session, auth.profile], ([session, profile]) => {
      const current = router.currentRoute.value
      if (!session && current.meta.auth) void router.replace({ name:'signin' })
      else if (profile && current.meta.admin && profile.role !== 'admin') void router.replace({ name:'home' })
    })
  }
  return guard(to, { session:auth.session.value, profile:auth.profile.value })
})
router.afterEach((to, _from, failure) => {
  if (failure) return
  const auth = useAuth()
  if (to.meta.admin && auth.isAdmin.value) auth.mode.value = 'admin'
  else if (to.name !== 'book' && to.name !== 'booking/:id') auth.mode.value = 'student'
})

export default router
