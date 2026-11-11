import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './styles/tokens.css'
import './styles/base.css'

const base = import.meta.env.BASE_URL
document.documentElement.style.setProperty('--logo-full', `url("${base}logo-full.png")`)
document.documentElement.style.setProperty('--logo-mark', `url("${base}logo-mark.png")`)

createApp(App).use(router).mount('#app')
