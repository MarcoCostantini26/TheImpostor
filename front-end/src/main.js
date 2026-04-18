import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import router from './router'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Toast, {
  position: 'top-right',
  timeout: 4000,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
})

app.mount('#app')